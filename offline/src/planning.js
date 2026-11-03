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
// GärtnAusbV (6 March 1996), §§ 9–15: statutory areas are independent of
// workbook columns. Extra workbook examples deliberately require task context.
const regulationRuleSet='gaertner-ap-1996-v1';
const regulationDefinitions={
 'Baumschule':{section:9,pages:'4–5',areas:['Pflanzenproduktion','Ernte und Vermarktung'],area1:['propagation','soil','plantwork','schooling','protection','nutrition'],area2:['lifting','selection','storage','advice']},
 'Friedhofsgärtnerei':{section:10,pages:'6–7',areas:['Grabanlage','Pflanzenproduktion, Trauerbinderei und Dekoration'],area1:['soil','planting'],area2:['propagation','plantwork','combinedcare','funeral','decoration']},
 'Garten- und Landschaftsbau':{section:11,pages:'8–9',areas:['Baustellenabwicklung und Bautechnik','Vegetationstechnik'],area1:['siteplanning','earthworks','drainage','paving','naturalstone','concrete','equipment'],area2:['planting','sowing','landscapecare']},
 'Gemüsebau':{section:12,pages:'10',areas:['Pflanzenproduktion','Ernte und Aufbereitung'],area1:['propagation','soil','planting','directsowing','plantwork','protection','nutrition'],area2:['harvest','preparation','packaging']},
 'Obstbau':{section:13,pages:'12',areas:['Produktion','Ernte und Aufbereitung'],area1:['propagation','soil','planting','support','plantwork','protection','nutrition'],area2:['harvest','sorting','packaging']},
 'Staudengärtnerei':{section:14,pages:'14–15',areas:['Pflanzenproduktion','Aufbereitung und Vermarktung'],area1:['propagation','soil','plantwork','protection','nutrition'],area2:['selection','packaging','planting']},
 'Zierpflanzenbau':{section:15,pages:'16–17',areas:['Pflanzenproduktion','Pflanzenverwendung'],area1:['propagation','planting','plantwork','protection','nutrition','harvest'],area2:['containers','indoor','bedding','bouquets']}
};
function regulationProfile(context){
 const d=context?.examType==='AP'&&workbookScope(context)&&regulationDefinitions[context.specialty];if(!d)return null;
 const overallWork=d.section===11,friedhof=d.section===10,section='§ '+d.section;
 const crossCutting=['Arbeitsschutz und Arbeitssicherheit','Natur- und Umweltschutz','Rationelle Energie- und Materialverwendung','Wahrnehmen und Beurteilen von Vorgängen','Beschaffen und Auswerten von Informationen',...(friedhof?['Verkauf und Beratung (in beiden Bereichen)']:[12,13].includes(d.section)?[`Vermarkten (im Bereich ${d.areas[1]})`]:[14,15].includes(d.section)?[`Verkaufen und Beraten (im Bereich ${d.areas[1]})`]:[])];
 return {id:regulationRuleSet,section,url:`https://www.gesetze-im-internet.de/g_rtnausbv/__${d.section}.html`,pages:d.pages,totalTasks:5,maxMinutes:300,overallWork,areas:d.areas.map((label,i)=>({id:'area'+(i+1),label,min:friedhof?2:i===0?3:1})),quotes:{
  count:overallWork?'Der Prüfling soll in der praktischen Prüfung in insgesamt höchstens fünf Stunden ein landschaftsgärtnerisches Gesamtwerk erstellen, das aus fünf komplexen Prüfungsaufgaben besteht.':'Der Prüfling soll in der praktischen Prüfung in insgesamt höchstens fünf Stunden fünf komplexe Prüfungsaufgaben durchführen und jeweils in einem Prüfungsgespräch erläutern.',
  areas:friedhof?'Die Bereiche Grabanlage sowie Pflanzenproduktion, Trauerbinderei und Dekoration sollen dabei mit je mindestens zwei Aufgaben vertreten sein.':`${overallWork?'Der Prüfungsbereich':'Der Bereich'} ${d.areas[0]} soll dabei mit mindestens drei Aufgaben und der Bereich ${d.areas[1]} mit mindestens einer Aufgabe vertreten sein.`,
  conversation:overallWork?'Das Gesamtwerk ist in einem Prüfungsgespräch zu erläutern, das sich auf die fünf Prüfungsaufgaben beziehen muß.':'Prüfungsaufgaben durchführen und jeweils in einem Prüfungsgespräch erläutern.',
  weighting:'Innerhalb der Prüfung nach Absatz 2 hat jede Prüfungsaufgabe und innerhalb der Prüfung nach Absatz 3 hat jedes Prüfungsfach das gleiche Gewicht.',
  examples:d.section===12?'Für die Prüfungsaufgaben kommen insbesondere folgende Gebiete in Betracht:':'Für die Prüfungsaufgaben kommen insbesondere in Betracht:'
 },crossCutting};
}
function regulationCategory(context,id){const p=regulationProfile(context),d=p&&regulationDefinitions[context.specialty],areaId=d?['area1','area2'].find(area=>d[area].includes(id))||null:null;return {areaId,reference:p?`${p.section} Abs. 2${areaId?' Nr. '+areaId.slice(-1):''}`:'',explicit:areaId!==null};}
// This validates stored declarations only. An unresolved inferred area is an
// ordinary draft and must never prevent saving/importing its source document.
function checkPracticalUnits(t){
 if(t.practicalUnits===undefined)return;
 if(!regulationProfile(t))throw Error('Zuordnung komplexer Prüfungsaufgaben ist nur für die Gärtner-Abschlussprüfung vorgesehen.');
 if(t.kind!=='practical')throw Error('Zuordnung komplexer Prüfungsaufgaben benötigt eine praktische Aufgabe.');
 if(!Array.isArray(t.practicalUnits)||!t.practicalUnits.length)throw Error('Komplexe Prüfungsaufgaben müssen als nichtleere Liste angegeben werden.');
 const seen=new Set();for(const u of t.practicalUnits){
  if(!u||typeof u!=='object'||Array.isArray(u)||typeof u.title!=='string'||!u.title.trim()||!['area1','area2'].includes(u.areaId))throw Error('Ungültige komplexe Prüfungsaufgabe oder Bereichszuordnung.');
  if(typeof u.reason!=='string'||!u.reason.trim())throw Error('Jede ausdrückliche Zuordnung einer Prüfungsaufgabe benötigt eine Begründung.');
  const title=u.title.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de');if(seen.has(title))throw Error('Komplexe Prüfungsaufgaben müssen unterschiedlich benannt und gesondert bewertet werden.');seen.add(title);
 }
}
function regulationTask(t){
 const issues=[];try{checkPracticalUnits(t);}catch(error){issues.push(error.message);}
 if(!regulationProfile(t)||t.kind!=='practical')return {units:[],issues};
 if(t.practicalUnits!==undefined){
  const units=Array.isArray(t.practicalUnits)&&t.practicalUnits.length?t.practicalUnits.map(u=>({title:typeof u?.title==='string'?u.title:t.title,areaId:['area1','area2'].includes(u?.areaId)?u.areaId:null,reason:typeof u?.reason==='string'?u.reason:'',explicit:true})):[{title:t.title,areaId:null,reason:'',explicit:true}];
  return {units,issues};
 }
 const ids=classify(t).ids,mapped=ids.map(id=>regulationCategory(t,id).areaId),areaId=mapped.length&&mapped.every(a=>a&&a===mapped[0])?mapped[0]:null;
 if(!areaId)issues.push('Bereich der komplexen Prüfungsaufgabe offen: anhand des konkreten Auftrags zuordnen und begründen.');
 return {units:[{title:t.title,areaId,reason:areaId?'Aus eindeutigem Aufgabenkopf oder bestätigter Kategorie abgeleitet.':'',explicit:false}],issues};
}
function regulationCoverage(e){
 const profile=regulationProfile(e);if(!profile)return null;
 const units=[],issues=[],families=new Set();let minutes=0,unknownMinutes=0;
 for(const [index,item] of (e.items||[]).entries()){
  const t=item.task,prefix='Aufgabe '+(index+1)+': ';
  if(!t||t.examType!==e.examType||t.specialty!==e.specialty||!regulationProfile(t)){issues.push(prefix+'gehört zu einem anderen Prüfungsbereich.');continue;}
  if(t.kind!=='practical'){issues.push(prefix+'ist keine praktische Prüfungsaufgabe.');continue;}
  if(t.familyId&&families.has(t.familyId))issues.push(prefix+'Aufgabenfamilie mehrfach ausgewählt.');if(t.familyId)families.add(t.familyId);
  const result=regulationTask(t);units.push(...result.units.map(u=>({...u,itemId:item.id,taskId:t.id})));issues.push(...result.issues.map(s=>prefix+s));
  if(!Number.isFinite(t.minutes)||t.minutes<0||t.timing?.method==='conflict'&&!(Number.isFinite(t.timing.manualTotalMinutes)&&t.timing.manualTotalMinutes===t.minutes))unknownMinutes++;else minutes+=t.minutes;
 }
 const total=units.length,areas=profile.areas.map(a=>({...a,actual:units.filter(u=>u.areaId===a.id).length,missing:Math.max(0,a.min-units.filter(u=>u.areaId===a.id).length)}));
 if(total!==profile.totalTasks)issues.push(`${total} von ${profile.totalTasks} komplexen Prüfungsaufgaben; genau fünf sind erforderlich.`);
 for(const a of areas)if(a.missing)issues.push(`${a.label}: ${a.actual} von mindestens ${a.min} komplexen Prüfungsaufgaben.`);
 if(unknownMinutes)issues.push(`${unknownMinutes} Zeitangabe(n) offen oder widersprüchlich; insgesamt höchstens 300 Minuten einschließlich Prüfungsgespräch.`);
 if(minutes>profile.maxMinutes)issues.push(`${minutes} Minuten überschreiten die höchstens 300 Minuten einschließlich Prüfungsgespräch.`);
 return {profile,total,areas,minutes,unknownMinutes,units,issues,complete:issues.length===0};
}
function regulationChecklist(context){
 const p=regulationProfile(context);if(!p)return [];
 return [
  {id:'conversation',label:'Prüfungsgespräch eingeplant',explanation:p.overallWork?'Das Gespräch bezieht sich auf alle fünf Aufgaben des Gesamtwerks; seine Zeit ist in den höchstens 300 Minuten enthalten.':'Jede der fünf Aufgaben wird im Prüfungsgespräch erläutert; die Gespräche sind in den höchstens 300 Minuten enthalten.',reference:p.section+' Abs. 2'},
  {id:'crossCutting',label:'Querschnittsinhalte berücksichtigt',explanation:p.crossCutting.join('; ')+'. Selbständiges Planen, Durchführen und Kontrollieren werden berücksichtigt.',reference:p.section+' Abs. 2 Nr. 1 und 2; § 3 Abs. 2'},
  {id:'preparation',label:'Vorbereitung und Ausbildungsschwerpunkte berücksichtigt',explanation:'Gelegenheit zum Kennenlernen der Maschinen, Geräte und technischen Einrichtungen vor der Prüfung; betriebliche Ausbildungsschwerpunkte angemessen berücksichtigen.',reference:p.section+' Abs. 2'},
  {id:'equalWeighting',label:'Fünf Aufgaben gleich gewichtet',explanation:'Jede komplexe Prüfungsaufgabe hat dasselbe Gewicht (je 20 % der praktischen Prüfung), auch bei verschiedenen Rohpunktzahlen oder mehreren Aufgaben in einem Dokument.',reference:p.section+' Abs. 6'},
  ...(p.overallWork?[{id:'overallWork',label:'Landschaftsgärtnerisches Gesamtwerk bestätigt',explanation:'Die fünf komplexen Aufgaben bilden ein zusammenhängendes landschaftsgärtnerisches Gesamtwerk.',reference:p.section+' Abs. 2'}]:[])
 ];
}
function regulationReviewKey(e){
 const raw=JSON.stringify({examType:e.examType,specialty:e.specialty,qualification:e.qualification,notes:e.notes,items:(e.items||[]).map(i=>i.task)},(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 // Content fingerprint, not a security signature. It prevents stale checkboxes
 // after any editor/import/API route changes the scope, task snapshots or notes.
 let first=2166136261,second=5381;for(let i=0;i<raw.length;i++){first=Math.imul(first^raw.charCodeAt(i),16777619);second=Math.imul(second,33)^raw.charCodeAt(i);}return (first>>>0).toString(16).padStart(8,'0')+(second>>>0).toString(16).padStart(8,'0');
}
function checkRegulationReview(e){
 if(e.regulationReview===undefined&&e.regulationReviewKey===undefined)return;
 const choices=regulationChecklist(e);if(!choices.length)throw Error('Bestätigungen zur Prüfungsverordnung sind nur für die Gärtner-Abschlussprüfung vorgesehen.');
 if(e.regulationReview!==undefined&&(!e.regulationReview||typeof e.regulationReview!=='object'||Array.isArray(e.regulationReview)||Object.entries(e.regulationReview).some(([id,value])=>!choices.some(c=>c.id===id)||typeof value!=='boolean')))throw Error('Ungültige Bestätigung zur Prüfungsverordnung.');
 if(e.regulationReviewKey!==undefined&&(typeof e.regulationReviewKey!=='string'||!/^[0-9a-f]{16}$/.test(e.regulationReviewKey)))throw Error('Ungültiger Stand der Bestätigung zur Prüfungsverordnung.');
}
function regulationPattern(type,specialty){const profile=regulationProfile({examType:type,specialty});return profile?{id:`pattern:${type}:${specialty}`,examType:type,specialty,status:'confirmed',version:1,categoryCatalog:'excel-ap-2026',ruleSet:regulationRuleSet,slots:[],note:`${profile.section} Abs. 2: fünf komplexe Aufgaben, Bereichsmindestzahlen und höchstens 300 Minuten einschließlich Prüfungsgespräch. Kategorien sind Beispiele; die fünfte Aufgabe ist flexibel.`}:null;}
function proposeRegulation(d,e){
 const current=regulationCoverage(e),used=new Set(e.items.map(i=>i.task.familyId)),counts=current.areas.map(a=>a.actual),initialTotal=current.total;
 if(initialTotal>=current.profile.totalTasks)return [];
 const candidates=scoped(d,e.examType,e.specialty).map(task=>({task,result:regulationTask(task),h:history(d,task)})).filter(c=>c.result.units.length&&!c.result.issues.length&&c.result.units.every(u=>u.areaId)&&!used.has(c.task.familyId)).map(c=>({...c,size:c.result.units.length,counts:current.areas.map(a=>c.result.units.filter(u=>u.areaId===a.id).length)})).sort((a,b)=>(a.h.sortDate||'9999').localeCompare(b.h.sortDate||'9999')||a.task.familyId.localeCompare(b.task.familyId)||a.task.id.localeCompare(b.task.id));
 let best=[],bestScore=-1,visits=0;
 function search(chosen,total){
  if(++visits>5000)return false;
  const score=counts.reduce((sum,n,i)=>sum+Math.min(n,current.areas[i].min)*100,0)+total;
  if(score>bestScore){bestScore=score;best=chosen.slice();}
  if(total===5&&counts.every((n,i)=>n>=current.areas[i].min))return true;
  const missing=counts.map((n,i)=>Math.max(0,current.areas[i].min-n));
  const fits=c=>!used.has(c.task.familyId)&&total+c.size<=5;
  const options=missing.map((n,i)=>({n,i,list:candidates.filter(c=>fits(c)&&c.counts[i]>0)})).filter(x=>x.n>0).sort((a,b)=>a.list.length-b.list.length);
  const next=options.find(x=>x.list.length);const choices=next?next.list:options.length?[]:candidates.filter(fits);
  for(const c of choices){used.add(c.task.familyId);c.counts.forEach((n,i)=>counts[i]+=n);chosen.push(c.task);if(search(chosen,total+c.size))return true;chosen.pop();c.counts.forEach((n,i)=>counts[i]-=n);used.delete(c.task.familyId);if(visits>5000)break;}return false;
 }
 search([],initialTotal);return best;
}

const workbookSource={sheet:'Aufgaben',version:'03.02.2020',workbook:'Notenberechnung Gärtner AP S 2026'};
// Separate source headings for the supplied Fachwerker papers, not the Gärtner
// workbook catalog. Harvest stays a distinct planning choice from plant work.
const fachwerkerSpecialties=Object.freeze(['Gemüsebau','Zierpflanzenbau']);
const fachwerkerCategories={
 'Gemüsebau':[{id:'soil',label:'Bodenbearbeitungsmaßnahmen'},{id:'plantwork',label:'Arbeiten an der Pflanze'},{id:'harvest',label:'Ernten und Aufbereitung'},{id:'propagation',label:'Vermehren von Pflanzen'}],
 'Zierpflanzenbau':[{id:'soil',label:'Bodenbearbeitungsmaßnahmen'},{id:'plantwork',label:'Arbeiten an der Pflanze'},{id:'machinery',label:'Geräte und Einsatz von Maschinen'},{id:'propagation',label:'Vermehren von Pflanzen'}]
};
function fachwerkerScope(t){return t?.examType==='FW_AP'?fachwerkerCategories[t.specialty]||null:null;}
function workbookScope(t){return ['AP','ZP'].includes(t?.examType)&&!/gartenbaufachwerk|\bGBF\b|\b17[1-7]\b/i.test(t.qualification||'')?workbookCategories[t.specialty]:null;}
for(const c of Object.values(workbookCategories).flat())if(!catalog.some(x=>x.id===c.id))catalog.push({id:c.id,label:c.label,re:/$^/});
function label(id,context){const legacy=['AP','ZP'].includes(context?.pattern?.examType)&&!context.pattern.categoryCatalog;return fachwerkerScope(context)?.find(c=>c.id===id)?.label||(!legacy&&workbookScope(context)?.find(c=>c.id===id)?.label)||catalog.find(c=>c.id===id)?.label||'Kategorie noch zuordnen';}
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
function classify(t,{legacy=false}={}){const official=legacy?null:workbookScope(t),fw=fachwerkerScope(t);const validIds=ids=>[...new Set(ids.map(id=>(t.examType==='ZP'&&official&&!official.some(c=>c.id===id)||t.examType==='FW_AP'&&!fw?.some(c=>c.id===id))?'unassigned':id))];if((t.planningCategories?.length||['excel-ap-2026','fw-sources-2026'].includes(t.planningCategoryCatalog))&&!(legacy&&t.planningCategoryCatalog==='excel-ap-2026')){const ids=validIds(t.planningCategories.filter(id=>applies(id,t)));return {ids:ids.length?ids:['unassigned'],evidence:t.planningCategoryEvidence||'Manuell zugeordnet',manual:true};}
 let evidence=heading(t);
 if(t.examType==='FW_AP'){
  const tests={soil:/bodenbearbeit|boden bearbeiten/i,plantwork:/arbeiten an (?:und mit )?der pflanze|beet bepflanzen|pflanzung durchführen/i,harvest:/ernte|ernten|aufbereitung/i,machinery:/einsatz von (?:maschinen|werkzeug|geräten)|geräte und einsatz/i,propagation:/vermehren von|vermehrung/i};
  let ids=(fw||[]).filter(c=>tests[c.id].test(evidence)).map(c=>c.id);if(ids.includes('harvest'))ids=ids.filter(id=>id!=='plantwork');
  return {ids:ids.length?ids:['unassigned'],evidence:evidence||'Kein eindeutiger Fachwerker-Aufgabenkopf',manual:false};
 }
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
// Explicit workbook assignments belong to the current catalog only. Stored legacy
// exam patterns keep their original heading-based interpretation.
function assignCategories(t,ids,evidence){const catalog=fachwerkerScope(t)?'fw-sources-2026':workbookScope(t)?'excel-ap-2026':undefined,same=t.planningCategoryCatalog===catalog&&Array.isArray(t.planningCategories)&&t.planningCategories.length===ids.length&&ids.every(id=>t.planningCategories.includes(id));if(!ids.length&&!catalog){delete t.planningCategories;delete t.planningCategoryEvidence;delete t.planningCategoryCatalog;return;}t.planningCategories=[...ids];if(!same||!t.planningCategoryEvidence)t.planningCategoryEvidence=evidence;if(catalog)t.planningCategoryCatalog=catalog;else delete t.planningCategoryCatalog;}
function categories(d,type,specialty,context={}){const scope={examType:type,specialty,...context},official=workbookScope(scope);if(type==='FW_AP')return (fachwerkerScope(scope)||[]).map(c=>({...c}));if(official)return official.map(c=>({...c}));const ids=new Set([...(archiveScopes[specialty]?.[type]||[]),...scoped(d,type,specialty,true).flatMap(t=>classify(t).ids)]);return catalog.filter(c=>ids.has(c.id)&&applies(c.id,scope)).map(c=>({...c,label:label(c.id,scope)}));}
function scoped(d,type,specialty,all=false){return d.tasks.filter(t=>t.examType===type&&t.specialty===specialty&&t.kind==='practical'&&(all||!t.supersededBy));}
function inferPattern(d,type,specialty){const tasks=scoped(d,type,specialty),ids=new Set(tasks.flatMap(t=>classify(t).ids));return {id:`pattern:${type}:${specialty}`,examType:type,specialty,status:'proposed',version:1,...(['AP','ZP'].includes(type)?{categoryCatalog:'excel-ap-2026'}:type==='FW_AP'?{categoryCatalog:'fw-sources-2026'}:{}),slots:catalog.filter(c=>ids.has(c.id)).map(c=>({categoryId:c.id,count:1})),note:'Aus vorhandenen Aufgabenköpfen abgeleitet. Anzahl und Pflichtkategorien fachlich bestätigen; kein Nachweis eines vollständigen Prüfungsjahres.'};}
function checkPattern(p){if(p?.ruleSet!==undefined){if(p.ruleSet!==regulationRuleSet||!regulationProfile(p)||p.categoryCatalog!=='excel-ap-2026'||!Number.isInteger(p.version)||p.version<1||!['proposed','confirmed'].includes(p.status)||!Array.isArray(p.slots)||p.slots.length)throw Error('Ungültiges Prüfungsmuster zur Gärtner-Prüfungsverordnung.');return p;}if(p?.categoryCatalog!==undefined&&p.categoryCatalog!==(p.examType==='FW_AP'?'fw-sources-2026':'excel-ap-2026'))throw Error('Unbekannter oder nicht zum Prüfungsbereich passender Kategorienstand.');if(p?.examType==='FW_AP'&&!fachwerkerScope(p))throw Error('Fachwerker-Prüfungsmuster ist nur für Gemüsebau und Zierpflanzenbau vorgesehen.');if(!p||!Number.isInteger(p.version)||p.version<1||!['AP','ZP','FW_AP'].includes(p.examType)||typeof p.specialty!=='string'||!['proposed','confirmed'].includes(p.status)||!Array.isArray(p.slots)||!p.slots.length)throw Error('Prüfungsmuster benötigt mindestens eine Kategorie.');const seen=new Set(),choices=p.examType==='FW_AP'?fachwerkerScope(p):catalog;for(const s of p.slots){if(!choices.some(c=>c.id===s.categoryId)||seen.has(s.categoryId)||!Number.isInteger(s.count)||s.count<1||s.count>10)throw Error('Ungültige Kategorie oder Anzahl im Prüfungsmuster.');seen.add(s.categoryId);}return p;}
function pattern(d,type,specialty){return d.patterns?.find(p=>p.examType===type&&p.specialty===specialty)||regulationPattern(type,specialty)||inferPattern(d,type,specialty);}
function history(d,t){const variants=scoped(d,t.examType,t.specialty,true).filter(v=>v.familyId===t.familyId),sourceIds=new Set(variants.flatMap(v=>v.sourceIds)),years=d.sources.filter(s=>sourceIds.has(s.id)&&Number.isInteger(s.year)&&s.year<=new Date().getFullYear()).map(s=>s.year),uses=d.uses.filter(u=>{const e=d.exams.find(e=>e.id===u.examId);return e?.examType===t.examType&&e?.specialty===t.specialty&&(u.familyIds.includes(t.familyId)||variants.some(v=>u.taskIds.includes(v.id)))&&u.date<=new Date().toISOString().slice(0,10);}).map(u=>u.date).sort();const confirmed=uses.at(-1)||null,sourceYear=years.length?Math.max(...years):null,year=Math.max(sourceYear||0,confirmed?Number(confirmed.slice(0,4)):0)||null;const sortDate=sourceYear&&(!confirmed||sourceYear>Number(confirmed.slice(0,4)))?sourceYear+'-12-31':confirmed;return {confirmed,sourceYear,year,sortDate,unknown:year===null};}
function rank(d,type,specialty,categoryId,excluded=[]){const skip=new Set(excluded);return scoped(d,type,specialty).filter(t=>!skip.has(t.familyId)&&classify(t).ids.includes(categoryId)).map(task=>({task,history:history(d,task)})).sort((a,b)=>(a.history.sortDate||'9999').localeCompare(b.history.sortDate||'9999')||a.task.familyId.localeCompare(b.task.familyId)||a.task.id.localeCompare(b.task.id));}
function patternClassify(t,p){return classify(t,{legacy:['AP','ZP'].includes(p?.examType)&&!p.categoryCatalog});}
function coverage(e){const regulation=regulationCoverage(e);if(regulation){if(e.pattern){try{checkPattern(e.pattern);}catch{regulation.issues.push('Prüfungsmuster ist ungültig.');}if(e.pattern.examType!==e.examType||e.pattern.specialty!==e.specialty)regulation.issues.push('Prüfungsmuster passt nicht zum Prüfungsbereich.');}return {...regulation,slots:[],complete:regulation.issues.length===0};}const issues=[],p=e.pattern;try{checkPattern(p);}catch{ return {complete:false,slots:[],issues:['Prüfungsmuster fehlt oder hat noch keine Kategorien.']};}if(p.examType!==e.examType||p.specialty!==e.specialty)issues.push('Prüfungsmuster passt nicht zum Prüfungsbereich.');if(p.status!=='confirmed')issues.push('Prüfungsmuster noch nicht bestätigt.');const families=new Set();for(const i of e.items){if(i.task.examType!==e.examType||i.task.specialty!==e.specialty)issues.push('Aufgabe gehört zu einem anderen Prüfungsbereich.');if(families.has(i.task.familyId))issues.push('Aufgabenfamilie mehrfach ausgewählt.');families.add(i.task.familyId);if(patternClassify(i.task,p).ids.some(id=>!p.slots.some(s=>s.categoryId===id)))issues.push('Aufgabe deckt eine Kategorie außerhalb des Musters ab.');if(patternClassify(i.task,p).ids.includes('unassigned'))issues.push('Aufgabe ohne bestätigbare Kategorie.');}
 const slots=p.slots.map(s=>({...s,actual:e.items.filter(i=>patternClassify(i.task,p).ids.includes(s.categoryId)).length}));for(const s of slots)if(s.actual!==s.count)issues.push(`${label(s.categoryId,e)}: ${s.actual} von ${s.count} vorgesehenen Aufgaben.`);return {complete:issues.length===0,slots,issues};}
function propose(d,e){
 if(regulationProfile(e)){if(e.pattern&&(e.pattern.examType!==e.examType||e.pattern.specialty!==e.specialty))throw Error('Prüfungsmuster passt nicht zum Prüfungsbereich.');return proposeRegulation(d,e);}
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

const api={regulationProfile,regulationCategory,regulationTask,regulationCoverage,regulationChecklist,regulationReviewKey,regulationPattern,checkPracticalUnits,checkRegulationReview,fachwerkerSpecialties,fachwerkerCategories,fachwerkerScope,assignCategories,workbookCategories,workbookSource,workbookScope,patternClassify,labels,catalog,categories,archiveScopes,label,heading,classify,scoped,inferPattern,pattern,checkPattern,history,rank,coverage,propose};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HortiPlanning=api;
})(globalThis);
