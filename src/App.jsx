import React, { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// DESIGN TOKENS
// ============================================================
const T = {
  abyss:"#080A0E",void:"#0D0F14",shadow:"#12151C",dusk:"#1A1E28",smoke:"#232838",
  gold:"#C8A951",goldDim:"#8A6F2E",red:"#E8341A",teal:"#1ECFB0",tealDim:"#0D7A69",
  purple:"#7B5EA7",paper:"#F0EDE6",ink:"#F0EDE6",inkSec:"#8B8FA8",inkMut:"#4A4F62",
  green:"#2ECC71",amber:"#F39C12",orange:"#E67E22",
};
const PLAYER_COLORS=["#1ECFB0","#C8A951","#E8341A","#2ECC71","#7B5EA7","#E67E22","#3498DB","#E91E63"];
const OPENAI_MODELS=[
  {id:"gpt-4o",label:"GPT-4o",desc:"Fast, smart — recommended",tier:"standard"},
  {id:"gpt-4o-mini",label:"GPT-4o Mini",desc:"Fastest & cheapest",tier:"fast"},
  {id:"gpt-4-turbo",label:"GPT-4 Turbo",desc:"Longer context",tier:"standard"},
  {id:"o1-mini",label:"o1 Mini",desc:"Strong reasoning",tier:"advanced"},
  {id:"o1",label:"o1",desc:"Max intelligence",tier:"advanced"},
];
const DIFFICULTY={
  easy:{id:"easy",label:"Rookie",icon:"🟢",desc:"2 critical clues free. Unlimited hints. Suspects crack fast. 30 min timer.",freeClues:2,unlimitedHints:true,crackMult:0.6,timer:30,reverseQ:2,permadeath:false,lieDetectorForce:true},
  medium:{id:"medium",label:"Detective",icon:"🟡",desc:"Standard. 1 hint per round. Balanced. 20 min timer.",freeClues:0,unlimitedHints:false,crackMult:1.0,timer:20,reverseQ:3,permadeath:false,lieDetectorForce:false},
  hard:{id:"hard",label:"Chief Inspector",icon:"🔴",desc:"No hints. Hard cracking. Wrong accusation = game over. 15 min timer.",freeClues:0,unlimitedHints:false,crackMult:1.8,timer:15,reverseQ:4,permadeath:true,lieDetectorForce:false},
};
const MOODS={
  cooperative:{label:"Cooperative",icon:"😌",color:"#1ECFB0",desc:"Open, gives extra detail"},
  nervous:{label:"Nervous",icon:"😰",color:"#C8A951",desc:"Anxious, prone to slips"},
  defensive:{label:"Defensive",icon:"😤",color:"#E67E22",desc:"Guarded, short answers"},
  hostile:{label:"Hostile",icon:"😠",color:"#E8341A",desc:"Refuses to elaborate"},
};
const getMood=(count,guilty)=>{
  if(count===0)return guilty?"nervous":"cooperative";
  if(count<=2)return guilty?"defensive":"nervous";
  if(count<=4)return guilty?"hostile":"defensive";
  return guilty?"hostile":"cooperative";
};

// ============================================================
// AI ENGINE — OpenAI only
// ============================================================
const AI_ERR="[AI_ERROR]";
const isAIErr=(t)=>!t||t.startsWith(AI_ERR)||(t.startsWith("[")&&t.includes("error"));

async function callAI(prompt,sys,ctx,settings){
  const id="ai_"+Date.now();
  const model=settings.openaiModel||"gpt-4o";
  if(!settings.openaiKey) return AI_ERR+" No OpenAI API key — go to Settings.";
  try{
    const isO1=model.startsWith("o1");
    const messages=isO1
      ?[{role:"user",content:sys+"\n\n"+prompt}]
      :[{role:"system",content:sys||"You power a detective mystery game."},{role:"user",content:prompt}];
    const body={model,messages,max_tokens:isO1?2000:1000};
    if(!isO1)body.temperature=0.85;
    const res=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+settings.openaiKey},
      body:JSON.stringify(body),
    });
    if(!res.ok){
      let eb="";
      try{const ej=await res.json();eb=ej?.error?.message||"";}catch{eb=await res.text().catch(()=>"");}
      if(res.status===401)return AI_ERR+" Invalid API key. Check Settings.";
      if(res.status===429)return AI_ERR+" Rate limit hit. Wait a moment.";
      return AI_ERR+" OpenAI error "+res.status+": "+eb.slice(0,80);
    }
    const data=await res.json();
    const text=data?.choices?.[0]?.message?.content?.trim();
    if(!text)return AI_ERR+" Empty response from model.";
    return text;
  }catch(err){
    return AI_ERR+" "+err.message;
  }
}

function safeJSON(raw,fallback){
  if(!fallback)fallback={};
  if(isAIErr(raw))return Object.assign({},fallback,{_error:raw});
  try{return JSON.parse(raw.replace(/```json|```/g,"").trim());}
  catch{
    const m=raw.match(/\{[\s\S]*\}/);
    if(m)try{return JSON.parse(m[0]);}catch{}
    return Object.assign({},fallback,{_parseError:true,_raw:raw.slice(0,200)});
  }
}

