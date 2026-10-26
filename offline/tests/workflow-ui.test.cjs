const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
async function ui(prepare=()=>{}){
 let download;
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../demo.json')));
 data.workshops=[{id:'meeting',title:'Testtermin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];
 prepare(data);
 const elements=new Map(),listeners={};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input','#ready-download'])elements.set(id,{innerHTML:'',textContent:'',showModal(){this.open=true;},close(){this.open=false;},addEventListener(){},classList:{add(){},remove(){}}});
 elements.set('#seed',{textContent:JSON.stringify(data)});elements.set('meta[name=hortiexam-storage]',{content:'memory'});
 const sandbox={HortiDocx:require('../src/docx.js'),JSZip:require('../vendor/jszip.min.js'),Blob,URL:{createObjectURL:b=>{download=b;return 'blob:test';},revokeObjectURL(){}},HortiSourceLayout:require('../src/source-layout.js'),HortiIcons:require('../src/icons.js'),HortiCatalog:require('../src/catalog.js'),HortiHelp:require('../src/help.js'),HortiPaper:require('../src/paper.js'),HortiPlanning:require('../src/planning.js'),HortiCore:require('../src/core.js'),HortiPrint:require('../src/print.js'),console,setTimeout,clearTimeout,
 window:{addEventListener(){}},document:{querySelector:q=>elements.get(q)||null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn}};
 await vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),sandbox);
 return {html:()=>elements.get('#app').innerHTML,dialog:()=>elements.get('#dialog'),data,download:()=>download,click:async(kind,value,id)=>listeners.click({target:{closest:selector=>selector===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}})};
}
test('existing meeting remains usable after coordinator browses the unscoped task archive',async()=>{
 const app=await ui();await app.click('route','scope');await app.click('action','choose-type','ZP');await app.click('route','dashboard');
 assert.ok(app.html().includes('Arbeitsgruppen für 2027'));assert.ok(!app.html().includes('Hier beginnen'));
 await app.click('route','groups');assert.ok(app.html().includes('Arbeitsbereich öffnen'));
});
test('global source archive shows the existing documents on first entry and after task browsing',async()=>{
 const app=await ui();await app.click('route','import');assert.ok(app.html().includes(`${app.data.sources.length} Dokumente`));
 for(const source of app.data.sources)assert.ok(app.html().includes(source.name));
 await app.click('route','scope');await app.click('action','choose-type','AP');await app.click('action','choose-specialty','Baumschule');await app.click('route','import');
 assert.ok(app.html().includes(`${app.data.sources.length} Dokumente`));
});
test('coordinator can open the full question catalog directly and reach readable help',async()=>{const app=await ui();await app.click('route','catalog');assert.ok(app.html().includes('Aufgabenbank'));assert.ok(app.html().includes('bank-specialty'));assert.ok(app.html().includes('bank-export'));assert.ok(app.html().includes('bank-query'));const before=app.html();await app.click('route','help');assert.equal(app.html(),before);assert.equal(app.dialog().open,true);assert.ok(app.dialog().innerHTML.includes('Wo liegen die Daten'));assert.ok(!/<details[^>]*\sopen(?:[\s>])/.test(app.dialog().innerHTML));await app.click('action','close');assert.equal(app.dialog().open,false);assert.equal(app.html(),before);});

test('coordinator download contains real candidate and solution Word files plus print HTML',async()=>{const C=require('../src/core.js'),Zip=require('../vendor/jszip.min.js');const app=await ui(d=>{const e=C.newExam({specialty:d.tasks[0].specialty,examType:d.tasks[0].examType});C.addItem(e,d.tasks[0]);d.exams.push(e);});await app.click('action','select-exam',app.data.exams[0].id);await app.click('action','export-exam');assert.ok(app.download(),'export offers a downloadable ZIP');const zip=await Zip.loadAsync(await app.download().arrayBuffer());for(const name of ['01_Teilnehmerfassung.docx','02_Loesung_und_Bewertung.docx']){assert.ok(zip.file(name),name);const doc=await Zip.loadAsync(await zip.file(name).async('uint8array'));assert.ok(doc.file('word/document.xml'));}assert.ok(zip.file('01_Teilnehmerfassung.html'));assert.ok(zip.file('02_Loesung_und_Bewertung.html'));assert.match(app.dialog().innerHTML,/Word/);});
