/* Prüfungswerkstatt Gartenbau portable domain. No DOM, network or storage dependencies. */
(function(root){
'use strict';
const SCHEMA=1;
const specialties=['Baumschule','Friedhofsgärtnerei','Garten- und Landschaftsbau','Gemüsebau','Obstbau','Staudengärtnerei','Zierpflanzenbau'];
const Planning=typeof module!=='undefined'&&module.exports?require('./planning.js'):root.HortiPlanning;
const fachwerkerSpecialties=Planning.fachwerkerSpecialties;
const examTypeLabel=type=>({AP:'Abschlussprüfung',ZP:'Zwischenprüfung',FW_AP:'Fachwerker · Abschlussprüfung'}[type]||String(type||'Prüfungsart offen'));
const allowedExamTypes=(workshop,specialty)=>[...(workshop?.examTypesBySpecialty?.[specialty]??examTypesFor(specialty))];
const examTypesFor=specialty=>['ZP','AP',...(fachwerkerSpecialties.includes(specialty)?['FW_AP']:[])];
const clone=v=>JSON.parse(JSON.stringify(v));
const id=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const now=()=>new Date().toISOString();
const empty=()=>({schemaVersion:SCHEMA,projectId:id('project'),name:'Prüfungswerkstatt Gartenbau Aufgabenbank',createdAt:now(),families:[],tasks:[],sources:[],assets:[],uses:[],exams:[],patterns:[],workshops:[],settings:[]});
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const equal=(a,b)=>canonical(a)===canonical(b);
const collectionNames=['families','tasks','sources','assets','uses','exams','patterns','workshops','settings'];
const number=(v,name)=>{if(v!==null&&v!==undefined&&(!Number.isFinite(v)||v<0))throw Error(name+' muss eine nichtnegative Zahl oder unbekannt sein.');};
const string=(v,label)=>{if(typeof v!=='string')throw Error('Ungültiges Textfeld: '+label);};
const strings=(v,label)=>{if(!Array.isArray(v)||v.some(x=>typeof x!=='string'))throw Error('Ungültige Textliste: '+label);};
const examType=v=>{if(!['AP','ZP','FW_AP'].includes(v))throw Error('Ungültige Prüfungsart.');};
function checkExamScope(type,specialty){examType(type);if(type==='FW_AP'&&!fachwerkerSpecialties.includes(specialty))throw Error('Fachwerker-Abschlussprüfungen sind nur für Gemüsebau und Zierpflanzenbau vorgesehen.');}
function sameFachwerkerScope(a,b){if((a.examType==='FW_AP'||b.examType==='FW_AP')&&(a.examType!==b.examType||a.specialty!==b.specialty))throw Error('Fachwerker-Aufgabe gehört zu einem anderen Prüfungsbereich.');}
const SourceLayout=typeof module!=='undefined'&&module.exports?require('./source-layout.js'):root.HortiSourceLayout;
const TimingPlan=()=>root.HortiTimingPlan||(typeof require==='function'?require('./timing-plan.js'):null);
const PointsPlan=()=>root.HortiPointsPlan||(typeof require==='function'?require('./points-plan.js'):null);
const Materials=()=>root.HortiMaterials||(typeof require==='function'?require('./materials.js'):null);
const checkTask=(t,context)=>{
 if(!t||typeof t.title!=='string'||!t.title.trim()||typeof t.text!=='string')throw Error('Aufgabe ohne Titel oder Text.');
 for(const k of ['tags','sourceIds','assetLinks','criteria','flags'])if(!Array.isArray(t[k]))throw Error('Ungültiges Aufgabenfeld: '+k);
 if(!['missing','draft','approved'].includes(t.solutionStatus))throw Error('Ungültiger Lösungsstatus.');
 for(const k of ['specialty','category','solution'])string(t[k],k);for(const k of ['tags','sourceIds','flags'])strings(t[k],k);checkExamScope(t.examType,t.specialty);if(!['review','approved'].includes(t.reviewStatus))throw Error('Ungültiger Prüfstatus.');if(t.kind!==undefined&&!['practical','oral','other'].includes(t.kind))throw Error('Ungültiger Aufgabenbestandsteil.');
 if(t.planningCategoryEvidence!==undefined)string(t.planningCategoryEvidence,'Kategoriebegründung');
 if(t.planningCategoryCatalog!==undefined){if(!['excel-ap-2026','fw-sources-2026','zp-general-2026'].includes(t.planningCategoryCatalog))throw Error('Unbekannter Kategorienkatalog.');const fw=t.planningCategoryCatalog==='fw-sources-2026';if(!(fw?Planning.fachwerkerScope(t):t.planningCategoryCatalog==='zp-general-2026'?Planning.zwischenpruefungScope(t):Planning.workbookScope(t)))throw Error('Kategorienkatalog gehört nicht zum Prüfungsbereich.');const scope=[...(fw?Planning.fachwerkerScope(t):t.planningCategoryCatalog==='zp-general-2026'?Planning.resolveCatalog(null,{examType:'ZP',specialty:'*'}):Planning.workbookScope(t)||[]),...(context?.categoryDefinitions||[])];if(!scope||!Array.isArray(t.planningCategories)||t.planningCategories.some(id=>!scope.some(c=>c.id===(fw?Planning.fachwerkerMainCategory(id):id))))throw Error('Kategorie gehört nicht zum Fachrichtungskatalog.');}
 if(t.planningCategories!==undefined){strings(t.planningCategories,'Prüfungskategorien');if(!t.planningCategories.length&&!t.planningCategoryCatalog||new Set(t.planningCategories).size!==t.planningCategories.length||t.planningCategories.some(id=>![...Planning.catalog,...(context?.categoryDefinitions||[])].some(c=>c.id===(t.examType==='FW_AP'?Planning.fachwerkerMainCategory(id):id))))throw Error('Ungültige Prüfungskategorie.');}
 if(t.examType==='FW_AP'&&t.planningCategories?.some(id=>!(context?.categoryDefinitions||Planning.fachwerkerScope(t)).some(c=>c.id===Planning.fachwerkerMainCategory(id))))throw Error('Kategorie gehört nicht zum Fachwerker-Katalog der Fachrichtung.');
 if(t.timing!==undefined){const x=t.timing;if(!x||!['unknown','explicit','phase-sum','conflict'].includes(x.method)||!Array.isArray(x.phases)||!Array.isArray(x.evidence))throw Error('Ungültige Zeitangaben.');number(x.totalMinutes,'Zeit');number(x.manualTotalMinutes,'Manuell bestätigte Zeit');for(const p of x.phases){if(!p||typeof p.label!=='string'||!Number.isFinite(p.minutes)||p.minutes<0)throw Error('Ungültige Zeitphase.');number(p.maxMinutes,'Zeitgrenze');}for(const q of x.evidence){if(!q||typeof q.sourceId!=='string'||q.reference!==undefined&&typeof q.reference!=='string')throw Error('Ungültige Zeitquelle.');strings(q.quotes,'Zeitbelege');}}
 if(context?.categoryDefinitions){Planning.checkDefinitions(context.categoryDefinitions,t);if(context.examType!==undefined&&context.examType!==t.examType||context.specialty!==undefined&&context.specialty!==t.specialty)throw Error('Kategorienstand gehört zu einem anderen Prüfungsbereich.');}
 if(t.reviewKey!==undefined&&(typeof t.reviewKey!=='string'||!reviewKeyPattern.test(t.reviewKey)))throw Error('Ungültiger Stand der fachlichen Prüfung.');
 for(const key of ['sourceReview','pointsReview'])if(t[key]!==undefined){checkReviewRecord(t[key]);if(key==='sourceReview')strings(t[key].flags,'Bestätigte Quellenhinweise');}
 Materials()?.validate(t);
 Planning.checkPracticalUnits(t);
 SourceLayout.validate(t);
 number(t.points,'Punkte');number(t.minutes,'Minuten');
 for(const c of t.criteria){if(typeof c.text!=='string'||typeof c.answer!=='string')throw Error('Ungültiges Kriterium.');number(c.points,'Kriteriumspunkte');}
 for(const l of t.assetLinks){if(!l||typeof l.assetId!=='string'||!['candidate','examiner','source'].includes(l.audience)||l.caption!==undefined&&typeof l.caption!=='string')throw Error('Ungültige Anlagenzuordnung.');}
};
function validate(d){
 if(!d||d.schemaVersion!==SCHEMA)throw Error('Nicht unterstütztes Datenformat / Schema-Version. Bestand bleibt unverändert.');
 d.patterns??=[];d.workshops??=[];d.settings??=[];
 for(const k of collectionNames){if(!Array.isArray(d[k]))throw Error('Fehlende Sammlung: '+k);const seen=new Set();for(const x of d[k]){if(!x||typeof x.id!=='string'||!x.id||seen.has(x.id))throw Error('Ungültige oder doppelte ID in '+k);seen.add(x.id);}}
 d.settings.forEach(r=>Planning.checkSettings(r));
 string(d.name,'Projektname');string(d.projectId,'Projektkennung');
 d.families.forEach(f=>{string(f.title,'Familientitel');});
 const sets=Object.fromEntries(collectionNames.map(k=>[k,new Set(d[k].map(x=>x.id))]));
 const ref=(kind,x)=>{if(!sets[kind].has(x))throw Error('Fehlender Verweis: '+kind+' / '+x);};
 const familyScopes=new Map();
 const links=(t,context)=>{checkTask(t,context);ref('families',t.familyId);const scopes=familyScopes.get(t.familyId)||[];if(scopes.some(s=>(s.examType==='FW_AP'||t.examType==='FW_AP')&&(s.examType!==t.examType||s.specialty!==t.specialty)))throw Error('Fachwerker-Aufgabenfamilie darf nicht mit anderen Prüfungsbereichen geteilt werden.');scopes.push(t);familyScopes.set(t.familyId,scopes);t.sourceIds.forEach(x=>{ref('sources',x);sameFachwerkerScope(t,d.sources.find(s=>s.id===x));});t.assetLinks.forEach(x=>ref('assets',x.assetId));};
 d.tasks.forEach(t=>links(t,Planning.projectContext(d,t)));d.patterns.forEach(Planning.checkPattern);const patternScopes=new Set();for(const p of d.patterns){const key=JSON.stringify([p.examType,p.specialty]);if(patternScopes.has(key))throw Error('Mehrere Prüfungsmuster für denselben Prüfungsbereich.');patternScopes.add(key);}
 d.sources.forEach(s=>{for(const k of ['name','specialty','role','text'])string(s[k],k);if(s.flags!==undefined)strings(s.flags,'Quellenhinweise');if(s.year!=null&&(!Number.isInteger(s.year)||s.year<1900||s.year>2200))throw Error('Ungültiges Quelljahr.');checkExamScope(s.examType,s.specialty);if(s.assetId)ref('assets',s.assetId);if(!Array.isArray(s.attachmentIds))throw Error('Ungültige Quellenanlagen.');s.attachmentIds.forEach(x=>ref('assets',x));});
 d.assets.forEach(a=>{if(typeof a.data!=='string'||typeof a.mime!=='string'||typeof a.name!=='string'||!/^[-\w.+]+\/[-\w.+]+$/.test(a.mime)||!/^[A-Za-z0-9+/=\s]*$/.test(a.data))throw Error('Ungültige Anlagendaten.');});
 d.workshops.forEach(checkWorkshop);
 d.exams.forEach(e=>{Planning.checkRegulationReview(e);if(e.deletedAt!==undefined&&(typeof e.deletedAt!=='string'||!Number.isFinite(Date.parse(e.deletedAt))||e.status==='used'||d.uses.some(u=>u.examId===e.id)))throw Error('Ungültiger Papierkorb-Eintrag oder dokumentierter Einsatz.');checkExamWorkshop(d,e);checkExamScope(e.examType,e.specialty);for(const k of ['specialty','date','notes'])string(e[k],k);if(e.internalNotes!==undefined&&(typeof e.internalNotes!=='string'||e.internalNotes.length>20000))throw Error('Interne Bemerkungen müssen Text mit höchstens 20.000 Zeichen sein.');if(e.submittedAt!==undefined&&(typeof e.submittedAt!=='string'||!Number.isFinite(Date.parse(e.submittedAt))||new Date(e.submittedAt).toISOString()!==e.submittedAt))throw Error('Ungültiger Vorlagezeitpunkt der Prüfung.');if(e.pattern){Planning.checkPattern(e.pattern);if((e.examType==='FW_AP'||e.pattern.examType==='FW_AP')&&(e.pattern.examType!==e.examType||e.pattern.specialty!==e.specialty))throw Error('Prüfungsmuster passt nicht zum Prüfungsbereich.');}if(typeof e.title!=='string'||!Array.isArray(e.items))throw Error('Ungültige Prüfung.');checkExamAdditions(e);const seen=new Set();examEntries(e).forEach(i=>{if(!i.id||seen.has(i.id))throw Error('Doppelte Prüfungsposition.');seen.add(i.id);if(typeof i.originTaskId!=='string')throw Error('Fehlende Aufgabenherkunft.');sameFachwerkerScope(e,i.task);if(i.component==='oral')checkOralTask(e,i.task);else if((e.oralRequirementVersion===1||e.materialRequirementVersion===1)&&i.task.kind==='oral')throw Error('Mündliche Aufgaben gehören in den eigenen Prüfungsteil.');links(i.task,Planning.examContext(e));});});
 d.uses.forEach(u=>{ref('exams',u.examId);strings(u.taskIds,'Einsatzaufgaben');strings(u.familyIds,'Einsatzfamilien');if(!validDate(u.date))throw Error('Ungültiger Einsatztermin.');});
 return d;
}
function checkWorkshop(w,previous){
 if(!w||typeof w.id!=='string'||!w.id||typeof w.title!=='string'||!w.title.trim())throw Error('Bitte einen Namen für den Vorbereitungstermin eingeben.');
 if(!Number.isInteger(w.examYear)||w.examYear<1900||w.examYear>2200)throw Error('Bitte ein gültiges Prüfungsjahr eingeben (1900–2200).');
 if(typeof w.meetingDate!=='string'||w.meetingDate&&!validDate(w.meetingDate))throw Error('Ungültiges Datum für den Vorbereitungstermin.');
 if(!Array.isArray(w.specialties)||!w.specialties.length||new Set(w.specialties).size!==w.specialties.length||w.specialties.some(s=>!specialties.includes(s)))throw Error('Bitte gültige Fachrichtungsgruppen wählen.');
 const recorded=previous?.committees?.filter(c=>c.participants.length||c.revisions.length)||[];
 if(recorded.length&&previous.examYear!==w.examYear)throw Error('Das Prüfungsjahr eines dokumentierten Ausschusses bleibt erhalten. Bitte einen neuen Vorbereitungstermin anlegen.');
 if(recorded.some(c=>!w.specialties.includes(c.specialty)))throw Error('Eine Fachrichtungsgruppe mit dokumentiertem Ausschuss muss im Vorbereitungstermin erhalten bleiben.');
 if(w.examTypesBySpecialty!==undefined){const types=w.examTypesBySpecialty;if(!types||typeof types!=='object'||Array.isArray(types)||Object.entries(types).some(([fr,values])=>!w.specialties.includes(fr)||!Array.isArray(values)||new Set(values).size!==values.length||values.some(t=>!examTypesFor(fr).includes(t))))throw Error('Ungültige Prüfungsarten der Arbeitsgruppe.');}
 if(w.committees!==undefined){if(!Array.isArray(w.committees))throw Error('Ungültige Ausschussliste.');const seen=new Set();for(const c of w.committees){if(!c||!w.specialties.includes(c.specialty)||seen.has(c.specialty))throw Error('Ausschuss muss einer eindeutigen Fachrichtungsgruppe des Vorbereitungstermins zugeordnet sein.');seen.add(c.specialty);checkCommitteeSnapshot(c);checkCommitteeTimestamp(c.updatedAt);if(!Array.isArray(c.revisions))throw Error('Ungültige Ausschusshistorie.');for(const r of c.revisions){checkCommitteeSnapshot(r);checkCommitteeTimestamp(r.recordedAt);}}}
 for(const old of previous?.committees||[]){const current=w.committees?.find(c=>c.specialty===old.specialty);if(!current){if(recorded.includes(old))throw Error('Dokumentierte Ausschüsse bleiben mit ihrer Historie erhalten.');continue;}const changed=!equal({name:old.name,participants:old.participants},{name:current.name,participants:current.participants});if(!equal(current.revisions.slice(0,old.revisions.length),old.revisions)||changed&&!equal(current.revisions[old.revisions.length],{name:old.name,participants:old.participants,recordedAt:old.updatedAt}))throw Error('Ausschussänderungen müssen den bisherigen Stand unverändert in der Historie erhalten.');}
}
function checkCommitteeSnapshot(c){
 if(!c||typeof c.name!=='string'||c.name!==c.name.trim()||c.name.length>160||/[\u0000-\u001f\u007f]/.test(c.name))throw Error('Ausschussname darf höchstens 160 Zeichen enthalten.');
 if(!Array.isArray(c.participants)||c.participants.length>100||c.participants.some(n=>typeof n!=='string'||!n||n!==n.trim()||n.length>120||/[\u0000-\u001f\u007f]/.test(n)))throw Error('Bitte höchstens 100 Beteiligte mit jeweils 1–120 Zeichen eintragen.');
 if(new Set(c.participants.map(n=>n.toLocaleLowerCase('de-DE'))).size!==c.participants.length)throw Error('Beteiligte dürfen nicht doppelt eingetragen werden.');
}
function checkCommitteeTimestamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)throw Error('Ungültiger Zeitstempel in der Ausschusshistorie.');}
function committee(w,specialty){return clone(w?.committees?.find(c=>c.specialty===specialty)||{specialty,name:'',participants:[],updatedAt:'',revisions:[]});}
function saveCommittee(d,workshopId,specialty,fields){
 const w=d.workshops.find(w=>w.id===workshopId);if(!w||!w.specialties.includes(specialty))throw Error('Fachrichtungsgruppe des Vorbereitungstermins fehlt.');
 if(!fields||typeof (fields.name??'')!=='string'||!Array.isArray(fields.participants)||fields.participants.some(n=>typeof n!=='string'))throw Error('Ungültige Ausschussangaben.');
 const seen=new Set(),participants=fields.participants.map(n=>n.trim()).filter(n=>{const key=n.toLocaleLowerCase('de-DE');if(!n||seen.has(key))return false;seen.add(key);return true;}),snapshot={name:(fields.name??'').trim(),participants};checkCommitteeSnapshot(snapshot);
 const old=w.committees?.find(c=>c.specialty===specialty);if(old&&equal({name:old.name,participants:old.participants},snapshot))return clone(old);
 const next={specialty,...snapshot,updatedAt:now(),revisions:old?[...clone(old.revisions),{name:old.name,participants:clone(old.participants),recordedAt:old.updatedAt}]:[]};
 saveWorkshop(d,{...w,committees:[...(w.committees||[]).filter(c=>c.specialty!==specialty),next]});return clone(next);
}
function committeeHistory(d,{year,specialty,query}={}){
 const needle=String(query||'').trim().toLocaleLowerCase('de-DE'),rows=[];
 for(const w of d.workshops){if(year&&w.examYear!==Number(year))continue;for(const c of w.committees||[]){if(specialty&&c.specialty!==specialty)continue;const texts=[w.title,c.specialty,c.name,...c.participants,...c.revisions.flatMap(r=>[r.name,...r.participants])];if(needle&&!texts.some(t=>t.toLocaleLowerCase('de-DE').includes(needle)))continue;rows.push({workshopId:w.id,workshopTitle:w.title,examYear:w.examYear,meetingDate:w.meetingDate,...clone(c)});}}
 return rows;
}
function checkExamWorkshop(d,e){
 if(e.examYear!==undefined&&(!Number.isInteger(e.examYear)||e.examYear<1900||e.examYear>2200))throw Error('Ungültiges Prüfungsjahr.');
 if(e.examYear!==undefined&&e.date&&(!validDate(e.date)||Number(e.date.slice(0,4))!==e.examYear))throw Error('Prüfungstermin und Prüfungsjahr müssen übereinstimmen.');
 if(e.workshopId!==undefined){const w=d.workshops.find(w=>w.id===e.workshopId);if(!w)throw Error('Vorbereitungstermin der Prüfung fehlt.');if(e.examYear!==w.examYear||!w.specialties.includes(e.specialty))throw Error('Prüfungsjahr und Fachrichtung müssen zum Vorbereitungstermin passen. Bestehende Prüfungen zuerst zuordnen.');}
}
function saveWorkshop(d,w){const previous=d.workshops.find(x=>x.id===w.id),saved={...w,...(w.committees===undefined&&previous?.committees!==undefined?{committees:clone(previous.committees)}:{})};checkWorkshop(saved,previous);const next=d.workshops.filter(x=>x.id!==saved.id).concat(saved);for(const e of d.exams)checkExamWorkshop({...d,workshops:next},e);d.workshops=next;return saved;}
function workshopExams(d,workshopId,specialty){return d.exams.filter(e=>!e.deletedAt&&e.workshopId===workshopId&&(!specialty||e.specialty===specialty));}
function trashExam(d,id){const e=d.exams.find(x=>x.id===id);if(!e)throw Error('Prüfung fehlt.');if(e.status==='used'||d.uses.some(u=>u.examId===id))throw Error('Bereits eingesetzte Prüfungen bleiben für die Einsatzhistorie erhalten.');e.deletedAt=e.updatedAt=now();return e;}
function purgeExam(d,id){const e=d.exams.find(x=>x.id===id);if(!e?.deletedAt)throw Error('Prüfung ist nicht im Papierkorb.');if(e.status==='used'||d.uses.some(u=>u.examId===id))throw Error('Bereits eingesetzte Prüfungen bleiben für die Einsatzhistorie erhalten.');d.exams=d.exams.filter(x=>x.id!==id);}
function restoreExam(d,id){const e=d.exams.find(x=>x.id===id);if(!e?.deletedAt)throw Error('Prüfung ist nicht im Papierkorb.');delete e.deletedAt;e.updatedAt=now();return e;}
function newExam(fields={}){checkExamScope(fields.examType||'ZP',fields.specialty||'');const e={id:id('exam'),title:fields.title||'Neue praktische Prüfung',examType:fields.examType||'ZP',specialty:fields.specialty||'',date:fields.date||'',notes:fields.notes??'',materialRequirementVersion:1,...(Planning.examRequirements(fields)?{structureRequirementVersion:1}:{}),...(['AP','FW_AP'].includes(fields.examType)?{oralRequirementVersion:1}:{}),...(fields.targetMinutes!=null?{targetMinutes:fields.targetMinutes}:{}),...(fields.selectedCategoryIds?{selectedCategoryIds:clone(fields.selectedCategoryIds)}:{}),...(fields.workflowStep!==undefined?{workflowStep:fields.workflowStep}:{}),internalNotes:fields.internalNotes??'',status:'draft',createdAt:now(),updatedAt:now(),items:[],...(fields.examYear!==undefined?{examYear:fields.examYear}:{}),...(fields.workshopId?{workshopId:fields.workshopId}:{}),...(fields.pattern?{pattern:clone(fields.pattern)}:{})};if(!currentExamPolicy(e)){delete e.oralRequirementVersion;delete e.materialRequirementVersion;delete e.structureRequirementVersion;}return e;}
function examEntries(e){return [...(e.items||[]).map((item,n)=>({...item,component:'practical',label:'Aufgabe '+(n+1)})),...(e.oralItem?[{...e.oralItem,component:'oral',label:'Mündliche Prüfungsaufgabe'}]:[])];}
function findExamItem(e,itemId){return e.items?.find(i=>i.id===itemId)||(e.oralItem?.id===itemId?e.oralItem:null);}
function checkOralTask(e,t){if(!['AP','FW_AP'].includes(e.examType)||!t||t.kind!=='oral'||t.examType!==e.examType||t.specialty!==e.specialty)throw Error('Mündliche Aufgabe muss zur Fachrichtung und Prüfungsart passen; für ZP ist kein mündlicher Teil vorgesehen.');}
function checkExamAdditions(e){
 if(e.releaseReview!==undefined){checkReviewRecord(e.releaseReview);if(e.releaseReview.version!==1)throw Error('Ungültige Prüfungsfreigabe.');}
 if(e.workflowStep!==undefined&&![1,2,3].includes(e.workflowStep))throw Error('Ungültiger Bearbeitungsschritt.');
 for(const key of ['oralRequirementVersion','materialRequirementVersion','structureRequirementVersion'])if(e[key]!==undefined&&e[key]!==1)throw Error('Unbekannter organisatorischer Prüfungsstand.');
 if(e.oralRequirementVersion===1&&!['AP','FW_AP'].includes(e.examType))throw Error('Mündlicher Prüfungsteil ist nur für AP und Fachwerker-AP vorgesehen.');
 if(e.targetMinutes!==undefined&&(!Number.isFinite(e.targetMinutes)||e.targetMinutes<0||e.targetMinutes>(e.examType==='AP'?300:1440)))throw Error('Ungültige organisatorische Zielzeit.');
 if(e.selectedCategoryIds!==undefined){const defs=Planning.examContext(e).categoryDefinitions||Planning.resolveCatalog(null,e);if(e.examType==='ZP'||!Array.isArray(e.selectedCategoryIds)||new Set(e.selectedCategoryIds).size!==e.selectedCategoryIds.length||e.selectedCategoryIds.some(id=>!defs.some(c=>c.id===id&&!c.hidden)))throw Error('Ungültige Themenauswahl.');}
 if(e.oralItem!==undefined&&e.oralItem!==null&&(typeof e.oralItem!=='object'||Array.isArray(e.oralItem)))throw Error('Ungültige mündliche Prüfungsaufgabe.');
}
function oralStatus(e){const required=e.oralRequirementVersion===1&&['AP','FW_AP'].includes(e.examType),present=!!e.oralItem,issues=[];if(required&&!present)issues.push('Mündliche Prüfungsaufgabe noch nicht ausgewählt (organisatorische Vorgabe).');if(present)try{checkOralTask(e,e.oralItem.task);}catch(error){issues.push(error.message);}return {required,present,issues};}
function assertOralPolicy(e){const issues=oralStatus(e).issues;if(issues.length)throw Error(issues.join('\n'));}
function setOralItem(e,t){if(e.status==='used')throw Error('Bereits eingesetzte Prüfung zuerst duplizieren.');checkOralTask(e,t);const context=Planning.examContext(e);checkTask(t,context);e.oralItem={id:id('item'),originTaskId:t.id,task:currentExamPolicy(e)?prepareCurrentTask(t,context):clone(t)};e.updatedAt=now();e.status='draft';delete e.submittedAt;return e.oralItem;}
function removeOralItem(e){if(e.status==='used')throw Error('Bereits eingesetzte Prüfung zuerst duplizieren.');delete e.oralItem;delete e.submittedAt;e.updatedAt=now();e.status='draft';}
function oralTotals(e){return totals({items:e.oralItem?[e.oralItem]:[]});}
// Local preparation rule from 2026. Original source records and used exams stay archival.
function currentExamPolicy(e){if(e.status==='used')return false;const years=[Number.isInteger(e.examYear)?e.examYear:null,validDate(e.date)?Number(e.date.slice(0,4)):null].filter(y=>y!==null);if(years.length)return years.some(y=>y>=2026);const created=typeof e.createdAt==='string'&&Number.isFinite(Date.parse(e.createdAt))?new Date(e.createdAt).getUTCFullYear():new Date().getUTCFullYear();return created>=2026;}
function reportbookAllowanceSpans(value){if(typeof value!=='string')return [];const pattern=/(?:[-–—]{2,}[ \t]*)?\b(?:das\s+)?Berichtsheft\s+(?:ist\s+(?:zulässig|erlaubt|zugelassen)|darf\s+(?:benutzt|verwendet)\s+werden)\b[.!]?(?:[ \t]*[-–—]{2,})?/giu;return [...value.matchAll(pattern)].filter(m=>!/\b(?:kein(?:e[smnr]?)?|nicht)\s*$/iu.test(value.slice(0,m.index))).map(m=>({start:m.index,end:m.index+m[0].length}));}
function removeTextSpans(value,spans){for(let i=spans.length-1;i>=0;i--)value=value.slice(0,spans[i].start)+value.slice(spans[i].end);return value;}
function stripReportbookAllowance(value){return removeTextSpans(value,reportbookAllowanceSpans(value));}
function prepareCurrentTask(task,context){
 const t=clone(task),clean=(object,key)=>{object[key]=stripReportbookAllowance(object[key]);};
 if(t.sourceLayout){if(t.sourceLayout.pages.some(p=>p.textEdits?.length)){const groups=t.sourceLayout.pages.flatMap(p=>SourceLayout.groups(p)),spans=reportbookAllowanceSpans(groups.map(g=>g.text).join('\n'));let offset=0;for(const g of groups){const start=offset;offset+=g.text.length+1;const text=removeTextSpans(g.text,spans.map(s=>({start:Math.max(0,s.start-start),end:Math.min(g.text.length,s.end-start)})).filter(s=>s.start<s.end));if(text!==g.text)SourceLayout.edit(t,g.id,text);}}const blocks=t.sourceLayout.pages.flatMap(p=>p.blocks),spans=reportbookAllowanceSpans(blocks.map(b=>b.text).join('\n'));if(spans.length||stripReportbookAllowance(t.text)!==t.text){SourceLayout.validate(t);if(SourceLayout.stale(t))throw Error('Aufgabentext und Originalseiten weichen ab. Bitte vor der Berichtsheft-Korrektur mit der Originalvorlage abgleichen.');clean(t,'text');let offset=0;for(const b of blocks){const start=offset;offset+=b.text.length+1;b.text=removeTextSpans(b.text,spans.map(s=>({start:Math.max(0,s.start-start),end:Math.min(b.text.length,s.end-start)})).filter(s=>s.start<s.end));}t.sourceLayout.baselineText=t.text;t.sourceLayout.edited=true;}}
 else clean(t,'text');
 for(const field of ['title','solution'])clean(t,field);for(const c of t.criteria||[])for(const field of ['text','answer'])clean(c,field);
 if(!equal(t,task)){t.reviewStatus='review';t.solutionStatus=t.solution?.trim()?'draft':'missing';t.reviewedBy='';delete t.reviewedAt;checkTask(t,context);}return t;
}
function reportbookIssues(e){
 if(!currentExamPolicy(e))return [];const issues=[],inspect=(value,label)=>{if(stripReportbookAllowance(value)!==value)issues.push(label+': Veraltete Berichtsheft-Zulassung entfernen; das Berichtsheft ist ab Prüfungsjahr 2026 nicht zugelassen.');};
 inspect(e.title,'Prüfungstitel');inspect(e.notes,'Prüfungshinweise');for(const item of examEntries(e)){const t=item.task,label=item.label;inspect(t.title,label+' · Titel');inspect(t.text,label+' · Aufgabenstellung');inspect(t.solution,label+' · Lösung');for(const [j,c] of (t.criteria||[]).entries()){inspect(c.text,label+' · Kriterium '+(j+1));inspect(c.answer,label+' · Erwartete Leistung '+(j+1));}if(t.sourceLayout)inspect(t.sourceLayout.pages.flatMap(p=>p.blocks.map(b=>b.text)).join('\n'),label+' · Originalseiten');}return issues;
}
function cleanReportbook(e,{force=false}={}){if(e.status==='used'||!force&&!currentExamPolicy(e))return false;const next=clone(e);next.title=stripReportbookAllowance(next.title);next.notes=stripReportbookAllowance(next.notes);for(const entry of examEntries(next)){const item=findExamItem(next,entry.id);item.task=prepareCurrentTask(item.task,Planning.examContext(next));}if(equal(next,e))return false;delete next.regulationReview;delete next.regulationReviewKey;next.updatedAt=now();Object.assign(e,next);delete e.regulationReview;delete e.regulationReviewKey;return true;}
function assertExamPolicy(e){const issues=reportbookIssues(e);if(issues.length)throw Error(issues.join('\n'));}
function assertStructurePolicy(e){const c=Planning.structureCoverage(e);if(c&&!c.complete)throw Error(c.issues.join('\n'));}
function addItem(e,t){const context=Planning.examContext(e);checkTask(t,context);checkExamScope(e.examType,e.specialty);sameFachwerkerScope(e,t);if(t.kind==='oral')throw Error('Mündliche Aufgaben bitte im eigenen Prüfungsteil auswählen.');const selectionIssue=Planning.zwischenpruefungSelectionIssue(e,t);if(selectionIssue)throw Error(selectionIssue);const structureIssue=currentExamPolicy(e)?Planning.structureSelectionIssue(e,t):null;if(structureIssue)throw Error(structureIssue);let task=currentExamPolicy(e)?prepareCurrentTask(t,context):clone(t);if(task.kind==='practical'&&e.materialRequirementVersion===1)task=Materials().resetMaterialsConfirmation(Materials().proposeMaterials(task));const item={id:id('item'),originTaskId:t.id,task};e.items.push(item);delete e.regulationReview;delete e.regulationReviewKey;e.updatedAt=now();return item;}
function revise(d,taskId,patch,options={}){const old=d.tasks.find(t=>t.id===taskId);if(!old)throw Error('Aufgabe nicht gefunden.');const next={...(options.replace===true?{}:clone(old)),...clone(patch),id:id('task'),previousId:old.id,createdAt:now()};delete next.supersededBy;
 if(old.solutionStatus==='approved'&&['text','points','criteria','assetLinks','practicalUnits','planningCategories','planningCategoryCatalog'].some(k=>!equal(next[k],old[k])))next.solutionStatus=next.solution?.trim()?'draft':'missing';
 if(['practicalUnits','planningCategories','planningCategoryCatalog'].some(k=>!equal(next[k],old[k])))next.reviewStatus='review';
 if(Materials()&&['title','text','specialty','examType','planningCategories','category'].some(k=>!equal(old[k],next[k])))Object.assign(next,Materials().resetMaterialsConfirmation(next));
 checkTask(next,Planning.projectContext(d,next));sameFachwerkerScope(old,next);old.supersededBy=next.id;d.tasks.push(next);return next;}