// Voice Library
const VOICE_LIBRARY = [
  {id: "default", name: "Default", gender: "Neutral"},
  {id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "Female"},
  {id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", gender: "Female"},
  {id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "Female"},
  {id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "Male"},
  {id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", gender: "Female"},
  {id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", gender: "Male"},
  {id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "Male"},
];

async function speakText(text, settings, voiceOverride = null){
  if(!settings.voiceEnabled || !settings.elevenLabsKey || isAIErr(text)) return;
  const voiceId = voiceOverride || settings.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM";
  
  try{
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId, {
      method: "POST",
      headers: {"xi-api-key": settings.elevenLabsKey, "Content-Type": "application/json"},
      body: JSON.stringify({text, model_id: "eleven_monolingual_v1"}),
    });
    if(!res.ok) return;
    new Audio(URL.createObjectURL(await res.blob())).play();
  }catch(e){
    console.warn("[TTS]", e.message);
  }
}

// ============================================================
// CASES
// ============================================================
const CASES=[
  {
    id:"gala",title:"The Crimson Gala",setting:"Rooftop Gala — Midnight",
    summary:"A billionaire found dead at his own birthday party. The champagne flute still in his hand.",
    victim:"Victor Harmon, 67 — CEO of Harmon Industries",
    cause:"Cyanide poisoning — targeted single champagne glass",
    killer:"Diana Voss",
    killerReason:"Diana served as Victor's PA for 12 years. Removed from his will last week when she discovered plans to sell the company. She slipped cyanide into his champagne during the 4-minute security camera gap she created herself.",
    narratorIntro:"The city never sleeps, but tonight it holds its breath. Victor Harmon is dead on his own rooftop. And somewhere in this room, someone is already rehearsing their alibi.",
    suspects:[
      {id:"diana",name:"Diana Voss",role:"Personal Assistant",age:34,avatar:"👩‍💼",guilty:true,
       alibi:"Claims she was at the bar the entire time",secret:"Was seen near victim's drink 10 minutes before death",
       dossier:{background:"12-year PA to Victor. Removed from will last week.",associates:"Board of Harmon Industries, estate lawyer",record:"Clean",financials:"$95k salary, maxed credit cards"},
       timeline:[{t:"9:00pm",a:"Arrived with Victor"},{t:"10:30pm",a:"Seen arguing with Victor near suite"},{t:"11:40pm",a:"At bar — unconfirmed"},{t:"11:47pm",a:"CAMERA GAP — 4 minutes"},{t:"11:52pm",a:"Returned visibly flushed, hands shaking"}]},
      {id:"marcus",name:"Marcus Harmon",role:"Son & Heir",age:42,avatar:"👨‍💼",guilty:false,
       alibi:"Was giving a speech on stage — 60 witnesses",secret:"$2.1M gambling debts",
       dossier:{background:"Victor's son. Failing property firm.",associates:"Debt collectors, lawyers",record:"DUI 2018",financials:"$2.1M gambling debt"},
       timeline:[{t:"9:00pm",a:"Arrived late, nervous"},{t:"10:00pm",a:"Speech — 60 witnesses"},{t:"11:30pm",a:"Bar — whiskeys"},{t:"12:00am",a:"Still at bar"}]},
      {id:"elena",name:"Elena Vance",role:"Business Rival",age:55,avatar:"👩‍💼",guilty:false,
       alibi:"Left early — valet confirmed 11:15pm",secret:"Secret merger negotiations with Victor",
       dossier:{background:"CEO of VanceCorp, 20yr rival.",associates:"Wall Street brokers",record:"None",financials:"$340M net worth"},
       timeline:[{t:"9:00pm",a:"Arrived alone"},{t:"11:15pm",a:"Departed — valet confirmed"}]},
      {id:"chef",name:"Chef Remy Blanc",role:"Head Caterer",age:48,avatar:"👨‍🍳",guilty:false,
       alibi:"In kitchen all night — 3 witnesses",secret:"Blackmailed by Victor over a health code violation",
       dossier:{background:"Renowned chef, 7yr Harmon events.",associates:"Kitchen staff",record:"Obstruction 2019",financials:"Restaurant struggling"},
       timeline:[{t:"6:00pm",a:"Setup"},{t:"11:00pm",a:"Kitchen — confirmed"},{t:"12:00am",a:"Still in kitchen"}]},
    ],
    clues:[
      {id:"c1",name:"Cyanide Residue",desc:"Found only in victim's flute — targeted, not accidental.",critical:true,room:"Rooftop Bar",found:false},
      {id:"c2",name:"Broken Nail Fragment",desc:"Acrylic nail near drink station. Matched to Diana's missing thumbnail.",critical:true,room:"Rooftop Bar",found:false},
      {id:"c3",name:"Deleted Calendar Entry",desc:"Victor's phone: deleted meeting 'D.V. — severance terms' for tomorrow.",critical:false,room:"Victim's Suite",found:false},
      {id:"c4",name:"Security Camera Gap",desc:"Footage 11:43-11:47pm near bar was manually looped.",critical:false,room:"Security Office",found:false},
      {id:"c5",name:"Bar Receipt",desc:"Marcus ordered 6 whiskeys 10pm-midnight. Alibi airtight.",critical:false,room:"VIP Lounge",found:false},
      {id:"c6",name:"Valet Log",desc:"Elena's car left 11:15pm — 35 min before time of death.",critical:false,room:"Kitchen Entrance",found:false},
    ],
    rooms:["Rooftop Bar","VIP Lounge","Kitchen Entrance","Security Office","Victim's Suite"],
    witnesses:[
      {id:"w1",name:"Jake Torres",role:"Head Bartender",avatar:"🧑‍🍳",summary:"Worked the bar all night. Saw something he didn't report.",
       statements:[
         {trigger:"general",text:"Mr. Harmon seemed fine early on. But around 11:30pm I noticed Diana at the far end just watching him. Not ordering anything."},
         {trigger:"diana",text:"Diana was here — but not the whole time. I stepped away around 11:40 to restock. When I came back she was at the bar again but her hands were shaking."},
         {trigger:"suspicious",text:"After the police arrived I found a small glass vial under the bar mat. It smelled like bitter almonds. I still have it."},
       ]},
      {id:"w2",name:"Clara Huang",role:"Event Photographer",avatar:"📸",summary:"Shot the whole event with a long lens. People forget she's there.",
       statements:[
         {trigger:"general",text:"Diana was composed all night until about 11:35. She checked her phone and her expression went completely cold."},
         {trigger:"diana",text:"I have a photo timestamped 11:44pm of Diana near the drink station. Her arm is clearly reaching toward the bar."},
         {trigger:"camera",text:"Whoever looped the security footage didn't know about my SD card backup. I still have those four minutes."},
       ]},
    ],
    interrogationQuestions:{
      diana:[{q:"Where exactly were you between 11:40 and 11:50pm?"},{q:"We found a nail fragment near the champagne — is that yours?"},{q:"When did you last speak privately with Victor today?"}],
      marcus:[{q:"How much debt are you carrying right now?"},{q:"Did you know your father was changing the will?"}],
    },
    reverseInterrogation:{
      alibi:"I was reviewing crime scene photographs and interviewing catering staff.",
      secret:"You arrived 20 minutes late and used the service entrance.",
      questions:["Your sign-in shows you used the service entrance tonight — same door the killer likely used. Explain that.","We found your fingerprints on the victim's glass. Why touch key evidence without gloves?","A witness says you argued with the victim three weeks ago. What was that about?","You took 20 minutes longer than protocol to secure the scene. What were you doing?"],
    },
    crossExam:{
      diana:{contradiction:"Diana claims she was at the bar all night — but the camera gap is 11:43-11:47pm, exactly when she says she was standing there.",pressure:"the nail fragment and camera gap",threshold:2},
      marcus:{contradiction:"Marcus says the inheritance timing was terrible — yet he met with an estate lawyer two weeks ago.",pressure:"secret lawyer meetings",threshold:3},
    },
  },
  {
    id:"museum",title:"The Missing Vermeer",setting:"City Modern Art Museum — 2am",
    summary:"A priceless Vermeer disappeared during a gala opening. The motion sensors never triggered.",
    victim:"Girl with a Pearl Earring II — estimated $80M",
    cause:"Inside job — master sensor override, 4-minute window",
    killer:"Noah Park",
    killerReason:"Noah was approached by a private collector 3 months ago. He disabled sensors during a gap between guard rotations and called in the theft himself.",
    narratorIntro:"They say art is eternal. Tonight $80 million worth of eternity walked out the front door. Somebody in this building knew exactly when to move.",
    suspects:[
      {id:"noah",name:"Noah Park",role:"Head of Security",age:38,avatar:"👮",guilty:true,
       alibi:"Claims he was on his scheduled patrol rounds",secret:"Offshore accounts with three unexplained deposits",
       dossier:{background:"15yr security veteran. Former police. IA probe 2019.",associates:"Private collectors, offshore broker",record:"IA investigation — no charges",financials:"Salary $62k. Offshore: $220k unaccounted"},
       timeline:[{t:"8:00pm",a:"Started shift"},{t:"11:50pm",a:"Near sensor terminal"},{t:"11:54pm",a:"4-min sensor disable"},{t:"12:05am",a:"Reported theft himself"}]},
      {id:"curator",name:"Dr. Sofia Chen",role:"Lead Curator",age:51,avatar:"👩‍🎨",guilty:false,
       alibi:"At gala dinner — 8 witnesses",secret:"Forged authentication papers 2022",
       dossier:{background:"20yr museum veteran.",associates:"Art world, auction houses",record:"None",financials:"$110k — clean"},
       timeline:[{t:"7:00pm",a:"Gala setup"},{t:"9:00pm",a:"Donor dinner — 8 witnesses"},{t:"12:10am",a:"First on scene"}]},
      {id:"restorer",name:"Kai Brennan",role:"Art Restorer",age:29,avatar:"🎨",guilty:false,
       alibi:"Left at 10pm — badge confirmed",secret:"Has skills to replicate masterworks",
       dossier:{background:"Prodigy restorer, known copier.",associates:"Private galleries",record:"None",financials:"Freelance"},
       timeline:[{t:"10:07pm",a:"Badge exit — 2hrs before theft"}]},
      {id:"patron",name:"Vivienne Lau",role:"Major Donor",age:63,avatar:"👩‍💼",guilty:false,
       alibi:"At table until midnight — 4 witnesses",secret:"Tried to buy this painting for 5 years",
       dossier:{background:"Billionaire collector. $4M offer declined.",associates:"Art brokers",record:"None",financials:"$1.2B net worth"},
       timeline:[{t:"7:00pm",a:"Arrived"},{t:"11:45pm",a:"Still at table"}]},
    ],
    clues:[
      {id:"c1",name:"Sensor Override Log",desc:"4-min disable at 11:58pm. Only Noah's credentials authorized.",critical:true,room:"Security Center",found:false},
      {id:"c2",name:"Offshore Wire Transfer",desc:"$180k to Noah's account from shell company — 72hrs post-theft.",critical:true,room:"Security Center",found:false},
      {id:"c3",name:"Replica Canvas",desc:"Blank canvas matching Vermeer's exact dimensions in Noah's locker.",critical:false,room:"Storage Vault",found:false},
      {id:"c4",name:"Sofia's Forgery File",desc:"Not connected to theft — damages her credibility.",critical:false,room:"Restorer's Workshop",found:false},
      {id:"c5",name:"Kai's Exit Badge",desc:"Confirmed exit 10:07pm — 2hrs before theft.",critical:false,room:"Gallery Hall A",found:false},
      {id:"c6",name:"Vivienne's Offer Letter",desc:"$4M private offer, declined 3 years ago.",critical:false,room:"Donor Lounge",found:false},
    ],
    rooms:["Gallery Hall A","Security Center","Storage Vault","Restorer's Workshop","Donor Lounge"],
    witnesses:[
      {id:"w1",name:"Officer Ray Chen",role:"Junior Guard",avatar:"👮",summary:"On patrol. Noah sent him on an unexplained break.",
       statements:[
         {trigger:"general",text:"Noah told me to take a 20-minute break at 11:45. That never happens — he's always strict about rotation."},
         {trigger:"noah",text:"I saw Noah near the sensor terminal around 11:50. He said it was a diagnostic. The timeline matches exactly when the sensors went offline."},
         {trigger:"suspicious",text:"After the theft was reported, Noah was the calmest person in the building. In five years I've never seen him calm during an incident."},
       ]},
    ],
    interrogationQuestions:{
      noah:[{q:"Walk me through your exact location at 11:50pm."},{q:"Someone used your credentials to disable the sensors."},{q:"$180,000 appeared in your account 72 hours after the theft."}],
      curator:[{q:"Tell me about the forged authentication certificate from 2022."},{q:"Did you notice anything unusual about Noah tonight?"}],
    },
    reverseInterrogation:{
      alibi:"I was called in after the fact — not on duty when it occurred.",
      secret:"Your precinct received $50k from the museum foundation last month.",
      questions:["Your precinct received $50,000 from the museum foundation last month. Doesn't that compromise you?","You were seen dining with Vivienne Lau two weeks before the heist.","Your file shows you cleared Noah Park in a prior incident.","Three art theft cases this year — all unsolved. Why?"],
    },
    crossExam:{
      noah:{contradiction:"Noah says his keycard was stolen — but access logs show it at his personal locker 40 minutes before the theft.",pressure:"the locker access timestamp",threshold:2},
      curator:{contradiction:"Sofia says she had no idea about the forgery file — but her signature is on the cover page.",pressure:"the signature",threshold:3},
    },
  },
];

const TIMER_OPTS=[{v:0,l:"Off"},{v:15,l:"15 min"},{v:20,l:"20 min"},{v:30,l:"30 min"},{v:45,l:"45 min"}];

// ============================================================
// CSS
// ============================================================
const css=`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital@1&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#080A0E;color:#F0EDE6;font-family:'Inter',sans-serif;min-height:100vh;overflow-x:hidden;}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:0.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:128px 128px;}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#0D0F14;}::-webkit-scrollbar-thumb{background:#232838;border-radius:2px;}::-webkit-scrollbar-thumb:hover{background:#C8A951;}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes beat{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes narratorIn{0%{opacity:0;letter-spacing:0.4em}100%{opacity:1;letter-spacing:0.06em}}
@keyframes pulseRed{0%,100%{box-shadow:0 0 0 0 #E8341A22}50%{box-shadow:0 0 28px 6px #E8341A44}}
@keyframes pinDrop{0%{opacity:0;transform:translateY(-28px) scale(0.85)}65%{transform:translateY(3px) scale(1.04)}100%{opacity:1;transform:none}}
.anim-up{animation:fadeUp 0.5s ease both;}
.anim-in{animation:fadeIn 0.35s ease both;}
.anim-pin{animation:pinDrop 0.55s cubic-bezier(0.34,1.56,0.64,1) both;}
.display{font-family:'Bebas Neue',sans-serif;letter-spacing:0.04em;line-height:0.92;}
.mono{font-family:'JetBrains Mono',monospace;}
.noir{font-family:'Playfair Display',serif;font-style:italic;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 17px;border-radius:4px;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid transparent;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;}
.btn:disabled{opacity:0.28;cursor:not-allowed;pointer-events:none;}
.btn-gold{background:#C8A95118;border-color:#C8A95155;color:#C8A951;}.btn-gold:hover{background:#C8A95128;border-color:#C8A951;box-shadow:0 0 20px #C8A95130;}
.btn-red{background:#E8341A18;border-color:#E8341A55;color:#E8341A;}.btn-red:hover{background:#E8341A28;border-color:#E8341A;}
.btn-teal{background:#1ECFB018;border-color:#1ECFB055;color:#1ECFB0;}.btn-teal:hover{background:#1ECFB028;border-color:#1ECFB0;box-shadow:0 0 20px #1ECFB030;}
.btn-purple{background:#7B5EA718;border-color:#7B5EA755;color:#7B5EA7;}.btn-purple:hover{background:#7B5EA728;border-color:#7B5EA7;}
.btn-green{background:#2ECC7118;border-color:#2ECC7155;color:#2ECC71;}.btn-green:hover{background:#2ECC7128;border-color:#2ECC71;}
.btn-ghost{background:transparent;border-color:#232838;color:#8B8FA8;}.btn-ghost:hover{border-color:#8B8FA8;color:#F0EDE6;}
.btn-paper{background:#F0EDE6;border-color:#F0EDE6;color:#080A0E;font-weight:700;}.btn-paper:hover{background:#D8D4CC;}
.btn-sm{padding:6px 13px;font-size:11px;}.btn-lg{padding:14px 36px;font-size:14px;}.btn-xl{padding:18px 48px;font-size:16px;}
.card{background:#0D0F14;border:1px solid #232838;border-radius:6px;transition:border-color 0.2s;}
.card-gold{border-color:#C8A95140;}.card-red{border-color:#E8341A40;}.card-teal{border-color:#1ECFB040;}.card-purple{border-color:#7B5EA740;}
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:2px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;font-family:'JetBrains Mono',monospace;}
.tag-gold{background:#C8A95114;color:#C8A951;border:1px solid #C8A95128;}.tag-red{background:#E8341A14;color:#E8341A;border:1px solid #E8341A28;}
.tag-teal{background:#1ECFB014;color:#1ECFB0;border:1px solid #1ECFB028;}.tag-purple{background:#7B5EA714;color:#7B5EA7;border:1px solid #7B5EA728;}
.tag-green{background:#2ECC7114;color:#2ECC71;border:1px solid #2ECC7128;}.tag-muted{background:#23283815;color:#4A4F62;border:1px solid #23283830;}
.input{background:#12151C;border:1px solid #232838;border-radius:4px;padding:10px 14px;color:#F0EDE6;font-family:'Inter',sans-serif;font-size:14px;width:100%;outline:none;transition:border-color 0.15s;}
.input:focus{border-color:#1ECFB0;box-shadow:0 0 0 3px #1ECFB012;}.input::placeholder{color:#4A4F62;}
textarea.input{resize:vertical;min-height:80px;line-height:1.65;}
.spinner{width:14px;height:14px;border:2px solid #232838;border-top-color:#1ECFB0;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;flex-shrink:0;}
.label{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#4A4F62;}
.bar-track{height:3px;background:#232838;border-radius:2px;overflow:hidden;}
.bar-fill{height:100%;border-radius:2px;transition:width 0.5s ease;}
.susp-track{height:6px;background:#232838;border-radius:3px;overflow:hidden;}
.susp-fill{height:100%;border-radius:3px;transition:width 0.6s cubic-bezier(0.34,1.56,0.64,1);}
.overlay{position:fixed;inset:0;background:#080A0Edd;backdrop-filter:blur(12px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:#0D0F14;border:1px solid #232838;border-radius:8px;padding:28px;max-width:680px;width:100%;max-height:90vh;overflow-y:auto;animation:fadeUp 0.25s ease;}
.modal-wide{max-width:920px;}
.top-nav{position:sticky;top:0;z-index:100;background:#080A0EF2;backdrop-filter:blur(24px);border-bottom:1px solid #232838;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;height:56px;}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:#080A0EF8;backdrop-filter:blur(20px);border-top:1px solid #232838;display:flex;align-items:center;justify-content:space-around;height:64px;padding:0 8px;}
.bnav-item{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:8px 14px;border-radius:6px;transition:all 0.15s;min-width:54px;}
.bnav-item.active{background:#1ECFB010;}
.bnav-icon{font-size:20px;line-height:1;}
.bnav-label{font-size:9px;letter-spacing:0.1em;font-family:'JetBrains Mono',monospace;text-transform:uppercase;color:#4A4F62;transition:color 0.15s;}
.bnav-item.active .bnav-label{color:#1ECFB0;}
.player-chip{display:flex;align-items:center;gap:7px;padding:5px 12px;background:#12151C;border:1px solid #232838;border-radius:20px;font-size:12px;cursor:pointer;transition:all 0.15s;}
.toggle{width:40px;height:22px;border-radius:11px;cursor:pointer;position:relative;transition:all 0.2s;flex-shrink:0;}
.toggle-knob{width:16px;height:16px;border-radius:50%;background:white;position:absolute;top:3px;transition:left 0.2s;}
.narrator-bar{border-top:1px solid #7B5EA720;border-bottom:1px solid #7B5EA720;padding:10px 24px;text-align:center;font-family:'Playfair Display',serif;font-style:italic;font-size:14px;color:#7B5EA7;letter-spacing:0.06em;line-height:1.7;background:linear-gradient(90deg,transparent,#7B5EA706,transparent);animation:narratorIn 1.2s ease;}
.timer-wrap{display:flex;align-items:center;gap:10px;padding:6px 14px;border-radius:6px;transition:all 0.5s;}
.timer-display{font-family:'Bebas Neue',sans-serif;letter-spacing:0.08em;font-size:26px;line-height:1;}
.timer-ok{color:#1ECFB0;}.timer-warn{color:#F39C12;}.timer-crit{color:#E8341A;animation:beat 0.8s ease infinite;}
.api-warn{background:#E8341A0E;border:1px solid #E8341A38;border-radius:6px;padding:12px 16px;display:flex;align-items:flex-start;gap:10px;}
.pulse-red{animation:pulseRed 1.6s ease infinite;}
.corkboard{border-radius:4px;position:relative;overflow:hidden;background:#3D2010;box-shadow:inset 0 2px 16px rgba(0,0,0,0.7),0 4px 32px rgba(0,0,0,0.8);border:4px solid #2A1508;}
.corkboard-inner{padding:20px;display:grid;gap:14px;}
.cork-note{background:#F8F3E0;border-radius:2px;padding:14px;position:relative;box-shadow:2px 3px 10px rgba(0,0,0,0.55);transition:all 0.2s;cursor:pointer;border-top:2px solid transparent;}
.cork-note:hover{transform:translateY(-2px);box-shadow:3px 6px 16px rgba(0,0,0,0.65);}
.cork-note.critical{border-top-color:#C8A951;}
.cork-note.unknown{background:#EDE8D5;opacity:0.65;}
.cork-note-title{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:#2A2010;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.08em;}
.cork-note-body{font-size:11px;color:#3A3020;line-height:1.55;}
.cork-stamp{position:absolute;top:8px;right:8px;font-size:8px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#C84030;border:1.5px solid #C84030;padding:1px 5px;border-radius:1px;opacity:0.75;font-family:'JetBrains Mono',monospace;}
.forensics-panel{background:#EDF5F3;border-left:3px solid #1ECFB0;border-radius:2px;padding:10px 12px;margin-top:10px;}
.portrait-card{background:#0D0F14;border:1px solid #232838;border-radius:6px;cursor:pointer;transition:all 0.2s;overflow:hidden;}
.portrait-card:hover{border-color:#C8A95166;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.5);}
.portrait-card.selected{border-color:#C8A951;box-shadow:0 0 0 1px #C8A951,0 8px 28px #C8A95128;}
.portrait-card.cracked{border-color:#E8341A;animation:pulseRed 2s ease infinite;}
.portrait-avatar{font-size:36px;line-height:1;display:flex;align-items:center;justify-content:center;height:70px;background:linear-gradient(180deg,#1A1E28,#12151C);}
.portrait-body{padding:12px;}
.portrait-name{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:0.04em;line-height:1;margin-bottom:3px;}
.portrait-role{font-size:10px;color:#8B8FA8;letter-spacing:0.06em;text-transform:uppercase;font-family:'JetBrains Mono',monospace;}
.bubble{padding:12px 15px;border-radius:6px;font-size:13px;line-height:1.65;animation:fadeIn 0.3s ease;max-width:86%;}
.bubble-user{background:#1ECFB012;border:1px solid #1ECFB028;margin-left:auto;}
.bubble-ai{background:#12151C;border:1px solid #232838;}
.bubble-error{background:#E8341A10;border:1px solid #E8341A33;color:#E8341A;font-size:12px;}
.bubble-witness{background:#1ECFB006;border:1px solid #1ECFB018;}
.bubble-reverse{background:#7B5EA710;border:1px solid #7B5EA728;margin-right:auto;}
.bubble-system{background:#C8A95108;border:1px solid #C8A95120;color:#8B8FA8;font-size:12px;text-align:center;max-width:100%;align-self:center;}
.bubble-pressure{background:#E8341A10;border:1px solid #E8341A28;}
.accuse-card{border:2px solid transparent;border-radius:6px;padding:14px;cursor:pointer;background:#12151C;transition:all 0.2s;}
.accuse-card:hover{border-color:#E8341A55;}.accuse-card.selected{border-color:#E8341A;background:#E8341A0C;}
.tactic-card{border:2px solid transparent;border-radius:6px;padding:12px;cursor:pointer;background:#12151C;transition:all 0.2s;}
.tactic-card:hover{border-color:#E8341A44;}.tactic-card.selected{border-color:#E8341A;background:#E8341A0C;}
.witness-item{border:2px solid transparent;border-radius:6px;padding:12px;cursor:pointer;background:#12151C;transition:all 0.2s;}
.witness-item:hover{border-color:#1ECFB055;}.witness-item.selected{border-color:#1ECFB0;background:#1ECFB00A;}
.diff-card{border:2px solid transparent;border-radius:6px;padding:16px;cursor:pointer;background:#12151C;transition:all 0.2s;}
.diff-card:hover{border-color:#C8A95144;}.diff-card.selected{border-color:#C8A951;background:#C8A9510A;}
.model-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:6px;cursor:pointer;border:1px solid #232838;background:#12151C;transition:all 0.15s;}
.model-row:hover{border-color:#1ECFB033;}.model-row.active{border-color:#1ECFB0;background:#1ECFB008;}
.splash{position:fixed;inset:0;background:#080A0E;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}
.splash-logo{font-family:'Bebas Neue',sans-serif;font-size:clamp(72px,12vw,140px);letter-spacing:0.06em;line-height:0.9;}
@media(min-width:1400px){.tv-scale{font-size:1.15em;}.portrait-name{font-size:22px;}.timer-display{font-size:34px;}.narrator-bar{font-size:17px;}}
@media(max-width:768px){.top-nav{padding:0 14px;height:52px;}.hide-mobile{display:none!important;}.modal{padding:20px;}}
`;

// ============================================================
// SHARED UI COMPONENTS
// ============================================================
function Lbl({children,style}){return<div className="label" style={{marginBottom:8,...style}}>{children}</div>;}
function APIWarn(){return(<div className="api-warn"><span style={{fontSize:20}}>⚠️</span><div><div style={{fontWeight:700,fontSize:13,color:T.red,marginBottom:3}}>No OpenAI API Key</div><div style={{fontSize:12,color:T.inkSec,lineHeight:1.6}}>Go to <strong style={{color:T.teal}}>⚙ Settings</strong> and add your OpenAI key to enable AI features.</div></div></div>);}
function Toggle({on,onChange}){return(<div className="toggle" style={{background:on?T.teal:"#232838"}} onClick={onChange}><div className="toggle-knob" style={{left:on?20:3}}/></div>);}
function SuspMeter({value,label}){
  const p=Math.min(100,Math.max(0,value||0));
  const c=p<30?T.green:p<60?T.amber:p<80?T.orange:T.red;
  const l=p<20?"CLEAR":p<40?"LOW":p<60?"MODERATE":p<80?"HIGH":"CRITICAL";
  return(<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span className="label">{label||"Suspicion"}</span><span className="mono" style={{fontSize:10,color:c}}>{l} {p}%</span></div><div className="susp-track"><div className="susp-fill" style={{width:p+"%",background:"linear-gradient(90deg,"+c+"88,"+c+")"}}/></div></div>);
}
function LieMeter({value}){
  const p=Math.min(100,Math.max(0,value||0));
  const c=p<25?T.green:p<50?T.teal:p<75?T.amber:T.red;
  const l=p<25?"TRUTHFUL":p<50?"UNCERTAIN":p<75?"EVASIVE":"LYING";
  return(<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span className="label">Deception Analysis</span><span className="mono" style={{fontSize:10,color:c}}>{l} {p}%</span></div><div className="susp-track"><div className="susp-fill" style={{width:p+"%",background:"linear-gradient(90deg,"+T.green+","+T.amber+","+T.red+")"}}/></div></div>);
}
function MoodBadge({count,guilty}){
  const mood=getMood(count,guilty);
  const m=MOODS[mood];
  return(<div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:3,background:m.color+"15",border:"1px solid "+m.color+"30",fontSize:11,fontWeight:600,color:m.color}}><span>{m.icon}</span><span>{m.label}</span></div>);
}
function CaseTimer({minutes,onExpire,paused}){
  const total=minutes*60;
  const [rem,setRem]=useState(total);
  const [done,setDone]=useState(false);
  useEffect(()=>{
    if(!minutes||paused||done)return;
    const id=setInterval(()=>setRem(r=>{if(r<=1){clearInterval(id);setDone(true);onExpire&&onExpire();return 0;}return r-1;}),1000);
    return()=>clearInterval(id);
  },[minutes,paused,done]);
  if(!minutes)return null;
  const m=Math.floor(rem/60),s=rem%60;
  const pct=(rem/total)*100;
  const crit=rem<120,warn=rem<300;
  const cls=crit?"timer-crit":warn?"timer-warn":"timer-ok";
  return(<div className="timer-wrap" style={{background:crit?T.red+"12":T.shadow,border:"1px solid "+(crit?T.red:warn?T.amber:"#232838")}}><span style={{fontSize:16}}>{crit?"🚨":warn?"⏳":"⏱"}</span><div><div className={"timer-display "+cls}>{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</div><div style={{width:70}} className="bar-track"><div className="bar-fill" style={{width:pct+"%",background:crit?T.red:warn?T.amber:T.teal,transition:"width 1s linear"}}/></div></div></div>);
}
function NarratorBar({text,loading}){
  if(!text&&!loading)return null;
  return(<div className="narrator-bar">{loading?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:T.purple}}><span className="spinner" style={{borderTopColor:T.purple}}/>Narrator composing...</span>:<>🎙 {text}</>}</div>);
}

