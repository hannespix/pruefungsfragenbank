/* HortiExam portable domain. No DOM, network or storage dependencies. */
(function(root){
'use strict';
const SCHEMA=1;
const clone=v=>JSON.parse(JSON.stringify(v));
const id=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const now=()=>new Date().toISOString();
const empty=()=>({schemaVersion:SCHEMA,projectId:id('project'),name:'HortiExam Aufgabenbank',createdAt:now(),families:[],tasks:[],sources:[],assets:[],uses:[],exams:[]});
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const equal=(a,b)=>canonical(a)===canonical(b);
const collectionNames=['families','tasks','sources','assets','uses','exams'];
const number=(v,name)=>{if(v!==null&&v!==undefined&&(!Number.isFinite(v)||v<0))throw Error(name+' muss eine nichtnegative Zahl oder unbekannt sein.');};
const string=(v,label)=>{if(typeof v!=='string')throw Error('Ungültiges Textfeld: '+label);};
const strings=(v,label)=>{if(!Array.isArray(v)||v.some(x=>typeof x!=='string'))throw Error('Ungültige Textliste: '+label);};
const examType=v=>{if(!['AP','ZP'].includes(v))throw Error('Ungültige Prüfungsart.');};
const checkTask=t=>{
 if(!t||typeof t.title!=='string'||!t.title.trim()||typeof t.text!=='string')throw Error('Aufgabe ohne Titel oder Text.');
 for(const k of ['tags','sourceIds','assetLinks','criteria','flags'])if(!Array.isArray(t[k]))throw Error('Ungültiges Aufgabenfeld: '+k);
 if(!['missing','draft','approved'].includes(t.solutionStatus))throw Error('Ungültiger Lösungsstatus.');
 for(const k of ['specialty','category','solution'])string(t[k],k);for(const k of ['tags','sourceIds','flags'])strings(t[k],k);examType(t.examType);if(!['review','approved'].includes(t.reviewStatus))throw Error('Ungültiger Prüfstatus.');if(t.kind!==undefined&&!['practical','oral','other'].includes(t.kind))throw Error('Ungültiger Aufgabenbestandsteil.');
 number(t.points,'Punkte');number(t.minutes,'Minuten');
 for(const c of t.criteria){if(typeof c.text!=='string'||typeof c.answer!=='string')throw Error('Ungültiges Kriterium.');number(c.points,'Kriteriumspunkte');}
 for(const l of t.assetLinks){if(!l||typeof l.assetId!=='string'||!['candidate','examiner','source'].includes(l.audience)||l.caption!==undefined&&typeof l.caption!=='string')throw Error('Ungültige Anlagenzuordnung.');}
};
function validate(d){
 if(!d||d.schemaVersion!==SCHEMA)throw Error('Nicht unterstütztes Datenformat / Schema-Version. Bestand bleibt unverändert.');
 for(const k of collectionNames){if(!Array.isArray(d[k]))throw Error('Fehlende Sammlung: '+k);const seen=new Set();for(const x of d[k]){if(!x||typeof x.id!=='string'||!x.id||seen.has(x.id))throw Error('Ungültige oder doppelte ID in '+k);seen.add(x.id);}}
 string(d.name,'Projektname');string(d.projectId,'Projektkennung');
 d.families.forEach(f=>{string(f.title,'Familientitel');});
 const sets=Object.fromEntries(collectionNames.map(k=>[k,new Set(d[k].map(x=>x.id))]));
 const ref=(kind,x)=>{if(!sets[kind].has(x))throw Error('Fehlender Verweis: '+kind+' / '+x);};
 const links=t=>{checkTask(t);ref('families',t.familyId);t.sourceIds.forEach(x=>ref('sources',x));t.assetLinks.forEach(x=>ref('assets',x.assetId));};
 d.tasks.forEach(links);
 d.sources.forEach(s=>{for(const k of ['name','specialty','role','text'])string(s[k],k);if(s.flags!==undefined)strings(s.flags,'Quellenhinweise');if(s.year!=null&&(!Number.isInteger(s.year)||s.year<1900||s.year>2200))throw Error('Ungültiges Quelljahr.');examType(s.examType);if(s.assetId)ref('assets',s.assetId);if(!Array.isArray(s.attachmentIds))throw Error('Ungültige Quellenanlagen.');s.attachmentIds.forEach(x=>ref('assets',x));});
 d.assets.forEach(a=>{if(typeof a.data!=='string'||typeof a.mime!=='string'||typeof a.name!=='string'||!/^[-\w.+]+\/[-\w.+]+$/.test(a.mime)||!/^[A-Za-z0-9+/=\s]*$/.test(a.data))throw Error('Ungültige Anlagendaten.');});
 d.exams.forEach(e=>{examType(e.examType);for(const k of ['specialty','date','notes'])string(e[k],k);if(typeof e.title!=='string'||!Array.isArray(e.items))throw Error('Ungültige Prüfung.');const seen=new Set();e.items.forEach(i=>{if(!i.id||seen.has(i.id))throw Error('Doppelte Prüfungsposition.');seen.add(i.id);if(typeof i.originTaskId!=='string')throw Error('Fehlende Aufgabenherkunft.');links(i.task);});});
 d.uses.forEach(u=>{ref('exams',u.examId);strings(u.taskIds,'Einsatzaufgaben');strings(u.familyIds,'Einsatzfamilien');if(!validDate(u.date))throw Error('Ungültiger Einsatztermin.');});
 return d;
}
function newExam(fields={}){return {id:id('exam'),title:fields.title||'Neue praktische Prüfung',examType:fields.examType||'ZP',specialty:fields.specialty||'',date:fields.date||'',notes:'',status:'draft',createdAt:now(),updatedAt:now(),items:[]};}
function addItem(e,t){checkTask(t);const item={id:id('item'),originTaskId:t.id,task:clone(t)};e.items.push(item);e.updatedAt=now();return item;}
function revise(d,taskId,patch){const old=d.tasks.find(t=>t.id===taskId);if(!old)throw Error('Aufgabe nicht gefunden.');const next={...clone(old),...clone(patch),id:id('task'),previousId:old.id,createdAt:now()};delete next.supersededBy;
 if(old.solutionStatus==='approved'&&['text','points','criteria','assetLinks'].some(k=>k in patch&&!equal(patch[k],old[k])))next.solutionStatus=next.solution?.trim()?'draft':'missing';
 checkTask(next);old.supersededBy=next.id;d.tasks.push(next);return next;}
function totals(e){return {points:e.items.reduce((s,i)=>s+(i.task.points??0),0),minutes:e.items.reduce((s,i)=>s+(i.task.minutes??0),0),unknownPoints:e.items.filter(i=>i.task.points==null).length,unknownMinutes:e.items.filter(i=>i.task.minutes==null).length};}
function readiness(e){const issues=[];if(!e.items.length)issues.push('Keine Aufgaben ausgewählt.');e.items.forEach((i,n)=>{const t=i.task,p='Aufgabe '+(n+1)+': ';if(t.points==null)issues.push(p+'Punktzahl fehlt.');if(t.reviewStatus!=='approved')issues.push(p+'fachliche Prüfung offen.');if(t.solutionStatus!=='approved'||!t.solution?.trim())issues.push(p+'Lösung fehlt oder ist nicht freigegeben.');if(t.criteria.length&&t.criteria.every(c=>c.points!=null)&&Math.abs(t.criteria.reduce((s,c)=>s+c.points,0)-(t.points??0))>0.001)issues.push(p+'Summe der Kriterien weicht von Gesamtpunkten ab.');if(t.criteria.some(c=>c.points==null))issues.push(p+'Kriteriumspunkte fehlen.');if(t.flags.length)issues.push(p+'offene Quellenhinweise.');});return {ready:issues.length===0,issues};}
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
function recordUse(d,examId,date){if(!validDate(date)||date>new Date().toISOString().slice(0,10))throw Error('Einsatzdatum muss ein gültiger, nicht zukünftiger Termin sein.');const e=d.exams.find(x=>x.id===examId);if(!e||!e.items.length)throw Error('Prüfung ist leer oder fehlt.');if(!d.uses.some(x=>x.examId===examId&&x.date===date))d.uses.push({id:id('use'),examId,date,taskIds:e.items.map(i=>i.originTaskId),familyIds:[...new Set(e.items.map(i=>i.task.familyId))],evidence:'confirmed-manually'});e.status='used';e.updatedAt=now();}
function merge(local,incoming){
 validate(local);validate(incoming);const result=clone(local),maps=Object.fromEntries(collectionNames.map(k=>[k,{}])),conflicts=[];
 // Deterministic import namespace makes repeated returns idempotent. This is an
 // identifier fingerprint, not an authentication or cryptographic checksum.
 let fingerprint=2166136261,second=5381;const raw=canonical(incoming);
 for(let i=0;i<raw.length;i++){fingerprint=Math.imul(fingerprint^raw.charCodeAt(i),16777619);second=Math.imul(second,33)^raw.charCodeAt(i);}
 const suffix=(fingerprint>>>0).toString(16)+(second>>>0).toString(16);
 const remap=(k,v)=>maps[k][v]||v;
 function fixTask(t){t.id=remap('tasks',t.id);t.familyId=remap('families',t.familyId);t.sourceIds=t.sourceIds.map(v=>remap('sources',v));t.assetLinks.forEach(l=>l.assetId=remap('assets',l.assetId));if(t.previousId)t.previousId=remap('tasks',t.previousId);if(t.supersededBy)t.supersededBy=remap('tasks',t.supersededBy);}
 function transform(k,original){const x=clone(original);x.id=remap(k,x.id);if(k==='tasks')fixTask(x);if(k==='sources'){if(x.assetId)x.assetId=remap('assets',x.assetId);x.attachmentIds=x.attachmentIds.map(v=>remap('assets',v));}if(k==='exams'){x.items.forEach(i=>{fixTask(i.task);i.originTaskId=remap('tasks',i.originTaskId);});if(maps.exams[original.id]){x.title+=' · Rücklauf';x.importedFrom=original.id;}}if(k==='uses'){x.examId=remap('exams',x.examId);x.taskIds=x.taskIds.map(v=>remap('tasks',v));x.familyIds=x.familyIds.map(v=>remap('families',v));}return x;}
 // Propagate collisions through references until every dependent record has a
 // stable destination. Local records and their snapshots are never rewritten.
 let added;do{added=false;for(const k of collectionNames)for(const x of incoming[k]){if(maps[k][x.id])continue;const old=local[k].find(y=>y.id===x.id);if(old&&!equal(old,transform(k,x))){maps[k][x.id]=x.id+'~'+suffix;conflicts.push({kind:k,id:x.id,newId:maps[k][x.id]});added=true;}}}while(added);
 for(const k of collectionNames)for(const original of incoming[k]){const x=transform(k,original),old=result[k].find(v=>v.id===x.id);if(!old)result[k].push(x);else if(!equal(old,x))throw Error('Abweichender Import mit gleicher Kennung. Bitte als separates Projekt öffnen.');}
 validate(result);return {db:result,conflicts};
}
function subset(d,specialty){const p={...empty(),name:'Arbeitsgruppe '+specialty};p.tasks=clone(d.tasks.filter(t=>t.specialty===specialty));const fs=new Set(p.tasks.map(t=>t.familyId)),ss=new Set(p.tasks.flatMap(t=>t.sourceIds));p.families=clone(d.families.filter(f=>fs.has(f.id)));p.sources=clone(d.sources.filter(s=>ss.has(s.id)));const as=new Set([...p.tasks.flatMap(t=>t.assetLinks.map(l=>l.assetId)),...p.sources.flatMap(s=>[s.assetId,...s.attachmentIds])]);p.assets=clone(d.assets.filter(a=>as.has(a.id)));return validate(p);}
const api={SCHEMA,clone,id,now,empty,equal,validate,newExam,addItem,revise,totals,readiness,validDate,recordUse,merge,subset,checkTask};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HortiCore=api;
})(globalThis);