// Proposed working scale, never an assertion about official examination rules.
function proposePoints(task,context){
 checkTask(task,context);const t=clone(task);if(t.points!=null)return t;
 const known=t.criteria.filter(c=>c.points!=null),unknown=t.criteria.filter(c=>c.points==null),preserved=known.reduce((s,c)=>s+c.points,0),total=Math.max(100,preserved);
 const remainder=total-preserved;if(unknown.length&&remainder<=0)throw Error('Bereits '+preserved+' Teilpunkte vorhanden, weitere Kriteriumspunkte fehlen. Gesamtpunktzahl ausdrücklich festlegen; die 100-Punkte-Arbeitsgrundlage reicht nicht aus.');const hasPlanning=known.some(c=>/planungsphase|planung|vorbereitung/i.test(c.text));
 let rubric=t.kind==='oral'?[['Fachwissen und fachliche Richtigkeit',50],['Begründung und Anwendung',30],['Struktur und verständliche Darstellung',10],['Reflexion und Rückfragen',10]]:t.kind==='other'?[['Fachliche Richtigkeit',50],['Vollständigkeit und nachvollziehbare Begründung',50]]:[...(!hasPlanning?[['Arbeitsplanung und Vorbereitung',20]]:[]),['Fachgerechte und sichere Durchführung',50],['Qualität und Kontrolle des Arbeitsergebnisses',20],['Begründung und Reflexion',10]];
 const targets=unknown.length?unknown:remainder>0?rubric.map(([text,weight],i)=>{const c={id:'proposed-'+t.id+'-'+i,text,points:null,answer:''};t.criteria.push(c);return c;}):[];
 const weights=unknown.length?targets.map(()=>1):rubric.map(x=>x[1]),sum=weights.reduce((a,b)=>a+b,0);let assigned=0;
 targets.forEach((c,i)=>{c.points=i===targets.length-1?Math.round((remainder-assigned)*100)/100:Math.floor(remainder*weights[i]/sum);assigned+=c.points;});
 t.points=total;t.pointsProposal={method:'working-scale-100-v1',total,preservedPoints:preserved,originalCriterionIds:known.map(c=>c.id).filter(Boolean)};
 t.flags.push('Punktevorschlag: '+total+' Punkte als Arbeitsgrundlage, keine amtliche Vorgabe. Vor Einsatz Gesamtpunkte, Teilpunkte und Gewichtung fachlich prüfen und diesen Hinweis nach Klärung entfernen.');
 t.reviewStatus='review';t.solutionStatus=t.solution.trim()?'draft':'missing';t.reviewedBy='';delete t.reviewedAt;return t;
}
// Content fingerprints detect stale review decisions; authorization remains server-side.
function contentKey(value){const raw=canonical(value);let a=2166136261,b=5381;for(let n=0;n<raw.length;n++){a=Math.imul(a^raw.charCodeAt(n),16777619);b=Math.imul(b,33)^raw.charCodeAt(n);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
const reviewKeyPattern=/^[0-9a-f]{16}$/;
function checkReviewRecord(value){if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.contentKey!=='string'||!reviewKeyPattern.test(value.contentKey)||typeof value.reviewedBy!=='string'||!value.reviewedBy.trim()||value.reviewedBy.length>160||typeof value.reviewedAt!=='string'||!Number.isFinite(Date.parse(value.reviewedAt))||new Date(value.reviewedAt).toISOString()!==value.reviewedAt)throw Error('Ungültige Prüfbestätigung oder Freigabe.');}
function pointsReviewKey(t){return contentKey({title:t.title,text:t.text,points:t.points,criteria:t.criteria,sourceLayout:t.sourceLayout,pointsProposal:t.pointsProposal});}
function pointsReviewCurrent(t){return !!t.pointsReview&&t.pointsReview.contentKey===pointsReviewKey(t);}
function taskReviewKey(t){const value=clone(t);for(const key of ['reviewStatus','solutionStatus','reviewedBy','reviewedAt','reviewKey','sourceReview','pointsReview','updatedAt'])delete value[key];if(value.materials)delete value.materials.status;return contentKey(value);}
function examReviewKey(e){const value=clone(e);for(const key of ['releaseReview','updatedAt','status','submittedAt','workflowStep','internalNotes'])delete value[key];return contentKey(value);}
function taskReviewCurrent(t){return t.reviewStatus==='approved'&&(!t.reviewKey||t.reviewKey===taskReviewKey(t));}
function openTaskFlags(t){return t.sourceReview?.contentKey===taskReviewKey(t)&&equal(t.sourceReview.flags,t.flags)?[]:[...(t.flags||[])];}
function pointsLabel(t){return t.points==null?'Punkte offen':t.points+' Punkte'+(t.pointsProposal||t.pointsReview?((t.pointsReview?pointsReviewCurrent(t):taskReviewCurrent(t))?' · geprüft':' · Vorschlag'):'');}
const round2=n=>Math.round(n*100)/100;
// Local calendar date; toISOString() is UTC and is still "yesterday" in Germany until 01:00/02:00.
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function totals(e){return {points:round2(e.items.reduce((s,i)=>s+(i.task.points??0),0)),minutes:round2(e.items.reduce((s,i)=>s+(i.task.minutes??0),0)),unknownPoints:e.items.filter(i=>i.task.points==null).length,unknownMinutes:e.items.filter(i=>i.task.minutes==null).length};}
function readiness(e){const issues=[...Planning.coverage(e).issues,...(TimingPlan()?.sourceIssues(e)||[]),...(PointsPlan()?.sourceIssues(e)||[]),...reportbookIssues(e),...oralStatus(e).issues,...(Materials()?.materialsIssues(e)||[])];const currentReview=e.regulationReviewKey===Planning.regulationReviewKey(e);for(const c of Planning.regulationChecklist(e))if(!currentReview||e.regulationReview?.[c.id]!==true)issues.push('Prüfungsverordnung: '+c.label+' – Bestätigung offen.');if(!e.items.length)issues.push('Keine Aufgaben ausgewählt.');examEntries(e).forEach(i=>{const t=i.task,p=i.label+': ';if(i.component==='oral'){if(!Number.isFinite(t.minutes)||t.minutes<=0)issues.push(p+'Bearbeitungszeit fehlt.');if(t.timing?.method==='conflict'&&t.timing.manualTotalMinutes!==t.minutes)issues.push(p+'Zeitangaben widersprüchlich; Gesamtzeit ausdrücklich festlegen.');}if(!Number.isFinite(t.points)||t.points<=0)issues.push(p+'Positive Gesamtpunktzahl fehlt.');if(!t.text?.trim())issues.push(p+'Aufgabenstellung fehlt.');if((t.pointsProposal||t.pointsReview)&&!(t.pointsReview?pointsReviewCurrent(t):taskReviewCurrent(t)))issues.push(p+'Punktevorschlag noch fachlich prüfen.');if(!taskReviewCurrent(t))issues.push(p+'fachliche Prüfung offen.');if(t.criteria.length&&t.criteria.every(c=>c.points!=null)&&Math.abs(t.criteria.reduce((s,c)=>s+c.points,0)-(t.points??0))>0.001)issues.push(p+'Summe der Kriterien weicht von Gesamtpunkten ab.');if(t.criteria.some(c=>c.points==null))issues.push(p+'Kriteriumspunkte fehlen.');for(const flag of openTaskFlags(t))issues.push(p+'Bitte prüfen: '+flag);});if(e.releaseReview&&e.releaseReview.contentKey!==examReviewKey(e))issues.push('Prüfung seit der Freigabe geändert; aktuelle Fassung erneut freigeben.');return {ready:issues.length===0,issues};}
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
function recordUse(d,examId,date){if(!validDate(date)||date>today())throw Error('Einsatzdatum muss ein gültiger, nicht zukünftiger Termin sein.');const e=d.exams.find(x=>x.id===examId);if(!e||!e.items.length)throw Error('Prüfung ist leer oder fehlt.');assertOralPolicy(e);assertStructurePolicy(e);if(!d.uses.some(x=>x.examId===examId&&x.date===date))d.uses.push({id:id('use'),examId,date,taskIds:examEntries(e).map(i=>i.originTaskId),familyIds:[...new Set(examEntries(e).map(i=>i.task.familyId))],evidence:'confirmed-manually'});e.status='used';e.updatedAt=now();}
function merge(local,incoming){
 validate(local);validate(incoming);for(const setting of incoming.settings){const old=local.settings.find(x=>x.id===setting.id);if(old&&!equal(old,setting))throw Error('Abweichende Grundeinstellungen: Projekt separat öffnen und Einstellungen abgleichen. Import nicht übernommen.');}for(const p of incoming.patterns){const old=local.patterns.find(x=>x.examType===p.examType&&x.specialty===p.specialty);if(old&&!equal(old,p))throw Error('Abweichende Prüfungsmuster: Projekt separat öffnen und Muster fachlich abgleichen. Import nicht übernommen.');}const result=clone(local),maps=Object.fromEntries(collectionNames.map(k=>[k,Object.create(null)])),conflicts=[];
 // Deterministic import namespace makes repeated returns idempotent. This is an
 // identifier fingerprint, not an authentication or cryptographic checksum.
 let fingerprint=2166136261,second=5381;const raw=canonical(incoming);
 for(let i=0;i<raw.length;i++){fingerprint=Math.imul(fingerprint^raw.charCodeAt(i),16777619);second=Math.imul(second,33)^raw.charCodeAt(i);}
 const suffix=(fingerprint>>>0).toString(16)+(second>>>0).toString(16);
 const remap=(k,v)=>Object.hasOwn(maps[k],v)?maps[k][v]:v;
 function fixTask(t){t.id=remap('tasks',t.id);t.familyId=remap('families',t.familyId);t.sourceIds=t.sourceIds.map(v=>remap('sources',v));if(t.materials)for(const evidence of t.materials.evidence||[])if(evidence.sourceId)evidence.sourceId=remap('sources',evidence.sourceId);t.assetLinks.forEach(l=>l.assetId=remap('assets',l.assetId));if(t.sourceLayout){t.sourceLayout.sourceId=remap('sources',t.sourceLayout.sourceId);t.sourceLayout.pages.forEach(p=>p.backgroundAssetId=remap('assets',p.backgroundAssetId));}if(t.previousId)t.previousId=remap('tasks',t.previousId);if(t.supersededBy)t.supersededBy=remap('tasks',t.supersededBy);}
 function transform(k,original){const x=clone(original);x.id=remap(k,x.id);if(k==='tasks')fixTask(x);if(k==='sources'){if(x.assetId)x.assetId=remap('assets',x.assetId);x.attachmentIds=x.attachmentIds.map(v=>remap('assets',v));}if(k==='exams'){if(x.workshopId)x.workshopId=remap('workshops',x.workshopId);for(const i of [...x.items,...(x.oralItem?[x.oralItem]:[])]){fixTask(i.task);i.originTaskId=remap('tasks',i.originTaskId);}if(maps.exams[original.id]){x.title+=' · Rücklauf';x.importedFrom=original.id;}}if(k==='uses'){x.examId=remap('exams',x.examId);x.taskIds=x.taskIds.map(v=>remap('tasks',v));x.familyIds=x.familyIds.map(v=>remap('families',v));}return x;}
 // Propagate collisions through references until every dependent record has a
 // stable destination. Local records and their snapshots are never rewritten.
 let added;do{added=false;for(const k of collectionNames)for(const x of incoming[k]){if(maps[k][x.id])continue;const old=local[k].find(y=>y.id===x.id);if(old&&!equal(old,transform(k,x))){maps[k][x.id]=x.id+'~'+suffix;conflicts.push({kind:k,id:x.id,newId:maps[k][x.id]});added=true;}}}while(added);
 for(const k of collectionNames)for(const original of incoming[k]){const x=transform(k,original),old=result[k].find(v=>v.id===x.id);if(!old)result[k].push(x);else if(!equal(old,x))throw Error('Abweichender Import mit gleicher Kennung. Bitte als separates Projekt öffnen.');}
 validate(result);return {db:result,conflicts};
}
function subset(d,specialty){const p={...empty(),name:'Arbeitsgruppe '+specialty};p.settings=clone((d.settings||[]).filter(r=>r.specialty==='*'||r.specialty===specialty));p.tasks=clone(d.tasks.filter(t=>t.specialty===specialty));const fs=new Set(p.tasks.map(t=>t.familyId)),ss=new Set(p.tasks.flatMap(t=>t.sourceIds));p.families=clone(d.families.filter(f=>fs.has(f.id)));p.sources=clone(d.sources.filter(s=>ss.has(s.id)));const as=new Set([...p.tasks.flatMap(t=>t.assetLinks.map(l=>l.assetId)),...p.sources.flatMap(s=>[s.assetId,...s.attachmentIds])]);p.assets=clone(d.assets.filter(a=>as.has(a.id)));return validate(p);}

// Import evidence only: isolated phase times never imply a complete task duration.
function extractTiming(text){
 const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),phases=[],evidence=[];
 const add=(label,minutes,quote,maxMinutes)=>{if(phases.some(p=>p.label===label))return;phases.push({label,minutes,...(maxMinutes?{maxMinutes}:{})});evidence.push(quote);};
 let totalMinutes=null,method='unknown';
 for(const [index,line] of lines.entries()){
  let m=line.match(/(?:Zeitablauf|Zeitvorgabe|\bZeit|Dauer|[Ii]nsgesamt)\s*:?\s*\(?(\d+)\s*(?:Min|min)/);
  if(!m&&index<9&&!/Planung|Vorbereit|Durchführ|Reflekt|Reflex|Eigenref|Mündliche Prüfung \(|Aufgabe .*\(\d+ Min\./i.test(line))m=line.match(/\((\d+)\s*(?:Minuten|Min\.)\)/);
  if(m&&totalMinutes===null){totalMinutes=Number(m[1]);method='explicit';evidence.push(line);}
  m=line.match(/Richtzeit sind (\d+) Minuten, max\. (\d+) Minuten/i);if(m)add('Planungsphase (Richtzeit)',+m[1],line,+m[2]);
  m=line.match(/(?:Planungszeit|Planungsphase)[^\d\n]*(\d+)\s*Min/i)||line.match(/Planung haben Sie\s*(\d+)\s*Minuten Zeit/i)||line.match(/Sie haben\s*(\d+)\s*Minuten Zeit für die Planung/i)||line.match(/davon\s*(\d+)\s*Minuten Vorbereitungszeit/i);
  if(m)add('Planung / Vorbereitung',+m[1],line);
  m=line.match(/(?:Beschreiben|Nennen) Sie unten in (\d+) Minuten/i);if(m)add('Schriftliche Vorbereitung',+m[1],line);
  m=line.match(/Durchführ(?:ung|ungszeit)[^\d\n]*(\d+)\s*Min/i)||line.match(/^\d*\.?\s*Aufgaben?[^\n]*\((\d+)\s*Min[.,)]/i)||line.match(/Für die Aufgaben .* haben Sie (\d+) Minuten Zeit/i);
  if(m)add(/Mündliche/.test(line)?'Prüfgespräch':'Durchführung',+m[1],line);
  m=line.match(/(?:Reflektionszeit|Reflexionszeit|Reflektionsgespräch|Reflexionsgespräch|Eigenreflexion|Eigenreflektion)[^\d\n]*(\d+)\s*Min/i);if(m)add('Reflexion',+m[1],line);
  m=line.match(/(?:Prüfgespräch dauert|verbleibenden)\s*(\d+)\s*Minuten/i);if(m)add('Prüfgespräch',+m[1],line);
 }
 const labels=phases.map(p=>p.label),complete=labels.includes('Durchführung')&&labels.includes('Reflexion')||labels.includes('Prüfgespräch')&&(labels.includes('Planung / Vorbereitung')||labels.includes('Durchführung'));
 if(totalMinutes===null&&complete){totalMinutes=phases.reduce((n,p)=>n+p.minutes,0);method='phase-sum';}
 return {totalMinutes,method,phases,evidence:[...new Set(evidence)]};
}
function durationSummary(t){return t.unknownMinutes?(t.minutes?`Bearbeitungszeit: ${t.minutes} Minuten bekannt · ${t.unknownMinutes} Aufgaben noch offen`:'Bearbeitungszeit noch festzulegen'):`Bearbeitungszeit gesamt: ${t.minutes} Minuten`;}

const api={today,pointsReviewKey,pointsReviewCurrent,contentKey,taskReviewKey,examReviewKey,taskReviewCurrent,openTaskFlags,assertStructurePolicy,allowedExamTypes,examEntries,findExamItem,setOralItem,removeOralItem,oralStatus,oralTotals,assertOralPolicy,examTypeLabel,examTypesFor,fachwerkerSpecialties,checkExamScope,trashExam,restoreExam,purgeExam,extractTiming,durationSummary,proposePoints,pointsLabel,SCHEMA,specialties,checkWorkshop,checkExamWorkshop,saveWorkshop,workshopExams,committee,saveCommittee,committeeHistory,clone,id,now,empty,equal,validate,newExam,currentExamPolicy,prepareCurrentTask,reportbookIssues,cleanReportbook,assertExamPolicy,addItem,revise,totals,readiness,validDate,recordUse,merge,subset,checkTask};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HortiCore=api;
})(globalThis);