// ============================================================
// SPLASH + LANDING
// ============================================================
function SplashScreen({onDone}){
  const [phase,setPhase]=useState(0);
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase(1),400);
    const t2=setTimeout(()=>setPhase(2),1400);
    const t3=setTimeout(()=>setPhase(3),2400);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);
  return(
    <div className="splash">
      <div style={{opacity:phase>=1?1:0,transform:phase>=1?"none":"translateY(30px)",transition:"all 1s cubic-bezier(0.16,1,0.3,1)",marginBottom:8}}>
        <div className="splash-logo"><span style={{color:T.paper}}>CASE</span><span style={{color:T.teal}}>ZERO</span></div>
      </div>
      <div style={{width:phase>=2?200:0,height:1,background:"linear-gradient(90deg,transparent,"+T.gold+",transparent)",transition:"width 0.8s ease",marginBottom:20}}/>
      <div style={{opacity:phase>=2?1:0,transition:"all 0.8s ease",marginBottom:48}}>
        <p className="noir" style={{fontSize:"clamp(14px,2vw,18px)",color:T.inkSec,letterSpacing:"0.12em"}}>Someone in this room is lying.</p>
      </div>
      <div style={{opacity:phase>=3?1:0,transform:phase>=3?"none":"translateY(16px)",transition:"all 0.6s ease"}}>
        <button className="btn btn-paper btn-xl" onClick={onDone} style={{letterSpacing:"0.2em",fontSize:15}}>ENTER</button>
      </div>
      <div style={{position:"absolute",bottom:24,left:0,right:0,textAlign:"center",opacity:phase>=3?0.4:0,transition:"opacity 0.6s ease 0.3s"}}>
        <span className="mono" style={{fontSize:10,color:T.inkMut,letterSpacing:"0.2em"}}>V2.0 · 2026 EDITION · POWERED BY OPENAI</span>
      </div>
    </div>
  );
}

