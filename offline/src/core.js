/* HortiExam portable domain. No DOM, network or storage dependencies. */
(function(root){
'use strict';
const SCHEMA=1;
const specialties=['Baumschule','Friedhofsgärtnerei','Garten- und Landschaftsbau','Gemüsebau','Obstbau','Staudengärtnerei','Zierpflanzenbau'];
const Planning=typeof module!=='undefined'&&module.exports?require('./planning.js'):root.HortiPlanning;
const clone=v=>JSON.parse(JSON.stringify(v));
const id=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const now=()=>new Date().toISOString();
const empty=()=>({schemaVersion:SCHEMA,projectId:id('project'),name:'HortiExam Aufgabenbank',createdAt:now(),families:[],tasks:[],sources:[],assets:[],uses:[],exams:[],patterns:[],workshops:[]});
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const equal=(a,b)=>canonical(a)===canonical(b);
const collectionNames=['families','tasks','sources','assets','uses','exams','patterns','workshops'];
const number=(v,name)=>{if(v!==null&&v!==undefined&&(!Number.isFinite(v)||v<0))throw Error(name+' muss eine nichtnegative Zahl oder unbekannt sein.');};
const string=(v,label)=>{if(typeof v!=='string')throw Error('Ungültiges Textfeld: '+label);};
const strings=(v,label)=>{if(!Array.isArray(v)||v.some(x=>typeof x!=='string'))throw Error('Ungültige Textliste: '+label);};
const examType=v=>{if(!['AP','ZP'].includes(v))throw Error('Ungültige Prüfungsart.');};
const checkTask=t=>{
 if(!t||typeof t.title!=='string'||!t.title.trim()||typeof t.text!=='string')throw Error('Aufgabe ohne Titel oder Text.');
 for(const k of ['tags','sourceIds','assetLinks','criteria','flags'])if(!Array.isArray(t[k]))throw Error('Ungültiges Aufgabenfeld: '+k);
 if(!['missing','draft','approved'].includes(t.solutionStatus))throw Error('Ungültiger Lösungsstatus.');
 for(const k of ['specialty','category','solution'])string(t[k],k);for(const k of ['tags','sourceIds','flags'])strings(t[k],k);examType(t.examType);if(!['review','approved'].includes(t.reviewStatus))throw Error('Ungültiger Prüfstatus.');if(t.kind!==undefined&&!['practical','oral','other'].includes(t.kind))throw Error('Ungültiger Aufgabenbestandsteil.');
 if(t.planningCategoryEvidence!==undefined)string(t.planningCategoryEvidence,'Kategoriebegründung');
 if(t.planningCategories!==undefined){strings(t.planningCategories,'Prüfungskategorien');if(!t.planningCategories.length||new Set(t.planningCategories).size!==t.planningCategories.length||t.planningCategories.some(id=>!Planning.catalog.some(c=>c.id===id)))throw Error('Ungültige Prüfungskategorie.');}
 number(t.points,'Punkte');number(t.minutes,'Minuten');
 for(const c of t.criteria){if(typeof c.text!=='string'||typeof c.answer!=='string')throw Error('Ungültiges Kriterium.');number(c.points,'Kriteriumspunkte');}
 for(const l of t.assetLinks){if(!l||typeof l.assetId!=='string'||!['candidate','examiner','source'].includes(l.audience)||l.caption!==undefined&&typeof l.caption!=='string')throw Error('Ungültige Anlagenzuordnung.');}
};
function validate(d){
 if(!d||d.schemaVersion!==SCHEMA)throw Error('Nicht unterstütztes Datenformat / Schema-Version. Bestand bleibt unverändert.');
 d.patterns??=[];d.workshops??=[];
 for(const k of collectionNames){if(!Array.isArray(d[k]))throw Error('Fehlende Sammlung: '+k);const seen=new Set();for(const x of d[k]){if(!x||typeof x.id!=='string'||!x.id||seen.has(x.id))throw Error('Ungültige oder doppelte ID in '+k);seen.add(x.id);}}
 string(d.name,'Projektname');string(d.projectId,'Projektkennung');
 d.families.forEach(f=>{string(f.title,'Familientitel');});
 const sets=Object.fromEntries(collectionNames.map(k=>[k,new Set(d[k].map(x=>x.id))]));
 const ref=(kind,x)=>{if(!sets[kind].has(x))throw Error('Fehlender Verweis: '+kind+' / '+x);};
 const links=t=>{checkTask(t);ref('families',t.familyId);t.sourceIds.forEach(x=>ref('sources',x));t.assetLinks.forEach(x=>ref('assets',x.assetId));};
 d.tasks.forEach(links);d.patterns.forEach(Planning.checkPattern);const patternScopes=new Set();for(const p of d.patterns){const key=JSON.stringify([p.examType,p.specialty]);if(patternScopes.has(key))throw Error('Mehrere Prüfungsmuster für denselben Prüfungsbereich.');patternScopes.add(key);}
 d.sources.forEach(s=>{for(const k of ['name','specialty','role','text'])string(s[k],k);if(s.flags!==undefined)strings(s.flags,'Quellenhinweise');if(s.year!=null&&(!Number.isInteger(s.year)||s.year<1900||s.year>2200))throw Error('Ungültiges Quelljahr.');examType(s.examType);if(s.assetId)ref('assets',s.assetId);if(!Array.isArray(s.attachmentIds))throw Error('Ungültige Quellenanlagen.');s.attachmentIds.forEach(x=>ref('assets',x));});
 d.assets.forEach(a=>{if(typeof a.data!=='string'||typeof a.mime!=='string'||typeof a.name!=='string'||!/^[-\w.+]+\/[-\w.+]+$/.test(a.mime)||!/^[A-Za-z0-9+/=\s]*$/.test(a.data))throw Error('Ungültige Anlagendaten.');});
 d.workshops.forEach(checkWorkshop);
 d.exams.forEach(e=>{checkExamWorkshop(d,e);examType(e.examType);for(const k of ['specialty','date','notes'])string(e[k],k);if(e.pattern)Planning.checkPattern(e.pattern);if(typeof e.title!=='string'||!Array.isArray(e.items))throw Error('Ungültige Prüfung.');const seen=new Set();e.items.forEach(i=>{if(!i.id||seen.has(i.id))throw Error('Doppelte Prüfungsposition.');seen.add(i.id);if(typeof i.originTaskId!=='string')throw Error('Fehlende Aufgabenherkunft.');links(i.task);});});
 d.uses.forEach(u=>{ref('exams',u.examId);strings(u.taskIds,'Einsatzaufgaben');strings(u.familyIds,'Einsatzfamilien');if(!validDate(u.date))throw Error('Ungültiger Einsatztermin.');});
 return d;
}
function checkWorkshop(w){
 if(!w||typeof w.id!=='string'||!w.id||typeof w.title!=='string'||!w.title.trim())throw Error('Bitte einen Namen für den Vorbereitungstermin eingeben.');
 if(!Number.isInteger(w.examYear)||w.examYear<1900||w.examYear>2200)throw Error('Bitte ein gültiges Prüfungsjahr eingeben (1900–2200).');
 if(typeof w.meetingDate!=='string'||w.meetingDate&&!validDate(w.meetingDate))throw Error('Ungültiges Datum für den Vorbereitungstermin.');
 if(!Array.isArray(w.specialties)||!w.specialties.length||new Set(w.specialties).size!==w.specialties.length||w.specialties.some(s=>!specialties.includes(s)))throw Error('Bitte gültige Fachrichtungsgruppen wählen.');
}
function checkExamWorkshop(d,e){
 if(e.examYear!==undefined&&(!Number.isInteger(e.examYear)||e.examYear<1900||e.examYear>2200))throw Error('Ungültiges Prüfungsjahr.');
 if(e.examYear!==undefined&&e.date&&(!validDate(e.date)||Number(e.date.slice(0,4))!==e.examYear))throw Error('Prüfungstermin und Prüfungsjahr müssen übereinstimmen.');
 if(e.workshopId!==undefined){const w=d.workshops.find(w=>w.id===e.workshopId);if(!w)throw Error('Vorbereitungstermin der Prüfung fehlt.');if(e.examYear!==w.examYear||!w.specialties.includes(e.specialty))throw Error('Prüfungsjahr und Fachrichtung müssen zum Vorbereitungstermin passen. Bestehende Prüfungen zuerst zuordnen.');}
}
function saveWorkshop(d,w){checkWorkshop(w);const next=d.workshops.filter(x=>x.id!==w.id).concat(w);for(const e of d.exams)checkExamWorkshop({...d,workshops:next},e);d.workshops=next;return w;}
function workshopExams(d,workshopId,specialty){return d.exams.filter(e=>e.workshopId===workshopId&&(!specialty||e.specialty===specialty));}
function newExam(fields={}){return {id:id('exam'),title:fields.title||'Neue praktische Prüfung',examType:fields.examType||'ZP',specialty:fields.specialty||'',date:fields.date||'',notes:'',status:'draft',createdAt:now(),updatedAt:now(),items:[],...(fields.examYear!==undefined?{examYear:fields.examYear}:{}),...(fields.workshopId?{workshopId:fields.workshopId}:{}),...(fields.pattern?{pattern:clone(fields.pattern)}:{})};}
function addItem(e,t){checkTask(t);const item={id:id('item'),originTaskId:t.id,task:clone(t)};e.items.push(item);e.updatedAt=now();return item;}
function revise(d,taskId,patch){const old=d.tasks.find(t=>t.id===taskId);if(!old)throw Error('Aufgabe nicht gefunden.');const next={...clone(old),...clone(patch),id:id('task'),previousId:old.id,createdAt:now()};delete next.supersededBy;
 if(old.solutionStatus==='approved'&&['text','points','criteria','assetLinks'].some(k=>k in patch&&!equal(patch[k],old[k])))next.solutionStatus=next.solution?.trim()?'draft':'missing';
 checkTask(next);old.supersededBy=next.id;d.tasks.push(next);return next;}
// Proposed working scale, never an assertion about official examination rules.
function proposePoints(task){
 checkTask(task);const t=clone(task);if(t.points!=null)return t;
 const known=t.criteria.filter(c=>c.points!=null),unknown=t.criteria.filter(c=>c.points==null),preserved=known.reduce((s,c)=>s+c.points,0),total=Math.max(100,preserved);
 const remainder=total-preserved,hasPlanning=known.some(c=>/planungsphase|planung|vorbereitung/i.test(c.text));
 let rubric=t.kind==='oral'?[['Fachwissen und fachliche Richtigkeit',50],['Begründung und Anwendung',30],['Struktur und verständliche Darstellung',10],['Reflexion und Rückfragen',10]]:t.kind==='other'?[['Fachliche Richtigkeit',50],['Vollständigkeit und nachvollziehbare Begründung',50]]:[...(!hasPlanning?[['Arbeitsplanung und Vorbereitung',20]]:[]),['Fachgerechte und sichere Durchführung',50],['Qualität und Kontrolle des Arbeitsergebnisses',20],['Begründung und Reflexion',10]];
 const targets=unknown.length?unknown:remainder>0?rubric.map(([text,weight],i)=>{const c={id:'proposed-'+t.id+'-'+i,text,points:null,answer:''};t.criteria.push(c);return c;}):[];
 const weights=unknown.length?targets.map(()=>1):rubric.map(x=>x[1]),sum=weights.reduce((a,b)=>a+b,0);let assigned=0;
 targets.forEach((c,i)=>{c.points=i===targets.length-1?Math.round((remainder-assigned)*100)/100:Math.floor(remainder*weights[i]/sum);assigned+=c.points;});
 t.points=total;t.pointsProposal={method:'working-scale-100-v1',total,preservedPoints:preserved,originalCriterionIds:known.map(c=>c.id).filter(Boolean)};
 t.flags.push('Punktevorschlag: '+total+' Punkte als Arbeitsgrundlage, keine amtliche Vorgabe. Vor Einsatz Gesamtpunkte, Teilpunkte und Gewichtung fachlich prüfen und diesen Hinweis nach Klärung entfernen.');
 t.reviewStatus='review';t.solutionStatus=t.solution.trim()?'draft':'missing';t.reviewedBy='';delete t.reviewedAt;return t;
}
function pointsLabel(t){return t.points==null?'Punkte offen':t.points+' Punkte'+(t.pointsProposal?(t.reviewStatus==='approved'?' · geprüft':' · Vorschlag'):'');}
function totals(e){return {points:e.items.reduce((s,i)=>s+(i.task.points??0),0),minutes:e.items.reduce((s,i)=>s+(i.task.minutes??0),0),unknownPoints:e.items.filter(i=>i.task.points==null).length,unknownMinutes:e.items.filter(i=>i.task.minutes==null).length};}
function readiness(e){const issues=[...Planning.coverage(e).issues];if(!e.items.length)issues.push('Keine Aufgaben ausgewählt.');e.items.forEach((i,n)=>{const t=i.task,p='Aufgabe '+(n+1)+': ';if(t.points==null)issues.push(p+'Punktzahl fehlt.');if(t.pointsProposal&&t.reviewStatus!=='approved')issues.push(p+'Punktevorschlag noch fachlich prüfen.');if(t.reviewStatus!=='approved')issues.push(p+'fachliche Prüfung offen.');if(t.solutionStatus!=='approved'||!t.solution?.trim())issues.push(p+'Lösung fehlt oder ist nicht freigegeben.');if(t.criteria.length&&t.criteria.every(c=>c.points!=null)&&Math.abs(t.criteria.reduce((s,c)=>s+c.points,0)-(t.points??0))>0.001)issues.push(p+'Summe der Kriterien weicht von Gesamtpunkten ab.');if(t.criteria.some(c=>c.points==null))issues.push(p+'Kriteriumspunkte fehlen.');if(t.flags.length)issues.push(p+'offene Quellenhinweise.');});return {ready:issues.length===0,issues};}
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
function recordUse(d,examId,date){if(!validDate(date)||date>new Date().toISOString().slice(0,10))throw Error('Einsatzdatum muss ein gültiger, nicht zukünftiger Termin sein.');const e=d.exams.find(x=>x.id===examId);if(!e||!e.items.length)throw Error('Prüfung ist leer oder fehlt.');if(!d.uses.some(x=>x.examId===examId&&x.date===date))d.uses.push({id:id('use'),examId,date,taskIds:e.items.map(i=>i.originTaskId),familyIds:[...new Set(e.items.map(i=>i.task.familyId))],evidence:'confirmed-manually'});e.status='used';e.updatedAt=now();}
function merge(local,incoming){
 validate(local);validate(incoming);for(const p of incoming.patterns){const old=local.patterns.find(x=>x.examType===p.examType&&x.specialty===p.specialty);if(old&&!equal(old,p))throw Error('Abweichende Prüfungsmuster: Projekt separat öffnen und Muster fachlich abgleichen. Import nicht übernommen.');}const result=clone(local),maps=Object.fromEntries(collectionNames.map(k=>[k,{}])),conflicts=[];
 // Deterministic import namespace makes repeated returns idempotent. This is an
 // identifier fingerprint, not an authentication or cryptographic checksum.
 let fingerprint=2166136261,second=5381;const raw=canonical(incoming);
 for(let i=0;i<raw.length;i++){fingerprint=Math.imul(fingerprint^raw.charCodeAt(i),16777619);second=Math.imul(second,33)^raw.charCodeAt(i);}
 const suffix=(fingerprint>>>0).toString(16)+(second>>>0).toString(16);
 const remap=(k,v)=>maps[k][v]||v;
 function fixTask(t){t.id=remap('tasks',t.id);t.familyId=remap('families',t.familyId);t.sourceIds=t.sourceIds.map(v=>remap('sources',v));t.assetLinks.forEach(l=>l.assetId=remap('assets',l.assetId));if(t.previousId)t.previousId=remap('tasks',t.previousId);if(t.supersededBy)t.supersededBy=remap('tasks',t.supersededBy);}
 function transform(k,original){const x=clone(original);x.id=remap(k,x.id);if(k==='tasks')fixTask(x);if(k==='sources'){if(x.assetId)x.assetId=remap('assets',x.assetId);x.attachmentIds=x.attachmentIds.map(v=>remap('assets',v));}if(k==='exams'){if(x.workshopId)x.workshopId=remap('workshops',x.workshopId);x.items.forEach(i=>{fixTask(i.task);i.originTaskId=remap('tasks',i.originTaskId);});if(maps.exams[original.id]){x.title+=' · Rücklauf';x.importedFrom=original.id;}}if(k==='uses'){x.examId=remap('exams',x.examId);x.taskIds=x.taskIds.map(v=>remap('tasks',v));x.familyIds=x.familyIds.map(v=>remap('families',v));}return x;}
 // Propagate collisions through references until every dependent record has a
 // stable destination. Local records and their snapshots are never rewritten.
 let added;do{added=false;for(const k of collectionNames)for(const x of incoming[k]){if(maps[k][x.id])continue;const old=local[k].find(y=>y.id===x.id);if(old&&!equal(old,transform(k,x))){maps[k][x.id]=x.id+'~'+suffix;conflicts.push({kind:k,id:x.id,newId:maps[k][x.id]});added=true;}}}while(added);
 for(const k of collectionNames)for(const original of incoming[k]){const x=transform(k,original),old=result[k].find(v=>v.id===x.id);if(!old)result[k].push(x);else if(!equal(old,x))throw Error('Abweichender Import mit gleicher Kennung. Bitte als separates Projekt öffnen.');}
 validate(result);return {db:result,conflicts};
}
function subset(d,specialty){const p={...empty(),name:'Arbeitsgruppe '+specialty};p.tasks=clone(d.tasks.filter(t=>t.specialty===specialty));const fs=new Set(p.tasks.map(t=>t.familyId)),ss=new Set(p.tasks.flatMap(t=>t.sourceIds));p.families=clone(d.families.filter(f=>fs.has(f.id)));p.sources=clone(d.sources.filter(s=>ss.has(s.id)));const as=new Set([...p.tasks.flatMap(t=>t.assetLinks.map(l=>l.assetId)),...p.sources.flatMap(s=>[s.assetId,...s.attachmentIds])]);p.assets=clone(d.assets.filter(a=>as.has(a.id)));return validate(p);}
const api={proposePoints,pointsLabel,SCHEMA,specialties,checkWorkshop,checkExamWorkshop,saveWorkshop,workshopExams,clone,id,now,empty,equal,validate,newExam,addItem,revise,totals,readiness,validDate,recordUse,merge,subset,checkTask};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HortiCore=api;
})(globalThis);
