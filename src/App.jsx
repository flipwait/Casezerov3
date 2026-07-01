import React, { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// DESIGN TOKENS
// ============================================================
const T = {
  abyss:"#06080C",void:"#0A0C12",shadow:"#10131A",dusk:"#181C26",smoke:"#1F2330",
  gold:"#C9AA71",goldBright:"#E8C97A",goldDim:"#7A6535",
  red:"#E03020",redDim:"#8A2010",
  teal:"#22D4B4",tealDim:"#0D8070",
  purple:"#9B7FD4",purpleDim:"#5A3F8A",
  paper:"#EDE9E0",ink:"#EDE9E0",inkSec:"#8A8FA8",inkMut:"#42475A",
  green:"#30D46A",amber:"#F0A020",orange:"#E07030",blue:"#4488EE",
};
const PLAYER_COLORS=["#22D4B4","#C9AA71","#E03020","#30D46A","#9B7FD4","#E07030","#4488EE","#E91E63"];
const OPENAI_MODELS=[
  {id:"gpt-4o",label:"GPT-4o",desc:"Smart & fast — recommended",tier:"standard"},
  {id:"gpt-4o-mini",label:"GPT-4o Mini",desc:"Fastest, most efficient",tier:"fast"},
  {id:"gpt-4-turbo",label:"GPT-4 Turbo",desc:"Maximum intelligence",tier:"advanced"},
];
// Difficulty: only two tiers now. "Rookie" removed. "Chief Inspector" renamed "Private Investigator".
const DIFFICULTY={
  detective:{id:"detective",label:"Detective",icon:"🟡",desc:"Standard. 1 hint per round. Balanced. 20 min timer.",freeClues:0,unlimitedHints:false,crackMult:1.0,timer:20,reverseQ:3,permadeath:false,lieDetectorForce:false,patienceBase:5},
  pi:{id:"pi",label:"Private Investigator",icon:"🔴",desc:"No hints. Hard cracking. Wrong accusation = game over. 15 min timer.",freeClues:0,unlimitedHints:false,crackMult:1.8,timer:15,reverseQ:4,permadeath:true,lieDetectorForce:false,patienceBase:3},
};
const MOODS={
  cooperative:{label:"Cooperative",icon:"😌",color:"#22D4B4",desc:"Open, gives extra detail"},
  nervous:{label:"Nervous",icon:"😰",color:"#C9AA71",desc:"Anxious, prone to slips"},
  defensive:{label:"Defensive",icon:"😤",color:"#E07030",desc:"Guarded, short answers"},
  hostile:{label:"Hostile",icon:"😠",color:"#E03020",desc:"Refuses to elaborate"},
  lawyered:{label:"Lawyered Up",icon:"⚖",color:"#9B7FD4",desc:"Refuses to answer without counsel"},
};
const getMood=(count,guilty,patience)=>{
  if(patience<=0)return "lawyered";
  if(count===0)return guilty?"nervous":"cooperative";
  if(count<=2)return guilty?"defensive":"nervous";
  if(count<=4)return guilty?"hostile":"defensive";
  return guilty?"hostile":"cooperative";
};
const TIMER_OPTS=[{v:0,l:"Off"},{v:15,l:"15 min"},{v:20,l:"20 min"},{v:30,l:"30 min"},{v:45,l:"45 min"}];

const NEWS_STAGES=[
  {threshold:0,urgency:"low",headlines:["Breaking: Incident reported at event venue","Police respond to scene","Witnesses describe chaotic scene"]},
  {threshold:40,urgency:"medium",headlines:["Suspect still at large — police widen search","DA pressures detectives for arrest","Public fear grows as killer walks free","Sources: investigation stalled with no leads"]},
  {threshold:70,urgency:"high",headlines:["KILLER STILL FREE — Mayor demands answers","Police chief under fire: no arrest after hours","Witnesses now refusing to cooperate","Suspects retain lawyers as pressure mounts"]},
  {threshold:90,urgency:"critical",headlines:["🚨 CRITICAL: Killer believed to be fleeing city","Emergency meeting: DA to take over investigation","Detectives under formal review","Last chance — killer spotted near border"]},
];

const SCENE_MAPS={
  gala:{label:"Rooftop Gala — Floor Plan",width:520,height:300,
    rooms:[
      {id:"Rooftop Bar",x:20,y:20,w:155,h:95,color:"#C9AA7118",border:"#C9AA7155",icon:"🍾",label:"Rooftop Bar"},
      {id:"VIP Lounge",x:195,y:20,w:135,h:95,color:"#22D4B418",border:"#22D4B455",icon:"🛋",label:"VIP Lounge"},
      {id:"Kitchen Entrance",x:350,y:20,w:150,h:95,color:"#E0703018",border:"#E0703055",icon:"🍽",label:"Kitchen"},
      {id:"Security Office",x:20,y:135,w:135,h:95,color:"#9B7FD418",border:"#9B7FD455",icon:"📷",label:"Security"},
      {id:"Victim's Suite",x:175,y:135,w:155,h:95,color:"#E0302018",border:"#E0302055",icon:"💀",label:"Victim Suite"},
    ],
    connections:[{from:"Rooftop Bar",to:"VIP Lounge"},{from:"VIP Lounge",to:"Kitchen Entrance"},{from:"Rooftop Bar",to:"Security Office"},{from:"VIP Lounge",to:"Victim's Suite"}],
  },
  museum:{label:"City Museum — Floor Plan",width:520,height:300,
    rooms:[
      {id:"Gallery Hall A",x:20,y:20,w:145,h:105,color:"#C9AA7118",border:"#C9AA7155",icon:"🖼",label:"Gallery A"},
      {id:"Security Center",x:185,y:20,w:135,h:105,color:"#E0302018",border:"#E0302055",icon:"📷",label:"Security"},
      {id:"Storage Vault",x:340,y:20,w:160,h:105,color:"#9B7FD418",border:"#9B7FD455",icon:"🔒",label:"Vault"},
      {id:"Restorer's Workshop",x:20,y:145,w:155,h:95,color:"#22D4B418",border:"#22D4B455",icon:"🎨",label:"Workshop"},
      {id:"Donor Lounge",x:195,y:145,w:155,h:95,color:"#F0A02018",border:"#F0A02055",icon:"🍷",label:"Donor Lounge"},
    ],
    connections:[{from:"Gallery Hall A",to:"Security Center"},{from:"Security Center",to:"Storage Vault"},{from:"Gallery Hall A",to:"Restorer's Workshop"},{from:"Security Center",to:"Donor Lounge"}],
  },
};

const PRESSURE_EVENTS=[
  {id:"pe1",trigger:30,message:"The DA's office called. They want a name within the hour.",effect:"All suspect patience reduced by 1."},
  {id:"pe2",trigger:55,message:"A witness has gone quiet. Someone got to them.",effect:"Cooperation window closing fast."},
  {id:"pe3",trigger:75,message:"A suspect was spotted near the exit with luggage.",effect:"Killer suspect patience drops to 1."},
  {id:"pe4",trigger:90,message:"Chief Inspector on scene. This is your last chance.",effect:"Final warning — accusation window closing."},
];

// ============================================================
// CASES — each has multiple possible killers (randomized per playthrough)
// alternateEndings[] holds different killer/motive pairs. One is picked
// at random when a case starts, and crossExam/clues adapt to it.
// ============================================================
const CASES=[
  {
    id:"gala",title:"The Crimson Gala",setting:"Rooftop Gala — Midnight",
    badge:"🍾",difficulty:"detective",
    summary:"A billionaire found dead at his own birthday party. The champagne flute still in his hand.",
    victim:"Victor Harmon, 67 — CEO of Harmon Industries",
    cause:"Cyanide poisoning — targeted single champagne glass",
    narratorIntro:"The city never sleeps, but tonight it holds its breath. Victor Harmon is dead on his own rooftop. And somewhere in this room, someone is already rehearsing their alibi.",
    polaroids:[
      {id:"p1",label:"Crime Scene",caption:"Champagne flute still in Harmon's hand. No signs of struggle.",emoji:"🍾"},
      {id:"p2",label:"Bar Station",caption:"Bar unmanned for 4 minutes. Camera angle deliberately blocked.",emoji:"🎥"},
      {id:"p3",label:"Victim's Hand",caption:"Faint chemical residue — not from the drink itself.",emoji:"🧪"},
    ],
    cctv:"11:43pm — CAMERA OFFLINE. Last frame near the bar station is obscured. Duration: 4 minutes 12 seconds. Manual loop detected — internal system access required.",
    finalNote:"A torn note found in the victim's coat pocket. Burnt at the edges. Part of it reads: '...should have told him before the will changed. Too late now.' The rest is illegible — handwriting analysis required.",
    suspects:[
      {id:"diana",name:"Diana Voss",role:"Personal Assistant",age:34,avatar:"👩‍💼",
       alibi:"Claims she was at the bar the entire time",secret:"Was seen near victim's drink 10 minutes before death",
       guiltyAlibi:"Claims she was at the bar the entire time",guiltySecret:"Was seen near victim's drink 10 minutes before death",
       guiltyReason:"Diana served as Victor's PA for 12 years. Removed from his will last week when she discovered plans to sell the company. She slipped cyanide into his champagne during the 4-minute camera gap she created herself.",
       psych:{archetype:"The Loyal Betrayed",traits:["Meticulous","Calculating","Wounded pride"],tell:"Touches left wrist when lying — missing the watch Victor gave her"},
       dossier:{background:"12-year PA to Victor. Removed from will last week.",associates:"Board of Harmon Industries, estate lawyer",record:"Clean",financials:"$95k salary, maxed credit cards"},
       timeline:[{t:"9:00pm",a:"Arrived with Victor"},{t:"10:30pm",a:"Argued with Victor near suite"},{t:"11:40pm",a:"At bar — unconfirmed"},{t:"11:47pm",a:"CAMERA GAP — 4 minutes"},{t:"11:52pm",a:"Returned visibly flushed, hands shaking"}],
       fingerprint:"loop",uvClue:"Cyanide micro-residue on right glove lining — visible only under UV"},
      {id:"marcus",name:"Marcus Harmon",role:"Son & Heir",age:42,avatar:"👨‍💼",
       alibi:"Was giving a speech on stage — 60 witnesses",secret:"$2.1M gambling debts",
       guiltyAlibi:"Claims his speech ran the entire window — but it ended 8 minutes earlier than logged",
       guiltySecret:"$2.1M gambling debts and a forged loan application using his father's signature",
       guiltyReason:"Marcus was about to be cut off financially — Victor discovered the forged loan applications. Facing total ruin, Marcus slipped away during the post-speech mingling to poison his father's glass before anyone noticed his absence.",
       psych:{archetype:"The Desperate Heir",traits:["Impulsive","Charming facade","Deeply in debt"],tell:"Laughs nervously when cornered"},
       dossier:{background:"Victor's son. Failing property firm.",associates:"Debt collectors, lawyers",record:"DUI 2018",financials:"$2.1M gambling debt"},
       timeline:[{t:"9:00pm",a:"Arrived late, nervous"},{t:"10:00pm",a:"Speech — 60 witnesses"},{t:"11:30pm",a:"Bar — whiskeys"},{t:"12:00am",a:"Still at bar"}],
       fingerprint:"whorl",uvClue:"Trace residue on Marcus's jacket cuff — consistent with handling the same glass cleaner used at the bar"},
      {id:"elena",name:"Elena Vance",role:"Business Rival",age:55,avatar:"👩‍💼",
       alibi:"Left early — valet confirmed 11:15pm",secret:"Secret merger negotiations with Victor",
       guiltyAlibi:"Valet log shows her car left at 11:15pm — but a second valet ticket shows she re-entered through the kitchen at 11:38pm",
       guiltySecret:"The 'merger' was a hostile takeover Victor had just rejected, costing Elena nine figures",
       guiltyReason:"Elena's takeover bid collapsed that afternoon when Victor rejected it publicly, humiliating her in front of the board. She faked her departure, slipped back in through the kitchen, and poisoned his drink in retaliation.",
       psych:{archetype:"The Power Player",traits:["Cold","Strategic","Feared"],tell:"Gives too much detail — classic over-explanation"},
       dossier:{background:"CEO of VanceCorp, 20yr rival.",associates:"Wall Street brokers",record:"None",financials:"$340M net worth"},
       timeline:[{t:"9:00pm",a:"Arrived alone"},{t:"11:15pm",a:"Departed — valet confirmed"}],
       fingerprint:"arch",uvClue:"Faint shoe print residue matching kitchen entrance tile compound"},
      {id:"chef",name:"Chef Remy Blanc",role:"Head Caterer",age:48,avatar:"👨‍🍳",
       alibi:"In kitchen all night — 3 witnesses",secret:"Blackmailed by Victor over a health code violation",
       guiltyAlibi:"Kitchen staff confirm his presence, but the timestamps on the prep logs were edited",
       guiltySecret:"Victor was about to report the health code violation publicly, ending Remy's career and restaurant",
       guiltyReason:"Remy was being blackmailed into free catering for years. When Victor threatened to expose the violation anyway — out of spite — Remy slipped the poison into the champagne tray himself before it was carried to the bar.",
       psych:{archetype:"The Cornered Professional",traits:["Proud","Secretive","Volatile"],tell:"Deflects with irrelevant food details"},
       dossier:{background:"Renowned chef, 7yr Harmon events.",associates:"Kitchen staff",record:"Obstruction 2019",financials:"Restaurant struggling"},
       timeline:[{t:"6:00pm",a:"Setup"},{t:"11:00pm",a:"Kitchen — confirmed"},{t:"12:00am",a:"Still in kitchen"}],
       fingerprint:"loop",uvClue:"Trace chemical compound found on a chef's glove discarded in the trash, matching the poison signature"},
    ],
    clues:[
      {id:"c1",name:"Cyanide Residue",desc:"Found only in victim's flute — targeted, not accidental.",critical:true,room:"Rooftop Bar",found:false,hasFingerprint:true,hasUV:true},
      {id:"c2",name:"Broken Nail Fragment",desc:"Acrylic nail near drink station.",critical:true,room:"Rooftop Bar",found:false,hasFingerprint:true,hasUV:false},
      {id:"c3",name:"Deleted Calendar Entry",desc:"Victor's phone: a deleted meeting for tomorrow morning.",critical:false,room:"Victim's Suite",found:false,hasFingerprint:false,hasUV:false},
      {id:"c4",name:"Security Camera Gap",desc:"Footage 11:43-11:47pm near bar was manually looped.",critical:false,room:"Security Office",found:false,hasFingerprint:false,hasUV:false},
      {id:"c5",name:"Bar Receipt",desc:"Drink order log from 10pm-midnight.",critical:false,room:"VIP Lounge",found:false,hasFingerprint:false,hasUV:false},
      {id:"c6",name:"Valet Log",desc:"Vehicle movement log from the valet stand.",critical:false,room:"Kitchen Entrance",found:false,hasFingerprint:false,hasUV:false},
    ],
    rooms:["Rooftop Bar","VIP Lounge","Kitchen Entrance","Security Office","Victim's Suite"],
    witnesses:[
      {id:"w1",name:"Jake Torres",role:"Head Bartender",avatar:"🧑‍🍳",summary:"Worked the bar all night. Saw something he didn't report.",
       statements:[
         {trigger:"general",text:"Mr. Harmon seemed fine early on. Around 11:30 things got strange near the drink station, but I was slammed and didn't think much of it at the time."},
         {trigger:"suspicious",text:"After police arrived I found a small glass vial under the bar mat. It smelled like bitter almonds."},
       ]},
    ],
    interrogationQuestions:{
      diana:[{q:"Where exactly were you between 11:40 and 11:50pm?"},{q:"We found a nail fragment near the champagne — is that yours?"},{q:"When did you last speak privately with Victor today?"}],
      marcus:[{q:"How much debt are you carrying right now?"},{q:"Did you know your father was changing the will?"}],
      elena:[{q:"Your valet ticket shows two exits tonight. Explain that."},{q:"What really happened with the merger talks?"}],
      chef:[{q:"Why were the kitchen prep logs edited tonight?"},{q:"What was Victor holding over you?"}],
    },
    reverseInterrogation:{
      alibi:"I was reviewing crime scene photographs and interviewing catering staff.",
      secret:"You arrived 20 minutes late and used the service entrance.",
      questions:["Your sign-in shows you used the service entrance — same door the killer likely used. Explain that.","We found your fingerprints on the victim's glass. Why touch key evidence without gloves?","A witness says you argued with the victim three weeks ago. What was that about?","You took 20 minutes longer than protocol to secure the scene. What were you doing?"],
    },
    crossExam:{
      diana:{contradiction:"Diana claims she was at the bar all night — but the camera gap is 11:43-11:47pm, exactly when she says she was standing there.",pressure:"the nail fragment and camera gap",threshold:2},
      marcus:{contradiction:"Marcus's speech timing doesn't match the venue's own AV log — there's an 8-minute discrepancy.",pressure:"the AV log discrepancy",threshold:2},
      elena:{contradiction:"Elena's valet ticket shows a departure at 11:15pm, but a second ticket shows re-entry through the kitchen at 11:38pm.",pressure:"the second valet ticket",threshold:2},
      chef:{contradiction:"Remy says the kitchen logs are accurate, but the timestamps don't match the actual prep schedule by 20 minutes.",pressure:"the edited prep logs",threshold:2},
    },
  },
  {
    id:"museum",title:"The Missing Vermeer",setting:"City Modern Art Museum — 2am",
    badge:"🎨",difficulty:"pi",
    summary:"A priceless Vermeer disappeared during a gala opening. The motion sensors never triggered.",
    victim:"Girl with a Pearl Earring II — estimated $80M",
    cause:"Inside job — master sensor override, 4-minute window",
    narratorIntro:"They say art is eternal. Tonight $80 million worth of eternity walked out the front door. Somebody in this building knew exactly when to move.",
    polaroids:[
      {id:"p1",label:"Empty Frame",caption:"Painting removed cleanly — no glass shards, no alarm triggered.",emoji:"🖼"},
      {id:"p2",label:"Sensor Terminal",caption:"Override logged at 11:58pm. Single credential used.",emoji:"💻"},
      {id:"p3",label:"Loading Dock",caption:"Tire tracks consistent with panel van. Fresh oil stain.",emoji:"🚐"},
    ],
    cctv:"11:58pm — SENSOR GRID OFFLINE. A figure is briefly visible at terminal C-7. Duration: 4 minutes 03 seconds. Painting removed during blackout. Loading dock footage: unregistered vehicle departing 12:02am.",
    finalNote:"A handwritten receipt found crumpled in a trash bin near the loading dock. Partial text: '...balance due on delivery, as discussed. Destroy after reading.' No signature — ink type and paper stock could narrow down the source.",
    suspects:[
      {id:"noah",name:"Noah Park",role:"Head of Security",age:38,avatar:"👮",
       alibi:"Claims he was on his scheduled patrol rounds",secret:"Offshore accounts with three unexplained deposits",
       guiltyAlibi:"Claims he was on patrol, but his badge access log places him at the sensor terminal at the exact override time",
       guiltySecret:"Offshore accounts show a $180k deposit from a shell company 72 hours after the theft",
       guiltyReason:"Noah was approached by a private collector months ago and offered a fortune to look the other way. He disabled the sensors during a guard rotation gap and reported the theft himself to appear above suspicion.",
       psych:{archetype:"The Trusted Insider",traits:["Disciplined facade","Financially desperate","Rehearsed calm"],tell:"Becomes hyper-precise about timings — too rehearsed"},
       dossier:{background:"15yr security veteran. Former police. IA probe 2019.",associates:"Private collectors, offshore broker",record:"IA investigation — no charges",financials:"Salary $62k. Offshore: $220k unaccounted"},
       timeline:[{t:"8:00pm",a:"Started shift"},{t:"11:50pm",a:"Near sensor terminal"},{t:"11:54pm",a:"4-min sensor disable"},{t:"12:05am",a:"Reported theft himself"}],
       fingerprint:"whorl",uvClue:"UV ink from sensor terminal keypad found on Noah's right thumb"},
      {id:"curator",name:"Dr. Sofia Chen",role:"Lead Curator",age:51,avatar:"👩‍🎨",
       alibi:"At gala dinner — 8 witnesses",secret:"Forged authentication papers 2022",
       guiltyAlibi:"Dinner witnesses confirm her presence, but she left the table unaccounted for nearly 10 minutes around the time of the theft",
       guiltySecret:"The forged authentication papers meant the real Vermeer had already been quietly sold years ago — this was a meticulously staged 'theft' of a replica to cover the original switch",
       guiltyReason:"Sofia forged authentication papers years ago to sell the real painting privately, replacing it with a replica. Tonight's 'theft' was staged to permanently erase any chance of forensic discovery — she orchestrated the blackout herself using stolen credentials.",
       psych:{archetype:"The Reputation Protector",traits:["Intellectual","Proud","Scandal-averse"],tell:"Changes subject rapidly when forgery comes up"},
       dossier:{background:"20yr museum veteran.",associates:"Art world, auction houses",record:"None",financials:"$110k — clean"},
       timeline:[{t:"7:00pm",a:"Gala setup"},{t:"9:00pm",a:"Donor dinner — 8 witnesses"},{t:"12:10am",a:"First on scene"}],
       fingerprint:"loop",uvClue:"Solvent residue on Sofia's evening gloves, consistent with canvas relining chemicals"},
      {id:"restorer",name:"Kai Brennan",role:"Art Restorer",age:29,avatar:"🎨",
       alibi:"Left at 10pm — badge confirmed",secret:"Has skills to replicate masterworks",
       guiltyAlibi:"Badge shows an exit at 10:07pm, but the badge was used again to re-enter through a side door at 11:49pm under a guest credential",
       guiltySecret:"Kai was commissioned to create an exact replica months ago — for what he was told was 'insurance purposes'",
       guiltyReason:"Kai built the replica believing it was for legitimate insurance display. When he realized the buyer intended to swap the real piece tonight, he returned in secret to stop it — but got caught executing the swap himself, framed by the same people who hired him.",
       psych:{archetype:"The Misunderstood Prodigy",traits:["Introverted","Defensive","Honest to a fault"],tell:"Makes eye contact only when speaking truth"},
       dossier:{background:"Prodigy restorer, known copier.",associates:"Private galleries",record:"None",financials:"Freelance"},
       timeline:[{t:"10:07pm",a:"Badge exit logged"},{t:"11:49pm",a:"Re-entry via side door, guest credential"}],
       fingerprint:"arch",uvClue:"Fresh varnish residue on Kai's fingertips, matching the replica canvas in storage"},
      {id:"patron",name:"Vivienne Lau",role:"Major Donor",age:63,avatar:"👩‍💼",
       alibi:"At table until midnight — 4 witnesses",secret:"Tried to buy this painting for 5 years",
       guiltyAlibi:"Table witnesses confirm her presence, but her assistant was seen near the loading dock during the blackout window",
       guiltySecret:"Her $4M offer was declined years ago — she had quietly arranged for the painting to be 'acquired' through other means",
       guiltyReason:"After years of rejection, Vivienne arranged the theft through an intermediary — her assistant — paying off museum staff to look away. She never left her table, orchestrating everything from a distance.",
       psych:{archetype:"The Obsessed Collector",traits:["Possessive","Indirect","Plays long games"],tell:"Asks questions back when she feels cornered"},
       dossier:{background:"Billionaire collector. $4M offer declined.",associates:"Art brokers",record:"None",financials:"$1.2B net worth"},
       timeline:[{t:"7:00pm",a:"Arrived"},{t:"11:45pm",a:"Still at table"}],
       fingerprint:"loop",uvClue:"Trace cash residue (uncommon bill-counting chemical) found on Vivienne's clutch"},
    ],
    clues:[
      {id:"c1",name:"Sensor Override Log",desc:"4-min disable at 11:58pm. A single credential authorized.",critical:true,room:"Security Center",found:false,hasFingerprint:true,hasUV:true},
      {id:"c2",name:"Offshore Wire Transfer",desc:"Large transfer from a shell company — 72hrs post-theft.",critical:true,room:"Security Center",found:false,hasFingerprint:false,hasUV:false},
      {id:"c3",name:"Replica Canvas",desc:"Blank canvas matching the Vermeer's exact dimensions, found in storage.",critical:false,room:"Storage Vault",found:false,hasFingerprint:true,hasUV:false},
      {id:"c4",name:"Forgery File",desc:"Old authentication paperwork that doesn't match museum records.",critical:false,room:"Restorer's Workshop",found:false,hasFingerprint:false,hasUV:false},
      {id:"c5",name:"Badge Access Log",desc:"Exit and re-entry timestamps for museum staff.",critical:false,room:"Gallery Hall A",found:false,hasFingerprint:false,hasUV:false},
      {id:"c6",name:"Donor Offer Letter",desc:"A private purchase offer, declined years ago.",critical:false,room:"Donor Lounge",found:false,hasFingerprint:false,hasUV:false},
    ],
    rooms:["Gallery Hall A","Security Center","Storage Vault","Restorer's Workshop","Donor Lounge"],
    witnesses:[
      {id:"w1",name:"Officer Ray Chen",role:"Junior Guard",avatar:"👮",summary:"On patrol. Sent on an unexplained break right before the blackout.",
       statements:[
         {trigger:"general",text:"I was told to take a 20-minute break at 11:45. That never happens — rotation is always strict here."},
         {trigger:"suspicious",text:"After the theft was reported, whoever called it in was unusually calm. In five years I've never seen anyone that composed during an incident."},
       ]},
    ],
    interrogationQuestions:{
      noah:[{q:"Walk me through your exact location at 11:50pm."},{q:"Someone used your credentials to disable the sensors."},{q:"Explain the offshore deposit 72 hours after the theft."}],
      curator:[{q:"Tell me about the forged authentication certificate from 2022."},{q:"Where were you for the 10 minutes you left the dinner table?"}],
      restorer:[{q:"Your badge shows a re-entry at 11:49pm using a guest credential. Explain that."},{q:"Who commissioned the replica, and why?"}],
      patron:[{q:"Where was your assistant during the blackout window?"},{q:"You tried to buy this painting for years. Tell me about that."}],
    },
    reverseInterrogation:{
      alibi:"I was called in after the fact — not on duty when it occurred.",
      secret:"Your precinct received funding from the museum foundation last month.",
      questions:["Your precinct received funding from the museum foundation last month. Doesn't that compromise you?","You were seen dining with one of the donors two weeks before the heist.","Your file shows you cleared a suspect quickly in a prior incident.","Several art theft cases this year remain unsolved. Why?"],
    },
    crossExam:{
      noah:{contradiction:"Noah's badge access log places him at the sensor terminal at the exact override time, contradicting his patrol claim.",pressure:"the badge access timestamp",threshold:2},
      curator:{contradiction:"Sofia says she never left the dinner table, but witnesses confirm she was missing for nearly 10 minutes.",pressure:"the unaccounted 10 minutes",threshold:2},
      restorer:{contradiction:"Kai's badge shows an exit at 10:07pm but a re-entry at 11:49pm using a guest credential — well after his claimed departure.",pressure:"the guest credential re-entry",threshold:2},
      patron:{contradiction:"Vivienne's assistant was seen near the loading dock during the blackout — a detail she never mentioned.",pressure:"the assistant's presence at the dock",threshold:2},
    },
  },
];

function pickRandomKiller(caseTemplate){
  const c=JSON.parse(JSON.stringify(caseTemplate));
  const idx=Math.floor(Math.random()*c.suspects.length);
  c.suspects=c.suspects.map((s,i)=>{
    if(i===idx){
      return Object.assign({},s,{
        guilty:true,
        alibi:s.guiltyAlibi||s.alibi,
        secret:s.guiltySecret||s.secret,
      });
    }
    return Object.assign({},s,{guilty:false});
  });
  c.killer=c.suspects[idx].name;
  c.killerReason=c.suspects[idx].guiltyReason||"The evidence points to this suspect.";
  return c;
}

// ============================================================
// AI ENGINE — Claude (Anthropic)
// ============================================================
const AI_ERR="[AI_ERROR]";
const isAIErr=(t)=>!t||t.startsWith(AI_ERR)||(t.startsWith("[")&&t.includes("error"));

async function callAI(prompt,sys,_ctx,settings){
  const model=settings.openAIModel||"gpt-4o";
  try{
    const messages=[];
    if(sys)messages.push({role:"system",content:sys});
    messages.push({role:"user",content:prompt});
    const res=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+(settings.openAIKey||"")},
      body:JSON.stringify({model,messages,max_tokens:1000}),
    });
    if(!res.ok){
      let eb="";try{const ej=await res.json();eb=ej?.error?.message||"";}catch{eb=await res.text().catch(()=>"");}
      if(res.status===401)return AI_ERR+" Invalid API key. Check Settings.";
      if(res.status===429)return AI_ERR+" Rate limit. Wait a moment.";
      return AI_ERR+" API error "+res.status+": "+eb.slice(0,80);
    }
    const data=await res.json();
    const text=data?.choices?.[0]?.message?.content?.trim();
    if(!text)return AI_ERR+" Empty response.";
    return text;
  }catch(err){return AI_ERR+" "+err.message;}
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

