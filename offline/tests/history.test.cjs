'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'src'),r=f=>require(path.join(SRC,f));
const C=r('core.js'),Hs=r('history.js');
const demo=()=>C.validate(JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json'),'utf8')));

test('undo and redo restore earlier project states step by step',()=>{
 const h=Hs.create();let db=demo();h.reset(db);
 const original=db.tasks[0].title;db.tasks[0].title='Geändert';assert.equal(h.record(db),true);
 db.tasks.splice(1,1);h.record(db);
 assert.equal(h.canUndo(),true);assert.equal(h.canRedo(),false);
 db=h.undo(db);assert.equal(db.tasks.length,demo().tasks.length);assert.equal(db.tasks[0].title,'Geändert');
 db=h.undo(db);assert.equal(db.tasks[0].title,original);assert.equal(h.canUndo(),false);
 db=h.redo(db);assert.equal(db.tasks[0].title,'Geändert');
 db=h.go(1,db);assert.equal(db.tasks.length,demo().tasks.length-1);assert.equal(h.canRedo(),false);
});

test('recording an identical state adds no step and a new edit clears redo',()=>{
 const h=Hs.create();let db=demo();h.reset(db);assert.equal(h.record(db),false);
 db.tasks[0].title='A';h.record(db);db=h.undo(db);assert.equal(h.canRedo(),true);
 db.tasks[0].title='B';h.record(db);assert.equal(h.canRedo(),false);assert.equal(h.entries().filter(e=>e.state==='undo').length,1);
});

test('labels describe the change in plain German',()=>{
 const h=Hs.create();const db=demo();db.exams=[];h.reset(db);
 const e=C.newExam({examType:'ZP',specialty:'Baumschule'});e.title='Probe';db.exams.push(e);h.record(db);
 const t=db.tasks.find(x=>x.examType==='ZP');e.items.push({id:'item-1',originTaskId:t.id,task:C.clone(t)});h.record(db);
 e.items=[];h.record(db);
 assert.deepEqual(h.entries().filter(x=>x.state==='undo').map(x=>x.label),['Aufgabe „'+db.tasks.find(t=>t.examType==='ZP').title+'“ aus der Prüfung entfernt','Aufgabe „'+db.tasks.find(t=>t.examType==='ZP').title+'“ zur Prüfung hinzugefügt','Prüfung „Probe“ angelegt']);
});

test('attachment data survives undo without being copied into every snapshot',()=>{
 const h=Hs.create();let db=demo();db.assets=[{id:'asset-x',name:'Plan.png',mime:'image/png',data:'iVBORw0KGgo='}];h.reset(db);
 db.assets=[];h.record(db);db=h.undo(db);assert.equal(db.assets[0].data,'iVBORw0KGgo=');
});

test('history keeps at most the configured number of steps',()=>{
 const h=Hs.create({limit:3});const db=demo();h.reset(db);
 for(let i=0;i<6;i++){db.tasks[0].title='T'+i;h.record(db);}
 assert.equal(h.entries().filter(e=>e.state==='undo').length,3);
});

async function ui(){
 const data=demo();for(const t of data.tasks)if(t.examType==='ZP')t.text='Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Synthetisches Beispiel\n'+t.text;data.workshops=[{id:'meeting',title:'Termin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];
 const stubs=new Map(),listeners={},mk=id=>{const el={id,value:'',innerHTML:'',textContent:'',open:false,dataset:{},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},classList:{s:new Set(),add(...x){x.forEach(v=>this.s.add(v));},remove(...x){x.forEach(v=>this.s.delete(v));},contains(x){return this.s.has(x);}}};stubs.set(id,el);return el;};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input'])mk(id);
 stubs.set('#seed',{textContent:JSON.stringify(data)});stubs.set('meta[name=hortiexam-storage]',{content:'memory'});
 const sandbox={HortiHistory:Hs,HortiPointsPlan:r('points-plan.js'),HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:r('timing-plan.js'),HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:require(path.join(ROOT,'vendor/jszip.min.js')),Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:r('planning.js'),HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
  window:{addEventListener(){}},document:{querySelector:q=>stubs.get(q)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f}};
 await vm.runInNewContext(fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace('await initStorage();','globalThis.testUI={getDb:()=>db};await initStorage();'),sandbox);
 const click=(kind,value,id)=>listeners.click({target:{closest:s=>s===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}});
 return {sandbox,stubs,listeners,click,db:()=>sandbox.testUI.getDb(),html:()=>stubs.get('#app').innerHTML,toast:()=>stubs.get('#toast').textContent};
}

test('editor shows undo/redo controls and the buttons and Ctrl+Z restore the exam',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');await u.click('action','suggest-themes');await u.click('action','workflow-step','2');
 const e=u.db().exams.at(-1),t=u.db().tasks.find(x=>x.examType==='ZP'&&x.specialty==='Baumschule');assert.ok(e&&t);
 assert.match(u.html(),/data-action="history-undo"/);
 await u.click('action','add',t.id);const added=u.db().exams.find(x=>x.id===e.id).items.length;assert.ok(added>0,u.toast());
 await u.click('action','history-undo');assert.equal(u.db().exams.find(x=>x.id===e.id).items.length,added-1);assert.match(u.toast(),/Rückgängig gemacht/);
 await u.click('action','history-redo');assert.equal(u.db().exams.find(x=>x.id===e.id).items.length,added);
 let prevented=false;u.listeners.keydown({key:'z',ctrlKey:true,shiftKey:false,target:{closest:()=>null},preventDefault(){prevented=true;}});
 assert.ok(prevented);assert.equal(u.db().exams.find(x=>x.id===e.id).items.length,added-1);
 // Inside a text field the browser's own undo applies.
 prevented=false;u.listeners.keydown({key:'z',ctrlKey:true,target:{closest:()=>({})},preventDefault(){prevented=true;}});assert.equal(prevented,false);
});
