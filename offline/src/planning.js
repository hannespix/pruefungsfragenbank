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
// Exact Gärtner AP titles from the supplied grading workbook, sheet Aufgaben.
// ZP uses the same specialty catalog by coordinator instruction; GBF remains separate.
const workbookCategories={
 "Zierpflanzenbau": [
  {
   "id": "propagation",
   "label": "Vermehren von Zierpflanzen",
   "cell": "C12",
   "area": 1
  },
  {
   "id": "planting",
   "label": "Vorbereiten und Durchführen von Pflanzungen",
   "cell": "C13",
   "area": 1
  },
  {
   "id": "plantwork",
   "label": "Durchführen von Arbeiten an der Pflanze",
   "cell": "C14",
   "area": 1
  },
  {
   "id": "protection",
   "label": "Durchführen von Pflanzenschutzmaßnahmen",
   "cell": "C15",
   "area": 1
  },
  {
   "id": "nutrition",
   "label": "Durchführen von Düngungs- und Bewässerungsmaßnahmen",
   "cell": "C16",
   "area": 1
  },
  {
   "id": "cultivationrooms",
   "label": "Durchführen von Arbeiten an Kulturräumen und Kultureinrichtungen",
   "cell": "C17",
   "area": 1
  },
  {
   "id": "harvest",
   "label": "Durchführen von Ernte- und Aufbereitungsmaßnahmen",
   "cell": "C18",
   "area": 2
  },
  {
   "id": "containers",
   "label": "Bepflanzen von Gefäßen",
   "cell": "C19",
   "area": 2
  },
  {
   "id": "indoor",
   "label": "Durchführen und Pflegen von Innenraumbegrünungen",
   "cell": "C20",
   "area": 2
  },
  {
   "id": "bedding",
   "label": "Bepflanzen von Rabatten",
   "cell": "C21",
   "area": 2
  },
  {
   "id": "bouquets",
   "label": "Binden von Sträußen",
   "cell": "C22",
   "area": 2
  },
  {
   "id": "advice",
   "label": "Verkaufen und Beraten",
   "cell": "C23",
   "area": 2
  },
  {
   "id": "presentation",
   "label": "Durchführen von verkaufsfördernden Präsentationen",
   "cell": "C24",
   "area": 2
  }
 ],
 "Gemüsebau": [
  {
   "id": "propagation",
   "label": "Anzucht von Jungpflanzen",
   "cell": "E12",
   "area": 1
  },
  {
   "id": "soil",
   "label": "Flächen ausmessen und zur Pflanzung oder Aussaat vorbereiten",
   "cell": "E13",
   "area": 1
  },
  {
   "id": "planting",
   "label": "Durchführen von Pflanzungen",
   "cell": "E14",
   "area": 1
  },
  {
   "id": "directsowing",
   "label": "Durchführen von Direktsaaten",
   "cell": "E15",
   "area": 1
  },
  {
   "id": "plantwork",
   "label": "Durchführen von Arbeiten an der Pflanze",
   "cell": "E16",
   "area": 1
  },
  {
   "id": "machinery",
   "label": "Einsatz von Maschinen und Geräten",
   "cell": "E17",
   "area": 1
  },
  {
   "id": "protection",
   "label": "Durchführen von Pflanzenschutzmaßnahmen",
   "cell": "E18",
   "area": 1
  },
  {
   "id": "nutrition",
   "label": "Durchführen von Düngungs- und Bewässerungsmaßnahmen",
   "cell": "E19",
   "area": 1
  },
  {
   "id": "cultivationrooms",
   "label": "Durchführen von Arbeiten an Kulturräumen und Kultureinrichtungen",
   "cell": "E20",
   "area": 1
  },
  {
   "id": "harvest",
   "label": "Ernten von Gemüse",
   "cell": "E21",
   "area": 2
  },
  {
   "id": "preparation",
   "label": "Aufbereiten und Sortieren von Gemüse",
   "cell": "E22",
   "area": 2
  },
  {
   "id": "packaging",
   "label": "Kennzeichnen und Verpacken von Gemüse",
   "cell": "E23",
   "area": 2
  },
  {
   "id": "presentation",
   "label": "Durchführen von verkaufsfördernden Präsentationen",
   "cell": "E24",
   "area": 2
  },
  {
   "id": "advice",
   "label": "Verkaufen und Beraten",
   "cell": "E25",
   "area": 2
  }
 ],
 "Baumschule": [
  {
   "id": "propagation",
   "label": "Vermehren von Gehölzen",
   "cell": "I12",
   "area": 1
  },
  {
   "id": "soil",
   "label": "Anlegen von Baumschulquartieren",
   "cell": "I13",
   "area": 1
  },
  {
   "id": "plantwork",
   "label": "Durchführen von Arbeiten an der Pflanze",
   "cell": "I14",
   "area": 1
  },
  {
   "id": "schooling",
   "label": "Aufschulen und Aufpflanzen",
   "cell": "I15",
   "area": 1
  },
  {
   "id": "protection",
   "label": "Durchführen von Pflanzenschutzmaßnahmen",
   "cell": "I16",
   "area": 1
  },
  {
   "id": "nutrition",
   "label": "Durchführen von Düngungs- und Bewässerungsmaßnahmen",
   "cell": "I17",
   "area": 1
  },
  {
   "id": "lifting",
   "label": "Gehölze roden und ballieren",
   "cell": "I18",
   "area": 1
  },
  {
   "id": "selection",
   "label": "Gehölze sortieren und kennzeichnen",
   "cell": "I19",
   "area": 1
  },
  {
   "id": "storage",
   "label": "Gehölze lagern und versandfertig machen",
   "cell": "I20",
   "area": 2
  },
  {
   "id": "advice",
   "label": "Verkaufen und Beraten",
   "cell": "I21",
   "area": 2
  },
  {
   "id": "presentation",
   "label": "Durchführen von verkaufsfördernden Präsentationen",
   "cell": "I22",
   "area": 2
  },
  {
   "id": "planting",
   "label": "Durchführen von Anpflanzungen beim Kunden",
   "cell": "I23",
   "area": 2
  }
 ],
 "Obstbau": [
  {
   "id": "propagation",
   "label": "Vermehren von Pflanzen",
   "cell": "K12",
   "area": 1
  },
  {
   "id": "soil",
   "label": "Flächen ausmessen und zur Pflanzung vorbereiten",
   "cell": "K13",
   "area": 1
  },
  {
   "id": "planting",
   "label": "Durchführen von Pflanzungen",
   "cell": "K14",
   "area": 1
  },
  {
   "id": "support",
   "label": "Erstellen von Stützkonstruktionen",
   "cell": "K15",
   "area": 1
  },
  {
   "id": "plantwork",
   "label": "Durchführen von Arbeiten an der Pflanze",
   "cell": "K16",
   "area": 1
  },
  {
   "id": "protection",
   "label": "Durchführen von Pflanzenschutzmaßnahmen",
   "cell": "K17",
   "area": 1
  },
  {
   "id": "nutrition",
   "label": "Durchführen von Düngungs- und Bewässerungsmaßnahmen",
   "cell": "K18",
   "area": 1
  },
  {
   "id": "harvest",
   "label": "Ernten von Obst",
   "cell": "K19",
   "area": 2
  },
  {
   "id": "sorting",
   "label": "Sortieren von Obst",
   "cell": "K20",
   "area": 2
  },
  {
   "id": "packaging",
   "label": "Kennzeichnen und Verpacken von Obst",
   "cell": "K21",
   "area": 2
  },
  {
   "id": "presentation",
   "label": "Durchführen von verkaufsfördernden Präsentationen",
   "cell": "K22",
   "area": 2
  },
  {
   "id": "advice",
   "label": "Verkaufen und Beraten",
   "cell": "K23",
   "area": 2
  }
 ],
 "Staudengärtnerei": [
  {
   "id": "propagation",
   "label": "Vermehren von Stauden",
   "cell": "C32",
   "area": 1
  },
  {
   "id": "soil",
   "label": "Anlegen von Staudenquartieren",
   "cell": "C33",
   "area": 1
  },
  {
   "id": "plantwork",
   "label": "Durchführen von Arbeiten an der Pflanze",
   "cell": "C34",
   "area": 1
  },
  {
   "id": "protection",
   "label": "Durchführen von Pflanzenschutzmaßnahmen",
   "cell": "C35",
   "area": 1
  },
  {
   "id": "nutrition",
   "label": "Durchführen von Düngungs- und Bewässerungsmaßnahmen",
   "cell": "C36",
   "area": 1
  },
  {
   "id": "selection",
   "label": "Stauden auswählen und kennzeichnen",
   "cell": "C37",
   "area": 2
  },
  {
   "id": "packaging",
   "label": "Stauden verpacken und verkaufsfertig machen",
   "cell": "C38",
   "area": 2
  },
  {
   "id": "planting",
   "label": "Staudenpflanzungen anlegen",
   "cell": "C39",
   "area": 2
  },
  {
   "id": "advice",
   "label": "Verkaufen und Beraten",
   "cell": "C40",
   "area": 2
  }
 ],
 "Garten- und Landschaftsbau": [
  {
   "id": "siteplanning",
   "label": "Ausführungspläne sowie Leistungsverzeichnisse lesen und auf die Baustelle übertragen",
   "cell": "E32",
   "area": 1
  },
  {
   "id": "earthworks",
   "label": "Durchführen von Erdarbeiten",
   "cell": "E33",
   "area": 1
  },
  {
   "id": "drainage",
   "label": "Durchführen von Entwässerungsarbeiten",
   "cell": "E34",
   "area": 1
  },
  {
   "id": "paving",
   "label": "Herstellen von befestigten Flächen",
   "cell": "E35",
   "area": 1
  },
  {
   "id": "naturalstone",
   "label": "Be- und Verarbeiten von Naturstein",
   "cell": "E36",
   "area": 1
  },
  {
   "id": "concrete",
   "label": "Bauen mit Betonfertigteilen",
   "cell": "E37",
   "area": 1
  },
  {
   "id": "equipment",
   "label": "Aufstellen und Montieren von Ausstattungsgegenständen",
   "cell": "E38",
   "area": 1
  },
  {
   "id": "planting",
   "label": "Pflanzungen vorbereiten und durchführen",
   "cell": "E39",
   "area": 2
  },
  {
   "id": "sowing",
   "label": "Flächen für Ansaaten vorbereiten und ansäen",
   "cell": "E40",
   "area": 2
  },
  {
   "id": "landscapecare",
   "label": "Pflegemaßnahmen durchführen",
   "cell": "E41",
   "area": 2
  },
  {
   "id": "protection",
   "label": "Durchführen von Pflanzenschutzmaßnahmen",
   "cell": "E42",
   "area": 2
  },
  {
   "id": "materials",
   "label": "Be- und Verarbeiten von Holz- und anderen Werkstoffen",
   "cell": "E43",
   "area": 1
  }
 ],
 "Friedhofsgärtnerei": [
  {
   "id": "soil",
   "label": "Grabstätte planen, Flächen aufteilen und vermessen",
   "cell": "I32",
   "area": 1
  },
  {
   "id": "planting",
   "label": "Boden bearbeiten und Grab bepflanzen",
   "cell": "I33",
   "area": 1
  },
  {
   "id": "propagation",
   "label": "Vermehren von Pflanzen",
   "cell": "I34",
   "area": 2
  },
  {
   "id": "plantwork",
   "label": "Durchführen von Arbeiten an der Pflanze",
   "cell": "I35",
   "area": 2
  },
  {
   "id": "combinedcare",
   "label": "Durchführen von Bewässerungs-, Düngungs- und Pflanzenschutzmaßnahmen",
   "cell": "I36",
   "area": 2
  },
  {
   "id": "gravecare",
   "label": "Durchführen von Pflegemaßnahmen an Grabstätten",
   "cell": "I37",
   "area": 1
  },
  {
   "id": "protection",
   "label": "Durchführen von Pflanzenschutzmaßnahmen",
   "cell": "I38",
   "area": 1
  },
  {
   "id": "funeral",
   "label": "Herstellen von Trauerbinderei",
   "cell": "I39",
   "area": 2
  },
  {
   "id": "decoration",
   "label": "Durchführen von Dekorationen",
   "cell": "I40",
   "area": 2
  },
  {
   "id": "advice",
   "label": "Verkaufen und Beraten",
   "cell": "I41",
   "area": 2
  },
  {
   "id": "containers",
   "label": "Bepflanzen von Gefäßen",
   "cell": "I42",
   "area": 2
  }
 ]
};
const workbookSource={sheet:'Aufgaben',version:'03.02.2020',workbook:'Notenberechnung Gärtner AP S 2026'};
function workbookScope(t){return ['AP','ZP'].includes(t?.examType)&&!/gartenbaufachwerk|\bGBF\b|\b17[1-7]\b/i.test(t.qualification||'')?workbookCategories[t.specialty]:null;}
for(const c of Object.values(workbookCategories).flat())if(!catalog.some(x=>x.id===c.id))catalog.push({id:c.id,label:c.label,re:/$^/});
function label(id,context){const legacy=['AP','ZP'].includes(context?.pattern?.examType)&&!context.pattern.categoryCatalog;return (!legacy&&workbookScope(context)?.find(c=>c.id===id)?.label)||catalog.find(c=>c.id===id)?.label||'Kategorie noch zuordnen';}
const labels=(t,pattern)=>patternClassify(t,pattern).ids.map(id=>label(id,pattern?{...t,pattern}:t));
const normalizeHeading=s=>s.toLocaleLowerCase('de').replace(/\bu\./g,'und').replace(/\s+/g,' ').trim();

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
function classify(t,{legacy=false}={}){const official=legacy?null:workbookScope(t);const validIds=ids=>[...new Set(ids.map(id=>t.examType==='ZP'&&official&&!official.some(c=>c.id===id)?'unassigned':id))];if(t.planningCategories?.length){const ids=validIds(t.planningCategories.filter(id=>applies(id,t)));return {ids:ids.length?ids:['unassigned'],evidence:t.planningCategoryEvidence||'Manuell zugeordnet',manual:true};}
 let evidence=heading(t);
 if(t.examType==='AP'&&t.specialty==='Garten- und Landschaftsbau'&&/Bewertungsblatt für die Phase I.*Planungsphase/i.test(t.text||'')){
  // The original planning form is a multi-section task: inspect explicit section
  // headings only, never arbitrary keywords in the explanatory questions.
  evidence=(t.text||'').replace(/\\n/g,'\n').split('\n').map(x=>x.trim()).filter(x=>/^(?:Ausführungspläne sowie Leistungsverzeichnisse lesen und auf die Baustelle übertragen[.]?|Herstellen von befestigten Flächen|Be- und Verarbeiten von Naturstein|Pflanzungen vorbereiten und durchführen|Flächen für Ansaaten vorbereiten und ansäen)$/i.test(x)).join('\n');
 }
 let ids=catalog.filter(c=>c.re.test(evidence)&&applies(c.id,t)).map(c=>c.id);if(ids.includes('naturalstone'))ids=ids.filter(id=>id!=='materials');
 if(official){
  const normalized=normalizeHeading(evidence).replace('grabstätte planen, fläche aufteilen','grabstätte planen, flächen aufteilen');
  const exact=official.filter(c=>normalized.includes(normalizeHeading(c.label))).map(c=>c.id);
  // Keep old aliases for existing questions, but split genuinely different Excel entries.
  if(exact.includes('bedding')&&!exact.includes('planting'))ids=ids.filter(id=>id!=='planting');
  if(t.specialty==='Friedhofsgärtnerei'&&exact.includes('planting')&&!exact.includes('soil'))ids=ids.filter(id=>id!=='soil');
  if(exact.some(id=>['sorting','preparation','packaging'].includes(id))&&!exact.includes('harvest')&&!/\bernten\b/i.test(evidence))ids=ids.filter(id=>id!=='harvest');
  if(exact.includes('combinedcare'))ids=ids.filter(id=>!['nutrition','protection'].includes(id)||exact.includes(id));
  ids=validIds([...ids,...exact]);
  ids.sort((a,b)=>{const index=id=>{const n=official.findIndex(c=>c.id===id);return n<0?999:n;};return index(a)-index(b);});
 }
 return {ids:ids.length?ids:['unassigned'],evidence:evidence||'Kein eindeutiger Aufgabenkopf',manual:false};
}
function categories(d,type,specialty,context={}){const scope={examType:type,specialty,...context},official=workbookScope(scope);if(official)return official.map(c=>({...c}));const ids=new Set([...(archiveScopes[specialty]?.[type]||[]),...scoped(d,type,specialty,true).flatMap(t=>classify(t).ids)]);return catalog.filter(c=>ids.has(c.id)&&applies(c.id,scope)).map(c=>({...c,label:label(c.id,scope)}));}
function scoped(d,type,specialty,all=false){return d.tasks.filter(t=>t.examType===type&&t.specialty===specialty&&t.kind==='practical'&&(all||!t.supersededBy));}
function inferPattern(d,type,specialty){const tasks=scoped(d,type,specialty),ids=new Set(tasks.flatMap(t=>classify(t).ids));return {id:`pattern:${type}:${specialty}`,examType:type,specialty,status:'proposed',version:1,...(['AP','ZP'].includes(type)?{categoryCatalog:'excel-ap-2026'}:{}),slots:catalog.filter(c=>ids.has(c.id)).map(c=>({categoryId:c.id,count:1})),note:'Aus vorhandenen Aufgabenköpfen abgeleitet. Anzahl und Pflichtkategorien fachlich bestätigen; kein Nachweis eines vollständigen Prüfungsjahres.'};}
function checkPattern(p){if(p?.categoryCatalog!==undefined&&p.categoryCatalog!=='excel-ap-2026')throw Error('Unbekannter Kategorienstand.');if(!p||!Number.isInteger(p.version)||p.version<1||!['AP','ZP'].includes(p.examType)||typeof p.specialty!=='string'||!['proposed','confirmed'].includes(p.status)||!Array.isArray(p.slots)||!p.slots.length)throw Error('Prüfungsmuster benötigt mindestens eine Kategorie.');const seen=new Set();for(const s of p.slots){if(!catalog.some(c=>c.id===s.categoryId)||seen.has(s.categoryId)||!Number.isInteger(s.count)||s.count<1||s.count>10)throw Error('Ungültige Kategorie oder Anzahl im Prüfungsmuster.');seen.add(s.categoryId);}return p;}
function pattern(d,type,specialty){return d.patterns?.find(p=>p.examType===type&&p.specialty===specialty)||inferPattern(d,type,specialty);}
function history(d,t){const variants=scoped(d,t.examType,t.specialty,true).filter(v=>v.familyId===t.familyId),sourceIds=new Set(variants.flatMap(v=>v.sourceIds)),years=d.sources.filter(s=>sourceIds.has(s.id)&&Number.isInteger(s.year)&&s.year<=new Date().getFullYear()).map(s=>s.year),uses=d.uses.filter(u=>{const e=d.exams.find(e=>e.id===u.examId);return e?.examType===t.examType&&e?.specialty===t.specialty&&(u.familyIds.includes(t.familyId)||variants.some(v=>u.taskIds.includes(v.id)))&&u.date<=new Date().toISOString().slice(0,10);}).map(u=>u.date).sort();const confirmed=uses.at(-1)||null,sourceYear=years.length?Math.max(...years):null,year=Math.max(sourceYear||0,confirmed?Number(confirmed.slice(0,4)):0)||null;const sortDate=sourceYear&&(!confirmed||sourceYear>Number(confirmed.slice(0,4)))?sourceYear+'-12-31':confirmed;return {confirmed,sourceYear,year,sortDate,unknown:year===null};}
function rank(d,type,specialty,categoryId,excluded=[]){const skip=new Set(excluded);return scoped(d,type,specialty).filter(t=>!skip.has(t.familyId)&&classify(t).ids.includes(categoryId)).map(task=>({task,history:history(d,task)})).sort((a,b)=>(a.history.sortDate||'9999').localeCompare(b.history.sortDate||'9999')||a.task.familyId.localeCompare(b.task.familyId)||a.task.id.localeCompare(b.task.id));}
function patternClassify(t,p){return classify(t,{legacy:['AP','ZP'].includes(p?.examType)&&!p.categoryCatalog});}
function coverage(e){const issues=[],p=e.pattern;try{checkPattern(p);}catch{ return {complete:false,slots:[],issues:['Prüfungsmuster fehlt oder hat noch keine Kategorien.']};}if(p.examType!==e.examType||p.specialty!==e.specialty)issues.push('Prüfungsmuster passt nicht zum Prüfungsbereich.');if(p.status!=='confirmed')issues.push('Prüfungsmuster noch nicht bestätigt.');const families=new Set();for(const i of e.items){if(i.task.examType!==e.examType||i.task.specialty!==e.specialty)issues.push('Aufgabe gehört zu einem anderen Prüfungsbereich.');if(families.has(i.task.familyId))issues.push('Aufgabenfamilie mehrfach ausgewählt.');families.add(i.task.familyId);if(patternClassify(i.task,p).ids.some(id=>!p.slots.some(s=>s.categoryId===id)))issues.push('Aufgabe deckt eine Kategorie außerhalb des Musters ab.');if(patternClassify(i.task,p).ids.includes('unassigned'))issues.push('Aufgabe ohne bestätigbare Kategorie.');}
 const slots=p.slots.map(s=>({...s,actual:e.items.filter(i=>patternClassify(i.task,p).ids.includes(s.categoryId)).length}));for(const s of slots)if(s.actual!==s.count)issues.push(`${label(s.categoryId,e)}: ${s.actual} von ${s.count} vorgesehenen Aufgaben.`);return {complete:issues.length===0,slots,issues};}