async function speakText(text,voiceCfg,settings){
  const key=voiceCfg?.elevenLabsKey||settings.elevenLabsKey;
  const voiceId=voiceCfg?.elevenLabsVoiceId||settings.elevenLabsVoiceId;
  if(!settings.voiceEnabled||!key||!voiceId||isAIErr(text))return;
  try{
    const res=await fetch("https://api.elevenlabs.io/v1/text-to-speech/"+voiceId,{method:"POST",headers:{"xi-api-key":key,"Content-Type":"application/json"},body:JSON.stringify({text,model_id:"eleven_monolingual_v1"})});
    if(!res.ok)return;
    new Audio(URL.createObjectURL(await res.blob())).play();
  }catch(e){console.warn("[TTS]",e.message);}
}

// ============================================================
// CSS
// ============================================================
const css=`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital@1&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#06080C;color:#EDE9E0;font-family:'Inter',sans-serif;min-height:100vh;overflow-x:hidden;}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:0.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:128px 128px;}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#0A0C12;}::-webkit-scrollbar-thumb{background:#1F2330;border-radius:2px;}::-webkit-scrollbar-thumb:hover{background:#C9AA71;}
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pinDrop{0%{opacity:0;transform:translateY(-28px) scale(0.85)}65%{transform:translateY(3px) scale(1.04)}100%{opacity:1;transform:none}}
@keyframes pulseRed{0%,100%{box-shadow:0 0 0 0 #E0302022}50%{box-shadow:0 0 28px 6px #E0302044}}
@keyframes scanline{from{transform:translateY(0)}to{transform:translateY(100vh)}}
@keyframes breathe{0%,100%{opacity:0.6}50%{opacity:1}}
@keyframes crackFlash{0%{background:#E0302000}50%{background:#E0302018}100%{background:#E0302000}}
@keyframes tickerScroll{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
@keyframes polaroidDrop{0%{opacity:0;transform:translateY(-20px) rotate(-2deg)}100%{opacity:1;transform:none}}
@keyframes uvGlow{0%,100%{box-shadow:0 0 0 0 #A020F000}50%{box-shadow:0 0 24px 6px #A020F055}}
@keyframes urgencyPulse{0%,100%{opacity:1}50%{opacity:0.4}}
@keyframes decodeFlicker{0%,100%{opacity:1}50%{opacity:0.5}}
.anim-up{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;}
.anim-in{animation:fadeIn 0.35s ease both;}
.anim-pin{animation:pinDrop 0.55s cubic-bezier(0.34,1.56,0.64,1) both;}
.display{font-family:'Bebas Neue',sans-serif;letter-spacing:0.04em;line-height:0.92;}
.mono{font-family:'JetBrains Mono',monospace;}
.noir{font-family:'Playfair Display',serif;font-style:italic;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 17px;border-radius:3px;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid transparent;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;}
.btn:disabled{opacity:0.28;cursor:not-allowed;pointer-events:none;}
.btn-gold{background:#C9AA7114;border-color:#C9AA7150;color:#C9AA71;}.btn-gold:hover{background:#C9AA7124;border-color:#C9AA71;box-shadow:0 0 20px #C9AA7128;}
.btn-red{background:#E0302014;border-color:#E0302050;color:#E03020;}.btn-red:hover{background:#E0302024;border-color:#E03020;}
.btn-teal{background:#22D4B414;border-color:#22D4B450;color:#22D4B4;}.btn-teal:hover{background:#22D4B424;border-color:#22D4B4;box-shadow:0 0 20px #22D4B428;}
.btn-purple{background:#9B7FD414;border-color:#9B7FD450;color:#9B7FD4;}.btn-purple:hover{background:#9B7FD424;border-color:#9B7FD4;}
.btn-green{background:#30D46A14;border-color:#30D46A50;color:#30D46A;}.btn-green:hover{background:#30D46A24;border-color:#30D46A;}
.btn-ghost{background:transparent;border-color:#1F2330;color:#8A8FA8;}.btn-ghost:hover{border-color:#8A8FA8;color:#EDE9E0;}
.btn-amber{background:#F0A02014;border-color:#F0A02050;color:#F0A020;}.btn-amber:hover{background:#F0A02024;border-color:#F0A020;}
.btn-sm{padding:6px 12px;font-size:10px;}.btn-lg{padding:13px 32px;font-size:14px;}.btn-xl{padding:17px 44px;font-size:15px;}
.card{background:#0A0C12;border:1px solid #1F2330;border-radius:4px;transition:border-color 0.2s;}
.card-gold{border-color:#C9AA7140;}.card-red{border-color:#E0302040;}.card-teal{border-color:#22D4B440;}.card-purple{border-color:#9B7FD440;}.card-amber{border-color:#F0A02040;}
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:2px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;font-family:'JetBrains Mono',monospace;}
.tag-gold{background:#C9AA7110;color:#C9AA71;border:1px solid #C9AA7124;}.tag-red{background:#E0302010;color:#E03020;border:1px solid #E0302024;}
.tag-teal{background:#22D4B410;color:#22D4B4;border:1px solid #22D4B424;}.tag-purple{background:#9B7FD410;color:#9B7FD4;border:1px solid #9B7FD424;}
.tag-green{background:#30D46A10;color:#30D46A;border:1px solid #30D46A24;}.tag-muted{background:#1F233010;color:#42475A;border:1px solid #1F233030;}
.tag-amber{background:#F0A02010;color:#F0A020;border:1px solid #F0A02024;}
.input{background:#10131A;border:1px solid #1F2330;border-radius:3px;padding:10px 14px;color:#EDE9E0;font-family:'Inter',sans-serif;font-size:14px;width:100%;outline:none;transition:border-color 0.15s;}
.input:focus{border-color:#22D4B4;box-shadow:0 0 0 3px #22D4B40C;}
.input::placeholder{color:#42475A;}
textarea.input{resize:vertical;min-height:80px;line-height:1.65;}
.spinner{width:14px;height:14px;border:2px solid #1F2330;border-top-color:#22D4B4;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;flex-shrink:0;}
.label{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#42475A;}
.bar-track{height:3px;background:#1F2330;border-radius:2px;overflow:hidden;}
.bar-fill{height:100%;border-radius:2px;transition:width 0.5s ease;}
.susp-track{height:6px;background:#1F2330;border-radius:3px;overflow:hidden;}
.susp-fill{height:100%;border-radius:3px;transition:width 0.6s cubic-bezier(0.34,1.56,0.64,1);}
.overlay{position:fixed;inset:0;background:#06080CEE;backdrop-filter:blur(16px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:#0A0C12;border:1px solid #1F2330;border-radius:6px;padding:28px;max-width:680px;width:100%;max-height:90vh;overflow-y:auto;animation:fadeUp 0.25s ease;}
.modal-wide{max-width:940px;}
.top-nav{position:sticky;top:0;z-index:100;background:#06080CF4;backdrop-filter:blur(28px);border-bottom:1px solid #1F2330;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;height:54px;}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:#06080CF8;backdrop-filter:blur(20px);border-top:1px solid #1F2330;display:flex;align-items:center;justify-content:space-around;height:64px;padding:0 6px;padding-bottom:env(safe-area-inset-bottom,0);}
.bnav-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;padding:6px 10px;border-radius:4px;transition:all 0.15s;min-width:48px;flex:1;}
.bnav-item.active{background:#22D4B40E;}
.bnav-icon{font-size:19px;line-height:1;}
.bnav-label{font-size:8px;letter-spacing:0.06em;font-family:'JetBrains Mono',monospace;text-transform:uppercase;color:#42475A;transition:color 0.15s;white-space:nowrap;}
.bnav-item.active .bnav-label{color:#22D4B4;}
.player-chip{display:flex;align-items:center;gap:7px;padding:4px 11px;background:#10131A;border:1px solid #1F2330;border-radius:16px;font-size:12px;cursor:pointer;transition:all 0.15s;}
.toggle{width:38px;height:21px;border-radius:11px;cursor:pointer;position:relative;transition:all 0.2s;flex-shrink:0;}
.toggle-knob{width:15px;height:15px;border-radius:50%;background:white;position:absolute;top:3px;transition:left 0.2s;}
.portrait-card{background:#0A0C12;border:1px solid #1F2330;border-radius:4px;cursor:pointer;transition:all 0.15s;overflow:hidden;}
.portrait-card:hover{border-color:#42475A;}
.portrait-card.selected{border-color:#22D4B4;background:#22D4B408;}
.portrait-card.cracked{border-color:#E03020;animation:crackFlash 0.5s ease;}
.portrait-card.lawyered{border-color:#9B7FD4;opacity:0.65;}
.portrait-avatar{display:flex;align-items:center;justify-content:center;background:#10131A;border-bottom:1px solid #1F2330;}
.portrait-body{padding:12px 14px;}
.portrait-name{font-family:'Bebas Neue',sans-serif;letter-spacing:0.04em;color:#EDE9E0;}
.portrait-role{font-size:11px;color:#8A8FA8;margin-top:2px;}
.bubble{max-width:85%;padding:10px 14px;border-radius:4px;font-size:13px;line-height:1.65;border:1px solid transparent;}
.bubble-user{background:#22D4B40E;border-color:#22D4B428;align-self:flex-end;}
.bubble-ai{background:#10131A;border-color:#1F2330;}
.bubble-error{background:#E030200E;border-color:#E0302028;color:#E03020;}
.bubble-system{background:#9B7FD40E;border-color:#9B7FD428;color:#9B7FD4;font-style:italic;}
.bubble-reverse{background:#9B7FD40E;border-color:#9B7FD428;}
.bubble-pressure{background:#E030200E;border-color:#E0302028;}
.bubble-backtalk{background:#F0A02010;border-color:#F0A02040;font-style:italic;}
.corkboard{background:#1A1208;border:1px solid #2A1E10;border-radius:6px;padding:24px;min-height:320px;}
.cork-note{background:#F5EDD0;border-radius:2px;padding:14px 12px 12px;position:relative;cursor:pointer;box-shadow:0 3px 14px rgba(0,0,0,0.55),0 1px 3px rgba(0,0,0,0.3);transition:transform 0.15s,box-shadow 0.15s;min-height:100px;}
.cork-note:hover{transform:translateY(-3px) rotate(0.5deg);box-shadow:0 8px 24px rgba(0,0,0,0.6);}
.cork-note.unknown{background:#2A2418;}
.cork-note.critical::after{content:'';position:absolute;inset:0;border-radius:2px;border:2px solid #C9AA71;pointer-events:none;}
.cork-note-title{font-weight:700;font-size:12px;color:#1A1208;margin-bottom:5px;}
.cork-note-body{font-size:11px;color:#3A3020;line-height:1.55;}
.cork-stamp{position:absolute;top:6px;right:8px;font-size:8px;font-weight:900;letter-spacing:0.15em;color:#8A6510;opacity:0.7;font-family:'JetBrains Mono',monospace;text-transform:uppercase;}
.forensics-panel{background:#0A1A14;border:1px solid #22D4B430;border-radius:3px;padding:10px 12px;}
.evidence-thread{position:relative;padding-left:20px;}
.evidence-thread::before{content:'';position:absolute;left:7px;top:0;bottom:0;width:1px;background:linear-gradient(to bottom,#C9AA7100,#C9AA7160,#C9AA7100);}
.thread-node{position:absolute;left:3px;width:9px;height:9px;border-radius:50%;border:2px solid #06080C;}
.witness-item{background:#0A0C12;border:1px solid #1F2330;border-radius:4px;padding:14px;cursor:pointer;transition:all 0.15s;}
.witness-item:hover{border-color:#42475A;}
.witness-item.selected{border-color:#22D4B4;background:#22D4B408;}
.diff-card{background:#10131A;border:1px solid #1F2330;border-radius:4px;padding:16px;cursor:pointer;transition:all 0.15s;text-align:center;}
.diff-card:hover{border-color:#42475A;}
.diff-card.selected{border-color:#C9AA71;background:#C9AA7108;}
.model-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:4px;border:1px solid #1F2330;cursor:pointer;transition:all 0.15s;background:#10131A;}
.model-row:hover{border-color:#42475A;}
.model-row.active{border-color:#22D4B4;background:#22D4B408;}
.tactic-card{background:#10131A;border:1px solid #1F2330;border-radius:4px;padding:12px 14px;cursor:pointer;transition:all 0.15s;}
.tactic-card:hover{border-color:#42475A;}
.tactic-card.selected{border-color:#E03020;background:#E030200E;}
.accuse-card{background:#10131A;border:1px solid #1F2330;border-radius:4px;padding:14px 16px;cursor:pointer;transition:all 0.15s;}
.accuse-card:hover{border-color:#E0302060;}
.accuse-card.selected{border-color:#E03020;background:#E030200E;}
.narrator-bar{background:#06080C;border-bottom:1px solid #1F2330;padding:8px 24px;overflow:hidden;}
.narrator-text{font-family:'Playfair Display',serif;font-style:italic;font-size:13px;color:#8A8FA8;letter-spacing:0.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.timer-display{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;padding:4px 12px;border-radius:3px;background:#10131A;border:1px solid #1F2330;letter-spacing:0.08em;}
.timer-display.warning{color:#F0A020;border-color:#F0A02040;background:#F0A02010;}
.timer-display.critical{color:#E03020;border-color:#E0302040;background:#E0302010;animation:pulseRed 1s infinite;}
.psych-card{background:#0A0C12;border:1px solid #9B7FD440;border-radius:4px;padding:14px 16px;margin-top:12px;}
.sidebar-section{margin-bottom:20px;}
.sidebar-section-title{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#42475A;padding:0 0 8px 0;border-bottom:1px solid #1F2330;margin-bottom:12px;}
.splash-bg{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#06080C;overflow:hidden;}
.splash-scanline{position:absolute;width:100%;height:2px;background:linear-gradient(90deg,transparent,#22D4B414,transparent);animation:scanline 3s linear infinite;pointer-events:none;}
.splash-grid{position:absolute;inset:0;background-image:linear-gradient(#1F233010 1px,transparent 1px),linear-gradient(90deg,#1F233010 1px,transparent 1px);background-size:40px 40px;pointer-events:none;}
.case-select-card{background:#0A0C12;border:1px solid #1F2330;border-radius:4px;padding:16px;cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden;}
.case-select-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:transparent;transition:background 0.15s;}
.case-select-card:hover{border-color:#42475A;transform:translateY(-1px);}
.case-select-card.selected{border-color:#C9AA71;}
.case-select-card.selected::before{background:#C9AA71;}
.profiler-trait{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;background:#9B7FD410;border:1px solid #9B7FD428;border-radius:2px;font-size:10px;color:#9B7FD4;font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;}
.verdict-bg{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;}
.news-ticker-wrap{overflow:hidden;border-bottom:1px solid #1F2330;height:28px;display:flex;align-items:center;position:relative;}
.news-ticker-inner{display:flex;align-items:center;white-space:nowrap;animation:tickerScroll 28s linear infinite;}
.news-ticker-inner.urgent{animation-duration:18s;}
.news-ticker-inner.critical-speed{animation-duration:10s;}
.ticker-badge{flex-shrink:0;padding:2px 10px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;margin-right:16px;}
.ticker-item{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.08em;padding:0 24px;border-right:1px solid;}
.fp-match-card{background:#10131A;border:1px solid #1F2330;border-radius:4px;padding:12px;cursor:pointer;transition:all 0.15s;text-align:center;}
.fp-match-card:hover{border-color:#42475A;}
.fp-match-card.matched{border-color:#30D46A;background:#30D46A10;}
.fp-match-card.wrong{border-color:#E03020;background:#E0302010;}
.uv-surface{position:relative;overflow:hidden;border-radius:4px;cursor:none;user-select:none;}
.uv-torch{position:absolute;width:120px;height:120px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,#A020F044 0%,#A020F022 40%,transparent 70%);transition:opacity 0.1s;}
.uv-revealed{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#A020F0;text-align:center;padding:20px;opacity:0;transition:opacity 0.3s;pointer-events:none;text-shadow:0 0 20px #A020F0,0 0 40px #A020F0;}
.scene-map-room{cursor:pointer;transition:all 0.2s;}
.scene-map-room:hover{filter:brightness(1.4);}
.polaroid{background:#F5F0E8;padding:12px 12px 32px;box-shadow:0 4px 20px rgba(0,0,0,0.6),0 1px 4px rgba(0,0,0,0.4);transform-origin:center;transition:transform 0.2s;cursor:pointer;animation:polaroidDrop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;}
.polaroid:hover{transform:scale(1.05) rotate(1deg);}
.polaroid-inner{width:140px;height:100px;background:#1A1A1A;display:flex;align-items:center;justify-content:center;margin-bottom:10px;border:1px solid #0A0A0A;}
.polaroid-caption{font-family:'Inter',sans-serif;font-size:9px;color:#3A3020;text-align:center;line-height:1.4;font-style:italic;}
.cctv-panel{background:#000;border:2px solid #1F2330;border-radius:4px;padding:16px;font-family:'JetBrains Mono',monospace;position:relative;overflow:hidden;}
.cctv-panel::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,0,0.015) 2px,rgba(0,255,0,0.015) 4px);pointer-events:none;}
.cctv-text{color:#00FF41;font-size:11px;line-height:1.8;text-shadow:0 0 8px #00FF4188;}
.cctv-cursor{display:inline-block;width:8px;height:13px;background:#00FF41;margin-left:2px;animation:urgencyPulse 0.8s infinite;}
.pressure-event{position:fixed;top:70px;right:20px;z-index:150;max-width:320px;background:#0A0C12;border:1px solid #E0302060;border-radius:4px;padding:14px 16px;box-shadow:0 8px 32px rgba(224,48,32,0.3);animation:fadeUp 0.3s ease;}
.decode-letter{display:inline-flex;align-items:center;justify-content:center;width:30px;height:36px;border:1px solid #1F2330;border-radius:3px;margin:2px;font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;background:#10131A;color:#42475A;}
.decode-letter.solved{color:#30D46A;border-color:#30D46A50;background:#30D46A0C;}
.mode-select-card{background:#0A0C12;border:1px solid #1F2330;border-radius:6px;padding:24px;cursor:pointer;transition:all 0.2s;text-align:center;flex:1;}
.mode-select-card:hover{border-color:#42475A;transform:translateY(-2px);}
.mode-select-card.selected{border-color:#22D4B4;background:#22D4B408;}
`;

