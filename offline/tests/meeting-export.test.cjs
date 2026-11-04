'use strict';
// All exams of a preparation meeting in one ZIP: one folder per specialty, one per exam, plus overviews.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'src'),r=f=>require(path.join(SRC,f));
const C=r('core.js'),L=r('planning.js'),Zip=require(path.join(ROOT,'vendor/jszip.min.js'));

async function ui(){
 const data=C.validate(JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json'),'utf8')));
 for(const t of data.tasks)if(t.examType==='ZP')t.text='Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Synthetisches Beispiel\n'+t.text;
 data.workshops=[{id:'meeting',title:'Frühjahrstermin',examYear:2027,meetingDate:'',specialties:['Baumschule','Garten- und Landschaftsbau']}];
 const mkExam=(title,taskId)=>{const t=data.tasks.find(x=>x.id===taskId),e=C.newExam({specialty:t.specialty,examType:'ZP',examYear:2027,workshopId:'meeting',pattern:L.pattern(data,'ZP',t.specialty)});e.title=title;L.assignCategories(t,['plantwork'],'Synthetisch bestätigte Einzelaufgabe');C.addItem(e,t);data.exams.push(e);return e;};
 mkExam('ZP Baumschule – Gruppe Nord','demo-task-0');mkExam('ZP Garten- und Landschaftsbau','demo-task-2');
 const empty=C.newExam({specialty:'Baumschule',examType:'ZP',examYear:2027,workshopId:'meeting',pattern:L.pattern(data,'ZP','Baumschule')});empty.title='Leerer Entwurf';data.exams.push(empty);
 C.validate(data);
 let download=null;const stubs=new Map(),listeners={},mk=id=>{const el={id,value:'',innerHTML:'',textContent:'',open:false,dataset:{},addEventListener(){},removeEventListener(){},showModal(){this.open=true;},close(){this.open=false;},classList:{s:new Set(),add(...x){x.forEach(v=>this.s.add(v));},remove(...x){x.forEach(v=>this.s.delete(v));},contains(x){return this.s.has(x);}}};stubs.set(id,el);return el;};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input','#ready-download'])mk(id);
 stubs.set('#seed',{textContent:JSON.stringify(data)});stubs.set('meta[name=hortiexam-storage]',{content:'memory'});
 const sandbox={HortiHistory:r('history.js'),HortiAdvisor:r('advisor.js'),HortiPointsPlan:r('points-plan.js'),HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:r('timing-plan.js'),HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:Zip,Blob,URL:{createObjectURL:b=>{download=b;return 'blob:test';},revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:L,HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
  window:{addEventListener(){}},document:{querySelector:q=>stubs.get(q)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f}};
 await vm.runInNewContext(fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace('await initStorage();','globalThis.testUI={getDb:()=>db};await initStorage();'),sandbox);
 const click=(kind,value,id)=>listeners.click({target:{closest:s=>s===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}});
 await click('route','results');
 return {click,db:()=>sandbox.testUI.getDb(),html:()=>stubs.get('#app').innerHTML,dialog:()=>stubs.get('#dialog').innerHTML,toast:()=>stubs.get('#toast').textContent,download:()=>download};
}
const names=zip=>Object.keys(zip.files).filter(n=>!zip.files[n].dir);

test('the coordinating body exports all exams of a meeting in one ZIP, one folder per specialty and exam',async()=>{
 const u=await ui();
 assert.match(u.html(),/data-action="export-meeting" data-id="meeting"/,'button on "Prüfungen & Ergebnisse"');
 await u.click('action','export-meeting','meeting');
 assert.ok(u.download(),u.toast());assert.match(u.dialog(),/2 Prüfungen aus 2 Fachrichtungen/);
 const zip=await Zip.loadAsync(await u.download().arrayBuffer()),files=names(zip);
 const root='Fruehjahrstermin 2027/';
 for(const f of ['00_Uebersicht.html','LESEN.txt','Baumschule/00_Materialuebersicht.html','Garten- und Landschaftsbau/00_Materialuebersicht.html'])assert.ok(files.includes(root+f),f+' in '+files.join(', '));
 for(const specialty of ['Baumschule','Garten- und Landschaftsbau']){
  const dir=files.find(f=>f.startsWith(root+specialty+'/01_Zwischenpruefung ')&&f.endsWith('/01_Teilnehmerfassung.docx'));assert.ok(dir,specialty+' exam folder');
  const base=dir.slice(0,-'01_Teilnehmerfassung.docx'.length);
  for(const f of ['00_Paketuebersicht.html','01_Teilnehmerfassung.html','02_Loesung_und_Bewertung.docx','02_Loesung_und_Bewertung.html','03_Materialliste.docx','03_Materialliste.html','04_Interne_Bemerkungen.docx','05_Zeitplan.docx','05_Zeitplan.html'])assert.ok(files.includes(base+f),base+f);
  const word=await Zip.loadAsync(await zip.file(dir).async('uint8array'));assert.ok(word.file('word/document.xml'),'real Word file');
 }
 assert.ok(files.every(f=>!/[äöüÄÖÜß–]/.test(f)),'folder names without umlauts or special dashes: '+files.filter(f=>/[äöüÄÖÜß–]/.test(f)).join(', '));
 const index=await zip.file(root+'00_Uebersicht.html').async('string');
 assert.match(index,/ZP Baumschule – Gruppe Nord/);assert.match(index,/ZP Garten- und Landschaftsbau/);assert.match(index,/Ohne Aufgaben – nicht enthalten[\s\S]*Leerer Entwurf/);
 assert.match(index,/href="Baumschule\/01_Zwischenpruefung%20[^"]*\/01_Teilnehmerfassung\.docx"/,'links into the folders');
 const materials=await zip.file(root+'Baumschule/00_Materialuebersicht.html').async('string');assert.match(materials,/Materialübersicht · Baumschule/);assert.match(materials,/ZP Baumschule – Gruppe Nord/);
 assert.match(await zip.file(root+'LESEN.txt').async('string'),/00_Uebersicht\.html[\s\S]*01_Teilnehmerfassung\.docx/);
});

test('an exam that cannot be built is listed with its reason; the others are still exported',async()=>{
 const u=await ui(),broken=u.db().exams.find(e=>e.specialty==='Garten- und Landschaftsbau');broken.items[0].task.materials={status:'kaputt'};
 await u.click('action','export-meeting','meeting');
 const zip=await Zip.loadAsync(await u.download().arrayBuffer()),files=names(zip),root='Fruehjahrstermin 2027/';
 assert.ok(files.some(f=>f.startsWith(root+'Baumschule/01_')),'Baumschule exported');
 assert.ok(!files.some(f=>f.startsWith(root+'Garten- und Landschaftsbau/')),'no half folder for the broken exam');
 assert.match(await zip.file(root+'00_Uebersicht.html').async('string'),/Nicht ausgegeben[\s\S]*ZP Garten- und Landschaftsbau/);
 assert.match(u.dialog(),/1 Prüfung aus 1 Fachrichtung[\s\S]*1 konnte nicht ausgegeben werden/);
});

test('a meeting without any exam with tasks says so instead of downloading an empty file',async()=>{
 const u=await ui();for(const e of u.db().exams)if(e.workshopId==='meeting'){e.items=[];e.oralItem=null;}
 await u.click('action','export-meeting','meeting');
 assert.equal(u.download(),null);assert.match(u.toast(),/noch keine Prüfung mit Aufgaben/);
});