function LandingScreen({onStart,hasKey}){
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 24px 40px",textAlign:"center",background:"radial-gradient(ellipse 80% 60% at 50% 0%, "+T.teal+"08, transparent)"}}>
        {!hasKey&&(
          <div style={{marginBottom:20,maxWidth:500,width:"100%"}}>
            <div className="api-warn anim-up"><span style={{fontSize:18}}>⚠️</span><div style={{fontSize:12,color:T.inkSec}}>Add your <strong style={{color:T.teal}}>OpenAI API key</strong> in Settings before playing.</div></div>
          </div>
        )}
        <div className="anim-up" style={{marginBottom:14}}>
          <span className="tag tag-teal" style={{display:"inline-flex"}}>V2.0 · 2026 EDITION</span>
        </div>
        <h1 className="display anim-up" style={{fontSize:"clamp(64px,10vw,120px)",color:T.paper,marginBottom:8,animationDelay:"0.05s"}}>
          CASE<span style={{color:T.teal}}>ZERO</span>
        </h1>
        <p className="noir anim-up" style={{fontSize:"clamp(15px,2vw,20px)",color:T.inkSec,marginBottom:48,letterSpacing:"0.06em",animationDelay:"0.1s"}}>
          Multiplayer AI detective mystery
        </p>
        <div className="anim-up" style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",animationDelay:"0.15s"}}>
          <button className="btn btn-teal btn-lg" style={{fontSize:15,letterSpacing:"0.12em"}} onClick={()=>onStart("lobby")}>▶ START GAME</button>
          <button className="btn btn-ghost btn-lg" style={{fontSize:14}} onClick={()=>onStart("settings")}>⚙ SETTINGS</button>
        </div>
      </div>
      <div style={{textAlign:"center",padding:"16px 24px",borderTop:"1px solid #232838"}}>
        <span className="mono" style={{fontSize:10,color:T.inkMut,letterSpacing:"0.15em"}}>CASEZERO V2 · OPENAI POWERED · FAMILY GAME NIGHT EDITION</span>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function SettingsScreen({settings,onChange,onBack}){
  const [testStatus,setTestStatus]=useState("");
  const [testing,setTesting]=useState(false);
  const test=async()=>{
    setTesting(true);setTestStatus("");
    const r=await callAI("Reply with exactly: Connection OK","Reply with: Connection OK","test",settings);
    setTestStatus(isAIErr(r)?"❌ "+r.replace(AI_ERR,"").trim():"✅ Connected — AI working");
    setTesting(false);
  };
  const set=(k,v)=>onChange(Object.assign({},settings,{[k]:v}));
  return(
    <div style={{maxWidth:640,margin:"0 auto",padding:"32px 24px"}}>
      <button className="btn btn-ghost btn-sm" style={{marginBottom:28}} onClick={onBack}>← Back</button>
      <h2 className="display" style={{fontSize:42,color:T.paper,marginBottom:4}}>SETTINGS</h2>
      <p style={{color:T.inkSec,marginBottom:28,fontSize:14}}>Configure AI engine, model, and game options.</p>
      {!settings.openaiKey&&<div style={{marginBottom:20}}><APIWarn/></div>}
      <div className="card" style={{padding:20,marginBottom:14}}>
        <Lbl>OpenAI API Key</Lbl>
        <input className="input" type="password" placeholder="sk-..." value={settings.openaiKey||""} onChange={e=>set("openaiKey",e.target.value)} style={{marginBottom:16}}/>
        <Lbl style={{marginBottom:10}}>Model</Lbl>
        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:16}}>
          {OPENAI_MODELS.map(m=>(
            <div key={m.id} className={"model-row "+(settings.openaiModel===m.id?"active":"")} onClick={()=>set("openaiModel",m.id)}>
              <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:m.tier==="advanced"?T.purple:m.tier==="fast"?T.green:T.teal}}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:settings.openaiModel===m.id?T.teal:T.ink}}>{m.label}</div><div style={{fontSize:11,color:T.inkSec}}>{m.desc}</div></div>
              <span className={"tag tag-"+(m.tier==="advanced"?"purple":m.tier==="fast"?"green":"teal")} style={{fontSize:9}}>{m.tier}</span>
              {settings.openaiModel===m.id&&<span style={{color:T.teal,fontSize:14}}>✓</span>}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <button className="btn btn-ghost btn-sm" onClick={test} disabled={testing}>{testing?<><span className="spinner"/>Testing...</>:"🔌 Test Connection"}</button>
          {testStatus&&<span style={{fontSize:12,color:testStatus.startsWith("✅")?T.green:T.red}}>{testStatus}</span>}
        </div>
      </div>
      <div className="card" style={{padding:20,marginBottom:14}}>
        <Lbl style={{marginBottom:10}}>ElevenLabs Voice (Optional)</Lbl>
        <input className="input" placeholder="ElevenLabs API Key" value={settings.elevenLabsKey||""} onChange={e=>set("elevenLabsKey",e.target.value)} style={{marginBottom:8}}/>
        <input className="input" placeholder="Voice ID" value={settings.elevenLabsVoiceId||""} onChange={e=>set("elevenLabsVoiceId",e.target.value)}/>
        <p style={{fontSize:11,color:T.inkMut,marginTop:8,lineHeight:1.6}}>Suspects speak during interrogation. Requires a server-side proxy for deployed apps.</p>
      </div>
      <div className="card" style={{padding:20}}>
        <Lbl style={{marginBottom:16}}>Game Options</Lbl>
        {[
          {k:"aiHints",l:"AI Hint System",d:"Request a subtle hint once per round"},
          {k:"lieDetector",l:"AI Lie Detector",d:"Scores deception % after each answer"},
          {k:"narratorEnabled",l:"AI Noir Narrator",d:"Atmospheric one-liner between phases"},
          {k:"voiceEnabled",l:"Voice (ElevenLabs)",d:"Suspects speak during interrogation"},
        ].map(o=>(
          <label key={o.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:16,cursor:"pointer"}}>
            <div><div style={{fontSize:14,fontWeight:500}}>{o.l}</div><div style={{fontSize:12,color:T.inkSec}}>{o.d}</div></div>
            <Toggle on={settings[o.k]} onChange={()=>set(o.k,!settings[o.k])}/>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// LOBBY
// ============================================================
function LobbyScreen({settings,onStart,onBack}){
  const [players,setPlayers]=useState([{id:1,name:"Detective 1",color:PLAYER_COLORS[0]}]);
  const [newName,setNewName]=useState("");
  const [mode,setMode]=useState("combined");
  const [diff,setDiff]=useState("medium");
  const [timerOvr,setTimerOvr]=useState(-1);
  const [selCase,setSelCase]=useState(CASES[0]);
  const [gen,setGen]=useState(false);
  const [genErr,setGenErr]=useState("");
  const [showCustom,setShowCustom]=useState(false);
  const [customPrompt,setCustomPrompt]=useState("");
  const d=DIFFICULTY[diff];
  const timerMins=timerOvr>=0?timerOvr:d.timer;
  const addPlayer=()=>{
    if(players.length>=8)return;
    const name=newName.trim()||"Detective "+(players.length+1);
    setPlayers(p=>[...p,{id:Date.now(),name,color:PLAYER_COLORS[p.length%8]}]);
    setNewName("");
  };
 async function generateStableCase(prompt, settings) {
  const schema = `
Return ONLY valid JSON.

Rules:
- no markdown
- no commentary
- must include:
  id, title, setting, summary, suspects[], clues[], endings{}

Each suspect MUST include:
id, name, guilty (boolean), alibi, secret

Each ending MUST include:
{
  trueEnding: string,
  badEnding: string,
  neutralEnding: string
}
`;

  const raw = await callAI(
    prompt + "\n\n" + schema,
    "You generate structured detective game cases.",
    "engine",
    settings
  );

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
  const MODES=[
    {id:"detective",icon:"🔍",l:"Detective Mode",d:"Explore rooms and find evidence"},
    {id:"interrogation",icon:"💬",l:"Interrogation Mode",d:"AI suspects, witnesses, cross-exam"},
    {id:"combined",icon:"🗂",l:"Full Investigation ★",d:"Everything — detect, interrogate, forensics, grill"},
  ];
  return(
    <div style={{maxWidth:960,margin:"0 auto",padding:"32px 24px"}}>
      <button className="btn btn-ghost btn-sm" style={{marginBottom:28}} onClick={onBack}>← Back</button>
      <h2 className="display" style={{fontSize:42,color:T.paper,marginBottom:4}}>MISSION BRIEFING</h2>
      <p style={{color:T.inkSec,marginBottom:28,fontSize:14}}>Configure your team, difficulty, and case.</p>
      {!settings.openaiKey&&<div style={{marginBottom:20}}><APIWarn/></div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div className="card" style={{padding:20}}>
          <Lbl style={{marginBottom:12}}>Detectives ({players.length}/8)</Lbl>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            {players.map(p=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                <span style={{flex:1,fontSize:13}}>{p.name}</span>
                {players.length>1&&<button className="btn btn-ghost btn-sm" style={{padding:"2px 8px",fontSize:11}} onClick={()=>setPlayers(pl=>pl.filter(x=>x.id!==p.id))}>✕</button>}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input className="input" placeholder="Player name" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()} style={{flex:1}}/>
            <button className="btn btn-teal" onClick={addPlayer} disabled={players.length>=8}>+</button>
          </div>
        </div>
        <div className="card" style={{padding:20}}>
          <Lbl style={{marginBottom:12}}>Game Mode</Lbl>
          {MODES.map(m=>(
            <div key={m.id} onClick={()=>setMode(m.id)} style={{padding:"10px 14px",borderRadius:6,cursor:"pointer",marginBottom:8,border:"1px solid "+(mode===m.id?T.teal:"#232838"),background:mode===m.id?T.teal+"0A":T.shadow,transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18}}>{m.icon}</span>
                <div><div style={{fontSize:13,fontWeight:600,color:mode===m.id?T.teal:T.ink}}>{m.l}</div><div style={{fontSize:11,color:T.inkSec}}>{m.d}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{padding:20,marginBottom:16}}>
        <Lbl style={{marginBottom:12}}>Difficulty</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
          {Object.values(DIFFICULTY).map(dv=>(
            <div key={dv.id} className={"diff-card "+(diff===dv.id?"selected":"")} onClick={()=>setDiff(dv.id)}>
              <div style={{fontSize:22,marginBottom:6}}>{dv.icon}</div>
              <div style={{fontSize:14,fontWeight:700,color:diff===dv.id?T.gold:T.ink,marginBottom:5}}>{dv.label}</div>
              <div style={{fontSize:11,color:T.inkSec,lineHeight:1.5}}>{dv.desc}</div>
              {dv.permadeath&&<span className="tag tag-red" style={{marginTop:8,fontSize:9}}>PERMADEATH</span>}
            </div>
          ))}
        </div>
        <Lbl style={{marginBottom:8}}>Case Timer</Lbl>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {TIMER_OPTS.map(t=>(
            <button key={t.v} className={"btn btn-sm "+(timerOvr===t.v?"btn-teal":"btn-ghost")} onClick={()=>setTimerOvr(t.v)}>
              {t.l}{t.v>0&&t.v===d.timer?" ★":""}
            </button>
          ))}
        </div>
        <div style={{fontSize:11,color:T.inkMut,marginTop:8}}>Timer: {timerMins===0?"Off":timerMins+" minutes"} — killer escapes when time runs out</div>
      </div>
      <div className="card" style={{padding:20,marginBottom:20}}>
        <Lbl style={{marginBottom:12}}>Select Case</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:14}}>
          {CASES.map(c=>(
            <div key={c.id} onClick={()=>setSelCase(c)} style={{padding:"14px",borderRadius:6,cursor:"pointer",border:"1px solid "+(selCase?.id===c.id?T.gold:"#232838"),background:selCase?.id===c.id?T.gold+"0A":T.shadow,transition:"all 0.15s"}}>
              <div style={{fontSize:13,fontWeight:700,color:selCase?.id===c.id?T.gold:T.ink,marginBottom:4}}>{c.title}</div>
              <div style={{fontSize:11,color:T.inkSec,marginBottom:8}}>{c.setting}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <span className="tag tag-muted" style={{fontSize:9}}>{c.suspects?.length} suspects</span>
                <span className="tag tag-muted" style={{fontSize:9}}>{c.clues?.length} clues</span>
              </div>
            </div>
          ))}
          <div onClick={()=>setShowCustom(true)} style={{padding:"14px",borderRadius:6,cursor:"pointer",border:"1px dashed #232838",background:T.shadow,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,minHeight:90}}>
            <span style={{fontSize:24}}>✨</span>
            <span style={{fontSize:12,color:T.inkMut}}>AI Generate</span>
          </div>
        </div>
        {selCase&&(
          <div style={{padding:"14px 16px",background:T.shadow,borderRadius:6,border:"1px solid #232838"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:T.paper,marginBottom:3}}>{selCase.title}</div>
            <div style={{fontSize:13,color:T.inkSec,marginBottom:10,lineHeight:1.6}}>{selCase.summary}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <span className="tag tag-muted">{selCase.suspects?.length} suspects</span>
              <span className="tag tag-muted">{selCase.clues?.length} clues</span>
              <span className="tag tag-teal">{selCase.witnesses?.length||0} witnesses</span>
              <span className="tag tag-muted">{selCase.rooms?.length} locations</span>
            </div>
          </div>
        )}
      </div>
      <button className="btn btn-gold btn-lg" style={{width:"100%",fontSize:15,letterSpacing:"0.12em"}} disabled={!selCase} onClick={()=>onStart({players,caseData:selCase,gameMode:mode,difficulty:diff,timerMinutes:timerMins})}>
        ▶ BEGIN INVESTIGATION
      </button>
      {showCustom&&(
        <div className="overlay" onClick={()=>setShowCustom(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 className="display" style={{fontSize:28,marginBottom:8}}>AI CASE GENERATOR</h3>
            <p style={{color:T.inkSec,fontSize:13,marginBottom:16}}>Describe the theme. GPT builds the full mystery.</p>
            <textarea className="input" placeholder="e.g. 'Spy thriller on a 1940s Orient Express'" value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} style={{marginBottom:14}}/>
            {genErr&&<div style={{color:T.red,fontSize:12,marginBottom:12,padding:"10px 12px",background:T.red+"0A",borderRadius:6}}>❌ {genErr}</div>}
            {!settings.openaiKey&&<div style={{marginBottom:12}}><APIWarn/></div>}
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-gold" onClick={generateCase} disabled={gen||!settings.openaiKey} style={{flex:1}}>{gen?<><span className="spinner"/>Generating...</>:"✨ Generate Case"}</button>
              <button className="btn btn-ghost" onClick={()=>setShowCustom(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CORKBOARD
// ============================================================
function CorkNote({clue,onDiscover,forensics,onForensics,forensicsUsed,hasKey,delay}){
  return(
    <div className={"cork-note "+(clue.found?"found":"unknown")+(clue.critical?" critical":"")+" anim-pin"} style={{animationDelay:(delay||0)+"ms"}} onClick={()=>!clue.found&&onDiscover(clue)}>
      <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",width:14,height:14,borderRadius:"50%",background:"radial-gradient(circle at 38% 32%, #F08888, #A03030)",boxShadow:"0 2px 6px rgba(0,0,0,0.7)",zIndex:1}}/>
      {clue.found?(
        <>
          {clue.critical&&<div className="cork-stamp">CRITICAL</div>}
          <div className="cork-note-title">{clue.name}</div>
          <div className="cork-note-body">{clue.desc}</div>
          <div style={{marginTop:8}}><span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:"#5A4A30",letterSpacing:"0.1em",textTransform:"uppercase"}}>📍 {clue.room}</span></div>
          {!forensics?.report&&(
            <button onClick={e=>{e.stopPropagation();onForensics(clue);}} disabled={forensics?.loading||!hasKey} style={{marginTop:8,background:"transparent",border:"1px solid #1ECFB044",borderRadius:3,padding:"3px 8px",fontSize:9,cursor:"pointer",color:"#0D7A69",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:5}}>
              {forensics?.loading?<><span style={{width:8,height:8,border:"1px solid #0D7A69",borderTopColor:"#1ECFB0",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>Analyzing...</>:("🔬 Analyze"+(forensicsUsed?"":" (free)"))}
            </button>
          )}
          {forensics?.error&&<div style={{marginTop:6,fontSize:10,color:T.red}}>{forensics.error}</div>}
          {forensics?.report&&(
            <div className="forensics-panel" style={{marginTop:10}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#0D7A69",marginBottom:5}}>🔬 FORENSICS REPORT</div>
              <div style={{fontSize:10,color:"#0D2520",lineHeight:1.55}}>{forensics.report}</div>
            </div>
          )}
        </>
      ):(
        <>
          <div className="cork-note-title" style={{color:"#6A5A40"}}>Unknown Evidence</div>
          <div style={{fontSize:11,color:"#8A7A60",marginTop:4}}>Click to examine</div>
          <div style={{marginTop:8}}><span style={{fontSize:9,color:"#8A7A60",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",textTransform:"uppercase"}}>📍 {clue.room}</span></div>
        </>
      )}
    </div>
  );
}

function CorkboardPanel({caseData,clues,activeRoom,setActiveRoom,discoverClue,notes,setNotes,settings}){
  const [forensicsState,setForensicsState]=useState({});
  const [forensicsUsed,setForensicsUsed]=useState(false);
  const clueRoom=c=>c.room||caseData.rooms[Math.floor((clues.indexOf(c)/clues.length)*caseData.rooms.length)];
  const roomClues=clues.filter(c=>clueRoom(c)===activeRoom);
  const foundTotal=clues.filter(c=>c.found).length;
  const pct=Math.round((foundTotal/clues.length)*100);
  const runForensics=async(clue)=>{
    if(forensicsState[clue.id]?.report)return;
    setForensicsState(p=>Object.assign({},p,{[clue.id]:{loading:true,report:null,error:""}}));
    const sys="You are a forensic scientist writing a brief lab report. 3-4 sentences. Provide specific scientific detail. Include one unexpected additional finding.";
    const pr="Clue: "+clue.name+" — "+clue.desc+". Case: "+caseData.title+". Write a forensic lab report with an extra finding.";
    const txt=await callAI(pr,sys,"forensics-"+clue.id,settings);
    if(isAIErr(txt)){setForensicsState(p=>Object.assign({},p,{[clue.id]:{loading:false,report:null,error:txt.replace(AI_ERR,"").trim()}}));return;}
    setForensicsState(p=>Object.assign({},p,{[clue.id]:{loading:false,report:txt,error:""}}));
    setForensicsUsed(true);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <h3 className="display" style={{fontSize:28,color:T.paper}}>EVIDENCE BOARD</h3>
          <span className="mono" style={{fontSize:11,color:T.teal}}>{foundTotal}/{clues.length} FOUND</span>
        </div>
        <div className="bar-track"><div className="bar-fill" style={{width:pct+"%",background:"linear-gradient(90deg,"+T.teal+","+T.gold+")"}}/></div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {caseData.rooms.map(r=>{
          const rc=clues.filter(c=>clueRoom(c)===r);
          const rf=rc.filter(c=>c.found).length;
          return(<button key={r} className={"btn btn-sm "+(activeRoom===r?"btn-gold":"btn-ghost")} onClick={()=>setActiveRoom(r)}>{r} <span style={{marginLeft:4,fontSize:9,opacity:0.7}}>{rf}/{rc.length}</span></button>);
        })}
      </div>
      <div className="corkboard" style={{flex:1,minHeight:300}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)"}}/>
        <div className="corkboard-inner" style={{gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",position:"relative"}}>
          {roomClues.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px 20px",color:"#6A5A40",fontFamily:"'JetBrains Mono',monospace",fontSize:12,letterSpacing:"0.1em"}}>NO EVIDENCE IN THIS LOCATION</div>}
          {roomClues.map((c,i)=><CorkNote key={c.id} clue={c} onDiscover={discoverClue} forensics={forensicsState[c.id]} onForensics={runForensics} forensicsUsed={forensicsUsed} hasKey={!!settings.openaiKey} delay={i*80}/>)}
        </div>
      </div>
      <div style={{marginTop:14}}>
        <div className="label" style={{marginBottom:6}}>Detective Notes — {activeRoom}</div>
        <textarea className="input" placeholder={"Write observations about "+activeRoom+"..."} value={notes[activeRoom]||""} onChange={e=>setNotes(n=>Object.assign({},n,{[activeRoom]:e.target.value}))} style={{minHeight:80,background:"#F8F4E8",color:"#1A1208",border:"1px solid #C8B888"}}/>
      </div>
    </div>
  );
}

// ============================================================
// INTERROGATION
// ============================================================
function InterrogationTab({caseData,suspects,selSuspect,setSelSuspect,interrogHist,setInterrogHist,questionCounts,setQuestionCounts,dynamicAlibis,lieScores,setLieScores,player,settings,diff}){
  const [customQ,setCustomQ]=useState("");
  const [loading,setLoading]=useState(false);
  const chatRef=useRef(null);
  const hist=selSuspect?(interrogHist[selSuspect.id]||[]):[];
  const qCount=selSuspect?(questionCounts[selSuspect.id]||0):0;
  const currentAlibi=selSuspect?(dynamicAlibis[selSuspect.id]||selSuspect.alibi):"";
  const alibiChanged=selSuspect&&dynamicAlibis[selSuspect.id]&&dynamicAlibis[selSuspect.id]!==selSuspect.alibi;
  const lieScore=selSuspect?lieScores[selSuspect.id]:null;
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[hist,selSuspect]);
  const askSuspect=async(suspect,question)=>{
    if(!question.trim()||!settings.openaiKey)return;
    setLoading(true);
    const newCount=(questionCounts[suspect.id]||0)+1;
    setQuestionCounts(p=>Object.assign({},p,{[suspect.id]:newCount}));
    const mood=getMood(newCount-1,suspect.guilty);
    const moodInfo=MOODS[mood];
    const sys="You are "+suspect.name+", "+suspect.role+", age "+suspect.age+". Case: "+caseData.title+".\nVictim: "+caseData.victim+". Current alibi: "+(dynamicAlibis[suspect.id]||suspect.alibi)+". Hidden secret: "+suspect.secret+".\nGuilty: "+(suspect.guilty?"YES — deny convincingly, show subtle cracks under pressure.":"NO — innocent but nervous, hide your secret.")+".\nCurrent mood: "+mood+" — "+moodInfo.desc+".\nMood behavior: "+(mood==="cooperative"?"Be open, give extra detail.":mood==="nervous"?"Be shaky, contradict slightly.":mood==="defensive"?"Keep answers short, deflect.":"Be curt, hostile, threaten to end the interview.")+".\nReply in 2-3 sentences. Human, realistic, emotionally consistent.";
    const resp=await callAI("Detective asks: "+question,sys,"interrogate-"+suspect.id,settings);
    let ls=null;
    if(!isAIErr(resp)&&(settings.lieDetector||diff.lieDetectorForce)){
      const lsys="You are a deception analyst. Return ONLY JSON: {\"score\":45} where score 0-100 = deception likelihood.";
      const lraw=await callAI("Suspect: "+suspect.name+". Guilty: "+suspect.guilty+". Mood: "+mood+". Q: "+question+". A: "+resp,lsys,"lie-detect",settings);
      if(!isAIErr(lraw)){
        const lp=safeJSON(lraw,{score:50});
        if(!lp._error&&!lp._parseError){ls=Math.min(100,Math.max(0,Number(lp.score)||50));setLieScores(p=>Object.assign({},p,{[suspect.id]:ls}));}
      }
    }
    setInterrogHist(p=>Object.assign({},p,{[suspect.id]:[...(p[suspect.id]||[]),{q:question,a:resp,player:player.name,lieScore:ls,mood,isErr:isAIErr(resp)}]}));
    setCustomQ("");
    if(!isAIErr(resp))await speakText(resp,settings);
    setLoading(false);
  };
  return(
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16,height:"100%"}}>
      <div>
        <Lbl style={{marginBottom:10}}>Suspects</Lbl>
        {suspects.map(s=>(
          <div key={s.id} className={"portrait-card "+(selSuspect?.id===s.id?"selected":"")} style={{marginBottom:10}} onClick={()=>setSelSuspect(s)}>
            <div className="portrait-avatar" style={{height:56,fontSize:28}}>{s.avatar||"👤"}</div>
            <div className="portrait-body" style={{padding:"10px 12px"}}>
              <div className="portrait-name" style={{fontSize:15}}>{s.name}</div>
              <div className="portrait-role" style={{marginBottom:6}}>{s.role}</div>
              {(questionCounts[s.id]||0)>0&&<MoodBadge count={questionCounts[s.id]||0} guilty={s.guilty}/>}
              {(interrogHist[s.id]?.length||0)>0&&<div style={{marginTop:5,display:"flex",gap:4,flexWrap:"wrap"}}>
                <span className="tag tag-muted" style={{fontSize:9}}>{interrogHist[s.id].length} Q&A</span>
                {lieScores[s.id]!=null&&<span className="tag tag-gold" style={{fontSize:9}}>{lieScores[s.id]}% lie</span>}
              </div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column"}}>
        {!selSuspect?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:T.inkMut,fontSize:14}}>Select a suspect to begin →</div>:(
          <>
            <div className="card card-gold" style={{padding:"14px 16px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div className="display" style={{fontSize:22,color:T.gold}}>{selSuspect.name}</div>
                  <div style={{fontSize:12,color:T.inkSec,marginTop:2}}>{selSuspect.role} · Age {selSuspect.age}</div>
                  <div style={{fontSize:11,marginTop:4,color:alibiChanged?T.amber:T.inkMut,display:"flex",alignItems:"center",gap:5}}>
                    {alibiChanged&&<span style={{color:T.amber,fontWeight:700}}>⚡</span>}{currentAlibi}
                  </div>
                </div>
                {qCount>0&&<MoodBadge count={qCount} guilty={selSuspect.guilty}/>}
              </div>
              {(settings.lieDetector||diff.lieDetectorForce)&&lieScore!=null&&<div style={{marginTop:12}}><LieMeter value={lieScore}/></div>}
            </div>
            <div ref={chatRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,marginBottom:12,minHeight:200,maxHeight:320}}>
              {hist.length===0&&<div style={{textAlign:"center",color:T.inkMut,fontSize:13,paddingTop:40}}>No questions yet.</div>}
              {hist.map((e,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",justifyContent:"flex-end"}}><div className="bubble bubble-user"><span style={{fontSize:10,color:T.teal,display:"block",marginBottom:3}}>{e.player}</span>{e.q}</div></div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    <div style={{display:"flex",justifyContent:"flex-start"}}><div className={"bubble "+(e.isErr?"bubble-error":"bubble-ai")}>{!e.isErr&&<span style={{fontSize:10,display:"block",marginBottom:3,color:MOODS[e.mood]?.color||T.gold}}>{selSuspect.name}{e.mood?" · "+MOODS[e.mood]?.icon+" "+e.mood:""}</span>}{e.a}</div></div>
                    {e.lieScore!=null&&(settings.lieDetector||diff.lieDetectorForce)&&<span style={{fontSize:10,color:e.lieScore>60?T.amber:T.inkMut,paddingLeft:4}}>🧠 {e.lieScore}% — {e.lieScore<25?"truthful":e.lieScore<50?"uncertain":e.lieScore<75?"evasive":"likely lying"}</span>}
                  </div>
                </div>
              ))}
              {loading&&<div style={{display:"flex",gap:8,alignItems:"center",padding:"6px 10px"}}><span className="spinner"/><span style={{fontSize:11,color:T.inkMut}}>{selSuspect.name} responding...</span></div>}
            </div>
            {caseData.interrogationQuestions?.[selSuspect.id]?.length>0&&(
              <div style={{marginBottom:10}}>
                <Lbl style={{marginBottom:6}}>Suggested</Lbl>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {caseData.interrogationQuestions[selSuspect.id].map((item,i)=>(
                    <button key={i} className="btn btn-ghost btn-sm" onClick={()=>askSuspect(selSuspect,item.q)} disabled={loading||!settings.openaiKey}>{item.q.slice(0,36)}...</button>
                  ))}
                </div>
              </div>
            )}
            {!settings.openaiKey&&<div style={{marginBottom:10}}><APIWarn/></div>}
            <div style={{display:"flex",gap:8}}>
              <input className="input" placeholder={settings.openaiKey?"Ask "+selSuspect.name.split(" ")[0]+" anything...":"Add OpenAI key in Settings"} value={customQ} onChange={e=>setCustomQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&customQ.trim()&&!loading&&settings.openaiKey&&askSuspect(selSuspect,customQ)} disabled={!settings.openaiKey} style={{flex:1}}/>
              <button className="btn btn-gold" disabled={!customQ.trim()||loading||!settings.openaiKey} onClick={()=>askSuspect(selSuspect,customQ)}>{loading?<span className="spinner"/>:"Ask"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CROSS-EXAM
// ============================================================
function CrossExamTab({caseData,suspects,selSuspect,setSelSuspect,crossState,setCrossState,dynamicAlibis,setDynamicAlibis,player,settings,diff}){
  const [tactic,setTactic]=useState(null);
  const [loading,setLoading]=useState(false);
  const chatRef=useRef(null);
  const state=selSuspect?(crossState[selSuspect.id]||{round:0,cracked:false,history:[]}):null;
  const examData=selSuspect?caseData.crossExam?.[selSuspect.id]:null;
  const pct=state&&examData?Math.min(100,Math.round((state.round/(examData.threshold||3))*100)):0;
  const alibiChanged=selSuspect&&dynamicAlibis[selSuspect.id]&&dynamicAlibis[selSuspect.id]!==selSuspect.alibi;
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[crossState,selSuspect]);
  const TACTICS=[{id:"evidence",icon:"🔎",l:"Present Evidence"},{id:"contradiction",icon:"⚔",l:"Point Contradiction"},{id:"bluff",icon:"🎭",l:"Bluff Pressure"},{id:"witness",icon:"👁",l:"Cite Witness"}];
  const doCrossExam=async(suspect,tac)=>{
    if(!settings.openaiKey)return;
    setLoading(true);
    const curState=crossState[suspect.id]||{round:0,cracked:false,history:[]};
    const newRound=curState.round+1;
    const threshold=Math.max(1,Math.round((examData?.threshold||2)*diff.crackMult));
    const willCrack=newRound>=threshold&&suspect.guilty;
    const currentAlibi=dynamicAlibis[suspect.id]||suspect.alibi;
    const sys="You are "+suspect.name+" under cross-examination.\nCurrent alibi: "+currentAlibi+".\nContradiction: "+(examData?.contradiction||"Your alibi doesn't add up.")+".\nPressure point: "+(examData?.pressure||"key evidence")+".\nGuilty: "+(suspect.guilty?"YES":"NO")+". Round "+newRound+"/"+threshold+".\n"+(willCrack?"BREAKING POINT — show dramatic crack, near-confession, emotional breakdown.":"Hold firm but fracture subtly. Consider shifting your alibi slightly.")+".\n2-3 sentences. Very tense.";
    const resp=await callAI("Tactic "+tac+" pressed on: "+(examData?.contradiction||"the contradiction"),sys,"cross-"+suspect.id,settings);
    if(!willCrack&&newRound>1&&!isAIErr(resp)){
      const asys="Extract the suspect's NEW claimed alibi in one sentence. If unchanged return original. Return ONLY the alibi sentence.";
      const nar=await callAI("Original: "+currentAlibi+". Latest: "+resp,asys,"dynamic-alibi",settings);
      if(!isAIErr(nar)&&nar.length>10&&nar.length<200)setDynamicAlibis(p=>Object.assign({},p,{[suspect.id]:nar}));
    }
    const newH=[...curState.history,{tactic:tac,response:resp,round:newRound,cracked:willCrack,isErr:isAIErr(resp)}];
    setCrossState(p=>Object.assign({},p,{[suspect.id]:{round:newRound,cracked:willCrack||curState.cracked,history:newH}}));
    await speakText(resp,settings);
    setTactic(null);setLoading(false);
  };
  return(
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16}}>
      <div>
        <Lbl style={{marginBottom:10}}>Suspects</Lbl>
        {suspects.map(s=>{
          const cs=crossState[s.id]||{};
          return(
            <div key={s.id} className={"portrait-card "+(selSuspect?.id===s.id?"selected ":"")+(cs.cracked?"cracked":"")} style={{marginBottom:10}} onClick={()=>setSelSuspect(s)}>
              <div className="portrait-avatar" style={{height:56,fontSize:28}}>{s.avatar||"👤"}</div>
              <div className="portrait-body" style={{padding:"10px 12px"}}>
                <div className="portrait-name" style={{fontSize:15}}>{s.name}</div>
                <div className="portrait-role">{s.role}</div>
                <div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
                  {cs.cracked&&<span className="tag tag-red" style={{fontSize:9}}>CRACKED</span>}
                  {cs.round>0&&!cs.cracked&&<span className="tag tag-gold" style={{fontSize:9}}>Rd {cs.round}</span>}
                  {dynamicAlibis[s.id]&&<span className="tag tag-gold" style={{fontSize:9}}>⚡ ALIBI</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div>
        {!selSuspect?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:280,color:T.inkMut,fontSize:14}}>Select a suspect to cross-examine →</div>:(
          <>
            <div className="card card-red" style={{padding:"14px 16px",marginBottom:12}}>
              <div className="display" style={{fontSize:22,color:T.red,marginBottom:3}}>{selSuspect.name} — Cross-Exam</div>
              <div style={{fontSize:12,color:T.inkSec,marginBottom:alibiChanged?8:12}}>Round {state.round} · {state.cracked?"CRACKED":"Holding firm"}</div>
              {alibiChanged&&<div style={{padding:"8px 10px",background:T.amber+"10",border:"1px solid "+T.amber+"30",borderRadius:4,marginBottom:10,fontSize:11}}><span style={{color:T.amber,fontWeight:700}}>⚡ ALIBI SHIFTED: </span><span style={{color:T.inkSec}}>{dynamicAlibis[selSuspect.id]}</span></div>}
              {examData&&<><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{flex:1}} className="bar-track"><div className="bar-fill" style={{width:pct+"%",background:"linear-gradient(90deg,"+T.amber+"88,"+T.red+")"}}/></div><span className="mono" style={{fontSize:10,color:T.red}}>{pct}%</span></div><div style={{fontSize:11,color:T.inkMut}}>Contradiction: <span style={{color:T.inkSec}}>{examData.contradiction}</span></div></>}
            </div>
            <div ref={chatRef} style={{height:190,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
              {state.history.length===0&&<div style={{textAlign:"center",color:T.inkMut,fontSize:12,paddingTop:30}}>Choose a tactic to press {selSuspect.name}.</div>}
              {state.history.map((e,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",justifyContent:"flex-end"}}><div className="bubble bubble-user" style={{background:T.red+"12",borderColor:T.red+"28"}}><span style={{fontSize:10,color:T.red,display:"block",marginBottom:2}}>Tactic: {e.tactic}</span>Pressing the contradiction...</div></div>
                  <div style={{display:"flex",justifyContent:"flex-start"}}><div className={"bubble "+(e.isErr?"bubble-error":e.cracked?"bubble-pressure":"bubble-ai")}><span style={{fontSize:10,color:e.cracked?T.red:T.inkMut,display:"block",marginBottom:2}}>{e.cracked?"⚠ CRACKING — ":""}{selSuspect.name} Rd {e.round}</span>{e.response}</div></div>
                </div>
              ))}
              {loading&&<div style={{display:"flex",gap:8,alignItems:"center"}}><span className="spinner"/><span style={{fontSize:11,color:T.inkMut}}>Applying pressure...</span></div>}
            </div>
            {!state.cracked?(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  {TACTICS.map(t=><div key={t.id} className={"tactic-card "+(tactic===t.id?"selected":"")} onClick={()=>setTactic(t.id)} style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>{t.icon}</span><div style={{fontSize:12,fontWeight:600,color:tactic===t.id?T.red:T.ink}}>{t.l}</div></div>)}
                </div>
                {!settings.openaiKey&&<div style={{marginBottom:10}}><APIWarn/></div>}
                <button className="btn btn-red" style={{width:"100%",justifyContent:"center"}} disabled={!tactic||loading||!settings.openaiKey} onClick={()=>doCrossExam(selSuspect,tactic)}>{loading?<><span className="spinner"/>Pressing...</>:"⚔ Press the Contradiction"}</button>
              </>
            ):<div className="card card-red pulse-red" style={{padding:16,textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>💥</div><div className="display" style={{fontSize:24,color:T.red,marginBottom:6}}>SUSPECT CRACKED</div><p style={{fontSize:13,color:T.inkSec}}>Their last response may contain the truth.</p></div>}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// WITNESS TAB
// ============================================================
function WitnessTab({witnesses,witnessState,setWitnessState,player,settings}){
  const [selWitness,setSelWitness]=useState(null);
  const [customQ,setCustomQ]=useState("");
  const [loading,setLoading]=useState(false);
  const chatRef=useRef(null);
  const wState=selWitness?witnessState[selWitness.id]:null;
  const hist=wState?.chatHistory||[];
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[witnessState,selWitness]);
  const TRIGGERS=[{id:"general",label:"Opening Statement",icon:"💬"},{id:"suspicious",label:"Suspicious Behavior",icon:"🔍"},{id:"diana",label:"About Diana",icon:"👤"},{id:"noah",label:"About Noah",icon:"👤"},{id:"camera",label:"About Evidence",icon:"📷"},{id:"victim",label:"About Victim",icon:"🎯"}];
  const callWitness=async(witness,trigger)=>{
    setLoading(true);
    const preset=witness.statements?.find(s=>s.trigger===trigger)||witness.statements?.[0];
    const existing=witnessState[witness.id]||{chatHistory:[]};
    let response;
    if(preset&&existing.chatHistory.length<2){response=preset.text;}
    else{
      const sys="You are "+witness.name+", "+witness.role+". "+witness.summary+".\nKnown info: "+(witness.statements?.map(s=>s.text).join(" ")||"none")+".\nPrior answers: "+(existing.chatHistory.map(h=>h.response).join(" | ")||"none")+".\nGive a natural 2-3 sentence follow-up about: "+trigger+". Stay consistent.";
      response=await callAI("Witness asked about: "+trigger,sys,"witness-"+witness.id,settings);
    }
    const entry={trigger,response:isAIErr(response)?"[Witness unavailable: "+response.replace(AI_ERR,"")+"]":response,player:player.name};
    setWitnessState(p=>Object.assign({},p,{[witness.id]:{unlocked:true,chatHistory:[...(p[witness.id]?.chatHistory||[]),entry]}}));
    if(!isAIErr(response))await speakText(response,settings);
    setLoading(false);
  };
  const askCustom=async(witness,q)=>{
    if(!q.trim())return;
    setLoading(true);
    const existing=witnessState[witness.id]||{chatHistory:[]};
    const sys="You are "+witness.name+", "+witness.role+". "+witness.summary+".\nKnown: "+(witness.statements?.map(s=>s.text).join(" ")||"none")+".\nPrior: "+(existing.chatHistory.map(h=>h.response).join(" | ")||"none")+".\nReply honestly in 2-3 sentences. Stay consistent.";
    const resp=await callAI("Detective asks: "+q,sys,"witness-custom-"+witness.id,settings);
    const entry={trigger:"custom",question:q,response:isAIErr(resp)?"["+resp.replace(AI_ERR,"")+"]":resp,player:player.name};
    setWitnessState(p=>Object.assign({},p,{[witness.id]:Object.assign({},p[witness.id]||{unlocked:true},{chatHistory:[...(p[witness.id]?.chatHistory||[]),entry]})}));
    if(!isAIErr(resp))await speakText(resp,settings);
    setCustomQ("");setLoading(false);
  };
  if(!witnesses||witnesses.length===0)return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,gap:10,color:T.inkMut}}><span style={{fontSize:40}}>👤</span><div style={{fontSize:14}}>No witnesses in this case.</div></div>);
  return(
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16}}>
      <div>
        <Lbl style={{marginBottom:10}}>Witnesses</Lbl>
        {witnesses.map(w=>(
          <div key={w.id} className={"witness-item "+(selWitness?.id===w.id?"selected":"")} style={{marginBottom:10}} onClick={()=>setSelWitness(w)}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><span style={{fontSize:24}}>{w.avatar||"👤"}</span><div><div style={{fontWeight:700,fontSize:13}}>{w.name}</div><div style={{fontSize:11,color:T.inkSec}}>{w.role}</div></div></div>
            <div style={{fontSize:11,color:T.inkMut,lineHeight:1.4}}>{w.summary}</div>
            {witnessState[w.id]?.unlocked&&<span className="tag tag-teal" style={{fontSize:9,marginTop:6}}>SPOKE TO DETECTIVE</span>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column"}}>
        {!selWitness?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:T.inkMut,fontSize:14}}>Select a witness →</div>:(
          <>
            <div className="card card-teal" style={{padding:"14px 16px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:32}}>{selWitness.avatar||"👤"}</span><div><div className="display" style={{fontSize:22,color:T.teal}}>{selWitness.name}</div><div style={{fontSize:12,color:T.inkSec,marginTop:2}}>{selWitness.role}</div><div style={{fontSize:11,color:T.inkMut,marginTop:3}}>{selWitness.summary}</div></div></div>
            </div>
            <div style={{marginBottom:10}}>
              <Lbl style={{marginBottom:7}}>Ask about...</Lbl>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{TRIGGERS.filter(t=>selWitness.statements?.some(s=>s.trigger===t.id)).map(t=><button key={t.id} className="btn btn-teal btn-sm" onClick={()=>callWitness(selWitness,t.id)} disabled={loading}>{t.icon} {t.label}</button>)}</div>
            </div>
            <div ref={chatRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:12,minHeight:160,maxHeight:260}}>
              {hist.length===0&&<div style={{textAlign:"center",color:T.inkMut,fontSize:12,paddingTop:28}}>Select a topic or ask a custom question.</div>}
              {hist.map((e,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:5}}>
                  {e.question&&<div style={{display:"flex",justifyContent:"flex-end"}}><div className="bubble bubble-user"><span style={{fontSize:10,color:T.teal,display:"block",marginBottom:2}}>{e.player}</span>{e.question}</div></div>}
                  {!e.question&&<div className="bubble bubble-system">Asked about: {e.trigger}</div>}
                  <div style={{display:"flex",justifyContent:"flex-start"}}><div className={"bubble "+(e.response?.startsWith("[")?"bubble-error":"bubble-witness")}><span style={{fontSize:10,color:T.teal,display:"block",marginBottom:2}}>{selWitness.name}</span>{e.response}</div></div>
                </div>
              ))}
              {loading&&<div style={{display:"flex",gap:7,alignItems:"center"}}><span className="spinner"/><span style={{fontSize:11,color:T.inkMut}}>{selWitness.name} thinking...</span></div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input className="input" placeholder={"Ask "+selWitness.name.split(" ")[0]+" anything..."} value={customQ} onChange={e=>setCustomQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&customQ.trim()&&!loading&&(askCustom(selWitness,customQ),setCustomQ(""))} style={{flex:1}}/>
              <button className="btn btn-teal" disabled={!customQ.trim()||loading} onClick={()=>{askCustom(selWitness,customQ);setCustomQ("");}}>Ask</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MODALS
// ============================================================
function DossierModal({suspect,suspects,dynamicAlibis,onClose}){
  const [cur,setCur]=useState(suspect);
  const d=cur.dossier||{};
  const alibiChanged=dynamicAlibis[cur.id]&&dynamicAlibis[cur.id]!==cur.alibi;
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide anim-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div><span className="tag tag-purple" style={{marginBottom:10,display:"inline-flex"}}>📋 Suspect Dossier</span><h3 className="display" style={{fontSize:36,color:T.paper,marginTop:6}}>{cur.name}</h3><div style={{fontSize:13,color:T.inkSec,marginTop:3}}>{cur.role} · Age {cur.age}</div></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",gap:7,marginBottom:20,flexWrap:"wrap"}}>{suspects.map(s=><button key={s.id} className={"btn btn-sm "+(cur.id===s.id?"btn-purple":"btn-ghost")} onClick={()=>setCur(s)}>{s.name.split(" ")[0]}</button>)}</div>
        {alibiChanged&&<div style={{padding:"10px 14px",background:T.amber+"10",border:"1px solid "+T.amber+"30",borderRadius:6,marginBottom:16,fontSize:12}}><span style={{color:T.amber,fontWeight:700}}>⚡ ALIBI UPDATED: </span><span style={{color:T.inkSec}}>{dynamicAlibis[cur.id]}</span></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          {[["Background",d.background],["Known Associates",d.associates],["Prior Record",d.record],["Financials",d.financials]].map(([label,val])=>(
            <div key={label} className="card" style={{padding:14}}><Lbl style={{marginBottom:6}}>{label}</Lbl><div style={{fontSize:13,color:T.inkSec,lineHeight:1.65}}>{val||"Unknown"}</div></div>
          ))}
        </div>
        <div className="card" style={{padding:14}}><Lbl style={{marginBottom:6}}>Original Alibi</Lbl><div style={{fontSize:13,color:T.inkSec}}>{cur.alibi}</div></div>
      </div>
    </div>
  );
}

function TimelineModal({suspect,suspects,onClose}){
  const [cur,setCur]=useState(suspect);
  const tl=cur.timeline||[];
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide anim-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div><span className="tag tag-teal" style={{marginBottom:10,display:"inline-flex"}}>⏱ Alibi Timeline</span><h3 className="display" style={{fontSize:36,color:T.paper,marginTop:6}}>{cur.name}</h3><div style={{fontSize:13,color:T.inkSec}}>{cur.role}</div></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",gap:7,marginBottom:20,flexWrap:"wrap"}}>{suspects.map(s=><button key={s.id} className={"btn btn-sm "+(cur.id===s.id?"btn-teal":"btn-ghost")} onClick={()=>setCur(s)}>{s.name.split(" ")[0]}</button>)}</div>
        <div style={{position:"relative",paddingLeft:20}}>
          <div style={{position:"absolute",left:7,top:0,bottom:0,width:1,background:"#232838"}}/>
          {tl.length===0&&<p style={{color:T.inkMut,fontSize:13}}>No timeline data available.</p>}
          {tl.map((e,i)=>(
            <div key={i} style={{display:"flex",gap:14,marginBottom:18,position:"relative"}}>
              <div style={{position:"absolute",left:-15,top:4,width:9,height:9,borderRadius:"50%",background:T.teal,border:"2px solid #080A0E"}}/>
              <div><div className="mono" style={{fontSize:12,color:T.teal,marginBottom:3}}>{e.t}</div><div style={{fontSize:13,color:T.inkSec,lineHeight:1.55}}>{e.a}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccuseModal({suspects,accusation,setAccusation,crossState,onConfirm,onClose,player}){
  return(
    <div className="overlay">
      <div className="modal anim-up">
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:10}}>⚖</div>
          <h3 className="display" style={{fontSize:36,color:T.red,marginBottom:6}}>FINAL ACCUSATION</h3>
          <p style={{color:T.inkSec,fontSize:13,lineHeight:1.7}}>One chance. Choose carefully, {player.name}.<br/>This is irreversible.</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {suspects.map(s=>(
            <div key={s.id} className={"accuse-card "+(accusation===s.id?"selected":"")} onClick={()=>setAccusation(s.id)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:28}}>{s.avatar||"👤"}</span><div><div className="display" style={{fontSize:20}}>{s.name}</div><div style={{fontSize:12,color:T.inkSec}}>{s.role}</div>{crossState[s.id]?.cracked&&<span className="tag tag-red" style={{fontSize:9,marginTop:5}}>CRACKED UNDER PRESSURE</span>}</div></div>
                {accusation===s.id&&<span style={{color:T.red,fontSize:24}}>◉</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}><button className="btn btn-red btn-lg" disabled={!accusation} onClick={onConfirm} style={{flex:1,justifyContent:"center"}}>CONFIRM ACCUSATION</button><button className="btn btn-ghost btn-lg" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

function TeamVoteModal({players,suspects,teamVotes,setTeamVotes,onClose}){
  const tally={};suspects.forEach(s=>{tally[s.id]=Object.values(teamVotes).filter(v=>v===s.id).length;});
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide anim-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div><span className="tag tag-teal" style={{marginBottom:10,display:"inline-flex"}}>🗳 Team Vote</span><h3 className="display" style={{fontSize:36,color:T.teal,marginTop:6}}>WHO'S THE KILLER?</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {players.map(p=>(
          <div key={p.id} style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/><span style={{fontSize:13,fontWeight:700}}>{p.name}</span></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
              {suspects.map(s=><div key={s.id} style={{padding:"10px 12px",borderRadius:6,cursor:"pointer",border:"2px solid "+(teamVotes[p.id]===s.id?T.teal:"#232838"),background:teamVotes[p.id]===s.id?T.teal+"0A":T.shadow,transition:"all 0.15s"}} onClick={()=>setTeamVotes(v=>Object.assign({},v,{[p.id]:s.id}))}><div style={{fontSize:13,fontWeight:700,color:teamVotes[p.id]===s.id?T.teal:T.ink}}>{s.name}</div><div style={{fontSize:10,color:T.inkSec}}>{s.role}</div></div>)}
            </div>
          </div>
        ))}
        <div className="card card-teal" style={{padding:14,marginTop:10}}>
          <Lbl style={{marginBottom:10}}>Live Tally</Lbl>
          {suspects.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{width:110,fontSize:12,color:T.inkSec}}>{s.name}</div>
              <div style={{flex:1}} className="bar-track"><div className="bar-fill" style={{width:(players.length?(tally[s.id]/players.length)*100:0)+"%",background:T.teal}}/></div>
              <span className="mono" style={{fontSize:12,color:T.teal,width:18}}>{tally[s.id]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReverseModal({caseData,player,state,setState,onClose,diff,settings}){
  const ri=caseData.reverseInterrogation;
  const qList=ri?.questions?.slice(0,diff.reverseQ)||[];
  const curQ=qList[state.qIdx];
  const ref=useRef(null);
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[state.history]);
  const suspColor=state.suspicion<30?T.green:state.suspicion<60?T.amber:state.suspicion<80?T.orange:T.red;
  const handleSubmit=async()=>{
    const q=curQ,ans=state.ans.trim();
    if(!ans)return;
    if(!settings.openaiKey){setState(s=>Object.assign({},s,{error:"No OpenAI key — add it in Settings."}));return;}
    setState(s=>Object.assign({},s,{loading:true,error:""}));
    const sys="You are a hard-boiled detective inspector grilling Detective "+player.name+".\nAlibi: "+ri.alibi+". Vulnerability: "+ri.secret+". Be adversarial, skeptical.\nRate believability 1-10. Return ONLY JSON: {\"score\":7,\"response\":\"2-3 sentence reaction.\"}";
    const raw=await callAI("Question: "+q+"\nAnswer: "+ans,sys,"reverse",settings);
    if(isAIErr(raw)){setState(s=>Object.assign({},s,{loading:false,error:raw.replace(AI_ERR,"").trim()}));return;}
    const parsed=safeJSON(raw,{score:5,response:"...your answer has been noted."});
    if(parsed._error||parsed._parseError){setState(s=>Object.assign({},s,{loading:false,error:"Could not parse AI response. Try again."}));return;}
    const score=Math.min(10,Math.max(1,Number(parsed.score)||5));
    const aiResp=parsed.response||"...your answer has been noted.";
    const delta=score>=7?-(Math.floor(Math.random()*15)+5):score>=4?Math.floor(Math.random()*8):Math.floor(Math.random()*20)+8;
    const newSusp=Math.min(100,Math.max(0,state.suspicion+delta));
    const isDone=state.qIdx>=qList.length-1;
    setState(s=>Object.assign({},s,{loading:false,error:"",history:[...s.history,{q,a:ans,aiResp,score,delta}],suspicion:newSusp,qIdx:s.qIdx+1,ans:"",done:isDone}));
    await speakText(aiResp,settings);
  };
  return(
    <div className="overlay">
      <div className="modal modal-wide anim-up">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div><span className="tag tag-purple" style={{marginBottom:10,display:"inline-flex"}}>🎯 Reverse Interrogation</span><h3 className="display" style={{fontSize:30,color:T.purple,marginTop:6}}>YOU'RE IN THE HOT SEAT</h3><p style={{fontSize:12,color:T.inkSec,marginTop:4}}>{player.name} · {qList.length} questions · {diff.label}</p></div>
          {state.done&&<button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
        </div>
        <div style={{marginBottom:14}}><SuspMeter value={state.suspicion} label={player.name+"'s Suspicion Level"}/></div>
        {state.error&&<div style={{background:T.red+"0E",border:"1px solid "+T.red+"33",borderRadius:6,padding:"10px 14px",marginBottom:12,display:"flex",gap:10}}><span>❌</span><div style={{fontSize:12,color:T.red}}>{state.error}</div></div>}
        <div ref={ref} style={{height:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          {state.history.length===0&&!state.loading&&<div className="bubble bubble-system">The interrogator enters. The pressure is immediate.</div>}
          {state.history.map((e,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",gap:7}}>
              <div style={{display:"flex",justifyContent:"flex-start"}}><div className="bubble bubble-reverse"><span style={{fontSize:10,color:T.purple,display:"block",marginBottom:3}}>Interrogator</span>{e.q}</div></div>
              <div style={{display:"flex",justifyContent:"flex-end"}}><div className="bubble bubble-user"><span style={{fontSize:10,color:T.teal,display:"block",marginBottom:3}}>{player.name}</span>{e.a}</div></div>
              <div style={{display:"flex",justifyContent:"flex-start"}}><div className="bubble" style={{background:e.delta>5?T.red+"10":T.purple+"10",border:"1px solid "+(e.delta>5?T.red:T.purple)+"28"}}><span style={{fontSize:10,color:e.delta>5?T.red:T.purple,display:"block",marginBottom:3}}>Credibility: {e.score}/10 · {e.delta>0?"▲ +"+e.delta+"% suspicion":"▼ "+Math.abs(e.delta)+"% suspicion"}</span>{e.aiResp}</div></div>
            </div>
          ))}
          {state.loading&&<div style={{display:"flex",gap:8,alignItems:"center",padding:"6px 10px"}}><span className="spinner"/><span style={{fontSize:11,color:T.inkMut}}>Interrogator considering...</span></div>}
        </div>
        {!state.done&&curQ&&!state.loading?(
          <>
            <div className="card card-purple" style={{padding:"12px 14px",marginBottom:12}}><Lbl style={{marginBottom:6}}>Interrogator asks:</Lbl><p style={{fontSize:14,lineHeight:1.7,color:T.paper}}>{curQ}</p></div>
            <div style={{display:"flex",gap:8}}>
              <input className="input" placeholder="Your answer — be convincing..." value={state.ans} onChange={e=>setState(s=>Object.assign({},s,{ans:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&state.ans.trim()&&handleSubmit()} style={{flex:1}}/>
              <button className="btn btn-purple" disabled={!state.ans.trim()||state.loading} onClick={handleSubmit}>Answer</button>
            </div>
          </>
        ):state.done?(
          <div style={{textAlign:"center"}}>
            <div style={{padding:20,background:suspColor+"10",border:"1px solid "+suspColor+"33",borderRadius:8,marginBottom:14}}>
              <div style={{fontSize:44,marginBottom:10}}>{state.suspicion<30?"✅":state.suspicion<60?"😬":"🚨"}</div>
              <div className="display" style={{fontSize:32,color:suspColor,marginBottom:6}}>FINAL SUSPICION: {state.suspicion}%</div>
              <p style={{fontSize:13,color:T.inkSec,lineHeight:1.7}}>{state.suspicion<30?"You handled yourself well.":state.suspicion<60?"Shaky. They're watching you.":state.suspicion<80?"You're under serious scrutiny.":"They nearly arrested you. Solve this fast."}</p>
            </div>
            <button className="btn btn-teal btn-lg" onClick={onClose} style={{width:"100%",justifyContent:"center"}}>← Return to Investigation</button>
          </div>
        ):null}
      </div>
    </div>
  );
}

function MobileModal({foundClues,suspects,caseData,player,onClose}){
  const [tab,setTab]=useState("clues");
  const [copied,setCopied]=useState(false);
  const summary="CASEZERO — "+caseData.title+"\nDetective: "+player.name+"\n\nCLUES FOUND ("+foundClues.length+"):\n"+(foundClues.map(c=>"• "+c.name+": "+c.desc).join("\n")||"None yet")+"\n\nSUSPECTS:\n"+suspects.map(s=>"• "+s.name+" ("+s.role+") — "+s.alibi).join("\n");
  const copy=()=>{navigator.clipboard.writeText(summary).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>{});};
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide anim-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div><span className="tag tag-teal" style={{marginBottom:10,display:"inline-flex"}}>📱 Mobile Companion</span><h3 className="display" style={{fontSize:30,color:T.teal,marginTop:6}}>YOUR CASE ON ANY SCREEN</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:18}}>{[["clues","🔎 Clues"],["suspects","👤 Suspects"],["share","📤 Share"]].map(([id,lbl])=><button key={id} className={"btn btn-sm "+(tab===id?"btn-teal":"btn-ghost")} onClick={()=>setTab(id)}>{lbl}</button>)}</div>
        {tab==="clues"&&<div style={{background:T.abyss,border:"2px solid #232838",borderRadius:16,padding:16,maxWidth:300,margin:"0 auto"}}><div style={{textAlign:"center",marginBottom:12}}><div className="mono" style={{fontSize:9,color:T.teal,letterSpacing:"0.2em"}}>CASEZERO · FIELD NOTES</div><div className="display" style={{fontSize:18,marginTop:4}}>{caseData.title}</div><div style={{fontSize:11,color:T.inkSec,marginTop:2}}>Det. {player.name}</div></div>{foundClues.length===0&&<div style={{textAlign:"center",color:T.inkMut,fontSize:13,padding:20}}>No clues yet.</div>}{foundClues.map(c=><div key={c.id} style={{background:T.void,border:"1px solid #232838",borderRadius:8,padding:12,marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span>{c.critical?"🔑":"🔎"}</span>{c.critical&&<span className="tag tag-gold" style={{fontSize:9}}>KEY</span>}</div><div style={{fontWeight:700,fontSize:12,marginBottom:3}}>{c.name}</div><div style={{fontSize:11,color:T.inkSec,lineHeight:1.5}}>{c.desc}</div></div>)}</div>}
        {tab==="suspects"&&<div style={{background:T.abyss,border:"2px solid #232838",borderRadius:16,padding:16,maxWidth:300,margin:"0 auto"}}><div style={{textAlign:"center",marginBottom:12}}><div className="mono" style={{fontSize:9,color:T.gold,letterSpacing:"0.2em"}}>SUSPECT PROFILES</div></div>{suspects.map(s=><div key={s.id} style={{background:T.void,border:"1px solid #232838",borderRadius:8,padding:12,marginBottom:8}}><div className="display" style={{fontSize:16,marginBottom:2}}>{s.name}</div><div style={{fontSize:11,color:T.gold,marginBottom:3}}>{s.role}</div><div style={{fontSize:11,color:T.inkSec}}>Alibi: {s.alibi}</div></div>)}</div>}
        {tab==="share"&&<div><div className="card card-teal" style={{padding:16,marginBottom:14}}><Lbl style={{marginBottom:8}}>Copy Case Summary</Lbl><div className="mono" style={{fontSize:10,color:T.inkSec,lineHeight:1.7,background:T.abyss,padding:12,borderRadius:6,maxHeight:180,overflowY:"auto",whiteSpace:"pre-wrap",marginBottom:12}}>{summary}</div><button className={"btn "+(copied?"btn-green":"btn-teal")} style={{width:"100%",justifyContent:"center"}} onClick={copy}>{copied?"✅ Copied!":"📋 Copy to Clipboard"}</button></div></div>}
      </div>
    </div>
  );
}

// ============================================================
// VERDICT
// ============================================================
function VerdictScreen({verdict,caseData,player,onEnd}){
  const [phase,setPhase]=useState(0);
  const [tab,setTab]=useState("result");
  const [revealKiller,setRevealKiller]=useState(false);
  useEffect(()=>{const t1=setTimeout(()=>setPhase(1),300);const t2=setTimeout(()=>setPhase(2),1200);return()=>{clearTimeout(t1);clearTimeout(t2);};},[]);
  const isTimer=verdict.timerExpired,correct=verdict.correct;
  const bgColor=isTimer?T.amber:correct?T.green:T.red;
  const emoji=isTimer?"⌛":correct?"🏆":verdict.permadeath?"💀":"😞";
  const headerText=isTimer?"TIME EXPIRED":correct?"CASE SOLVED":verdict.permadeath?"GAME OVER":"WRONG ACCUSATION";
  const subText=isTimer?"The clock ran out. "+verdict.killer.name+" escapes.":correct?player.name+" correctly identified "+verdict.killer.name+".":player.name+" accused "+verdict.suspect?.name+". The killer was "+verdict.killer.name+".";
  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse 100% 60% at 50% 0%, "+bgColor+"10, transparent)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:660,width:"100%",opacity:phase>=1?1:0,transform:phase>=1?"none":"translateY(30px)",transition:"all 0.8s cubic-bezier(0.16,1,0.3,1)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:72,marginBottom:16}}>{emoji}</div>
          <span className={"tag tag-"+(isTimer?"gold":correct?"green":"red")} style={{marginBottom:16,display:"inline-flex",fontSize:11,padding:"5px 14px"}}>{headerText}</span>
          <h1 className="display" style={{fontSize:"clamp(36px,6vw,64px)",color:T.paper,marginBottom:10,lineHeight:1}}>{isTimer?"The killer escapes.":correct?"Brilliant work, Detective.":verdict.permadeath?"One shot. One miss.":"The real killer walks free."}</h1>
          <p style={{color:T.inkSec,fontSize:15,lineHeight:1.7}}>{subText}</p>
        </div>
        <div style={{height:1,background:"linear-gradient(90deg,transparent,"+bgColor+"44,transparent)",marginBottom:24}}/>
        <div style={{display:"flex",gap:6,marginBottom:20,opacity:phase>=2?1:0,transition:"opacity 0.6s ease 0.3s"}}>
          {[["result","Result"],["debrief","Debrief"],["evidence","Evidence"],["votes","Votes"]].map(([id,lbl])=><button key={id} className={"btn btn-sm "+(tab===id?"btn-gold":"btn-ghost")} style={{flex:1,justifyContent:"center"}} onClick={()=>setTab(id)}>{lbl}</button>)}
        </div>
        <div style={{opacity:phase>=2?1:0,transition:"opacity 0.6s ease 0.4s"}}>
          {tab==="result"&&(!revealKiller?<button className="btn btn-gold btn-lg" style={{width:"100%",justifyContent:"center",marginBottom:14}} onClick={()=>setRevealKiller(true)}>Reveal the Full Truth</button>:(
            <div className="card card-gold" style={{padding:20,marginBottom:14}}>
              <Lbl style={{marginBottom:8}}>The Full Story</Lbl>
              <div className="display" style={{fontSize:22,color:T.gold,marginBottom:6}}>{verdict.killer.name} — {verdict.killer.role}</div>
              <p style={{fontSize:14,color:T.inkSec,lineHeight:1.75}}>{verdict.reason}</p>
            </div>
          ))}
          {tab==="debrief"&&<div>
            <div className="card" style={{padding:16,marginBottom:12}}><Lbl style={{marginBottom:8}}>Your Suspicion Level</Lbl><SuspMeter value={verdict.revSuspicion||15}/><div style={{fontSize:12,color:T.inkMut,marginTop:8}}>{(verdict.revSuspicion||15)<40?"You stayed clear during the reverse interrogation.":"Your alibi raised some eyebrows."}</div></div>
            <div className="card" style={{padding:16}}><Lbl style={{marginBottom:8}}>Evidence Summary</Lbl><div style={{fontSize:13,color:T.inkSec,marginBottom:10}}>Found {verdict.foundClues.length} of {caseData.clues.length} clues · {verdict.foundClues.filter(c=>c.critical).length} critical</div>{verdict.foundClues.map(c=><div key={c.id} style={{display:"flex",gap:8,marginBottom:7}}><span style={{color:c.critical?T.gold:T.teal,fontSize:12}}>◆</span><span style={{fontSize:12,color:T.inkSec}}><strong style={{color:T.ink}}>{c.name}</strong> — {c.desc}</span></div>)}</div>
          </div>}
          {tab==="evidence"&&<div><Lbl style={{marginBottom:12}}>All Clues — Full Reveal</Lbl>{caseData.clues.map(c=><div key={c.id} style={{display:"flex",gap:10,marginBottom:12,opacity:c.found?1:0.45}}><span style={{fontSize:18,flexShrink:0}}>{c.found?"🔎":"❓"}</span><div><div style={{fontSize:13,fontWeight:700,marginBottom:3}}>{c.name}{c.critical&&<span className="tag tag-gold" style={{fontSize:9,marginLeft:8}}>CRITICAL</span>}</div><div style={{fontSize:12,color:T.inkSec,lineHeight:1.55}}>{c.desc}{!c.found&&<span style={{color:T.inkMut}}> (missed — was in {c.room})</span>}</div></div></div>)}</div>}
          {tab==="votes"&&<div><Lbl style={{marginBottom:12}}>Team Vote Results</Lbl>{Object.keys(verdict.teamVotes||{}).length===0&&<p style={{color:T.inkMut,fontSize:13}}>No votes cast.</p>}{Object.entries(verdict.teamVotes||{}).map(([pid,sid])=>{const p=(verdict.players||[]).find(x=>x.id.toString()===pid)||{name:"Player",color:T.teal};const s=caseData.suspects.find(x=>x.id===sid)||{name:"Unknown",guilty:false};return(<div key={pid} style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,padding:"10px 14px",background:T.void,borderRadius:6,border:"1px solid "+(s.guilty?T.green:T.red)+"22"}}><div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/><span style={{fontSize:13,flex:1}}>{p.name}</span><span style={{fontSize:12,color:T.inkSec}}>→ {s.name}</span><span className={"tag tag-"+(s.guilty?"green":"red")} style={{fontSize:9}}>{s.guilty?"CORRECT":"WRONG"}</span></div>);})}</div>}
        </div>
        <div style={{display:"flex",gap:10,marginTop:24,opacity:phase>=2?1:0,transition:"opacity 0.6s ease 0.5s"}}>
          <button className="btn btn-teal btn-lg" style={{flex:1,justifyContent:"center"}} onClick={()=>onEnd("lobby")}>▶ Play Again</button>
          <button className="btn btn-ghost btn-lg" onClick={()=>onEnd("home")}>Main Menu</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GAME SCREEN
// ============================================================
function Sidebar({caseData,foundClues,clues,progress,revSuspicion,hint,showHint,hintUsed,hintLoading,getHint,unlimitedHints,aiHints,openaiKey}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div className="card" style={{padding:16}}>
        <Lbl style={{marginBottom:8}}>Case Brief</Lbl>
        <div style={{fontSize:13,color:T.inkSec,lineHeight:1.65,marginBottom:8}}>{caseData.summary}</div>
        <div style={{fontSize:11,color:T.inkMut}}>Victim: <span style={{color:T.gold}}>{caseData.victim}</span></div>
      </div>
      <div className="card" style={{padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><Lbl>Evidence</Lbl><span className="mono" style={{fontSize:10,color:T.teal}}>{foundClues.length}/{clues.length}</span></div>
        <div className="bar-track" style={{marginBottom:12}}><div className="bar-fill" style={{width:progress+"%",background:"linear-gradient(90deg,"+T.teal+","+T.gold+")"}}/></div>
        {foundClues.map(c=>(
          <div key={c.id} style={{display:"flex",gap:8,paddingBottom:8}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}><div style={{width:7,height:7,borderRadius:"50%",background:c.critical?T.gold:T.teal,flexShrink:0,marginTop:4}}/><div style={{width:1,flex:1,background:"#232838",marginTop:3}}/></div>
            <div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,marginBottom:2}}>{c.name}</div><div style={{fontSize:10,color:T.inkSec,lineHeight:1.5}}>{c.desc}</div></div>
          </div>
        ))}
        {foundClues.length===0&&<p style={{fontSize:11,color:T.inkMut}}>No evidence found yet.</p>}
      </div>
      <div className="card card-purple" style={{padding:14}}><Lbl style={{marginBottom:7}}>Your Suspicion</Lbl><SuspMeter value={revSuspicion}/></div>
      {aiHints&&(
        <div className="card" style={{padding:14}}>
          <Lbl style={{marginBottom:8}}>AI Game Master</Lbl>
          {showHint?<p className="noir" style={{fontSize:13,color:T.purple,lineHeight:1.7}}>"{hint}"</p>
            :<button className="btn btn-ghost btn-sm" style={{width:"100%",justifyContent:"center"}} onClick={getHint} disabled={(!unlimitedHints&&hintUsed)||hintLoading||!openaiKey}>
              {hintLoading?<><span className="spinner"/>Thinking...</>:(!unlimitedHints&&hintUsed)?"Hint used":"💡 Request Hint"}
            </button>}
          {unlimitedHints&&<div style={{fontSize:10,color:T.green,marginTop:6}}>∞ unlimited (easy mode)</div>}
        </div>
      )}
    </div>
  );
}

function InterrogPanel({subTab,setSubTab,setShowDossier,setShowTimeline,suspects,...props}){
  return(
    <div className="anim-in">
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[["interrogate","💬","Interrogate","btn-gold"],["cross","⚔","Cross-Exam","btn-red"],["witnesses","👁","Witnesses","btn-teal"]].map(([id,icon,lbl,btn])=>(
          <button key={id} className={"btn btn-sm "+(subTab===id?btn:"btn-ghost")} onClick={()=>setSubTab(id)}>{icon} {lbl}</button>
        ))}
        <button className="btn btn-sm btn-ghost" style={{marginLeft:"auto"}} onClick={()=>setShowDossier(props.selSuspect||suspects[0])}>📋</button>
        <button className="btn btn-sm btn-ghost" onClick={()=>setShowTimeline(props.selSuspect||suspects[0])}>⏱</button>
      </div>
      {subTab==="interrogate"&&<InterrogationTab suspects={suspects} {...props}/>}
      {subTab==="cross"&&<CrossExamTab suspects={suspects} {...props}/>}
      {subTab==="witnesses"&&<WitnessTab witnesses={props.caseData.witnesses||[]} witnessState={props.witnessState} setWitnessState={props.setWitnessState} player={props.player} settings={props.settings}/>}
    </div>
  );
}

function GameScreen({gameState,settings,onEnd}){
  const {players,caseData,gameMode,difficulty,timerMinutes}=gameState;
  const diff=DIFFICULTY[difficulty]||DIFFICULTY.medium;
  const [phase,setPhase]=useState(gameMode==="interrogation"?"interrogation":"detective");
  const [curPlayer,setCurPlayer]=useState(0);
  const [clues,setClues]=useState(()=>{
    let c=caseData.clues.map(x=>Object.assign({},x));
    if(diff.freeClues>0){let g=0;c=c.map(x=>{if(!x.found&&x.critical&&g<diff.freeClues){g++;return Object.assign({},x,{found:true});}return x;});}
    return c;
  });
  const [notes,setNotes]=useState({});
  const [activeRoom,setActiveRoom]=useState(caseData.rooms[0]);
  const [selSuspect,setSelSuspect]=useState(null);
  const [interrogHist,setInterrogHist]=useState({});
  const [questionCounts,setQuestionCounts]=useState({});
  const [dynamicAlibis,setDynamicAlibis]=useState({});
  const [lieScores,setLieScores]=useState({});
  const [crossState,setCrossState]=useState({});
  const [witnessState,setWitnessState]=useState({});
  const [subTab,setSubTab]=useState("interrogate");
  const [hint,setHint]=useState("");
  const [hintUsed,setHintUsed]=useState(false);
  const [hintLoading,setHintLoading]=useState(false);
  const [showHint,setShowHint]=useState(false);
  const [narrator,setNarrator]=useState({text:caseData.narratorIntro||"",loading:false});
  const [showAccuse,setShowAccuse]=useState(false);
  const [accusation,setAccusation]=useState(null);
  const [showReverse,setShowReverse]=useState(false);
  const [revState,setRevState]=useState({suspicion:15,history:[],qIdx:0,ans:"",loading:false,done:false,error:""});
  const [showDossier,setShowDossier]=useState(null);
  const [showTimeline,setShowTimeline]=useState(null);
  const [showMobile,setShowMobile]=useState(false);
  const [showVote,setShowVote]=useState(false);
  const [teamVotes,setTeamVotes]=useState({});
  const [verdict,setVerdict]=useState(null);
  const [isTV,setIsTV]=useState(false);
  const [isMobile,setIsMobile]=useState(false);
  const player=players[curPlayer];
  const foundClues=clues.filter(c=>c.found);
  const progress=Math.round((foundClues.length/clues.length)*100);
  useEffect(()=>{
    const check=()=>{setIsTV(window.innerWidth>=1400);setIsMobile(window.innerWidth<768);};
    check();window.addEventListener("resize",check);return()=>window.removeEventListener("resize",check);
  },[]);
  useEffect(()=>{
    if(!settings.narratorEnabled||!settings.openaiKey)return;
    const fc=foundClues.map(c=>c.name).join(", ")||"nothing yet";
    const sys="You are a hardboiled noir narrator. One atmospheric sentence, 15-25 words, present tense. No quotes. Evocative and tense.";
    const pr="Case: "+caseData.title+". Phase: "+phase+". Clues found: "+fc+". One atmospheric line.";
    setNarrator(n=>Object.assign({},n,{loading:true}));
    callAI(pr,sys,"narrator",settings).then(txt=>setNarrator({text:isAIErr(txt)?"The investigation continues...":txt,loading:false}));
  },[phase]);
  const discoverClue=c=>setClues(prev=>prev.map(x=>x.id===c.id?Object.assign({},x,{found:true}):x));
  const getHint=async()=>{
    if(!diff.unlimitedHints&&hintUsed)return;
    setHintLoading(true);
    const found=foundClues.map(c=>c.name).join(",")||"nothing";
    const h=await callAI("Detective found: "+found+". One cryptic noir hint 20 words or less toward the next critical clue.","You are the AI game master. Subtle, cryptic, noir-style hints only.","hint",settings);
    setHint(isAIErr(h)?"Look closer at what is already in front of you.":h);
    setHintUsed(true);setShowHint(true);setHintLoading(false);
  };
  const submitAccusation=()=>{
    const s=caseData.suspects.find(x=>x.id===accusation);
    if(diff.permadeath&&!s.guilty){setVerdict({correct:false,permadeath:true,suspect:s,killer:caseData.suspects.find(x=>x.guilty),reason:caseData.killerReason,foundClues,revSuspicion:revState.suspicion,players,teamVotes});setShowAccuse(false);return;}
    setVerdict({correct:s.guilty,suspect:s,killer:caseData.suspects.find(x=>x.guilty),reason:caseData.killerReason,foundClues,revSuspicion:revState.suspicion,players,teamVotes});
    setShowAccuse(false);
  };
  const handleTimerExpire=()=>setVerdict({timerExpired:true,correct:false,suspect:null,killer:caseData.suspects.find(x=>x.guilty),reason:caseData.killerReason,foundClues,revSuspicion:revState.suspicion,players,teamVotes});
  if(verdict)return<VerdictScreen verdict={verdict} caseData={caseData} player={player} onEnd={onEnd}/>;
  const shared={caseData,suspects:caseData.suspects,selSuspect,setSelSuspect,interrogHist,setInterrogHist,questionCounts,setQuestionCounts,dynamicAlibis,setDynamicAlibis,lieScores,setLieScores,crossState,setCrossState,witnessState,setWitnessState,player,settings,diff};
  const sidebarP={caseData,foundClues,clues,progress,revSuspicion:revState.suspicion,hint,showHint,hintUsed,hintLoading,getHint,unlimitedHints:diff.unlimitedHints,aiHints:settings.aiHints,openaiKey:settings.openaiKey};
  return(
    <div style={{minHeight:"100vh",paddingBottom:isMobile?80:0}}>
      <div className="top-nav">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span className="display" style={{fontSize:24,color:T.paper}}>CASE<span style={{color:T.teal}}>ZERO</span></span>
          <span className="tag tag-gold" style={{fontSize:9}}>{caseData.title}</span>
          <span className="mono" style={{fontSize:10,color:T.inkMut}}>{settings.openaiModel||"gpt-4o"}</span>
          {!settings.openaiKey&&<span className="tag tag-red" style={{fontSize:9}}>NO KEY</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {timerMinutes>0&&<CaseTimer minutes={timerMinutes} onExpire={handleTimerExpire} paused={!!verdict}/>}
          {players.length>1&&players.map((p,i)=><div key={p.id} className="player-chip" style={{opacity:i===curPlayer?1:0.4,borderColor:i===curPlayer?p.color:"#232838"}} onClick={()=>setCurPlayer(i)}><div style={{width:7,height:7,borderRadius:"50%",background:p.color}}/><span style={{fontSize:12}}>{p.name}</span></div>)}
          {!isMobile&&gameMode==="combined"&&<div style={{display:"flex",gap:4}}>{[["detective","🔍"],["interrogation","💬"]].map(([id,icon])=><button key={id} className={"btn btn-sm "+(phase===id?"btn-teal":"btn-ghost")} onClick={()=>setPhase(id)}>{icon}</button>)}</div>}
          <button className="btn btn-sm btn-ghost" onClick={()=>setShowMobile(true)}>📱</button>
          <button className="btn btn-sm btn-purple" onClick={()=>setShowReverse(true)}>🎯</button>
          {players.length>1&&<button className="btn btn-sm btn-teal" onClick={()=>setShowVote(true)}>🗳</button>}
          <button className="btn btn-sm btn-red" onClick={()=>setShowAccuse(true)}>⚖ Accuse</button>
        </div>
      </div>
      {settings.narratorEnabled&&<NarratorBar text={narrator.text} loading={narrator.loading}/>}
      {isTV?(
        <div style={{display:"grid",gridTemplateColumns:"300px 1fr 280px",gap:20,padding:"20px 28px"}}>
          <div style={{overflowY:"auto"}}><Sidebar {...sidebarP}/></div>
          <div style={{overflowY:"auto"}}>
            {gameMode==="combined"&&<div style={{display:"flex",gap:8,marginBottom:16}}>{[["detective","🔍","Detect"],["interrogation","💬","Interrogate"]].map(([id,icon,lbl])=><button key={id} className={"btn "+(phase===id?"btn-teal":"btn-ghost")} style={{fontSize:14}} onClick={()=>setPhase(id)}>{icon} {lbl}</button>)}</div>}
            {!settings.openaiKey&&<div style={{marginBottom:14}}><APIWarn/></div>}
            {phase==="detective"&&<CorkboardPanel caseData={caseData} clues={clues} activeRoom={activeRoom} setActiveRoom={setActiveRoom} discoverClue={discoverClue} notes={notes} setNotes={setNotes} settings={settings}/>}
            {phase==="interrogation"&&<InterrogPanel subTab={subTab} setSubTab={setSubTab} setShowDossier={setShowDossier} setShowTimeline={setShowTimeline} suspects={caseData.suspects} questionCounts={questionCounts} dynamicAlibis={dynamicAlibis} lieScores={lieScores} crossState={crossState} {...shared}/>}
          </div>
          <div style={{overflowY:"auto"}}>
            <Lbl style={{marginBottom:12}}>Suspects</Lbl>
            {caseData.suspects.map(s=>{
              const cs=crossState[s.id]||{},qc=questionCounts[s.id]||0;
              return(<div key={s.id} className={"portrait-card "+(selSuspect?.id===s.id?"selected ":"")+(cs.cracked?"cracked":"")} style={{marginBottom:12,cursor:"pointer"}} onClick={()=>{setSelSuspect(s);if(phase!=="interrogation")setPhase("interrogation");}}>
                <div className="portrait-avatar" style={{height:72,fontSize:36}}>{s.avatar||"👤"}</div>
                <div className="portrait-body" style={{padding:"12px 14px"}}><div className="portrait-name" style={{fontSize:18}}>{s.name}</div><div className="portrait-role" style={{marginBottom:8}}>{s.role}</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{qc>0&&<MoodBadge count={qc} guilty={s.guilty}/>}{cs.cracked&&<span className="tag tag-red" style={{fontSize:9}}>CRACKED</span>}{dynamicAlibis[s.id]&&<span className="tag tag-gold" style={{fontSize:9}}>⚡ ALIBI</span>}{lieScores[s.id]!=null&&<span className="tag tag-muted" style={{fontSize:9}}>{lieScores[s.id]}% lie</span>}</div></div>
              </div>);
            })}
          </div>
        </div>
      ):(
        <div style={{maxWidth:1200,margin:"0 auto",padding:"18px 16px",display:isMobile?"flex":"grid",flexDirection:isMobile?"column":undefined,gridTemplateColumns:isMobile?undefined:"240px 1fr",gap:16}}>
          {!isMobile&&<Sidebar {...sidebarP}/>}
          <div>
            {!settings.openaiKey&&<div style={{marginBottom:14}}><APIWarn/></div>}
            {phase==="detective"&&<CorkboardPanel caseData={caseData} clues={clues} activeRoom={activeRoom} setActiveRoom={setActiveRoom} discoverClue={discoverClue} notes={notes} setNotes={setNotes} settings={settings}/>}
            {phase==="interrogation"&&<InterrogPanel subTab={subTab} setSubTab={setSubTab} setShowDossier={setShowDossier} setShowTimeline={setShowTimeline} {...shared}/>}
          </div>
        </div>
      )}
      {isMobile&&gameMode==="combined"&&(
        <div className="bottom-nav">
          {[["detective","🔍","Explore"],["interrogation","💬","Interrogate"]].map(([id,icon,lbl])=>(
            <div key={id} className={"bnav-item "+(phase===id?"active":"")} onClick={()=>setPhase(id)}><div className="bnav-icon">{icon}</div><div className="bnav-label">{lbl}</div></div>
          ))}
          <div className="bnav-item" onClick={()=>setShowReverse(true)}><div className="bnav-icon">🎯</div><div className="bnav-label">Grill</div></div>
          <div className="bnav-item" onClick={()=>setShowAccuse(true)}><div className="bnav-icon">⚖</div><div className="bnav-label" style={{color:T.red}}>Accuse</div></div>
        </div>
      )}
      {showAccuse&&<AccuseModal suspects={caseData.suspects} accusation={accusation} setAccusation={setAccusation} crossState={crossState} onConfirm={submitAccusation} onClose={()=>setShowAccuse(false)} player={player}/>}
      {showVote&&<TeamVoteModal players={players} suspects={caseData.suspects} teamVotes={teamVotes} setTeamVotes={setTeamVotes} onClose={()=>setShowVote(false)}/>}
      {showReverse&&<ReverseModal caseData={caseData} player={player} state={revState} setState={setRevState} onClose={()=>setShowReverse(false)} diff={diff} settings={settings}/>}
      {showDossier&&<DossierModal suspect={showDossier} suspects={caseData.suspects} dynamicAlibis={dynamicAlibis} onClose={()=>setShowDossier(null)}/>}
      {showTimeline&&<TimelineModal suspect={showTimeline} suspects={caseData.suspects} onClose={()=>setShowTimeline(null)}/>}
      {showMobile&&<MobileModal foundClues={foundClues} suspects={caseData.suspects} caseData={caseData} player={player} onClose={()=>setShowMobile(false)}/>}
    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App(){
  const [showSplash,setShowSplash]=useState(true);
  const [screen,setScreen]=useState("home");
  const [gameState,setGameState]=useState(null);
  const [settings,setSettings]=useState({
    openaiKey:process.env.REACT_APP_OPENAI_KEY||"",
    openaiModel:process.env.REACT_APP_OPENAI_MODEL||"gpt-4o",
    elevenLabsKey:process.env.REACT_APP_ELEVENLABS_KEY||"",
    elevenLabsVoiceId:process.env.REACT_APP_ELEVENLABS_VOICE||"",
    aiHints:true,lieDetector:true,narratorEnabled:true,voiceEnabled:false,
  });
  const handleEnd=useCallback((dest)=>{setGameState(null);setScreen(dest||"home");},[]);
  const startGame=(gs)=>{setGameState(gs);setScreen("game");};
  if(showSplash)return(<><style>{css}</style><SplashScreen onDone={()=>setShowSplash(false)}/></>);
  return(
    <>
      <style>{css}</style>
      {screen!=="game"&&(
        <div className="top-nav">
          <span className="display" style={{fontSize:22,color:"#F0EDE6",cursor:"pointer"}} onClick={()=>setScreen("home")}>CASE<span style={{color:"#1ECFB0"}}>ZERO</span></span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!settings.openaiKey&&screen!=="settings"&&<span style={{fontSize:11,color:"#C8A951"}}>⚠ No API key</span>}
            <span className="mono" style={{fontSize:10,color:"#4A4F62"}}>V2.0</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>setScreen("settings")}>⚙</button>
          </div>
        </div>
      )}
      {screen==="home"&&<LandingScreen onStart={s=>setScreen(s)} hasKey={!!settings.openaiKey}/>}
      {screen==="settings"&&<SettingsScreen settings={settings} onChange={setSettings} onBack={()=>setScreen("home")}/>}
      {screen==="lobby"&&<LobbyScreen settings={settings} onStart={startGame} onBack={()=>setScreen("home")}/>}
      {screen==="game"&&gameState&&<GameScreen gameState={gameState} settings={settings} onEnd={handleEnd}/>}
    </>
  );
}

export class CaseEngine {
  constructor(caseData) {
    this.case = caseData;
    this.state = {
      cluesFound: [],
      suspicion: {},
      endings: [],
      timeline: [],
      accused: null,
      resolved: false,
    };
  }

  findClue(clueId) {
    if (!this.state.cluesFound.includes(clueId)) {
      this.state.cluesFound.push(clueId);
    }
  }

  updateSuspicion(suspectId, value) {
    this.state.suspicion[suspectId] =
      (this.state.suspicion[suspectId] || 0) + value;
  }

  getTopSuspect() {
    return Object.entries(this.state.suspicion)
      .sort((a, b) => b[1] - a[1])[0];
  }

  checkEndings() {
    const top = this.getTopSuspect();
    if (!top) return null;

    const suspect = this.case.suspects.find(s => s.id === top[0]);

    if (!suspect) return null;

    if (this.state.cluesFound.length >= 4 && suspect.guilty) {
      return "TRUE_ENDING";
    }

    if (!suspect.guilty && this.state.cluesFound.length >= 4) {
      return "BAD_ACCUSATION";
    }

    if (this.state.cluesFound.length < 2) {
      return "INCONCLUSIVE";
    }

    return null;
  }
}

export function resolveEnding(caseData, engineState) {
  const suspectId = engineState.getTopSuspect()?.[0];
  const suspect = caseData.suspects.find(s => s.id === suspectId);

  if (!suspect) return caseData.endings.neutral;

  const clues = engineState.state.cluesFound.length;

  if (suspect.guilty && clues >= 4) {
    return caseData.endings.trueEnding;
  }

  if (!suspect.guilty && clues >= 4) {
    return caseData.endings.badEnding;
  }

  return caseData.endings.neutralEnding;
}