function propose(d,e){
 checkPattern(e.pattern);if(e.pattern.examType!==e.examType||e.pattern.specialty!==e.specialty)throw Error('Prüfungsmuster passt nicht zum Prüfungsbereich.');
 const slots=e.pattern.slots,required=new Map(slots.map(s=>[s.categoryId,s.count])),counts=new Map(slots.map(s=>[s.categoryId,e.items.filter(i=>patternClassify(i.task,e.pattern).ids.includes(s.categoryId)).length])),used=new Set(e.items.map(i=>i.task.familyId));
 const candidates=scoped(d,e.examType,e.specialty).map(task=>({task,ids:patternClassify(task,e.pattern).ids,h:history(d,task)})).filter(c=>c.ids.every(id=>required.has(id))&&!used.has(c.task.familyId)).sort((a,b)=>(a.h.sortDate||'9999').localeCompare(b.h.sortDate||'9999')||a.task.id.localeCompare(b.task.id));
 let best=[],bestScore=0,visits=0;
 function search(chosen){if(++visits>5000)return false;const score=chosen.reduce((n,t)=>n+patternClassify(t,e.pattern).ids.length,0);if(score>bestScore){best=chosen.slice();bestScore=score;}const missing=slots.filter(s=>counts.get(s.categoryId)<s.count);if(!missing.length)return true;
  const fits=c=>!used.has(c.task.familyId)&&c.ids.every(id=>counts.get(id)<required.get(id));
  const options=missing.map(s=>({s,list:candidates.filter(c=>c.ids.includes(s.categoryId)&&fits(c))})).sort((a,b)=>a.list.length-b.list.length);
  // Try constrained categories first; if one is impossible, still offer a useful partial draft.
  const next=options.find(o=>o.list.length);if(!next)return false;
  for(const c of next.list){used.add(c.task.familyId);c.ids.forEach(id=>counts.set(id,counts.get(id)+1));chosen.push(c.task);if(search(chosen))return true;chosen.pop();c.ids.forEach(id=>counts.set(id,counts.get(id)-1));used.delete(c.task.familyId);if(visits>5000)break;}return false;
 }
 search([]);return best;
}

const api={workbookCategories,workbookSource,workbookScope,patternClassify,labels,catalog,categories,archiveScopes,label,heading,classify,scoped,inferPattern,pattern,checkPattern,history,rank,coverage,propose};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HortiPlanning=api;
})(globalThis);