// ============================================================
// SMALL COMPONENTS
// ============================================================
function Lbl({children,style}){return <div className="label" style={style}>{children}</div>;}
function Toggle({on,onChange}){
  return(
    <div className="toggle" style={{background:on?"#22D4B4":"#1F2330"}} onClick={onChange}>
      <div className="toggle-knob" style={{left:on?"20px":"3px"}}/>
    </div>
  );
}
function MoodBadge({count,guilty,patience}){
  const mood=getMood(count,guilty,patience??10);
  const m=MOODS[mood];
  return <span className="tag" style={{background:m.color+"12",color:m.color,border:"1px solid "+m.color+"24",fontSize:9}}>{m.icon} {m.label}</span>;
}
function LieMeter({value}){
  const color=value<30?"#30D46A":value<55?"#F0A020":value<75?"#E07030":"#E03020";
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1}} className="bar-track"><div className="bar-fill" style={{width:value+"%",background:"linear-gradient(90deg,#30D46A,"+color+")"}}/></div>
      <span className="mono" style={{fontSize:10,color,minWidth:52}}>{value}% {value<30?"honest":value<55?"evasive":value<75?"deceptive":"lying"}</span>
    </div>
  );
}
function SuspMeter({value,label}){
  const color=value<30?"#30D46A":value<60?"#F0A020":value<80?"#E07030":"#E03020";
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><Lbl>{label||"Suspicion"}</Lbl><span className="mono" style={{fontSize:10,color}}>{value}%</span></div>
      <div className="susp-track"><div className="susp-fill" style={{width:value+"%",background:"linear-gradient(90deg,#30D46A,"+color+")"}}/></div>
    </div>
  );
}
function CaseTimer({minutes,onExpire,paused}){
  const [secs,setSecs]=useState(minutes*60);
  const ref=useRef(null);
  useEffect(()=>{
    if(paused){clearInterval(ref.current);return;}
    ref.current=setInterval(()=>setSecs(s=>{if(s<=1){clearInterval(ref.current);onExpire();return 0;}return s-1;}),1000);
    return()=>clearInterval(ref.current);
  },[paused]);
  const m=Math.floor(secs/60),s=secs%60,pct=(secs/(minutes*60))*100;
  const cls=pct>40?"timer-display":pct>15?"timer-display warning":"timer-display critical";
  return <div className={cls}>{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</div>;
}
function NarratorBar({text,loading,name}){
  return(
    <div className="narrator-bar">
      <div className="narrator-text">{name?<span style={{color:"#22D4B4",marginRight:8}}>{name}:</span>:null}{loading?"...":(text||"The investigation continues...")}</div>
    </div>
  );
}

// ============================================================
// NEWS TICKER
// ============================================================
function NewsTicker({elapsedPct,caseData,onEscalate}){
  const stage=NEWS_STAGES.slice().reverse().find(s=>elapsedPct>=s.threshold)||NEWS_STAGES[0];
  const prevStageRef=useRef(stage.urgency);
  useEffect(()=>{
    if(prevStageRef.current!==stage.urgency){prevStageRef.current=stage.urgency;onEscalate&&onEscalate(stage.urgency);}
  },[stage.urgency]);
  const color=stage.urgency==="critical"?"#E03020":stage.urgency==="high"?"#E07030":stage.urgency==="medium"?"#F0A020":"#42475A";
  const speed=stage.urgency==="critical"?"critical-speed":stage.urgency==="high"?"urgent":"";
  const headlines=[...stage.headlines,...stage.headlines];
  return(
    <div className="news-ticker-wrap" style={{background:stage.urgency==="critical"?"#E0302008":"transparent",borderBottomColor:color+"40"}}>
      <div className="ticker-badge" style={{background:color+"18",color,borderColor:color+"40",flexShrink:0,marginLeft:8}}>
        {stage.urgency==="critical"?"🚨 BREAKING":stage.urgency==="high"?"📡 URGENT":stage.urgency==="medium"?"📰 NEWS":"📡 LIVE"}
      </div>
      <div style={{flex:1,overflow:"hidden"}}>
        <div className={"news-ticker-inner "+speed}>
          {headlines.map((h,i)=><span key={i} className="ticker-item" style={{color,borderRightColor:color+"30"}}>{h} · {caseData.title}</span>)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PRESSURE EVENT
// ============================================================
function PressureEvent({event,onDismiss}){
  useEffect(()=>{const t=setTimeout(onDismiss,8000);return()=>clearTimeout(t);},[]);
  return(
    <div className="pressure-event">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <span className="tag tag-red" style={{fontSize:9}}>🚨 PRESSURE EVENT</span>
        <button style={{background:"none",border:"none",color:"#42475A",cursor:"pointer",fontSize:12}} onClick={onDismiss}>✕</button>
      </div>
      <div style={{fontSize:13,color:"#EDE9E0",lineHeight:1.6,marginBottom:6}}>{event.message}</div>
      <div style={{fontSize:11,color:"#8A8FA8"}}>{event.effect}</div>
    </div>
  );
}

// ============================================================
// FINGERPRINT MINIGAME
// ============================================================
const FP_PATTERNS={
  loop:{name:"Loop Pattern",paths:["M100,60 C120,40 140,50 140,75 C140,100 120,115 100,115 C80,115 60,100 60,75 C60,50 80,40 100,60","M100,70 C115,55 130,62 130,78 C130,95 115,105 100,105 C85,105 70,95 70,78 C70,62 85,55 100,70","M100,80 C110,70 120,75 120,82 C120,90 110,95 100,95 C90,95 80,90 80,82 C80,75 90,70 100,80"]},
  whorl:{name:"Whorl Pattern",paths:["M100,60 C130,60 150,80 150,100 C150,120 130,140 100,140 C70,140 50,120 50,100 C50,80 70,60 100,60","M100,72 C122,72 138,86 138,100 C138,114 122,128 100,128 C78,128 62,114 62,100 C62,86 78,72 100,72","M100,84 C114,84 126,92 126,100 C126,108 114,116 100,116 C86,116 74,108 74,100 C74,92 86,84 100,84"]},
  arch:{name:"Arch Pattern",paths:["M40,120 C40,80 70,50 100,50 C130,50 160,80 160,120","M50,120 C50,85 72,60 100,60 C128,60 150,85 150,120","M60,120 C60,90 78,70 100,70 C122,70 140,90 140,120"]},
};
function FingerprintMinigame({clue,suspects,onMatch,onClose}){
  const canvasRef=useRef(null);
  const [scanning,setScanning]=useState(false);
  const [scanY,setScanY]=useState(0);
  const [revealed,setRevealed]=useState(false);
  const [chosen,setChosen]=useState(null);
  const [result,setResult]=useState(null);
  const correctSuspect=suspects.find(s=>s.guilty)||suspects[0];
  const correctPattern=correctSuspect?.fingerprint||"loop";
  useEffect(()=>{
    if(!canvasRef.current)return;
    const ctx=canvasRef.current.getContext("2d");
    ctx.clearRect(0,0,200,200);
    ctx.strokeStyle=revealed?"#C9AA7188":"#1F2330";
    ctx.lineWidth=revealed?2:1.5;ctx.lineCap="round";
    FP_PATTERNS[correctPattern].paths.forEach(p=>{const path=new Path2D(p);ctx.stroke(path);});
    if(revealed){ctx.strokeStyle="#C9AA71AA";ctx.lineWidth=1;for(let i=0;i<8;i++){ctx.beginPath();ctx.arc(100,100,30+i*8,0,Math.PI*2);ctx.stroke();}}
  },[revealed,correctPattern]);
  useEffect(()=>{
    if(!scanning)return;
    let y=0;
    const int=setInterval(()=>{y=(y+3)%200;setScanY(y);if(y>80&&y<120)setRevealed(true);},16);
    const t=setTimeout(()=>{clearInterval(int);setScanning(false);setRevealed(true);},2200);
    return()=>{clearInterval(int);clearTimeout(t);};
  },[scanning]);
  const handleMatch=(s)=>{
    if(result)return;setChosen(s.id);
    const correct=s.fingerprint===correctPattern;
    setResult(correct?"match":"wrong");
    setTimeout(()=>onMatch(correct,s,correctSuspect),1200);
  };
  return(
    <div className="overlay">
      <div className="modal anim-up" style={{maxWidth:580}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div><span className="tag tag-teal" style={{marginBottom:8,display:"inline-flex"}}>🔬 FINGERPRINT ANALYSIS</span><h3 className="display" style={{fontSize:26,color:"#22D4B4",marginTop:6}}>{clue.name}</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <p style={{fontSize:12,color:"#8A8FA8",marginBottom:18,lineHeight:1.6}}>Scan the print, then match it to a suspect's known fingerprint pattern.</p>
        <div style={{display:"flex",gap:24,alignItems:"flex-start",flexWrap:"wrap",marginBottom:18}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <Lbl>Evidence Print</Lbl>
            <div style={{position:"relative",width:200,height:200,borderRadius:"50%",overflow:"hidden",border:"2px solid #1F2330",background:"#06080C"}}>
              <canvas ref={canvasRef} width={200} height={200} style={{position:"absolute",inset:0}}/>
              {scanning&&<div style={{position:"absolute",top:scanY,width:"100%",height:3,background:"linear-gradient(90deg,transparent,#22D4B480,transparent)",pointerEvents:"none"}}/>}
              {!revealed&&!scanning&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:11,color:"#42475A",fontFamily:"'JetBrains Mono',monospace",textAlign:"center"}}>Print detected — Scan to reveal</span></div>}
            </div>
            {!revealed&&<button className="btn btn-teal btn-sm" onClick={()=>setScanning(true)} disabled={scanning}>{scanning?<><span className="spinner"/>Scanning...</>:"🔬 Scan Print"}</button>}
            {revealed&&<span className="tag tag-teal">✓ {FP_PATTERNS[correctPattern].name}</span>}
          </div>
          <div style={{flex:1,minWidth:220}}>
            <Lbl style={{marginBottom:10}}>Suspect Print Database</Lbl>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {suspects.map(s=>(
                <div key={s.id} className={"fp-match-card "+(chosen===s.id?(result==="match"?"matched":"wrong"):"")} onClick={()=>revealed&&handleMatch(s)} style={{opacity:revealed?1:0.4,pointerEvents:revealed?"all":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:20}}>{s.avatar||"👤"}</span>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontSize:12,fontWeight:700,color:chosen===s.id?(result==="match"?"#30D46A":"#E03020"):"#EDE9E0"}}>{s.name}</div>
                      <div style={{fontSize:10,color:"#8A8FA8"}}>Pattern: {s.fingerprint?FP_PATTERNS[s.fingerprint]?.name:"Unknown"}</div>
                    </div>
                    {chosen===s.id&&<span style={{marginLeft:"auto",fontSize:16}}>{result==="match"?"✅":"❌"}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {result&&(
          <div style={{padding:"12px 14px",borderRadius:4,background:result==="match"?"#30D46A10":"#E0302010",border:"1px solid "+(result==="match"?"#30D46A":"#E03020")+"30",textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:result==="match"?"#30D46A":"#E03020",marginBottom:4}}>{result==="match"?"✅ PRINT MATCHED — Critical evidence logged!":"❌ NO MATCH — Try a different suspect."}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// UV LIGHT MINIGAME
// ============================================================
function UVMinigame({suspect,onClose,onReveal}){
  const surfaceRef=useRef(null);
  const [torchPos,setTorchPos]=useState({x:-200,y:-200});
  const [revealed,setRevealed]=useState(false);
  const [revealPct,setRevealPct]=useState(0);
  const clue=suspect.uvClue||"Nothing unusual detected under UV light.";
  const isClean=clue.startsWith("Nothing");
  const handleMove=(e)=>{
    const rect=surfaceRef.current?.getBoundingClientRect();if(!rect)return;
    const x=(e.clientX||e.touches?.[0]?.clientX||0)-rect.left;
    const y=(e.clientY||e.touches?.[0]?.clientY||0)-rect.top;
    setTorchPos({x:x-60,y:y-60});
    const cx=rect.width/2,cy=rect.height/2,dist=Math.sqrt((x-cx)**2+(y-cy)**2);
    if(dist<80){setRevealPct(p=>Math.min(100,p+2));if(revealPct>80)setRevealed(true);}
  };
  return(
    <div className="overlay">
      <div className="modal anim-up" style={{maxWidth:500}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div><span className="tag" style={{marginBottom:8,display:"inline-flex",background:"#A020F010",color:"#A020F0",border:"1px solid #A020F030"}}>🔦 UV SCAN</span><h3 className="display" style={{fontSize:26,color:"#A020F0",marginTop:6}}>{suspect.name}</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <p style={{fontSize:12,color:"#8A8FA8",marginBottom:14,lineHeight:1.6}}>Move the UV torch to reveal hidden traces.</p>
        <div ref={surfaceRef} className="uv-surface" style={{height:220,background:"#06080C",border:"1px solid #1F2330",marginBottom:14,cursor:"none"}} onMouseMove={handleMove} onTouchMove={handleMove}>
          <div style={{position:"absolute",inset:0,opacity:0.06,backgroundImage:"repeating-linear-gradient(45deg,#C9AA71 0,#C9AA71 1px,transparent 0,transparent 50%)",backgroundSize:"8px 8px"}}/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:64,opacity:0.08}}>{suspect.avatar||"👤"}</div>
          <div className="uv-torch" style={{left:torchPos.x,top:torchPos.y,opacity:0.9}}/>
          <div style={{position:"absolute",bottom:8,left:12,right:12,height:3,background:"#1F2330",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:revealPct+"%",background:"#A020F0",borderRadius:2,transition:"width 0.1s"}}/>
          </div>
          <div className="uv-revealed" style={{opacity:revealed?1:0,color:isClean?"#42475A":"#A020F0",textShadow:isClean?"none":"0 0 20px #A020F0,0 0 40px #A020F0"}}>{isClean?"CLEAN — No traces detected":clue}</div>
          {!revealed&&<div style={{position:"absolute",top:12,left:0,right:0,textAlign:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#42475A"}}>Move UV torch to scan</div>}
        </div>
        {revealed&&(
          <>
            <div style={{padding:"12px 14px",borderRadius:4,background:"#A020F010",border:"1px solid #A020F030",marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:"#A020F0",marginBottom:4}}>UV SCAN RESULT</div>
              <div style={{fontSize:13,color:isClean?"#8A8FA8":"#EDE9E0",lineHeight:1.6}}>{clue}</div>
            </div>
            <button className="btn btn-purple" style={{width:"100%",justifyContent:"center"}} onClick={()=>{onReveal(suspect,clue,isClean);onClose();}}>
              {isClean?"✓ Log Result — Clean":"🔬 Log UV Evidence"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CCTV REPLAY
// ============================================================
function CCTVReplay({caseData,onClose}){
  const [typed,setTyped]=useState("");
  const [done,setDone]=useState(false);
  const text=caseData.cctv||"No CCTV footage available for this case.";
  useEffect(()=>{
    let i=0;
    const int=setInterval(()=>{if(i>=text.length){setDone(true);clearInterval(int);return;}setTyped(t=>t+text[i]);i++;},22);
    return()=>clearInterval(int);
  },[text]);
  return(
    <div className="overlay">
      <div className="modal anim-up" style={{maxWidth:600}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div><span className="tag tag-muted" style={{marginBottom:8,display:"inline-flex"}}>📹 CCTV RECONSTRUCTION</span><h3 className="display" style={{fontSize:26,color:"#30D46A",marginTop:6}}>SECURITY FOOTAGE LOG</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="cctv-panel" style={{minHeight:160,marginBottom:14}}>
          <div className="cctv-text" style={{whiteSpace:"pre-wrap"}}>{"> CASE: "+caseData.title.toUpperCase()+"\n> ACCESSING FOOTAGE...\n> \n> "+typed}{!done&&<span className="cctv-cursor"/>}</div>
        </div>
        {done&&<div style={{padding:"10px 14px",background:"#30D46A08",border:"1px solid #30D46A28",borderRadius:3}}><div style={{fontSize:11,color:"#30D46A",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.1em"}}>✓ FOOTAGE LOG COMPLETE — Cross-reference with suspect timelines</div></div>}
      </div>
    </div>
  );
}

// ============================================================
// SCENE MAP
// ============================================================
function SceneMapModal({caseData,activeRoom,setActiveRoom,clues,onClose}){
  const mapData=SCENE_MAPS[caseData.id];
  if(!mapData)return(
    <div className="overlay" onClick={onClose}>
      <div className="modal anim-up" onClick={e=>e.stopPropagation()}>
        <h3 className="display" style={{fontSize:28,marginBottom:12}}>SCENE MAP</h3>
        <p style={{color:"#8A8FA8"}}>No floor plan available for this case.</p>
        <button className="btn btn-ghost btn-sm" style={{marginTop:16}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
  const roomClueCount=id=>clues.filter(c=>c.room===id&&c.found).length;
  const roomHasCritical=id=>clues.some(c=>c.room===id&&c.found&&c.critical);
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide anim-up" onClick={e=>e.stopPropagation()} style={{padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div><span className="tag tag-gold" style={{marginBottom:8,display:"inline-flex"}}>🗺 SCENE MAP</span><h3 className="display" style={{fontSize:26,color:"#C9AA71",marginTop:6}}>{mapData.label}</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{background:"#06080C",borderRadius:6,border:"1px solid #1F2330",padding:16,marginBottom:14,overflowX:"auto"}}>
          <svg width={mapData.width} height={mapData.height} style={{display:"block",margin:"0 auto"}}>
            {mapData.connections.map((conn,i)=>{
              const from=mapData.rooms.find(r=>r.id===conn.from),to=mapData.rooms.find(r=>r.id===conn.to);
              if(!from||!to)return null;
              return <line key={i} x1={from.x+from.w/2} y1={from.y+from.h/2} x2={to.x+to.w/2} y2={to.y+to.h/2} stroke="#1F2330" strokeWidth="2" strokeDasharray="4,4"/>;
            })}
            {mapData.rooms.map(room=>{
              const isActive=activeRoom===room.id,cc=roomClueCount(room.id),hasCrit=roomHasCritical(room.id);
              return(
                <g key={room.id} onClick={()=>{setActiveRoom(room.id);onClose();}} style={{cursor:"pointer"}}>
                  <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={4} ry={4} fill={isActive?room.color.replace("18","30"):room.color} stroke={isActive?room.border:room.border.replace("55","25")} strokeWidth={isActive?2:1} className="scene-map-room"/>
                  <text x={room.x+room.w/2} y={room.y+room.h/2-8} textAnchor="middle" style={{fontSize:18,userSelect:"none"}} dominantBaseline="middle">{room.icon}</text>
                  <text x={room.x+room.w/2} y={room.y+room.h/2+14} textAnchor="middle" fill={isActive?"#EDE9E0":"#8A8FA8"} fontSize={9} fontFamily="'JetBrains Mono',monospace" fontWeight={700} style={{userSelect:"none"}}>{room.label}</text>
                  {cc>0&&<><circle cx={room.x+room.w-10} cy={room.y+10} r={8} fill={hasCrit?"#C9AA71":"#22D4B4"}/><text x={room.x+room.w-10} y={room.y+10} textAnchor="middle" dominantBaseline="middle" fill="#06080C" fontSize={9} fontWeight={900}>{cc}</text></>}
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {mapData.rooms.map(r=>(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:activeRoom===r.id?"#C9AA71":"#8A8FA8"}}>
              <span style={{fontSize:14}}>{r.icon}</span>{r.label}
              {roomClueCount(r.id)>0&&<span className="tag tag-teal" style={{fontSize:8}}>{roomClueCount(r.id)} clue{roomClueCount(r.id)>1?"s":""}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// POLAROID WALL
// ============================================================
function PolaroidWall({caseData,foundClues,onClose}){
  const polaroids=caseData.polaroids||[];
  const angles=[-3,2,-1,3,-2,1,0,-3,2];
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide anim-up" onClick={e=>e.stopPropagation()} style={{background:"#1A1208",border:"1px solid #2A1E10"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div><span className="tag tag-gold" style={{marginBottom:8,display:"inline-flex"}}>📷 CRIME SCENE PHOTOS</span><h3 className="display" style={{fontSize:26,color:"#C9AA71",marginTop:6}}>{caseData.title}</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {polaroids.length===0&&<p style={{color:"#42475A",fontSize:13}}>No photographs on file.</p>}
        <div style={{display:"flex",gap:20,flexWrap:"wrap",justifyContent:"center",marginBottom:18}}>
          {polaroids.map((p,i)=>(
            <div key={p.id} className="polaroid" style={{transform:"rotate("+angles[i%9]+"deg)",animationDelay:i*0.1+"s"}}>
              <div className="polaroid-inner"><div style={{fontSize:44,opacity:0.7}}>{p.emoji}</div></div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#8A6510",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{p.label}</div>
              <div className="polaroid-caption">{p.caption}</div>
            </div>
          ))}
        </div>
        {foundClues.filter(c=>c.critical).length>0&&(
          <div style={{borderTop:"1px solid #2A1E10",paddingTop:14,marginTop:6}}>
            <Lbl style={{marginBottom:10}}>Critical Evidence Photos</Lbl>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              {foundClues.filter(c=>c.critical).map((c,i)=>(
                <div key={c.id} className="polaroid" style={{transform:"rotate("+angles[i%9]+"deg)",animationDelay:(polaroids.length+i)*0.1+"s",maxWidth:164}}>
                  <div className="polaroid-inner"><div style={{fontSize:32,opacity:0.6}}>🔑</div></div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#8A6510",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{c.room}</div>
                  <div className="polaroid-caption">{c.name}: {c.desc.slice(0,60)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// FINAL DECODE MINIGAME — triggers when all clues revealed
// ============================================================
function DecodeMinigame({caseData,onClose,onSolved}){
  const note=caseData.finalNote||"No final note recovered for this case.";
  // Build a simple substitution puzzle from the note: scramble letters consistently
  const letters=useState(()=>{
    const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const shuffled=[...alphabet].sort(()=>Math.random()-0.5);
    const map={};
    alphabet.forEach((l,i)=>{map[l]=shuffled[i];});
    return map;
  })[0];
  const [guesses,setGuesses]=useState({});
  const [solvedCount,setSolvedCount]=useState(0);
  const displayChars=note.toUpperCase().split("");
  const encodedChars=displayChars.map(c=>/[A-Z]/.test(c)?letters[c]:c);
  const uniqueEncoded=[...new Set(encodedChars.filter(c=>/[A-Z]/.test(c)))].sort();
  const handleGuess=(encLetter,guess)=>{
    const g=guess.toUpperCase().slice(0,1);
    setGuesses(prev=>{
      const next={...prev,[encLetter]:g};
      let correct=0;
      uniqueEncoded.forEach(el=>{
        const realLetter=Object.keys(letters).find(k=>letters[k]===el);
        if(next[el]&&next[el]===realLetter)correct++;
      });
      setSolvedCount(correct);
      if(correct===uniqueEncoded.length)setTimeout(()=>onSolved&&onSolved(),600);
      return next;
    });
  };
  const pct=uniqueEncoded.length?Math.round((solvedCount/uniqueEncoded.length)*100):0;
  return(
    <div className="overlay">
      <div className="modal modal-wide anim-up">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div><span className="tag tag-gold" style={{marginBottom:8,display:"inline-flex"}}>🔐 FINAL EVIDENCE — DECODE</span><h3 className="display" style={{fontSize:26,color:"#C9AA71",marginTop:6}}>Decrypt the Recovered Note</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <p style={{fontSize:12,color:"#8A8FA8",marginBottom:16,lineHeight:1.6}}>All evidence has been gathered. A final coded fragment was recovered from the scene — crack the substitution cipher to reveal it before making your accusation.</p>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><Lbl>Decryption Progress</Lbl><span className="mono" style={{fontSize:10,color:"#C9AA71"}}>{pct}%</span></div>
          <div className="bar-track"><div className="bar-fill" style={{width:pct+"%",background:"linear-gradient(90deg,#22D4B4,#C9AA71)"}}/></div>
        </div>
        <div style={{background:"#06080C",border:"1px solid #1F2330",borderRadius:4,padding:16,marginBottom:18,lineHeight:2.4,wordBreak:"break-word"}}>
          {displayChars.map((ch,i)=>{
            if(!/[A-Z]/.test(ch))return <span key={i} style={{fontFamily:"'JetBrains Mono',monospace",color:"#42475A"}}>{ch}</span>;
            const enc=encodedChars[i];
            const guessed=guesses[enc];
            const realLetter=Object.keys(letters).find(k=>letters[k]===enc);
            const isCorrect=guessed&&guessed===realLetter;
            return(
              <span key={i} className={"decode-letter"+(isCorrect?" solved":"")} title={"Cipher: "+enc}>
                {isCorrect?ch:(guessed||"")}
              </span>
            );
          })}
        </div>
        <div style={{marginBottom:10}}><Lbl style={{marginBottom:8}}>Cipher Key — guess what each symbol represents</Lbl></div>
        <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
          {uniqueEncoded.map(enc=>{
            const realLetter=Object.keys(letters).find(k=>letters[k]===enc);
            const guessed=guesses[enc];
            const isCorrect=guessed&&guessed===realLetter;
            return(
              <div key={enc} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",background:"#10131A",border:"1px solid #1F2330",borderRadius:3,fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:"#C9AA71"}}>{enc}</div>
                <input
                  maxLength={1}
                  value={guessed||""}
                  onChange={e=>handleGuess(enc,e.target.value)}
                  className="input"
                  style={{width:30,height:30,padding:0,textAlign:"center",fontSize:13,background:isCorrect?"#30D46A12":"#10131A",borderColor:isCorrect?"#30D46A":"#1F2330",color:isCorrect?"#30D46A":"#EDE9E0"}}
                />
              </div>
            );
          })}
        </div>
        {pct===100&&(
          <div style={{marginTop:18,padding:"12px 14px",background:"#30D46A10",border:"1px solid #30D46A30",borderRadius:4,textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#30D46A"}}>✅ DECODED — Final evidence secured.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CORK NOTE
// ============================================================
function CorkNote({clue,onDiscover,forensics,onForensics,onFingerprint,onUV,delay}){
  return(
    <div className={"cork-note "+(clue.found?"found":"unknown")+(clue.critical?" critical":"")+" anim-pin"} style={{animationDelay:(delay||0)+"ms"}} onClick={()=>!clue.found&&onDiscover(clue)}>
      <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",width:13,height:13,borderRadius:"50%",background:"radial-gradient(circle at 38% 32%, #F08888, #A03030)",boxShadow:"0 2px 6px rgba(0,0,0,0.7)",zIndex:1}}/>
      {clue.found?(
        <>
          {clue.critical&&<div className="cork-stamp">CRITICAL</div>}
          <div className="cork-note-title">{clue.name}</div>
          <div className="cork-note-body">{clue.desc}</div>
          <div style={{marginTop:8}}><span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:"#5A4A30",letterSpacing:"0.1em",textTransform:"uppercase"}}>📍 {clue.room}</span></div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
            {!forensics?.report&&<button onClick={e=>{e.stopPropagation();onForensics(clue);}} disabled={forensics?.loading} style={{background:"transparent",border:"1px solid #22D4B444",borderRadius:2,padding:"3px 7px",fontSize:9,cursor:"pointer",color:"#0D8070",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",textTransform:"uppercase"}}>{forensics?.loading?"Analyzing...":"🔬 Analyze"}</button>}
            {clue.hasFingerprint&&<button onClick={e=>{e.stopPropagation();onFingerprint(clue);}} style={{background:"transparent",border:"1px solid #C9AA7144",borderRadius:2,padding:"3px 7px",fontSize:9,cursor:"pointer",color:"#7A6535",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",textTransform:"uppercase"}}>👆 Print</button>}
            {clue.hasUV&&<button onClick={e=>{e.stopPropagation();onUV(clue);}} style={{background:"transparent",border:"1px solid #A020F044",borderRadius:2,padding:"3px 7px",fontSize:9,cursor:"pointer",color:"#8820C0",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",textTransform:"uppercase"}}>🔦 UV</button>}
          </div>
          {forensics?.report&&<div className="forensics-panel" style={{marginTop:10}}><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#22D4B4",marginBottom:5}}>🔬 FORENSICS</div><div style={{fontSize:10,color:"#22D4B4",lineHeight:1.55,opacity:0.85}}>{forensics.report}</div></div>}
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

// ============================================================
// CORKBOARD PANEL — detective notes textarea removed per request
// ============================================================
function CorkboardPanel({caseData,clues,activeRoom,setActiveRoom,discoverClue,settings,onShowMap,onShowCCTV,onShowPolaroids,allCluesFound,onOpenDecode,decodeSolved}){
  const [forensicsState,setForensicsState]=useState({});
  const [fpClue,setFpClue]=useState(null);
  const [uvSuspect,setUvSuspect]=useState(null);
  const [uvLog,setUvLog]=useState([]);
  const clueRoom=c=>c.room||caseData.rooms[0];
  const roomClues=clues.filter(c=>clueRoom(c)===activeRoom);
  const foundTotal=clues.filter(c=>c.found).length;
  const pct=Math.round((foundTotal/clues.length)*100);
  const runForensics=async(clue)=>{
    if(forensicsState[clue.id]?.report)return;
    setForensicsState(p=>({...p,[clue.id]:{loading:true,report:null,error:""}}));
    const sys="You are a forensic scientist. Write a brief 3-4 sentence lab report with one unexpected finding that adds mystery.";
    const txt=await callAI("Clue: "+clue.name+" — "+clue.desc+". Case: "+caseData.title+".",sys,"forensics-"+clue.id,settings);
    if(isAIErr(txt)){setForensicsState(p=>({...p,[clue.id]:{loading:false,report:null,error:txt.replace(AI_ERR,"").trim()}}));return;}
    setForensicsState(p=>({...p,[clue.id]:{loading:false,report:txt,error:""}}));
  };
  const handleUVReveal=(suspect,clue,isClean)=>{if(!isClean)setUvLog(l=>[...l,{suspectId:suspect.id,suspectName:suspect.name,clue}]);};
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1,display:"flex",gap:6,flexWrap:"wrap"}}>
          {caseData.rooms.map(r=>(
            <button key={r} className={"btn btn-sm "+(activeRoom===r?"btn-gold":"btn-ghost")} onClick={()=>setActiveRoom(r)}>
              {r}{clues.filter(c=>clueRoom(c)===r&&c.found).length>0&&<span style={{background:"#22D4B4",color:"#06080C",borderRadius:"50%",width:14,height:14,fontSize:8,display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{clues.filter(c=>clueRoom(c)===r&&c.found).length}</span>}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button className="btn btn-ghost btn-sm" onClick={onShowMap}>🗺 Map</button>
          <button className="btn btn-ghost btn-sm" onClick={onShowCCTV}>📹 CCTV</button>
          <button className="btn btn-ghost btn-sm" onClick={onShowPolaroids}>📷 Photos</button>
        </div>
        <span className="mono" style={{fontSize:10,color:"#22D4B4"}}>{pct}%</span>
      </div>
      <div className="corkboard" style={{marginBottom:14}}>
        {roomClues.length===0&&<div style={{textAlign:"center",color:"#6A5A40",fontSize:13,paddingTop:60}}>Room appears clear.</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(158px,1fr))",gap:20,alignItems:"start"}}>
          {roomClues.map((c,i)=><CorkNote key={c.id} clue={c} delay={i*80} onDiscover={discoverClue} forensics={forensicsState[c.id]} onForensics={runForensics} onFingerprint={cl=>setFpClue(cl)} onUV={()=>{const s=caseData.suspects.find(x=>x.guilty)||caseData.suspects[0];setUvSuspect(s);}}/>)}
        </div>
      </div>
      {uvLog.length>0&&<div style={{marginBottom:12,padding:"10px 14px",background:"#A020F008",border:"1px solid #A020F028",borderRadius:4}}><Lbl style={{marginBottom:6}}>UV Evidence Log</Lbl>{uvLog.map((u,i)=><div key={i} style={{fontSize:11,color:"#A020F0",marginBottom:3}}>🔦 {u.suspectName}: {u.clue}</div>)}</div>}
      {allCluesFound&&(
        <div className="card card-gold" style={{padding:16,textAlign:"center"}}>
          <div style={{fontSize:24,marginBottom:6}}>🔐</div>
          <div style={{fontSize:14,fontWeight:700,color:"#C9AA71",marginBottom:6}}>All evidence collected</div>
          <div style={{fontSize:12,color:"#8A8FA8",marginBottom:10}}>{decodeSolved?"Final coded note decrypted. You're ready to make an accusation.":"A final coded note was recovered from the scene. Decrypt it before making your accusation."}</div>
          <button className="btn btn-gold btn-sm" onClick={onOpenDecode}>{decodeSolved?"✓ View Decoded Note":"🔐 Decode Final Evidence"}</button>
        </div>
      )}
      {fpClue&&<FingerprintMinigame clue={fpClue} suspects={caseData.suspects} onMatch={()=>{}} onClose={()=>setFpClue(null)}/>}
      {uvSuspect&&<UVMinigame suspect={uvSuspect} onClose={()=>setUvSuspect(null)} onReveal={handleUVReveal}/>}
    </div>
  );
}

// ============================================================
// PSYCH PROFILER
// ============================================================
function PsychProfiler({suspect,settings,caseData}){
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const psych=suspect?.psych;
  const generate=async()=>{
    setLoading(true);setErr("");
    const sys="You are a forensic psychologist. Write a 3-sentence psychological assessment, noir-toned. Include a prediction of interrogation behavior.";
    const pr="Suspect: "+suspect.name+", "+suspect.role+" (age "+suspect.age+"). Archetype: "+(psych?.archetype||"unknown")+". Traits: "+(psych?.traits?.join(", ")||"unknown")+". Secret: "+suspect.secret+". Case: "+caseData.title+".";
    const txt=await callAI(pr,sys,"profiler-"+suspect.id,settings);
    if(isAIErr(txt)){setErr(txt.replace(AI_ERR,"").trim());setLoading(false);return;}
    setProfile(txt);setLoading(false);
  };
  if(!suspect)return null;
  return(
    <div className="psych-card">
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span className="tag tag-purple">🧠 Psych Profile</span>
        {psych?.archetype&&<span style={{fontSize:11,color:"#9B7FD4"}}>{psych.archetype}</span>}
      </div>
      {psych?.traits?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>{psych.traits.map((t,i)=><span key={i} className="profiler-trait">{t}</span>)}</div>}
      {psych?.tell&&<div style={{fontSize:11,color:"#8A8FA8",marginBottom:10,padding:"8px 10px",background:"#9B7FD408",borderRadius:3,border:"1px solid #9B7FD420"}}><span style={{color:"#9B7FD4",fontWeight:600}}>Tell: </span>{psych.tell}</div>}
      {!profile&&!loading&&<button className="btn btn-purple btn-sm" onClick={generate}>🧠 Generate Deep Profile</button>}
      {loading&&<div style={{display:"flex",gap:8,alignItems:"center",fontSize:12,color:"#42475A"}}><span className="spinner"/>Analyzing...</div>}
      {err&&<div style={{fontSize:11,color:"#E03020",marginTop:6}}>{err}</div>}
      {profile&&<div style={{fontSize:12,color:"#8A8FA8",lineHeight:1.65,marginTop:4,padding:"10px 12px",background:"#9B7FD406",borderRadius:3,border:"1px solid #9B7FD418"}}>{profile}</div>}
    </div>
  );
}

// ============================================================
// SIDEBAR — Case Notes section removed per request
// ============================================================
function Sidebar({caseData,foundClues,clues,progress,revSuspicion,hint,showHint,hintUsed,hintLoading,getHint,unlimitedHints,aiHints}){
  const critFound=foundClues.filter(c=>c.critical).length,critTotal=clues.filter(c=>c.critical).length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      <div className="card card-gold" style={{padding:"14px 16px",marginBottom:12}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:20}}>{caseData.badge||"🔍"}</span>
          <div><div className="display" style={{fontSize:16,color:"#C9AA71"}}>{caseData.title}</div><div style={{fontSize:10,color:"#42475A",marginTop:1}}>{caseData.setting}</div></div>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><Lbl>Evidence</Lbl><span className="mono" style={{fontSize:9,color:"#22D4B4"}}>{foundClues.length}/{clues.length}</span></div>
          <div className="bar-track"><div className="bar-fill" style={{width:progress+"%",background:"linear-gradient(90deg,#22D4B4,#C9AA71)"}}/></div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <span className="tag tag-red" style={{fontSize:8}}>🔑 {critFound}/{critTotal} critical</span>
          {revSuspicion>0&&<span className="tag tag-purple" style={{fontSize:8}}>🎯 {revSuspicion}%</span>}
        </div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Case Brief</div>
        <div style={{fontSize:11,color:"#8A8FA8",lineHeight:1.65,marginBottom:8}}>{caseData.summary}</div>
        <div style={{fontSize:10,color:"#42475A",lineHeight:1.6}}>
          <div style={{marginBottom:3}}><span style={{color:"#8A8FA8"}}>Victim: </span>{caseData.victim}</div>
          <div><span style={{color:"#8A8FA8"}}>Cause: </span>{caseData.cause}</div>
        </div>
      </div>
      {foundClues.length>0&&(
        <div className="sidebar-section">
          <div className="sidebar-section-title">Evidence Found</div>
          <div className="evidence-thread">
            {foundClues.map((c,i)=>(
              <div key={c.id} style={{marginBottom:12,paddingLeft:14,position:"relative"}}>
                <div className="thread-node" style={{top:4,background:c.critical?"#C9AA71":"#22D4B4"}}/>
                <div style={{fontSize:11,fontWeight:600,color:c.critical?"#C9AA71":"#EDE9E0",marginBottom:1}}>{c.name}</div>
                <div style={{fontSize:10,color:"#8A8FA8",lineHeight:1.4}}>{c.desc.slice(0,60)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {aiHints&&(
        <div className="sidebar-section">
          <div className="sidebar-section-title">AI Hint</div>
          {!showHint?<button className="btn btn-ghost btn-sm" style={{width:"100%",justifyContent:"center"}} onClick={getHint} disabled={(!unlimitedHints&&hintUsed)||hintLoading}>{hintLoading?<><span className="spinner"/>Thinking...</>:(!unlimitedHints&&hintUsed?"✓ Used":"💡 Get hint")}</button>:<div style={{fontSize:11,color:"#C9AA71",lineHeight:1.65,padding:"10px 12px",background:"#C9AA7108",border:"1px solid #C9AA7120",borderRadius:3,fontStyle:"italic"}}>{hint}</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// INTERROGATION TAB
// ============================================================
function InterrogationTab({caseData,suspects,selSuspect,setSelSuspect,interrogHist,setInterrogHist,questionCounts,setQuestionCounts,dynamicAlibis,setDynamicAlibis,lieScores,setLieScores,patience,setPatience,player,settings,diff,voiceCfg}){
  const [customQ,setCustomQ]=useState("");
  const [loading,setLoading]=useState(false);
  const [copMode,setCopMode]=useState("neutral");
  const chatRef=useRef(null);
  const hist=selSuspect?(interrogHist[selSuspect.id]||[]):[];
  const qCount=selSuspect?(questionCounts[selSuspect.id]||0):0;
  const lieScore=selSuspect?lieScores[selSuspect.id]:null;
  const currentAlibi=selSuspect?(dynamicAlibis[selSuspect.id]||selSuspect.alibi):"";
  const alibiChanged=selSuspect&&dynamicAlibis[selSuspect.id]&&dynamicAlibis[selSuspect.id]!==selSuspect.alibi;
  const suspPatience=selSuspect?(patience[selSuspect.id]??diff.patienceBase):diff.patienceBase;
  const isLawyered=suspPatience<=0;
  const currentMood=selSuspect?getMood(qCount,selSuspect.guilty,suspPatience):"cooperative";
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[interrogHist,selSuspect]);
  const lastEntry=hist[hist.length-1];
  const maybeSlip=lastEntry&&selSuspect?.guilty&&lastEntry.lieScore>70&&!lastEntry.isErr;
  const askSuspect=async(suspect,question)=>{
    if(!question.trim()||isLawyered)return;
    setCustomQ("");setLoading(true);
    const newCount=(questionCounts[suspect.id]||0)+1;
    const currentAl=dynamicAlibis[suspect.id]||suspect.alibi;
    const prevAnswers=(interrogHist[suspect.id]||[]).slice(-3).map(e=>"Q: "+e.q+" A: "+e.a).join(" | ");
    const copInstr=copMode==="good"?"The detective is warm and empathetic — use this to lower guard.":copMode==="bad"?"The detective is aggressive and accusatory — respond defensively.":"Standard interrogation tone.";
    const sys=[
      "You are "+suspect.name+", "+suspect.role+" (age "+suspect.age+").",
      "Mood: "+currentMood+" ("+MOODS[currentMood]?.desc+"). Guilty: "+(suspect.guilty?"YES":"NO")+".",
      "Alibi: "+currentAl+". Secret: "+suspect.secret+".",
      "Detective style: "+copInstr,
      "Previous answers you gave: "+(prevAnswers||"none — first question")+".",
      "Stay consistent with previous answers. If you said something before, remember it.",
      suspect.guilty&&newCount>3?" Show micro-tells — hesitation, contradictory detail.":"Remain consistent.",
      "2-4 sentences. Never confess directly.",
      "SOMETIMES (1 in 4) end with a suspicious question back: 'Why are you so interested in that?' or 'Who told you that?' Only when it fits naturally.",
    ].join(" ");
    const resp=await callAI("Detective "+player.name+" ("+copMode+" cop) asks: "+question,sys,"interrog-"+suspect.id,settings);
    let ls=null;
    if(settings.lieDetector||diff.lieDetectorForce){
      const lsys="Rate deception 0-100. 0=fully truthful, 100=complete lie. Return ONLY a number.";
      const lr=await callAI("Suspect is "+(suspect.guilty?"GUILTY":"INNOCENT")+". Said: "+resp,lsys,"lie-"+suspect.id,settings);
      if(!isAIErr(lr)){const n=parseInt(lr.replace(/\D/g,""));if(!isNaN(n))ls=Math.min(100,Math.max(0,n));}
    }
    const drain=copMode==="bad"?2:copMode==="good"?0:1;
    setPatience(p=>({...p,[suspect.id]:Math.max(0,(p[suspect.id]??diff.patienceBase)-drain)}));
    const entry={q:question,a:isAIErr(resp)?"[Unavailable]":resp,mood:currentMood,lieScore:ls,player:player.name,isErr:isAIErr(resp),copMode};
    setInterrogHist(p=>({...p,[suspect.id]:[...(p[suspect.id]||[]),entry]}));
    setQuestionCounts(p=>({...p,[suspect.id]:newCount}));
    if(ls!==null)setLieScores(p=>({...p,[suspect.id]:ls}));
    if(!isAIErr(resp))await speakText(resp,suspect.voiceCfg,settings);
    setLoading(false);
  };
  return(
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16}}>
      <div>
        <Lbl style={{marginBottom:10}}>Suspects</Lbl>
        {suspects.map(s=>{
          const qc=questionCounts[s.id]||0,sp=patience[s.id]??diff.patienceBase,lawyered=sp<=0;
          return(
            <div key={s.id} className={"portrait-card "+(selSuspect?.id===s.id?"selected ":"")+(lawyered?"lawyered":"")} style={{marginBottom:10}} onClick={()=>setSelSuspect(s)}>
              <div className="portrait-avatar" style={{height:60,fontSize:30}}>{s.avatar||"👤"}</div>
              <div className="portrait-body">
                <div className="portrait-name" style={{fontSize:15}}>{s.name}</div>
                <div className="portrait-role">{s.role}</div>
                <div style={{marginTop:4}}>
                  <div style={{display:"flex",gap:3,marginBottom:5}}>{[...Array(diff.patienceBase)].map((_,i)=><div key={i} style={{width:8,height:8,borderRadius:2,background:i<sp?"#F0A020":"#1F2330",transition:"background 0.3s"}}/>)}</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {qc>0&&<MoodBadge count={qc} guilty={s.guilty} patience={sp}/>}
                    {lawyered&&<span className="tag tag-purple" style={{fontSize:8}}>⚖ LAWYERED</span>}
                    {dynamicAlibis[s.id]&&<span className="tag tag-amber" style={{fontSize:8}}>⚡</span>}
                    {lieScores[s.id]!=null&&<span className="tag tag-muted" style={{fontSize:8}}>{lieScores[s.id]}%</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",flexDirection:"column"}}>
        {!selSuspect?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",height:280,color:"#42475A",fontSize:14,flexDirection:"column",gap:10}}><span style={{fontSize:40}}>👤</span>Select a suspect</div>:(
          <>
            <div className="card card-gold" style={{padding:"14px 16px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div>
                  <div className="display" style={{fontSize:22,color:"#C9AA71"}}>{selSuspect.name}</div>
                  <div style={{fontSize:12,color:"#8A8FA8",marginTop:2}}>{selSuspect.role} · Age {selSuspect.age}</div>
                  <div style={{fontSize:11,marginTop:4,color:alibiChanged?"#F0A020":"#42475A"}}>{alibiChanged&&<span style={{color:"#F0A020",fontWeight:700}}>⚡ </span>}{currentAlibi}</div>
                </div>
                <MoodBadge count={qCount} guilty={selSuspect.guilty} patience={suspPatience}/>
              </div>
              <div style={{marginTop:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><Lbl>Patience</Lbl><span className="mono" style={{fontSize:9,color:suspPatience<=1?"#E03020":suspPatience<=2?"#F0A020":"#42475A"}}>{isLawyered?"LAWYERED UP":suspPatience+" left"}</span></div>
                <div style={{display:"flex",gap:3}}>{[...Array(diff.patienceBase)].map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<suspPatience?"#F0A020":"#1F2330",transition:"background 0.3s"}}/>)}</div>
              </div>
              {(settings.lieDetector||diff.lieDetectorForce)&&lieScore!=null&&<div style={{marginTop:10}}><LieMeter value={lieScore}/></div>}
              {settings.psychProfiler&&<PsychProfiler suspect={selSuspect} settings={settings} caseData={caseData}/>}
            </div>
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              <Lbl style={{marginRight:6,alignSelf:"center"}}>Tactic:</Lbl>
              {[["good","😊 Good Cop","btn-teal"],["neutral","😐 Neutral","btn-ghost"],["bad","😡 Bad Cop","btn-red"]].map(([id,lbl,cls])=>(
                <button key={id} className={"btn btn-sm "+(copMode===id?cls:"btn-ghost")} onClick={()=>setCopMode(id)}>{lbl}</button>
              ))}
            </div>
            {copMode==="good"&&<div style={{fontSize:10,color:"#22D4B4",marginBottom:8,padding:"5px 10px",background:"#22D4B408",borderRadius:3}}>Good cop: slower patience drain, suspects open up more</div>}
            {copMode==="bad"&&<div style={{fontSize:10,color:"#E03020",marginBottom:8,padding:"5px 10px",background:"#E0302008",borderRadius:3}}>Bad cop: drains patience fast — risky but can force slips</div>}
            {isLawyered&&<div style={{padding:14,background:"#9B7FD410",border:"1px solid #9B7FD430",borderRadius:4,marginBottom:10,textAlign:"center"}}><div style={{fontSize:20,marginBottom:6}}>⚖</div><div style={{fontSize:13,fontWeight:700,color:"#9B7FD4",marginBottom:4}}>{selSuspect.name} has lawyered up</div><div style={{fontSize:11,color:"#8A8FA8"}}>Build more evidence or use cross-exam to proceed.</div></div>}
            <div ref={chatRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,marginBottom:10,minHeight:180,maxHeight:300}}>
              {hist.length===0&&<div style={{textAlign:"center",color:"#42475A",fontSize:13,paddingTop:40}}>No questions yet.</div>}
              {hist.map((e,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",justifyContent:"flex-end"}}>
                    <div className="bubble bubble-user"><span style={{fontSize:10,color:e.copMode==="bad"?"#E03020":e.copMode==="good"?"#22D4B4":"#8A8FA8",display:"block",marginBottom:3}}>{e.player} · {e.copMode==="good"?"😊 Good Cop":e.copMode==="bad"?"😡 Bad Cop":"😐 Neutral"}</span>{e.q}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    <div style={{display:"flex",justifyContent:"flex-start"}}>
                      {e.a&&(e.a.includes("Why are you")||e.a.includes("Who told you")||e.a.includes("Why do you")||e.a.includes("What makes you"))?(
                        <div className="bubble bubble-backtalk"><span style={{fontSize:10,color:"#F0A020",display:"block",marginBottom:3}}>{selSuspect.name} · 🔄 QUESTIONING YOU</span>{e.a}</div>
                      ):(
                        <div className={"bubble "+(e.isErr?"bubble-error":"bubble-ai")}><span style={{fontSize:10,display:"block",marginBottom:3,color:MOODS[e.mood]?.color||"#C9AA71"}}>{selSuspect.name} · {MOODS[e.mood]?.icon} {e.mood}</span>{e.a}</div>
                      )}
                    </div>
                    {e.lieScore!=null&&(settings.lieDetector||diff.lieDetectorForce)&&<span style={{fontSize:10,color:e.lieScore>60?"#F0A020":"#42475A",paddingLeft:4}}>🧠 {e.lieScore}% — {e.lieScore<25?"truthful":e.lieScore<50?"uncertain":e.lieScore<75?"evasive":"likely lying"}</span>}
                  </div>
                </div>
              ))}
              {loading&&<div style={{display:"flex",gap:8,alignItems:"center",padding:"6px 10px"}}><span className="spinner"/><span style={{fontSize:11,color:"#42475A"}}>{selSuspect.name} responding...</span></div>}
            </div>
            {maybeSlip&&<div style={{padding:"8px 12px",background:"#F0A02010",border:"1px solid #F0A02030",borderRadius:3,marginBottom:8,display:"flex",gap:8,alignItems:"center"}}><span style={{color:"#F0A020",fontSize:14}}>⚠</span><div style={{fontSize:11,color:"#F0A020"}}>Possible slip detected — their last answer may contain an inconsistency worth pressing.</div></div>}
            {!isLawyered&&(
              <>
                {caseData.interrogationQuestions?.[selSuspect.id]?.length>0&&<div style={{marginBottom:8}}><Lbl style={{marginBottom:5}}>Suggested</Lbl><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{caseData.interrogationQuestions[selSuspect.id].map((item,i)=><button key={i} className="btn btn-ghost btn-sm" onClick={()=>askSuspect(selSuspect,item.q)} disabled={loading}>{item.q.slice(0,38)}{item.q.length>38?"...":""}</button>)}</div></div>}
                <div style={{display:"flex",gap:8}}>
                  <input className="input" placeholder={"Ask "+selSuspect.name.split(" ")[0]+"..."} value={customQ} onChange={e=>setCustomQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&customQ.trim()&&!loading&&askSuspect(selSuspect,customQ)} style={{flex:1}}/>
                  <button className="btn btn-gold" disabled={!customQ.trim()||loading} onClick={()=>askSuspect(selSuspect,customQ)}>{loading?<span className="spinner"/>:"Ask"}</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CROSS-EXAM TAB
// ============================================================
function CrossExamTab({caseData,suspects,selSuspect,setSelSuspect,crossState,setCrossState,dynamicAlibis,setDynamicAlibis,player,settings,diff}){
  const [tactic,setTactic]=useState(null);
  const [loading,setLoading]=useState(false);
  const chatRef=useRef(null);
  const state=selSuspect?(crossState[selSuspect.id]||{round:0,cracked:false,history:[]}):null;
  const examData=selSuspect?caseData.crossExam?.[selSuspect.id]:null;
  const pct=state&&examData?Math.min(100,Math.round((state.round/(examData.threshold||3))*100)):0;
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[crossState,selSuspect]);
  const TACTICS=[{id:"evidence",icon:"🔎",l:"Present Evidence"},{id:"contradiction",icon:"⚔",l:"Point Contradiction"},{id:"bluff",icon:"🎭",l:"Bluff Pressure"},{id:"witness",icon:"👁",l:"Cite Witness"}];
  const doCrossExam=async(suspect,tac)=>{
    setLoading(true);
    const curState=crossState[suspect.id]||{round:0,cracked:false,history:[]};
    const newRound=curState.round+1;
    const threshold=Math.max(1,Math.round((examData?.threshold||2)*diff.crackMult));
    const willCrack=newRound>=threshold&&suspect.guilty;
    const currentAlibi=dynamicAlibis[suspect.id]||suspect.alibi;
    const sys="You are "+suspect.name+" under cross-examination. Alibi: "+currentAlibi+". Contradiction: "+(examData?.contradiction||"Your alibi doesn't add up.")+". Pressure: "+(examData?.pressure||"key evidence")+". Guilty: "+(suspect.guilty?"YES":"NO")+". Round "+newRound+"/"+threshold+". "+(willCrack?"BREAKING POINT — dramatic crack, near-confession.":"Hold firm but fracture subtly.")+". 2-3 sentences. Very tense.";
    const resp=await callAI("Tactic: "+tac,sys,"cross-"+suspect.id,settings);
    if(!willCrack&&newRound>1&&!isAIErr(resp)){
      const asys="Extract suspect's new alibi in one sentence. Return ONLY the alibi.";
      const nar=await callAI("Original: "+currentAlibi+". Latest: "+resp,asys,"dynamic-alibi",settings);
      if(!isAIErr(nar)&&nar.length>10&&nar.length<200)setDynamicAlibis(p=>({...p,[suspect.id]:nar}));
    }
    const newH=[...curState.history,{tactic:tac,response:resp,round:newRound,cracked:willCrack,isErr:isAIErr(resp)}];
    setCrossState(p=>({...p,[suspect.id]:{round:newRound,cracked:willCrack||curState.cracked,history:newH}}));
    await speakText(resp,suspect.voiceCfg,settings);
    setTactic(null);setLoading(false);
  };
  return(
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16}}>
      <div>
        <Lbl style={{marginBottom:10}}>Suspects</Lbl>
        {suspects.map(s=>{const cs=crossState[s.id]||{};return(
          <div key={s.id} className={"portrait-card "+(selSuspect?.id===s.id?"selected ":"")+(cs.cracked?"cracked":"")} style={{marginBottom:10}} onClick={()=>setSelSuspect(s)}>
            <div className="portrait-avatar" style={{height:56,fontSize:28}}>{s.avatar||"👤"}</div>
            <div className="portrait-body" style={{padding:"10px 12px"}}>
              <div className="portrait-name" style={{fontSize:15}}>{s.name}</div>
              <div className="portrait-role">{s.role}</div>
              <div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
                {cs.cracked&&<span className="tag tag-red" style={{fontSize:9}}>CRACKED</span>}
                {cs.round>0&&!cs.cracked&&<span className="tag tag-amber" style={{fontSize:9}}>Rd {cs.round}</span>}
                {dynamicAlibis[s.id]&&<span className="tag tag-amber" style={{fontSize:9}}>⚡</span>}
              </div>
            </div>
          </div>
        );})}
      </div>
      <div>
        {!selSuspect?<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:280,color:"#42475A",fontSize:14}}>Select a suspect to cross-examine</div>:(
          <>
            <div className="card card-red" style={{padding:"14px 16px",marginBottom:12}}>
              <div className="display" style={{fontSize:20,color:"#E03020",marginBottom:3}}>{selSuspect.name} — Cross-Exam</div>
              <div style={{fontSize:12,color:"#8A8FA8",marginBottom:10}}>Round {state.round} · {state.cracked?"CRACKED":"Holding"}</div>
              {examData&&<><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{flex:1}} className="bar-track"><div className="bar-fill" style={{width:pct+"%",background:"linear-gradient(90deg,#F0A02088,#E03020)"}}/></div><span className="mono" style={{fontSize:10,color:"#E03020"}}>{pct}%</span></div><div style={{fontSize:11,color:"#42475A"}}>Contradiction: <span style={{color:"#8A8FA8"}}>{examData.contradiction}</span></div></>}
            </div>
            <div ref={chatRef} style={{height:190,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
              {state.history.length===0&&<div style={{textAlign:"center",color:"#42475A",fontSize:12,paddingTop:30}}>Choose a tactic.</div>}
              {state.history.map((e,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",justifyContent:"flex-end"}}><div className="bubble bubble-user" style={{background:"#E0302010",borderColor:"#E0302024"}}><span style={{fontSize:10,color:"#E03020",display:"block",marginBottom:2}}>Tactic: {e.tactic}</span>Pressing...</div></div>
                  <div style={{display:"flex",justifyContent:"flex-start"}}><div className={"bubble "+(e.isErr?"bubble-error":e.cracked?"bubble-pressure":"bubble-ai")}><span style={{fontSize:10,color:e.cracked?"#E03020":"#42475A",display:"block",marginBottom:2}}>{e.cracked?"⚠ CRACKING — ":""}{selSuspect.name} Rd {e.round}</span>{e.response}</div></div>
                </div>
              ))}
              {loading&&<div style={{display:"flex",gap:8,alignItems:"center"}}><span className="spinner"/><span style={{fontSize:11,color:"#42475A"}}>Applying pressure...</span></div>}
            </div>
            {!state.cracked?(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>{TACTICS.map(t=><div key={t.id} className={"tactic-card "+(tactic===t.id?"selected":"")} onClick={()=>setTactic(t.id)} style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>{t.icon}</span><div style={{fontSize:12,fontWeight:600,color:tactic===t.id?"#E03020":"#EDE9E0"}}>{t.l}</div></div>)}</div>
                <button className="btn btn-red" style={{width:"100%",justifyContent:"center"}} disabled={!tactic||loading} onClick={()=>doCrossExam(selSuspect,tactic)}>{loading?<><span className="spinner"/>Pressing...</>:"⚔ Press Contradiction"}</button>
              </>
            ):<div className="card card-red pulse-red" style={{padding:16,textAlign:"center"}}><div style={{fontSize:28,marginBottom:6}}>💥</div><div className="display" style={{fontSize:22,color:"#E03020"}}>SUSPECT CRACKED</div></div>}
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
  const hist=selWitness?witnessState[selWitness.id]?.chatHistory||[]:[];
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[witnessState,selWitness]);
  const TRIGGERS=[{id:"general",label:"Opening",icon:"💬"},{id:"suspicious",label:"Suspicious Behavior",icon:"🔍"}];
  const callWitness=async(witness,trigger)=>{
    setLoading(true);
    const preset=witness.statements?.find(s=>s.trigger===trigger)||witness.statements?.[0];
    const existing=witnessState[witness.id]||{chatHistory:[]};
    let response;
    if(preset&&existing.chatHistory.length<2){response=preset.text;}
    else{
      const sys="You are "+witness.name+", "+witness.role+". "+witness.summary+". Known: "+(witness.statements?.map(s=>s.text).join(" ")||"none")+". Prior answers: "+(existing.chatHistory.map(h=>h.response).join(" | ")||"none")+". 2-3 sentences about: "+trigger+".";
      response=await callAI("Witness asked about: "+trigger,sys,"witness-"+witness.id,settings);
    }
    const entry={trigger,response:isAIErr(response)?"[Witness unavailable]":response,player:player.name};
    setWitnessState(p=>({...p,[witness.id]:{unlocked:true,chatHistory:[...(p[witness.id]?.chatHistory||[]),entry]}}));
    if(!isAIErr(response))await speakText(response,witness.voiceCfg,settings);
    setLoading(false);
  };
  const askCustom=async(witness,q)=>{
    if(!q.trim())return;setLoading(true);
    const existing=witnessState[witness.id]||{chatHistory:[]};
    const sys="You are "+witness.name+", "+witness.role+". "+witness.summary+". Known: "+(witness.statements?.map(s=>s.text).join(" ")||"none")+". Prior: "+(existing.chatHistory.map(h=>h.response).join(" | ")||"none")+". Reply honestly in 2-3 sentences.";
    const resp=await callAI("Detective asks: "+q,sys,"witness-custom-"+witness.id,settings);
    const entry={trigger:"custom",question:q,response:isAIErr(resp)?"[Unavailable]":resp,player:player.name};
    setWitnessState(p=>({...p,[witness.id]:{...p[witness.id]||{unlocked:true},chatHistory:[...(p[witness.id]?.chatHistory||[]),entry]}}));
    if(!isAIErr(resp))await speakText(resp,witness.voiceCfg,settings);
    setCustomQ("");setLoading(false);
  };
  if(!witnesses||witnesses.length===0)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300,color:"#42475A",fontSize:14}}>No witnesses in this case.</div>;
  return(
    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16}}>
      <div>
        <Lbl style={{marginBottom:10}}>Witnesses</Lbl>
        {witnesses.map(w=>(
          <div key={w.id} className={"witness-item "+(selWitness?.id===w.id?"selected":"")} style={{marginBottom:10}} onClick={()=>setSelWitness(w)}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><span style={{fontSize:24}}>{w.avatar||"👤"}</span><div><div style={{fontWeight:700,fontSize:13}}>{w.name}</div><div style={{fontSize:11,color:"#8A8FA8"}}>{w.role}</div></div></div>
            <div style={{fontSize:11,color:"#42475A",lineHeight:1.4}}>{w.summary}</div>
            {witnessState[w.id]?.unlocked&&<span className="tag tag-teal" style={{fontSize:8,marginTop:6}}>INTERVIEWED</span>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column"}}>
        {!selWitness?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#42475A",fontSize:14}}>Select a witness</div>:(
          <>
            <div className="card card-teal" style={{padding:"14px 16px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:32}}>{selWitness.avatar||"👤"}</span><div><div className="display" style={{fontSize:20,color:"#22D4B4"}}>{selWitness.name}</div><div style={{fontSize:12,color:"#8A8FA8",marginTop:2}}>{selWitness.role}</div><div style={{fontSize:11,color:"#42475A",marginTop:3}}>{selWitness.summary}</div></div></div>
            </div>
            <div style={{marginBottom:10}}><Lbl style={{marginBottom:7}}>Ask about...</Lbl><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{TRIGGERS.filter(t=>selWitness.statements?.some(s=>s.trigger===t.id)).map(t=><button key={t.id} className="btn btn-teal btn-sm" onClick={()=>callWitness(selWitness,t.id)} disabled={loading}>{t.icon} {t.label}</button>)}</div></div>
            <div ref={chatRef} style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:10,minHeight:160,maxHeight:260}}>
              {hist.length===0&&<div style={{textAlign:"center",color:"#42475A",fontSize:12,paddingTop:28}}>Select a topic or ask below.</div>}
              {hist.map((e,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:7}}>
                  {e.question&&<div style={{display:"flex",justifyContent:"flex-end"}}><div className="bubble bubble-user"><span style={{fontSize:10,color:"#22D4B4",display:"block",marginBottom:2}}>{e.player}</span>{e.question}</div></div>}
                  <div style={{display:"flex",justifyContent:"flex-start"}}><div className="bubble bubble-ai"><span style={{fontSize:10,color:"#22D4B4",display:"block",marginBottom:2}}>{selWitness.name}</span>{e.response}</div></div>
                </div>
              ))}
              {loading&&<div style={{display:"flex",gap:8,alignItems:"center"}}><span className="spinner"/><span style={{fontSize:11,color:"#42475A"}}>{selWitness.name} thinking...</span></div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input className="input" placeholder={"Ask "+selWitness.name.split(" ")[0]+"..."} value={customQ} onChange={e=>setCustomQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&customQ.trim()&&!loading&&askCustom(selWitness,customQ)} style={{flex:1}}/>
              <button className="btn btn-teal" disabled={!customQ.trim()||loading} onClick={()=>askCustom(selWitness,customQ)}>{loading?<span className="spinner"/>:"Ask"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// INTERROG PANEL
// ============================================================
function InterrogPanel(props){
  const {subTab,setSubTab,setShowDossier,setShowTimeline,suspects}=props;
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[["interrogate","💬","Interrogate","btn-gold"],["cross","⚔","Cross-Exam","btn-red"],["witnesses","👁","Witnesses","btn-teal"]].map(([id,icon,lbl,btn])=>(
          <button key={id} className={"btn btn-sm "+(subTab===id?btn:"btn-ghost")} onClick={()=>setSubTab(id)}>{icon} {lbl}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          <button className="btn btn-sm btn-ghost" onClick={()=>setShowDossier(props.selSuspect||suspects[0])}>📋 Dossier</button>
          <button className="btn btn-sm btn-ghost" onClick={()=>setShowTimeline(props.selSuspect||suspects[0])}>⏱ Timeline</button>
        </div>
      </div>
      {subTab==="interrogate"&&<InterrogationTab suspects={suspects} {...props}/>}
      {subTab==="cross"&&<CrossExamTab suspects={suspects} {...props}/>}
      {subTab==="witnesses"&&<WitnessTab witnesses={props.caseData.witnesses||[]} witnessState={props.witnessState} setWitnessState={props.setWitnessState} player={props.player} settings={props.settings}/>}
    </div>
  );
}

// ============================================================
// DOSSIER MODAL
// ============================================================
function DossierModal({suspect,dynamicAlibis,onClose}){
  if(!suspect)return null;
  const dos=suspect.dossier||{};
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal anim-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:44}}>{suspect.avatar||"👤"}</span><div><div className="display" style={{fontSize:28,color:"#C9AA71"}}>{suspect.name}</div><div style={{fontSize:13,color:"#8A8FA8"}}>{suspect.role} · Age {suspect.age}</div></div></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {dynamicAlibis[suspect.id]&&<div style={{padding:"8px 12px",background:"#F0A02010",border:"1px solid #F0A02028",borderRadius:3,marginBottom:14,fontSize:12}}><span style={{color:"#F0A020",fontWeight:700}}>⚡ Alibi updated: </span>{dynamicAlibis[suspect.id]}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["Background",dos.background],["Associates",dos.associates],["Record",dos.record],["Financials",dos.financials]].map(([k,v])=>v&&(
            <div key={k} style={{padding:"12px 14px",background:"#10131A",borderRadius:3,border:"1px solid #1F2330"}}><Lbl style={{marginBottom:5}}>{k}</Lbl><div style={{fontSize:12,color:"#8A8FA8",lineHeight:1.6}}>{v}</div></div>
          ))}
        </div>
        {suspect.psych&&(
          <div style={{marginTop:12,padding:"12px 14px",background:"#9B7FD408",borderRadius:3,border:"1px solid #9B7FD428"}}>
            <span className="tag tag-purple" style={{marginBottom:8,display:"inline-flex"}}>🧠 Psych Archetype</span>
            <div style={{fontSize:14,fontWeight:600,color:"#9B7FD4",marginBottom:6}}>{suspect.psych.archetype}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>{suspect.psych.traits?.map((t,i)=><span key={i} className="profiler-trait">{t}</span>)}</div>
            {suspect.psych.tell&&<div style={{fontSize:11,color:"#8A8FA8"}}><span style={{color:"#9B7FD4"}}>Tell: </span>{suspect.psych.tell}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TIMELINE MODAL
// ============================================================
function TimelineModal({suspect,onClose}){
  if(!suspect)return null;
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal anim-up" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div><span className="tag tag-teal" style={{marginBottom:8,display:"inline-flex"}}>⏱ Timeline</span><h3 className="display" style={{fontSize:28,marginTop:6,color:"#22D4B4"}}>{suspect.name}</h3></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{paddingLeft:20,borderLeft:"1px solid #1F2330"}}>
          {(suspect.timeline||[]).map((e,i)=>(
            <div key={i} style={{display:"flex",gap:14,marginBottom:16,position:"relative"}}>
              <div style={{position:"absolute",left:-24,top:4,width:9,height:9,borderRadius:"50%",background:"#22D4B4",border:"2px solid #06080C"}}/>
              <div><div className="mono" style={{fontSize:12,color:"#22D4B4",marginBottom:3}}>{e.t}</div><div style={{fontSize:13,color:"#8A8FA8",lineHeight:1.55}}>{e.a}</div></div>
            </div>
          ))}
          {!(suspect.timeline?.length)&&<p style={{color:"#42475A",fontSize:13}}>No timeline data.</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ACCUSE MODAL
// ============================================================
function AccuseModal({suspects,accusation,setAccusation,crossState,onConfirm,onClose,player}){
  return(
    <div className="overlay">
      <div className="modal anim-up">
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:10}}>⚖</div>
          <h3 className="display" style={{fontSize:36,color:"#E03020",marginBottom:6}}>FINAL ACCUSATION</h3>
          <p style={{color:"#8A8FA8",fontSize:13,lineHeight:1.7}}>One chance. Choose carefully, {player.name}.</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {suspects.map(s=>(
            <div key={s.id} className={"accuse-card "+(accusation===s.id?"selected":"")} onClick={()=>setAccusation(s.id)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:28}}>{s.avatar||"👤"}</span><div><div className="display" style={{fontSize:20}}>{s.name}</div><div style={{fontSize:12,color:"#8A8FA8"}}>{s.role}</div>{crossState[s.id]?.cracked&&<span className="tag tag-red" style={{fontSize:9,marginTop:4}}>CRACKED</span>}</div></div>
                {accusation===s.id&&<span style={{color:"#E03020",fontSize:24}}>◉</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}><button className="btn btn-red btn-lg" disabled={!accusation} onClick={onConfirm} style={{flex:1,justifyContent:"center"}}>CONFIRM ACCUSATION</button><button className="btn btn-ghost btn-lg" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

// ============================================================
// GRILL MODAL (formerly "Hot Seat" / reverse interrogation) — now with a back button
// ============================================================
function GrillModal({caseData,player,state,setState,onClose,onBack,diff,settings}){
  const ri=caseData.reverseInterrogation;
  const qList=ri?.questions?.slice(0,diff.reverseQ)||[];
  const curQ=qList[state.qIdx];
  const ref=useRef(null);
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[state.history]);
  const suspColor=state.suspicion<30?"#30D46A":state.suspicion<60?"#F0A020":state.suspicion<80?"#E07030":"#E03020";
  const handleSubmit=async()=>{
    const q=curQ,ans=state.ans.trim();if(!ans)return;
    setState(s=>({...s,loading:true,error:""}));
    const sys="You are a hard-boiled detective inspector grilling Detective "+player.name+". Alibi: "+ri.alibi+". Vulnerability: "+ri.secret+". Be adversarial, skeptical. Rate believability 1-10. Return ONLY JSON with keys score (1-10) and response (string). No markdown.";
    const raw=await callAI("Question: "+q+"\nAnswer: "+ans,sys,"grill",settings);
    if(isAIErr(raw)){setState(s=>({...s,loading:false,error:raw.replace(AI_ERR,"").trim()}));return;}
    const parsed=safeJSON(raw,{score:5,response:"...noted."});
    const score=Math.min(10,Math.max(1,Number(parsed.score)||5));
    const delta=score>=7?-(Math.floor(Math.random()*15)+5):score>=4?Math.floor(Math.random()*8):Math.floor(Math.random()*20)+8;
    const newSusp=Math.min(100,Math.max(0,state.suspicion+delta));
    const isDone=state.qIdx>=qList.length-1;
    setState(s=>({...s,loading:false,error:"",history:[...s.history,{q,a:ans,aiResp:parsed.response||"...noted.",score,delta}],suspicion:newSusp,qIdx:s.qIdx+1,ans:"",done:isDone}));
    await speakText(parsed.response,null,settings);
  };
  return(
    <div className="overlay">
      <div className="modal modal-wide anim-up">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
            <div><span className="tag tag-purple" style={{marginBottom:6,display:"inline-flex"}}>🎯 Grill</span><h3 className="display" style={{fontSize:26,color:"#9B7FD4",marginTop:4}}>TURN THE TABLES</h3></div>
          </div>
          {state.done&&<button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
        </div>
        <div style={{marginBottom:12}}><SuspMeter value={state.suspicion} label={player.name+"'s Suspicion"}/></div>
        {state.error&&<div style={{background:"#E030200E",border:"1px solid #E0302033",borderRadius:4,padding:"10px 14px",marginBottom:10,fontSize:12,color:"#E03020"}}>❌ {state.error}</div>}
        <div ref={ref} style={{height:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
          {state.history.length===0&&!state.loading&&<div className="bubble bubble-system">The interrogator enters. The pressure is immediate.</div>}
          {state.history.map((e,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",gap:7}}>
              <div style={{display:"flex",justifyContent:"flex-start"}}><div className="bubble bubble-reverse"><span style={{fontSize:10,color:"#9B7FD4",display:"block",marginBottom:3}}>Interrogator</span>{e.q}</div></div>
              <div style={{display:"flex",justifyContent:"flex-end"}}><div className="bubble bubble-user"><span style={{fontSize:10,color:"#22D4B4",display:"block",marginBottom:3}}>{player.name}</span>{e.a}</div></div>
              <div style={{display:"flex",justifyContent:"flex-start"}}><div className="bubble" style={{background:e.delta>5?"#E0302010":"#9B7FD410",border:"1px solid "+(e.delta>5?"#E03020":"#9B7FD4")+"28"}}><span style={{fontSize:10,color:e.delta>5?"#E03020":"#9B7FD4",display:"block",marginBottom:2}}>Credibility: {e.score}/10 · {e.delta>0?"▲ +"+e.delta+"%":"▼ "+Math.abs(e.delta)+"%"}</span>{e.aiResp}</div></div>
            </div>
          ))}
          {state.loading&&<div style={{display:"flex",gap:8,alignItems:"center",padding:"6px 10px"}}><span className="spinner"/><span style={{fontSize:11,color:"#42475A"}}>Interrogator considering...</span></div>}
        </div>
        {!state.done&&curQ&&!state.loading?(
          <>
            <div className="card card-purple" style={{padding:"12px 14px",marginBottom:10}}><Lbl style={{marginBottom:6}}>Interrogator asks:</Lbl><p style={{fontSize:14,lineHeight:1.7,color:"#EDE9E0"}}>{curQ}</p></div>
            <div style={{display:"flex",gap:8}}>
              <input className="input" placeholder="Your answer..." value={state.ans} onChange={e=>setState(s=>({...s,ans:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&state.ans.trim()&&handleSubmit()} style={{flex:1}}/>
              <button className="btn btn-purple" disabled={!state.ans.trim()||state.loading} onClick={handleSubmit}>Answer</button>
            </div>
          </>
        ):state.done?(
          <div style={{textAlign:"center"}}>
            <div style={{padding:20,background:suspColor+"10",border:"1px solid "+suspColor+"33",borderRadius:6,marginBottom:12}}>
              <div style={{fontSize:40,marginBottom:8}}>{state.suspicion<30?"✅":state.suspicion<60?"😬":"🚨"}</div>
              <div className="display" style={{fontSize:28,color:suspColor,marginBottom:5}}>FINAL SUSPICION: {state.suspicion}%</div>
              <p style={{fontSize:13,color:"#8A8FA8"}}>{state.suspicion<30?"You held yourself together.":state.suspicion<60?"Shaky — they're watching you.":state.suspicion<80?"Under serious scrutiny.":"Solve this fast."}</p>
            </div>
            <button className="btn btn-teal btn-lg" onClick={onBack} style={{width:"100%",justifyContent:"center"}}>← Back to Investigation</button>
          </div>
        ):null}
      </div>
    </div>
  );
}

// ============================================================
// VERDICT SCREEN
// ============================================================
function VerdictScreen({verdict,caseData,player,onEnd}){
  const [phase,setPhase]=useState(0);
  const [tab,setTab]=useState("result");
  useEffect(()=>{const t1=setTimeout(()=>setPhase(1),300);const t2=setTimeout(()=>setPhase(2),1200);return()=>{clearTimeout(t1);clearTimeout(t2);};},[]);
  const isTimer=verdict.timerExpired,correct=verdict.correct;
  const bgColor=isTimer?"#F0A020":correct?"#30D46A":"#E03020";
  const emoji=isTimer?"⌛":correct?"🏆":verdict.permadeath?"💀":"😞";
  return(
    <div className="verdict-bg" style={{background:"radial-gradient(ellipse 100% 60% at 50% 0%, "+bgColor+"12, transparent)"}}>
      <div style={{maxWidth:660,width:"100%",opacity:phase>=1?1:0,transform:phase>=1?"none":"translateY(30px)",transition:"all 0.8s cubic-bezier(0.16,1,0.3,1)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:72,marginBottom:16}}>{emoji}</div>
          <span className={"tag tag-"+(isTimer?"amber":correct?"green":"red")} style={{marginBottom:16,display:"inline-flex",fontSize:11,padding:"5px 14px"}}>{isTimer?"TIME EXPIRED":correct?"CASE SOLVED":verdict.permadeath?"GAME OVER":"WRONG ACCUSATION"}</span>
          <h1 className="display" style={{fontSize:"clamp(36px,6vw,64px)",color:"#EDE9E0",marginBottom:10,lineHeight:1}}>{isTimer?"The killer escapes.":correct?"Brilliant work, Detective.":verdict.permadeath?"One shot. One miss.":"The real killer walks free."}</h1>
          <p style={{color:"#8A8FA8",fontSize:15,lineHeight:1.7}}>{isTimer?"The clock ran out. "+verdict.killer.name+" escapes.":correct?player.name+" correctly identified "+verdict.killer.name+".":player.name+" accused "+verdict.suspect?.name+". The killer was "+verdict.killer.name+"."}</p>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:24}}>
          {[["result","📊 Result"],["killerReveal","🎭 The Truth"],["stats","📈 Stats"]].map(([id,lbl])=>(
            <button key={id} className={"btn btn-sm "+(tab===id?"btn-teal":"btn-ghost")} onClick={()=>setTab(id)}>{lbl}</button>
          ))}
        </div>
        <div style={{opacity:phase>=2?1:0,transition:"opacity 0.6s ease 0.2s"}}>
          {tab==="result"&&(
            <div className="card" style={{padding:20,marginBottom:16}}>
              <Lbl style={{marginBottom:12}}>Investigation Summary</Lbl>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                {[{l:"Evidence Found",v:(verdict.foundClues?.length||0)+" pieces"},{l:"Critical Clues",v:(verdict.foundClues?.filter(c=>c.critical).length||0)+" found"},{l:"Your Suspicion",v:(verdict.revSuspicion||0)+"%"}].map(({l,v})=>(
                  <div key={l} style={{textAlign:"center",padding:12,background:"#10131A",borderRadius:3}}><div className="mono" style={{fontSize:18,color:"#22D4B4",marginBottom:4}}>{v}</div><Lbl>{l}</Lbl></div>
                ))}
              </div>
            </div>
          )}
          {tab==="killerReveal"&&verdict.killer&&(
            <div className="card card-red" style={{padding:20,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}><span style={{fontSize:48}}>{verdict.killer.avatar||"👤"}</span><div><span className="tag tag-red" style={{marginBottom:6,display:"inline-flex"}}>THE KILLER</span><div className="display" style={{fontSize:28,color:"#E03020"}}>{verdict.killer.name}</div><div style={{fontSize:13,color:"#8A8FA8"}}>{verdict.killer.role}</div></div></div>
              <div style={{fontSize:13,color:"#8A8FA8",lineHeight:1.7,padding:"12px 14px",background:"#E0302008",borderRadius:3,border:"1px solid #E0302020"}}>{verdict.reason}</div>
            </div>
          )}
          {tab==="stats"&&(
            <div className="card" style={{padding:20,marginBottom:16}}>
              <Lbl style={{marginBottom:12}}>Evidence Collected</Lbl>
              {verdict.foundClues?.map(c=>(
                <div key={c.id} style={{display:"flex",gap:10,marginBottom:8,padding:"8px 10px",background:"#10131A",borderRadius:3}}><span>{c.critical?"🔑":"🔎"}</span><div><div style={{fontSize:12,fontWeight:600,color:c.critical?"#C9AA71":"#EDE9E0"}}>{c.name}</div><div style={{fontSize:11,color:"#8A8FA8"}}>{c.desc}</div></div></div>
              ))}
              {!verdict.foundClues?.length&&<div style={{color:"#42475A",fontSize:13}}>No evidence collected.</div>}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button className="btn btn-teal btn-lg" onClick={()=>onEnd("lobby")}>🔍 New Case</button>
          <button className="btn btn-ghost btn-lg" onClick={()=>onEnd("home")}>← Home</button>
        </div>
      </div>
    </div>
  );
}
// ============================================================
// SPLASH SCREEN
// ============================================================
function SplashScreen({onDone}){
  const [phase,setPhase]=useState(0);
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase(1),400);
    const t2=setTimeout(()=>setPhase(2),1100);
    const t3=setTimeout(()=>setPhase(3),1800);
    const t4=setTimeout(()=>onDone(),2800);
    return()=>{[t1,t2,t3,t4].forEach(clearTimeout);};
  },[]);
  return(
    <div className="splash-bg">
      <div className="splash-grid"/><div className="splash-scanline"/>
      <div style={{textAlign:"center",position:"relative",zIndex:1}}>
        <div style={{opacity:phase>=1?1:0,transform:phase>=1?"none":"translateY(30px)",transition:"all 0.7s cubic-bezier(0.16,1,0.3,1)"}}>
          <div className="mono" style={{fontSize:10,color:"#22D4B4",letterSpacing:"0.3em",marginBottom:20,opacity:0.7}}>INITIALIZING CASE FILES...</div>
          <div className="display" style={{fontSize:"clamp(64px,14vw,128px)",color:"#EDE9E0",lineHeight:0.85}}>CASE<span style={{color:"#22D4B4"}}>ZERO</span></div>
        </div>
        <div style={{marginTop:20,opacity:phase>=2?1:0,transition:"opacity 0.6s ease 0.1s"}}>
          <div className="noir" style={{fontSize:18,color:"#8A8FA8"}}>Every case has a zero hour.</div>
        </div>
        <div style={{marginTop:32,opacity:phase>=3?1:0,transition:"opacity 0.5s ease"}}>
          <div style={{display:"flex",justifyContent:"center",gap:6}}>
            {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#22D4B4",opacity:0.4,animation:"breathe 1.4s ease infinite",animationDelay:i*0.2+"s"}}/>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODE SELECT — TV or Phone, shown once on first visit
// ============================================================
function ModeSelectScreen({onSelect}){
  const [sel,setSel]=useState(null);
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,background:"#06080C"}}>
      <div style={{textAlign:"center",marginBottom:48}}>
        <div className="display" style={{fontSize:"clamp(48px,8vw,88px)",color:"#EDE9E0",lineHeight:0.88}}>CASE<span style={{color:"#22D4B4"}}>ZERO</span></div>
        <div className="noir" style={{fontSize:17,color:"#8A8FA8",marginTop:12}}>Choose your viewing experience</div>
      </div>
      <div style={{display:"flex",gap:20,flexWrap:"wrap",justifyContent:"center",marginBottom:40,maxWidth:640,width:"100%"}}>
        {[
          {id:"tv",icon:"🖥",label:"TV Mode",desc:"Wide layout with three-column view. Best for desktop, tablet, or large screen.",sub:"Sidebar · Evidence Board · Suspect Panel"},
          {id:"phone",icon:"📱",label:"Phone Mode",desc:"Compact layout with bottom navigation. Optimised for mobile.",sub:"Bottom nav · Single column · Touch-friendly"},
        ].map(m=>(
          <div key={m.id} className={"mode-select-card "+(sel===m.id?"selected":"")} onClick={()=>setSel(m.id)} style={{maxWidth:260}}>
            <div style={{fontSize:48,marginBottom:14}}>{m.icon}</div>
            <div className="display" style={{fontSize:26,color:sel===m.id?"#22D4B4":"#EDE9E0",marginBottom:8}}>{m.label}</div>
            <div style={{fontSize:12,color:"#8A8FA8",lineHeight:1.6,marginBottom:10}}>{m.desc}</div>
            <div style={{fontSize:10,color:"#42475A",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.1em"}}>{m.sub}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-teal btn-lg" disabled={!sel} onClick={()=>onSelect(sel)} style={{minWidth:200,justifyContent:"center"}}>
        Continue →
      </button>
      <div style={{marginTop:16,fontSize:11,color:"#42475A"}}>You can always switch in Settings</div>
    </div>
  );
}

// ============================================================
// SETTINGS SCREEN — redesigned with voice/name slots
// ============================================================
function SettingsScreen({settings,onChange,onBack,layoutMode,onLayoutChange}){
  const [testStatus,setTestStatus]=useState("");
  const [testing,setTesting]=useState(false);
  const test=async()=>{
    setTesting(true);setTestStatus("");
    if(!settings.openAIKey){setTestStatus("❌ Enter your OpenAI API key first.");setTesting(false);return;}
    const r=await callAI("Reply with exactly: Connection OK","You are a test assistant. Reply with: Connection OK","test",settings);
    setTestStatus(isAIErr(r)?"❌ "+r.replace(AI_ERR,"").trim():"✅ Connected — GPT is ready");
    setTesting(false);
  };
  const set=(k,v)=>onChange({...settings,[k]:v});
  const setVoice=(slot,field,val)=>{
    const voices={...settings.voices};
    voices[slot]={...voices[slot],[field]:val};
    onChange({...settings,voices});
  };
  const v=settings.voices||{};
  return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"32px 24px",paddingBottom:80}}>
      <button className="btn btn-ghost btn-sm" style={{marginBottom:28}} onClick={onBack}>← Back</button>
      <h2 className="display" style={{fontSize:42,color:"#EDE9E0",marginBottom:4}}>SETTINGS</h2>
      <p style={{color:"#8A8FA8",marginBottom:28,fontSize:14}}>Configure AI model, voice slots, and game options.</p>

      {/* Layout toggle */}
      <div className="card" style={{padding:20,marginBottom:14}}>
        <Lbl style={{marginBottom:12}}>Display Mode</Lbl>
        <div style={{display:"flex",gap:10}}>
          {[["tv","🖥 TV Mode"],["phone","📱 Phone Mode"]].map(([id,lbl])=>(
            <button key={id} className={"btn btn-sm "+(layoutMode===id?"btn-teal":"btn-ghost")} style={{flex:1,justifyContent:"center"}} onClick={()=>onLayoutChange(id)}>{lbl}</button>
          ))}
        </div>
        <div style={{fontSize:11,color:"#42475A",marginTop:8}}>TV: three-column wide layout. Phone: compact bottom nav.</div>
      </div>

      {/* OpenAI model + key */}
      <div className="card" style={{padding:20,marginBottom:14}}>
        <Lbl style={{marginBottom:10}}>OpenAI Model</Lbl>
        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
          {OPENAI_MODELS.map(m=>(
            <div key={m.id} className={"model-row "+(settings.openAIModel===m.id?"active":"")} onClick={()=>set("openAIModel",m.id)}>
              <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:m.tier==="advanced"?"#9B7FD4":m.tier==="fast"?"#30D46A":"#22D4B4"}}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:settings.openAIModel===m.id?"#22D4B4":"#EDE9E0"}}>{m.label}</div><div style={{fontSize:11,color:"#8A8FA8"}}>{m.desc}</div></div>
              {settings.openAIModel===m.id&&<span style={{color:"#22D4B4",fontSize:14}}>✓</span>}
            </div>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <Lbl style={{marginBottom:8}}>OpenAI API Key</Lbl>
          <input className="input" placeholder="sk-..." type="password" value={settings.openAIKey||""} onChange={e=>set("openAIKey",e.target.value)}/>
          <div style={{fontSize:11,color:"#42475A",marginTop:6}}>Get your key at <span style={{color:"#22D4B4"}}>platform.openai.com</span></div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button className="btn btn-ghost btn-sm" onClick={test} disabled={testing}>{testing?<><span className="spinner"/>Testing...</>:"🔌 Test Connection"}</button>
          {testStatus&&<span style={{fontSize:12,color:testStatus.startsWith("✅")?"#30D46A":"#E03020"}}>{testStatus}</span>}
        </div>
      </div>

      {/* Voice & Name Slots */}
      <div className="card" style={{padding:20,marginBottom:14}}>
        <Lbl style={{marginBottom:4}}>Voice & Name Slots (ElevenLabs)</Lbl>
        <p style={{fontSize:11,color:"#42475A",marginBottom:16,lineHeight:1.6}}>Assign custom names and ElevenLabs voice IDs to the Narrator, up to 4 named suspects, and 1 witness. Leave blank to use defaults.</p>
        {[
          {slot:"narrator",label:"Narrator",icon:"🎙"},
          {slot:"suspect1",label:"Suspect 1",icon:"👤"},
          {slot:"suspect2",label:"Suspect 2",icon:"👤"},
          {slot:"suspect3",label:"Suspect 3",icon:"👤"},
          {slot:"suspect4",label:"Suspect 4 (optional)",icon:"👤"},
          {slot:"witness1",label:"Witness",icon:"🧑"},
        ].map(({slot,label,icon})=>(
          <div key={slot} style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
              <span style={{fontSize:16}}>{icon}</span>
              <Lbl style={{color:"#8A8FA8"}}>{label}</Lbl>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <input className="input" placeholder="Display name (optional)" style={{fontSize:12}} value={v[slot]?.name||""} onChange={e=>setVoice(slot,"name",e.target.value)}/>
              <input className="input" placeholder="ElevenLabs Voice ID" style={{fontSize:12}} value={v[slot]?.elevenLabsVoiceId||""} onChange={e=>setVoice(slot,"elevenLabsVoiceId",e.target.value)}/>
            </div>
          </div>
        ))}
        <div style={{borderTop:"1px solid #1F2330",paddingTop:14,marginTop:4}}>
          <Lbl style={{marginBottom:8}}>ElevenLabs API Key (shared)</Lbl>
          <input className="input" placeholder="xi-xxxxxxxxxxxxxxxxxxxxxxxx" value={settings.elevenLabsKey||""} onChange={e=>set("elevenLabsKey",e.target.value)}/>
        </div>
      </div>

      {/* Game options */}
      <div className="card" style={{padding:20}}>
        <Lbl style={{marginBottom:14}}>Game Options</Lbl>
        {[
          {k:"aiHints",l:"AI Hint System",d:"Request a subtle hint once per round"},
          {k:"lieDetector",l:"AI Lie Detector",d:"Scores deception % after each answer"},
          {k:"narratorEnabled",l:"AI Noir Narrator",d:"Atmospheric one-liner between phases"},
          {k:"psychProfiler",l:"Psych Profiler",d:"Reveal suspect psychological archetype & tells"},
          {k:"voiceEnabled",l:"Voice (ElevenLabs)",d:"Suspects and narrator speak using TTS"},
          {k:"newsTicker",l:"News Ticker",d:"Escalating headlines that affect suspects"},
          {k:"pressureEvents",l:"Pressure Events",d:"Mid-game urgency alerts from HQ"},
        ].map(o=>(
          <label key={o.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:14,cursor:"pointer"}}>
            <div><div style={{fontSize:14,fontWeight:500}}>{o.l}</div><div style={{fontSize:12,color:"#8A8FA8"}}>{o.d}</div></div>
            <Toggle on={settings[o.k]} onChange={()=>set(o.k,!settings[o.k])}/>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// LANDING SCREEN
// ============================================================
function LandingScreen({onStart,layoutMode}){
  return(
    <div style={{maxWidth:960,margin:"0 auto",padding:"48px 24px"}}>
      <div className="anim-up" style={{marginBottom:52,textAlign:"center"}}>
        <span className="tag tag-teal" style={{marginBottom:18,display:"inline-flex"}}>V4 · POWERED BY OPENAI</span>
        <h1 className="display" style={{fontSize:"clamp(52px,9vw,96px)",color:"#EDE9E0",marginBottom:14,lineHeight:0.88}}>CASE<span style={{color:"#22D4B4"}}>ZERO</span></h1>
        <p className="noir" style={{fontSize:20,color:"#8A8FA8",maxWidth:480,margin:"0 auto",lineHeight:1.6}}>The city has a new detective. The suspects don't know it's you.</p>
      </div>
      <div className="anim-up" style={{animationDelay:"0.1s",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginBottom:48}}>
        {[["🎭","AI Suspects","Memory, mood & good/bad cop tactics"],["🎲","Random Killer","Each playthrough has a different culprit"],["👆","Fingerprint Lab","Scan & match prints with drag mechanic"],["🔦","UV Evidence","Sweep UV torch to reveal hidden traces"],["📺","News Ticker","Escalating headlines affect suspects live"],["🗺","Scene Map","Top-down floor plan to navigate rooms"],["📷","Crime Photos","Polaroid wall of crime scene stills"],["🔐","Decode Minigame","Crack the cipher when all clues are found"],["⚖","Patience Meter","Push too hard and suspects lawyer up"]].map(([i,t,d])=>(
          <div key={t} className="card" style={{padding:"16px 14px",textAlign:"center"}}><div style={{fontSize:26,marginBottom:8}}>{i}</div><div style={{fontSize:11,fontWeight:700,color:"#EDE9E0",marginBottom:4,letterSpacing:"0.04em"}}>{t}</div><div style={{fontSize:10,color:"#8A8FA8",lineHeight:1.5}}>{d}</div></div>
        ))}
      </div>
      <div className="anim-up" style={{animationDelay:"0.18s",display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
        <button className="btn btn-teal btn-xl" onClick={()=>onStart("lobby")}>▶ BEGIN INVESTIGATION</button>
        <button className="btn btn-ghost btn-xl" onClick={()=>onStart("settings")}>⚙ SETTINGS</button>
      </div>
    </div>
  );
}

// ============================================================
// LOBBY SCREEN
// ============================================================
function LobbyScreen({settings,onStart,onBack}){
  const [players,setPlayers]=useState([{id:1,name:"Detective 1",color:PLAYER_COLORS[0]}]);
  const [newName,setNewName]=useState("");
  const [diff,setDiff]=useState("detective");
  const [timerOvr,setTimerOvr]=useState(-1);
  const [selCase,setSelCase]=useState(null);
  const [gen,setGen]=useState(false);
  const [genErr,setGenErr]=useState("");
  const [showCustom,setShowCustom]=useState(false);
  const [customPrompt,setCustomPrompt]=useState("");
  const d=DIFFICULTY[diff];
  const timerMins=timerOvr>=0?timerOvr:d.timer;
  const addPlayer=()=>{if(players.length>=8)return;const name=newName.trim()||"Detective "+(players.length+1);setPlayers(p=>[...p,{id:Date.now(),name,color:PLAYER_COLORS[p.length%8]}]);setNewName("");};
  const generateCase=async()=>{
    setGen(true);setGenErr("");
    const prompt=`Create a noir detective mystery with multiple possible killers. Return ONLY valid compact JSON:
{"id":"c${Date.now()}","title":"Title","setting":"Setting","badge":"🔍","difficulty":"detective","summary":"Hook in 1-2 sentences","victim":"Name age role","cause":"Method","narratorIntro":"1-2 sentence noir atmosphere","finalNote":"A short cryptic note found at the scene, 1-2 sentences","polaroids":[{"id":"p1","label":"Label","caption":"Caption","emoji":"🔎"}],"cctv":"Short CCTV log description.","suspects":[{"id":"s1","name":"Name","role":"Role","age":35,"avatar":"👤","alibi":"Innocent alibi","secret":"Innocent secret","guiltyAlibi":"What they claim if guilty","guiltySecret":"What they hide if guilty","guiltyReason":"Motive if guilty — 2 sentences","psych":{"archetype":"Label","traits":["Trait1","Trait2"],"tell":"Behavioral tell"},"dossier":{"background":"","associates":"","record":"","financials":""},"timeline":[{"t":"9pm","a":"Action"}],"fingerprint":"loop","uvClue":"Nothing unusual detected"},{"id":"s2","name":"Name","role":"Role","age":40,"avatar":"👤","alibi":"Innocent alibi","secret":"Innocent secret","guiltyAlibi":"What they claim if guilty","guiltySecret":"What they hide if guilty","guiltyReason":"Motive if guilty","psych":{"archetype":"Label","traits":["Trait1"],"tell":"Tell"},"dossier":{"background":"","associates":"","record":"","financials":""},"timeline":[],"fingerprint":"whorl","uvClue":"Nothing unusual detected"},{"id":"s3","name":"Name","role":"Role","age":45,"avatar":"👤","alibi":"Innocent alibi","secret":"Innocent secret","guiltyAlibi":"What they claim if guilty","guiltySecret":"What they hide if guilty","guiltyReason":"Motive if guilty","psych":{"archetype":"Label","traits":["Trait1"],"tell":"Tell"},"dossier":{"background":"","associates":"","record":"","financials":""},"timeline":[],"fingerprint":"arch","uvClue":"Nothing unusual detected"}],"clues":[{"id":"c1","name":"Clue","desc":"Detail","critical":true,"room":"Room A","found":false,"hasFingerprint":true,"hasUV":true},{"id":"c2","name":"Clue","desc":"Detail","critical":true,"room":"Room B","found":false,"hasFingerprint":false,"hasUV":false},{"id":"c3","name":"Clue","desc":"Detail","critical":false,"room":"Room A","found":false,"hasFingerprint":false,"hasUV":false}],"rooms":["Room A","Room B","Room C"],"witnesses":[{"id":"w1","name":"Name","role":"Role","avatar":"👤","summary":"One line","statements":[{"trigger":"general","text":"Statement"},{"trigger":"suspicious","text":"Something odd"}]}],"interrogationQuestions":{"s1":[{"q":"Q?"},{"q":"Q2?"}],"s2":[{"q":"Q?"}],"s3":[{"q":"Q?"}]},"reverseInterrogation":{"alibi":"Claim","secret":"Weakness","questions":["Q1?","Q2?","Q3?"]},"crossExam":{"s1":{"contradiction":"Contradiction","pressure":"Key point","threshold":2},"s2":{"contradiction":"Contradiction","pressure":"Key point","threshold":2},"s3":{"contradiction":"Contradiction","pressure":"Key point","threshold":2}}}
Theme: ${customPrompt||"A shocking death at an exclusive private dinner"}. Make it atmospheric, noir, and original. Every suspect must have a believable motive.`;
    const raw=await callAI(prompt,"Return ONLY valid compact JSON. No markdown. No extra text.","case-gen",settings);
    if(isAIErr(raw)){setGenErr(raw.replace(AI_ERR,"").trim());setGen(false);return;}
    const parsed=safeJSON(raw);
    if(parsed._error||parsed._parseError){setGenErr(parsed._error||"JSON parse failed. Try again.");setGen(false);return;}
    parsed.suspects&&parsed.suspects.forEach(s=>{
      s.dossier=s.dossier||{background:"",associates:"",record:"None",financials:""};
      s.timeline=s.timeline||[];
      s.psych=s.psych||{archetype:"Unknown",traits:[],tell:"No obvious tell"};
      s.fingerprint=s.fingerprint||"loop";
      s.uvClue=s.uvClue||"Nothing unusual detected";
      s.guiltyAlibi=s.guiltyAlibi||s.alibi;
      s.guiltySecret=s.guiltySecret||s.secret;
      s.guiltyReason=s.guiltyReason||"Evidence points to this suspect.";
    });
    parsed.witnesses=parsed.witnesses||[];
    parsed.reverseInterrogation=parsed.reverseInterrogation||{alibi:"",secret:"",questions:["Where were you?","Why this case?"]};
    parsed.crossExam=parsed.crossExam||{};
    parsed.polaroids=parsed.polaroids||[];
    parsed.cctv=parsed.cctv||"No CCTV footage on file.";
    parsed.finalNote=parsed.finalNote||"A fragment of paper recovered from the scene. Too damaged to read fully.";
    setSelCase(parsed);setShowCustom(false);setGen(false);
  };
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"32px 24px"}}>
      <button className="btn btn-ghost btn-sm" style={{marginBottom:28}} onClick={onBack}>← Back</button>
      <div style={{marginBottom:28}}><h2 className="display" style={{fontSize:42,color:"#EDE9E0",marginBottom:4}}>MISSION BRIEFING</h2><p style={{color:"#8A8FA8",fontSize:14}}>Configure your team, difficulty, and case.</p></div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="card" style={{padding:20}}>
          <Lbl style={{marginBottom:12}}>Detectives ({players.length}/8)</Lbl>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {players.map(p=><div key={p.id} style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:9,height:9,borderRadius:"50%",background:p.color,flexShrink:0}}/><span style={{flex:1,fontSize:13}}>{p.name}</span>{players.length>1&&<button className="btn btn-ghost btn-sm" style={{padding:"2px 8px",fontSize:10}} onClick={()=>setPlayers(pl=>pl.filter(x=>x.id!==p.id))}>✕</button>}</div>)}
          </div>
          <div style={{display:"flex",gap:8}}><input className="input" placeholder="Player name" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()} style={{flex:1}}/><button className="btn btn-teal" onClick={addPlayer} disabled={players.length>=8}>+</button></div>
        </div>
        <div className="card" style={{padding:20}}>
          <Lbl style={{marginBottom:12}}>Difficulty</Lbl>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {Object.values(DIFFICULTY).map(dv=>(
              <div key={dv.id} className={"diff-card "+(diff===dv.id?"selected":"")} onClick={()=>setDiff(dv.id)} style={{textAlign:"left",padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><span style={{fontSize:18}}>{dv.icon}</span><div style={{fontSize:15,fontWeight:700,color:diff===dv.id?"#C9AA71":"#EDE9E0"}}>{dv.label}</div>{dv.permadeath&&<span className="tag tag-red" style={{fontSize:8}}>PERMADEATH</span>}</div>
                <div style={{fontSize:11,color:"#8A8FA8",lineHeight:1.5}}>{dv.desc}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:14}}>
            <Lbl style={{marginBottom:8}}>Case Timer</Lbl>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{TIMER_OPTS.map(t=><button key={t.v} className={"btn btn-sm "+(timerOvr===t.v?"btn-teal":"btn-ghost")} onClick={()=>setTimerOvr(t.v)}>{t.l}{t.v>0&&t.v===d.timer?" ★":""}</button>)}</div>
            <div style={{fontSize:11,color:"#42475A",marginTop:6}}>Timer: {timerMins===0?"Off":timerMins+" minutes"}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{padding:20,marginBottom:16}}>
        <Lbl style={{marginBottom:12}}>Select Case</Lbl>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
          {CASES.map(c=>(
            <div key={c.id} className={"case-select-card "+(selCase?.id===c.id?"selected":"")} onClick={()=>setSelCase(c)}>
              <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                <div style={{fontSize:26,flexShrink:0}}>{c.badge||"🔍"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{fontSize:15,fontWeight:700,color:selCase?.id===c.id?"#C9AA71":"#EDE9E0"}}>{c.title}</div>
                    <span className={"tag tag-"+(c.difficulty==="pi"?"red":"amber")} style={{fontSize:8}}>{c.difficulty==="pi"?"Private Investigator":"Detective"}</span>
                    <span className="tag tag-teal" style={{fontSize:8}}>🎲 Random killer</span>
                  </div>
                  <div style={{fontSize:12,color:"#8A8FA8",marginBottom:6,lineHeight:1.5}}>{c.summary}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    <span className="tag tag-muted" style={{fontSize:9}}>{c.suspects?.length} suspects</span>
                    <span className="tag tag-muted" style={{fontSize:9}}>{c.clues?.length} clues</span>
                    <span className="tag tag-teal" style={{fontSize:9}}>{c.witnesses?.length||0} witnesses</span>
                  </div>
                </div>
                {selCase?.id===c.id&&<div style={{width:8,height:8,borderRadius:"50%",background:"#C9AA71",flexShrink:0,marginTop:4}}/>}
              </div>
            </div>
          ))}
          <div onClick={()=>setShowCustom(true)} style={{padding:"14px 18px",borderRadius:3,cursor:"pointer",border:"1px dashed #1F2330",background:"#10131A",display:"flex",alignItems:"center",gap:14,transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#42475A"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1F2330"}>
            <span style={{fontSize:26}}>✨</span>
            <div><div style={{fontSize:14,fontWeight:600,color:"#8A8FA8",marginBottom:2}}>AI-Generated Case</div><div style={{fontSize:12,color:"#42475A"}}>Claude builds a full mystery from your theme — with multiple possible killers</div></div>
          </div>
        </div>
        {selCase&&<div style={{padding:"10px 14px",background:"#F0A02008",border:"1px solid #F0A02028",borderRadius:3,display:"flex",gap:10,alignItems:"center"}}><span style={{color:"#F0A020",fontSize:14}}>🎲</span><div style={{fontSize:12,color:"#8A8FA8"}}>The killer is randomized each playthrough. Even replaying the same case will give you a different culprit.</div></div>}
      </div>

      <button className="btn btn-gold btn-lg" style={{width:"100%",fontSize:14,letterSpacing:"0.12em",justifyContent:"center"}} disabled={!selCase} onClick={()=>onStart({players,caseData:selCase,difficulty:diff,timerMinutes:timerMins})}>▶ BEGIN INVESTIGATION</button>

      {showCustom&&(
        <div className="overlay" onClick={()=>setShowCustom(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 className="display" style={{fontSize:32,marginBottom:8}}>AI CASE GENERATOR</h3>
            <p style={{color:"#8A8FA8",fontSize:13,marginBottom:14}}>Describe a theme. Claude builds the full mystery with multiple possible killers so every playthrough is different.</p>
            <textarea className="input" placeholder="e.g. 'A poisoning at a Michelin star restaurant' or 'Cold War spy thriller in Vienna'" value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} style={{marginBottom:12}}/>
            {genErr&&<div style={{color:"#E03020",fontSize:12,marginBottom:10,padding:"8px 12px",background:"#E030200A",borderRadius:4}}>❌ {genErr}</div>}
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-gold" onClick={generateCase} disabled={gen} style={{flex:1,justifyContent:"center"}}>{gen?<><span className="spinner"/>Generating...</>:"✨ Generate Case"}</button>
              <button className="btn btn-ghost" onClick={()=>setShowCustom(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// IN-GAME SETTINGS PANEL (accessible from top nav during game)
// ============================================================
function InGameSettings({settings,onChange,onClose}){
  const set=(k,v)=>onChange({...settings,[k]:v});
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal anim-up" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 className="display" style={{fontSize:28,color:"#EDE9E0"}}>IN-GAME SETTINGS</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {[
          {k:"lieDetector",l:"Lie Detector",d:"Show deception % after each response"},
          {k:"narratorEnabled",l:"Noir Narrator",d:"Atmospheric one-liner between phases"},
          {k:"psychProfiler",l:"Psych Profiler",d:"Suspect psychological deep-dive"},
          {k:"aiHints",l:"AI Hints",d:"Request subtle hints during investigation"},
          {k:"voiceEnabled",l:"Voice (ElevenLabs)",d:"Suspects speak via TTS"},
          {k:"newsTicker",l:"News Ticker",d:"Escalating press headlines"},
          {k:"pressureEvents",l:"Pressure Events",d:"Mid-game urgency alerts from HQ"},
        ].map(o=>(
          <label key={o.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:16,cursor:"pointer"}}>
            <div><div style={{fontSize:14,fontWeight:500}}>{o.l}</div><div style={{fontSize:12,color:"#8A8FA8"}}>{o.d}</div></div>
            <Toggle on={settings[o.k]} onChange={()=>set(o.k,!settings[o.k])}/>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GAME SCREEN — master controller
// ============================================================
function GameScreen({gameState,settings,onSettings,onEnd,layoutMode}){
  const {players,caseData:rawCase,difficulty,timerMinutes}=gameState;
  const diff=DIFFICULTY[difficulty]||DIFFICULTY.detective;
  const [caseData]=useState(()=>pickRandomKiller(rawCase));
  const [phase,setPhase]=useState("detective");
  const [curPlayer,setCurPlayer]=useState(0);
  const [clues,setClues]=useState(()=>caseData.clues.map(x=>({...x,found:false})));
  const [activeRoom,setActiveRoom]=useState(caseData.rooms[0]);
  const [selSuspect,setSelSuspect]=useState(null);
  const [interrogHist,setInterrogHist]=useState({});
  const [questionCounts,setQuestionCounts]=useState({});
  const [dynamicAlibis,setDynamicAlibis]=useState({});
  const [lieScores,setLieScores]=useState({});
  const [patience,setPatience]=useState(()=>{const p={};caseData.suspects.forEach(s=>{p[s.id]=diff.patienceBase;});return p;});
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
  const [showGrill,setShowGrill]=useState(false);
  const [grillState,setGrillState]=useState({suspicion:15,history:[],qIdx:0,ans:"",loading:false,done:false,error:""});
  const [showDossier,setShowDossier]=useState(null);
  const [showTimeline,setShowTimeline]=useState(null);
  const [verdict,setVerdict]=useState(null);
  const [showMap,setShowMap]=useState(false);
  const [showCCTV,setShowCCTV]=useState(false);
  const [showPolaroids,setShowPolaroids]=useState(false);
  const [showDecode,setShowDecode]=useState(false);
  const [decodeSolved,setDecodeSolved]=useState(false);
  const [showInGameSettings,setShowInGameSettings]=useState(false);
  const [elapsedPct,setElapsedPct]=useState(0);
  const [newsUrgency,setNewsUrgency]=useState("low");
  const [pressureEvent,setPressureEvent]=useState(null);
  const [firedEvents,setFiredEvents]=useState([]);
  const startTime=useRef(Date.now());
  const totalMs=(timerMinutes||20)*60*1000;
  const player=players[curPlayer];
  const foundClues=clues.filter(c=>c.found);
  const allCluesFound=foundClues.length===clues.length;
  const progress=Math.round((foundClues.length/clues.length)*100);
  const isTV=layoutMode==="tv";
  const isPhone=layoutMode==="phone";

  // Build voice config mapping for suspects/narrator/witness
  const voices=settings.voices||{};
  const narratorVoiceCfg=voices.narrator?.elevenLabsVoiceId?{elevenLabsKey:settings.elevenLabsKey,elevenLabsVoiceId:voices.narrator.elevenLabsVoiceId}:null;
  const narratorName=voices.narrator?.name||null;

  useEffect(()=>{
    if(!settings.newsTicker&&!settings.pressureEvents)return;
    const int=setInterval(()=>{
      const pct=Math.min(100,((Date.now()-startTime.current)/totalMs)*100);
      setElapsedPct(pct);
      if(settings.pressureEvents){
        PRESSURE_EVENTS.forEach(ev=>{
          if(pct>=ev.trigger&&!firedEvents.includes(ev.id)){
            setFiredEvents(f=>[...f,ev.id]);setPressureEvent(ev);
            if(ev.id==="pe1")setPatience(p=>{const n={};Object.keys(p).forEach(k=>{n[k]=Math.max(0,p[k]-1);});return n;});
            if(ev.id==="pe3"){const killer=caseData.suspects.find(s=>s.guilty);if(killer)setPatience(p=>({...p,[killer.id]:Math.min(1,p[killer.id]||1)}));}
          }
        });
      }
    },3000);
    return()=>clearInterval(int);
  },[settings.newsTicker,settings.pressureEvents,firedEvents,totalMs]);

  useEffect(()=>{if(newsUrgency==="high"||newsUrgency==="critical"){setPatience(p=>{const n={};Object.keys(p).forEach(k=>{n[k]=Math.max(0,p[k]-1);});return n;});}  },[newsUrgency]);

  useEffect(()=>{
    if(!settings.narratorEnabled)return;
    const sys="You are a hardboiled noir narrator. One atmospheric sentence, 15-25 words, present tense.";
    const pr="Case: "+caseData.title+". Phase: "+phase+". Clues: "+(foundClues.map(c=>c.name).join(", ")||"none")+".";
    setNarrator(n=>({...n,loading:true}));
    callAI(pr,sys,"narrator",settings).then(async txt=>{
      const text=isAIErr(txt)?"The investigation continues...":txt;
      setNarrator({text,loading:false});
      if(!isAIErr(txt))await speakText(text,narratorVoiceCfg,settings);
    });
  },[phase]);

  const discoverClue=c=>setClues(prev=>prev.map(x=>x.id===c.id?{...x,found:true}:x));
  const getHint=async()=>{
    if(!diff.unlimitedHints&&hintUsed)return;setHintLoading(true);
    const h=await callAI("Detective found: "+(foundClues.map(c=>c.name).join(",")||"nothing")+". One cryptic noir hint under 20 words.","Game master. Subtle noir hints only.","hint",settings);
    setHint(isAIErr(h)?"Look closer at what's already in front of you.":h);setHintUsed(true);setShowHint(true);setHintLoading(false);
  };
  const submitAccusation=()=>{
    const s=caseData.suspects.find(x=>x.id===accusation);
    if(diff.permadeath&&!s.guilty){setVerdict({correct:false,permadeath:true,suspect:s,killer:caseData.suspects.find(x=>x.guilty),reason:caseData.killerReason,foundClues,revSuspicion:grillState.suspicion,players});setShowAccuse(false);return;}
    setVerdict({correct:s.guilty,suspect:s,killer:caseData.suspects.find(x=>x.guilty),reason:caseData.killerReason,foundClues,revSuspicion:grillState.suspicion,players});setShowAccuse(false);
  };
  const handleTimerExpire=()=>setVerdict({timerExpired:true,correct:false,suspect:null,killer:caseData.suspects.find(x=>x.guilty),reason:caseData.killerReason,foundClues,revSuspicion:grillState.suspicion,players});

  if(verdict)return <VerdictScreen verdict={verdict} caseData={caseData} player={player} onEnd={onEnd}/>;

  const shared={caseData,suspects:caseData.suspects,selSuspect,setSelSuspect,interrogHist,setInterrogHist,questionCounts,setQuestionCounts,dynamicAlibis,setDynamicAlibis,lieScores,setLieScores,patience,setPatience,crossState,setCrossState,witnessState,setWitnessState,player,settings,diff};
  const sidebarP={caseData,foundClues,clues,progress,revSuspicion:grillState.suspicion,hint,showHint,hintUsed,hintLoading,getHint,unlimitedHints:diff.unlimitedHints,aiHints:settings.aiHints};
  const boardP={caseData,clues,activeRoom,setActiveRoom,discoverClue,settings,onShowMap:()=>setShowMap(true),onShowCCTV:()=>setShowCCTV(true),onShowPolaroids:()=>setShowPolaroids(true),allCluesFound,onOpenDecode:()=>setShowDecode(true),decodeSolved};

  return(
    <div style={{minHeight:"100vh",paddingBottom:isPhone?72:0}}>
      {/* TOP NAV */}
      <div className="top-nav">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span className="display" style={{fontSize:22,color:"#EDE9E0"}}>CASE<span style={{color:"#22D4B4"}}>ZERO</span></span>
          <span className="tag tag-gold" style={{fontSize:8,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{caseData.title}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          {timerMinutes>0&&<CaseTimer minutes={timerMinutes} onExpire={handleTimerExpire} paused={!!verdict}/>}
          {players.length>1&&players.map((p,i)=>(
            <div key={p.id} className="player-chip" style={{opacity:i===curPlayer?1:0.4,borderColor:i===curPlayer?p.color:"#1F2330"}} onClick={()=>setCurPlayer(i)}>
              <div style={{width:7,height:7,borderRadius:"50%",background:p.color}}/><span style={{fontSize:11}}>{p.name}</span>
            </div>
          ))}
          {!isPhone&&(
            <div style={{display:"flex",gap:4}}>
              {[["detective","🔍"],["interrogation","💬"]].map(([id,icon])=><button key={id} className={"btn btn-sm "+(phase===id?"btn-teal":"btn-ghost")} onClick={()=>setPhase(id)}>{icon}</button>)}
            </div>
          )}
          <button className="btn btn-sm btn-ghost" onClick={()=>setShowMap(true)}>🗺</button>
          <button className="btn btn-sm btn-ghost" onClick={()=>setShowCCTV(true)}>📹</button>
          <button className="btn btn-sm btn-ghost" onClick={()=>setShowPolaroids(true)}>📷</button>
          <button className="btn btn-sm btn-purple" onClick={()=>setShowGrill(true)}>🎯 Grill</button>
          <button className="btn btn-sm btn-ghost" onClick={()=>setShowInGameSettings(true)}>⚙</button>
          <button className="btn btn-sm btn-red" onClick={()=>setShowAccuse(true)}>⚖</button>
        </div>
      </div>

      {/* NEWS TICKER */}
      {settings.newsTicker&&<NewsTicker elapsedPct={elapsedPct} caseData={caseData} onEscalate={setNewsUrgency}/>}
      {/* NARRATOR */}
      {settings.narratorEnabled&&<NarratorBar text={narrator.text} loading={narrator.loading} name={narratorName}/>}
      {/* PRESSURE EVENT */}
      {pressureEvent&&<PressureEvent event={pressureEvent} onDismiss={()=>setPressureEvent(null)}/>}

      {/* MAIN LAYOUT */}
      {isTV?(
        <div style={{display:"grid",gridTemplateColumns:"250px 1fr 240px",gap:16,padding:"16px 22px"}}>
          <div style={{overflowY:"auto"}}><Sidebar {...sidebarP}/></div>
          <div style={{overflowY:"auto"}}>
            <div style={{display:"flex",gap:7,marginBottom:14}}>
              {[["detective","🔍","Evidence"],["interrogation","💬","Interrogate"]].map(([id,icon,lbl])=><button key={id} className={"btn "+(phase===id?"btn-teal":"btn-ghost")} style={{fontSize:13}} onClick={()=>setPhase(id)}>{icon} {lbl}</button>)}
            </div>
            {phase==="detective"&&<CorkboardPanel {...boardP}/>}
            {phase==="interrogation"&&<InterrogPanel subTab={subTab} setSubTab={setSubTab} setShowDossier={setShowDossier} setShowTimeline={setShowTimeline} suspects={caseData.suspects} questionCounts={questionCounts} dynamicAlibis={dynamicAlibis} lieScores={lieScores} crossState={crossState} {...shared}/>}
          </div>
          <div style={{overflowY:"auto"}}>
            <Lbl style={{marginBottom:10}}>Suspects</Lbl>
            {caseData.suspects.map(s=>{
              const cs=crossState[s.id]||{},qc=questionCounts[s.id]||0,sp=patience[s.id]??diff.patienceBase;
              return(
                <div key={s.id} className={"portrait-card "+(selSuspect?.id===s.id?"selected ":"")+(cs.cracked?"cracked ":"")+(sp<=0?"lawyered":"")} style={{marginBottom:10,cursor:"pointer"}} onClick={()=>{setSelSuspect(s);if(phase!=="interrogation")setPhase("interrogation");}}>
                  <div className="portrait-avatar" style={{height:60,fontSize:30}}>{s.avatar||"👤"}</div>
                  <div className="portrait-body" style={{padding:"10px 12px"}}>
                    <div className="portrait-name" style={{fontSize:15}}>{s.name}</div>
                    <div className="portrait-role" style={{marginBottom:5}}>{s.role}</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {qc>0&&<MoodBadge count={qc} guilty={s.guilty} patience={sp}/>}
                      {cs.cracked&&<span className="tag tag-red" style={{fontSize:8}}>CRACKED</span>}
                      {sp<=0&&<span className="tag tag-purple" style={{fontSize:8}}>LAWYERED</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ):(
        <div style={{maxWidth:900,margin:"0 auto",padding:"14px 14px"}}>
          {!isPhone&&<div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:14}}><div><Sidebar {...sidebarP}/></div><div>{phase==="detective"&&<CorkboardPanel {...boardP}/>}{phase==="interrogation"&&<InterrogPanel subTab={subTab} setSubTab={setSubTab} setShowDossier={setShowDossier} setShowTimeline={setShowTimeline} {...shared}/>}</div></div>}
          {isPhone&&<div>{phase==="detective"&&<CorkboardPanel {...boardP}/>}{phase==="interrogation"&&<InterrogPanel subTab={subTab} setSubTab={setSubTab} setShowDossier={setShowDossier} setShowTimeline={setShowTimeline} {...shared}/>}</div>}
        </div>
      )}

      {/* PHONE BOTTOM NAV — fixed icons properly spaced */}
      {isPhone&&(
        <div className="bottom-nav">
          {[
            {id:"detective",icon:"🔍",label:"Evidence"},
            {id:"interrogation",icon:"💬",label:"Interrogate"},
            {id:"map",icon:"🗺",label:"Map",action:()=>setShowMap(true)},
            {id:"grill",icon:"🎯",label:"Grill",action:()=>setShowGrill(true)},
            {id:"accuse",icon:"⚖",label:"Accuse",action:()=>setShowAccuse(true)},
          ].map(item=>(
            <div key={item.id} className={"bnav-item "+(phase===item.id&&!item.action?"active":"")} onClick={item.action||(() =>setPhase(item.id))}>
              <div className="bnav-icon">{item.icon}</div>
              <div className="bnav-label" style={{color:item.id==="accuse"?"#E03020":phase===item.id&&!item.action?"#22D4B4":"#42475A"}}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* MODALS */}
      {showAccuse&&<AccuseModal suspects={caseData.suspects} accusation={accusation} setAccusation={setAccusation} crossState={crossState} onConfirm={submitAccusation} onClose={()=>setShowAccuse(false)} player={player}/>}
      {showGrill&&<GrillModal caseData={caseData} player={player} state={grillState} setState={setGrillState} onClose={()=>setShowGrill(false)} onBack={()=>setShowGrill(false)} diff={diff} settings={settings}/>}
      {showDossier&&<DossierModal suspect={showDossier} dynamicAlibis={dynamicAlibis} onClose={()=>setShowDossier(null)}/>}
      {showTimeline&&<TimelineModal suspect={showTimeline} onClose={()=>setShowTimeline(null)}/>}
      {showMap&&<SceneMapModal caseData={caseData} activeRoom={activeRoom} setActiveRoom={setActiveRoom} clues={clues} onClose={()=>setShowMap(false)}/>}
      {showCCTV&&<CCTVReplay caseData={caseData} onClose={()=>setShowCCTV(false)}/>}
      {showPolaroids&&<PolaroidWall caseData={caseData} foundClues={foundClues} onClose={()=>setShowPolaroids(false)}/>}
      {showDecode&&<DecodeMinigame caseData={caseData} onClose={()=>setShowDecode(false)} onSolved={()=>{setDecodeSolved(true);setShowDecode(false);}}/>}
      {showInGameSettings&&<InGameSettings settings={settings} onChange={onSettings} onClose={()=>setShowInGameSettings(false)}/>}
    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App(){
  const [showSplash,setShowSplash]=useState(true);
  const [showModeSelect,setShowModeSelect]=useState(true);
  const [layoutMode,setLayoutMode]=useState("tv");
  const [screen,setScreen]=useState("home");
  const [gameState,setGameState]=useState(null);
  const [settings,setSettings]=useState({
    openAIModel:"gpt-4o",
    openAIKey:"",
    elevenLabsKey:"",
    voices:{narrator:{name:"",elevenLabsVoiceId:""},suspect1:{name:"",elevenLabsVoiceId:""},suspect2:{name:"",elevenLabsVoiceId:""},suspect3:{name:"",elevenLabsVoiceId:""},suspect4:{name:"",elevenLabsVoiceId:""},witness1:{name:"",elevenLabsVoiceId:""}},
    aiHints:true,lieDetector:true,narratorEnabled:true,psychProfiler:true,
    voiceEnabled:false,newsTicker:true,pressureEvents:true,
  });
  const handleEnd=useCallback((dest)=>{setGameState(null);setScreen(dest||"home");},[]);
  const startGame=gs=>{setGameState(gs);setScreen("game");};
  if(showSplash)return(<><style>{css}</style><SplashScreen onDone={()=>setShowSplash(false)}/></>);
  if(showModeSelect)return(<><style>{css}</style><ModeSelectScreen onSelect={m=>{setLayoutMode(m);setShowModeSelect(false);}}/></>);
  return(
    <>
      <style>{css}</style>
      {screen!=="game"&&(
        <div className="top-nav">
          <span className="display" style={{fontSize:22,color:"#EDE9E0",cursor:"pointer"}} onClick={()=>setScreen("home")}>CASE<span style={{color:"#22D4B4"}}>ZERO</span></span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span className="tag tag-teal" style={{fontSize:8}}>V4 · OPENAI</span>
            <span className="tag tag-muted" style={{fontSize:8}}>{layoutMode==="tv"?"🖥 TV":"📱 Phone"}</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>setScreen("settings")}>⚙</button>
          </div>
        </div>
      )}
      {screen==="home"&&<LandingScreen onStart={s=>setScreen(s)} layoutMode={layoutMode}/>}
      {screen==="settings"&&<SettingsScreen settings={settings} onChange={setSettings} onBack={()=>setScreen("home")} layoutMode={layoutMode} onLayoutChange={setLayoutMode}/>}
      {screen==="lobby"&&<LobbyScreen settings={settings} onStart={startGame} onBack={()=>setScreen("home")}/>}
      {screen==="game"&&gameState&&<GameScreen gameState={gameState} settings={settings} onSettings={setSettings} onEnd={handleEnd} layoutMode={layoutMode}/>}
    </>
  );
}
