/* Category proposals and family rotation; independent of UI, storage and authorization. */
(function(root){'use strict';
const catalog=[
 ['soil','Bodenbearbeitung & Flächenvorbereitung',/bodenbearbeit|boden bearbeiten|flächen ausmessen|fläche aufteilen|mutterpflanzenbeet anlegen|anlegen von staudenquartieren/i],
 ['propagation','Pflanzen vermehren',/vermehren von|vermehrung/i],
 ['plantwork','Arbeiten an der Pflanze',/arbeiten an (?:und mit )?der pflanze/i],
 ['harvest','Ernte & Aufbereitung',/ernte|ernten|sortieren von obst/i],
 ['machinery','Maschinen, Werkzeuge & Geräte einsetzen',/einsatz von (?:maschinen|werkzeug)/i],
 ['maintenance','Maschinen, Geräte & Anlagen pflegen',/pflegemaßnahmen an maschinen/i],
 ['materials','Materialien & Werkstoffe bearbeiten',/be- und verarbeiten/i],
 ['plantuse','Pflanzen verwenden',/verwendung (?:der|von) pflanzen/i],
 ['protection','Pflanzenschutz',/pflanzenschutzmaßnahmen/i],
 ['nutrition','Düngung & Bewässerung',/düngungs?.{0,30}bewässerungs?/i],
 ['planting','Pflanzungen anlegen',/pflanzungen|pflanzung durchführen|beet bepflanzen|rabatten|grab bepflanzen/i],
 ['containers','Gefäße bepflanzen',/bepflanzen von gefäßen/i],
 ['advice','Verkaufen & Beraten',/verkaufen und beraten/i],
 ['presentation','Verkaufsfördernde Präsentation',/verkaufsfördernden? präsentationen/i],
 ['selection','Pflanzen auswählen, sortieren & kennzeichnen',/gehölze sortieren|sortieren und kennzeichnen von gehölzen|stauden auswählen und kennzeichnen/i],
 ['indoor','Innenraumbegrünung',/innenraumbegrünungen/i],
 ['gravecare','Grabstätten pflegen',/pflegemaßnahmen an grabstätten/i],
 ['siteplanning','Ausführungspläne & Arbeitsablauf',/ausführungspläne sowie leistungsverzeichnisse lesen/i],
 ['paving','Befestigte Flächen herstellen',/herstellen von befestigten flächen/i],
 ['naturalstone','Naturstein be- und verarbeiten',/be- und verarbeiten von naturstein/i],
 ['sowing','Ansaatflächen vorbereiten & ansäen',/flächen für ansaaten vorbereiten und ansäen/i]
].map(([id,label,re])=>({id,label,re}));
const label=id=>catalog.find(c=>c.id===id)?.label||'Kategorie noch zuordnen';
function heading(t){let text=(t.text||'').replace(/\\n/g,'\n');const marker=text.match(/(?:^|\n)Aufgaben?\s*:?\s*/i);if(marker)text=text.slice(marker.index+marker[0].length);return text.split(/\bHier\s*:|\bSzenario\s*:|\bIn der Planungsphase|\bSie (?:sind|sollen|erhalten|werden|arbeiten|haben)|\bAls Mitarbeiter|\bWelche|\bFühren Sie|\bBereiten Sie|\bDie Vorgabe|\bZeitvorgabe|\bMaterial\s*:/i)[0].slice(0,800).replace(/durchführen von arbeiten an und mit der pflanze\s*[-–]\s*/gi,'').trim();}
// Archive evidence is separated by exam type; these are available choices, not
// mandatory annual counts. New same-scope source tasks can extend this evidence.
const archiveScopes={
 'Baumschule':{ZP:['soil','propagation','plantwork','harvest','maintenance'],AP:['propagation','plantwork','protection','planting','advice','presentation','selection']},
 'Friedhofsgärtnerei':{ZP:[],AP:['soil','protection','planting','containers','gravecare']},
 'Garten- und Landschaftsbau':{ZP:['soil','propagation','plantwork','machinery','maintenance','materials'],AP:['siteplanning','paving','naturalstone','planting','sowing']},
 'Gemüsebau':{ZP:['soil','propagation','plantwork','harvest','machinery','maintenance','materials'],AP:['soil','propagation','plantwork','harvest','machinery','protection','nutrition','planting','presentation']},
 'Obstbau':{ZP:['propagation','plantwork','machinery','maintenance'],AP:['soil','plantwork','harvest','protection','planting','presentation']},
 'Staudengärtnerei':{ZP:['soil','propagation','plantwork','harvest','machinery','maintenance','plantuse'],AP:['soil','propagation','plantwork','protection','nutrition','planting','advice','selection']},
 'Zierpflanzenbau':{ZP:['soil','propagation','plantwork','harvest','machinery','maintenance','materials','plantuse'],AP:['propagation','plantwork','harvest','protection','nutrition','planting','containers','advice','presentation','indoor']}
};
function applies(id,t){return id!=='gravecare'||t.specialty==='Friedhofsgärtnerei';}
function classify(t){if(t.planningCategories?.length){const ids=t.planningCategories.filter(id=>applies(id,t));return {ids:ids.length?ids:['unassigned'],evidence:t.planningCategoryEvidence||'Manuell zugeordnet',manual:true};}
 let evidence=heading(t);
 if(t.examType==='AP'&&t.specialty==='Garten- und Landschaftsbau'&&/Bewertungsblatt für die Phase I.*Planungsphase/i.test(t.text||'')){
  // The original planning form is a multi-section task: inspect explicit section
  // headings only, never arbitrary keywords in the explanatory questions.
  evidence=(t.text||'').replace(/\\n/g,'\n').split('\n').map(x=>x.trim()).filter(x=>/^(?:Ausführungspläne sowie Leistungsverzeichnisse lesen und auf die Baustelle übertragen[.]?|Herstellen von befestigten Flächen|Be- und Verarbeiten von Naturstein|Pflanzungen vorbereiten und durchführen|Flächen für Ansaaten vorbereiten und ansäen)$/i.test(x)).join('\n');
 }
 let ids=catalog.filter(c=>c.re.test(evidence)&&applies(c.id,t)).map(c=>c.id);if(ids.includes('naturalstone'))ids=ids.filter(id=>id!=='materials');
 return {ids:ids.length?ids:['unassigned'],evidence:evidence||'Kein eindeutiger Aufgabenkopf',manual:false};
}
function categories(d,type,specialty){const ids=new Set([...(archiveScopes[specialty]?.[type]||[]),...scoped(d,type,specialty,true).flatMap(t=>classify(t).ids)]);return catalog.filter(c=>ids.has(c.id)&&applies(c.id,{specialty}));}
function scoped(d,type,specialty,all=false){return d.tasks.filter(t=>t.examType===type&&t.specialty===specialty&&t.kind==='practical'&&(all||!t.supersededBy));}
function inferPattern(d,type,specialty){const tasks=scoped(d,type,specialty),ids=new Set(tasks.flatMap(t=>classify(t).ids));return {id:`pattern:${type}:${specialty}`,examType:type,specialty,status:'proposed',version:1,slots:catalog.filter(c=>ids.has(c.id)).map(c=>({categoryId:c.id,count:1})),note:'Aus vorhandenen Aufgabenköpfen abgeleitet. Anzahl und Pflichtkategorien fachlich bestätigen; kein Nachweis eines vollständigen Prüfungsjahres.'};}
function checkPattern(p){if(!p||!Number.isInteger(p.version)||p.version<1||!['AP','ZP'].includes(p.examType)||typeof p.specialty!=='string'||!['proposed','confirmed'].includes(p.status)||!Array.isArray(p.slots)||!p.slots.length)throw Error('Prüfungsmuster benötigt mindestens eine Kategorie.');const seen=new Set();for(const s of p.slots){if(!catalog.some(c=>c.id===s.categoryId)||seen.has(s.categoryId)||!Number.isInteger(s.count)||s.count<1||s.count>10)throw Error('Ungültige Kategorie oder Anzahl im Prüfungsmuster.');seen.add(s.categoryId);}return p;}
function pattern(d,type,specialty){return d.patterns?.find(p=>p.examType===type&&p.specialty===specialty)||inferPattern(d,type,specialty);}
function history(d,t){const variants=scoped(d,t.examType,t.specialty,true).filter(v=>v.familyId===t.familyId),sourceIds=new Set(variants.flatMap(v=>v.sourceIds)),years=d.sources.filter(s=>sourceIds.has(s.id)&&Number.isInteger(s.year)&&s.year<=new Date().getFullYear()).map(s=>s.year),uses=d.uses.filter(u=>{const e=d.exams.find(e=>e.id===u.examId);return e?.examType===t.examType&&e?.specialty===t.specialty&&(u.familyIds.includes(t.familyId)||variants.some(v=>u.taskIds.includes(v.id)))&&u.date<=new Date().toISOString().slice(0,10);}).map(u=>u.date).sort();const confirmed=uses.at(-1)||null,sourceYear=years.length?Math.max(...years):null,year=Math.max(sourceYear||0,confirmed?Number(confirmed.slice(0,4)):0)||null;const sortDate=sourceYear&&(!confirmed||sourceYear>Number(confirmed.slice(0,4)))?sourceYear+'-12-31':confirmed;return {confirmed,sourceYear,year,sortDate,unknown:year===null};}
function rank(d,type,specialty,categoryId,excluded=[]){const skip=new Set(excluded);return scoped(d,type,specialty).filter(t=>!skip.has(t.familyId)&&classify(t).ids.includes(categoryId)).map(task=>({task,history:history(d,task)})).sort((a,b)=>(a.history.sortDate||'9999').localeCompare(b.history.sortDate||'9999')||a.task.familyId.localeCompare(b.task.familyId)||a.task.id.localeCompare(b.task.id));}
function coverage(e){const issues=[],p=e.pattern;try{checkPattern(p);}catch{ return {complete:false,slots:[],issues:['Prüfungsmuster fehlt oder hat noch keine Kategorien.']};}if(p.examType!==e.examType||p.specialty!==e.specialty)issues.push('Prüfungsmuster passt nicht zum Prüfungsbereich.');if(p.status!=='confirmed')issues.push('Prüfungsmuster noch nicht bestätigt.');const families=new Set();for(const i of e.items){if(i.task.examType!==e.examType||i.task.specialty!==e.specialty)issues.push('Aufgabe gehört zu einem anderen Prüfungsbereich.');if(families.has(i.task.familyId))issues.push('Aufgabenfamilie mehrfach ausgewählt.');families.add(i.task.familyId);if(classify(i.task).ids.some(id=>!p.slots.some(s=>s.categoryId===id)))issues.push('Aufgabe deckt eine Kategorie außerhalb des Musters ab.');if(classify(i.task).ids.includes('unassigned'))issues.push('Aufgabe ohne bestätigbare Kategorie.');}
 const slots=p.slots.map(s=>({...s,actual:e.items.filter(i=>classify(i.task).ids.includes(s.categoryId)).length}));for(const s of slots)if(s.actual!==s.count)issues.push(`${label(s.categoryId)}: ${s.actual} von ${s.count} vorgesehenen Aufgaben.`);return {complete:issues.length===0,slots,issues};}
function propose(d,e){
 checkPattern(e.pattern);if(e.pattern.examType!==e.examType||e.pattern.specialty!==e.specialty)throw Error('Prüfungsmuster passt nicht zum Prüfungsbereich.');
 const slots=e.pattern.slots,required=new Map(slots.map(s=>[s.categoryId,s.count])),counts=new Map(slots.map(s=>[s.categoryId,e.items.filter(i=>classify(i.task).ids.includes(s.categoryId)).length])),used=new Set(e.items.map(i=>i.task.familyId));
 const candidates=scoped(d,e.examType,e.specialty).map(task=>({task,ids:classify(task).ids,h:history(d,task)})).filter(c=>c.ids.every(id=>required.has(id))&&!used.has(c.task.familyId)).sort((a,b)=>(a.h.sortDate||'9999').localeCompare(b.h.sortDate||'9999')||a.task.id.localeCompare(b.task.id));
 let best=[],bestScore=0,visits=0;
 function search(chosen){if(++visits>5000)return false;const score=chosen.reduce((n,t)=>n+classify(t).ids.length,0);if(score>bestScore){best=chosen.slice();bestScore=score;}const missing=slots.filter(s=>counts.get(s.categoryId)<s.count);if(!missing.length)return true;
  const fits=c=>!used.has(c.task.familyId)&&c.ids.every(id=>counts.get(id)<required.get(id));
  const options=missing.map(s=>({s,list:candidates.filter(c=>c.ids.includes(s.categoryId)&&fits(c))})).sort((a,b)=>a.list.length-b.list.length);
  // Try constrained categories first; if one is impossible, still offer a useful partial draft.
  const next=options.find(o=>o.list.length);if(!next)return false;
  for(const c of next.list){used.add(c.task.familyId);c.ids.forEach(id=>counts.set(id,counts.get(id)+1));chosen.push(c.task);if(search(chosen))return true;chosen.pop();c.ids.forEach(id=>counts.set(id,counts.get(id)-1));used.delete(c.task.familyId);if(visits>5000)break;}return false;
 }
 search([]);return best;
}

const api={catalog,categories,archiveScopes,label,heading,classify,scoped,inferPattern,pattern,checkPattern,history,rank,coverage,propose};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HortiPlanning=api;
})(globalThis);
