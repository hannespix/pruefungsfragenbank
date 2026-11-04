'use strict';
// Baukasten: building-block board above the exam sheet and drag & drop onto its slots.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'src'),r=f=>require(path.join(SRC,f));
const C=r('core.js');

async function ui(){
 const data=C.validate(JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json'),'utf8')));
 const heads=['Durchführen von Arbeiten an der Pflanze','Einsatz von Werkzeug und Geräten','Vermehren von Pflanzen'];let n=0;
 for(const t of data.tasks)if(t.examType==='ZP')t.text='Aufgabe: '+heads[n++%heads.length]+'\nHier: Synthetisches Beispiel\n'+t.text;
 data.workshops=[{id:'meeting',title:'Termin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];
 const stubs=new Map(),listeners={},mk=id=>{const el={id,value:'',innerHTML:'',textContent:'',open:false,dataset:{},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},classList:{s:new Set(),add(...x){x.forEach(v=>this.s.add(v));},remove(...x){x.forEach(v=>this.s.delete(v));},contains(x){return this.s.has(x);}}};stubs.set(id,el);return el;};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input'])mk(id);
 stubs.set('#seed',{textContent:JSON.stringify(data)});stubs.set('meta[name=hortiexam-storage]',{content:'memory'});
 const sandbox={HortiHistory:r('history.js'),HortiAdvisor:r('advisor.js'),HortiPointsPlan:r('points-plan.js'),HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:r('timing-plan.js'),HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:require(path.join(ROOT,'vendor/jszip.min.js')),Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:r('planning.js'),HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
  window:{addEventListener(){}},document:{querySelector:q=>stubs.get(q)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f}};
 await vm.runInNewContext(fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace('await initStorage();','globalThis.testUI={getDb:()=>db};await initStorage();'),sandbox);
 const click=(kind,value,id)=>listeners.click({target:{closest:s=>s===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}});
 const u={sandbox,listeners,click,db:()=>sandbox.testUI.getDb(),html:()=>stubs.get('#app').innerHTML,toast:()=>stubs.get('#toast').textContent};
 await click('action','open-group','Baumschule');await click('action','track-new','ZP');await click('action','suggest-themes');await click('action','workflow-step','2');
 return u;
}
const drop=(u,payload,dataset)=>u.listeners.drop({target:{closest:()=>({dataset,classList:{add(){},remove(){}}})},preventDefault(){},dataTransfer:{getData:()=>payload}});

test('the exam shows a Baukasten with one open slot per selected theme',async()=>{
 const u=await ui(),h=u.html(),slots=(h.match(/class="board-slot"/g)||[]).length;
 assert.match(h,/class="exam-board"/);assert.equal(slots,3);assert.match(h,/0 von 3 Plätzen belegt/);
 assert.match(h,/data-drop-slot="plantwork"/);assert.match(h,/class="paper-source-task[^"]*is-draggable/);assert.match(h,/style="--cat-h:\d+"/);
});

test('dropping a task card onto a slot places it as a building block',async()=>{
 const u=await ui(),e=u.db().exams.at(-1),t=u.db().tasks.find(x=>x.examType==='ZP'&&x.text.includes('an der Pflanze'));
 drop(u,'task:'+t.id,{dropSlot:'plantwork'});
 assert.equal(u.db().exams.find(x=>x.id===e.id).items.length,1,u.toast());
 const h=u.html();assert.match(h,/class="board-block just-added"/);assert.match(h,/1 von 3 Plätzen belegt/);assert.equal((h.match(/class="board-slot"/g)||[]).length,2);
 // An exam item dropped on an empty slot is not moved.
 const before=u.db().exams.find(x=>x.id===e.id).items.map(i=>i.id);drop(u,'item:'+before[0],{dropSlot:'machinery'});
 assert.deepEqual(u.db().exams.find(x=>x.id===e.id).items.map(i=>i.id),before);
});

test('tapping an open slot filters the task list to that theme',async()=>{
 const u=await ui();await u.click('action','board-slot','propagation');
 assert.match(u.toast(),/Vermehren von Pflanzen/);assert.match(u.html(),/class="paper-category selected"[^>]*data-paper-category="propagation"/);
});

test('a regulation violation appears as a visible card with its fix',async()=>{
 const u=await ui(),t=u.db().tasks.find(x=>x.examType==='ZP'&&x.text.includes('an der Pflanze'));await u.click('action','add',t.id);
 const e=u.db().exams.at(-1);e.items[0].task.minutes=500;await u.click('action','paper-category','');
 const h=u.html();assert.match(h,/class="rule-board"/);assert.match(h,/Zeitrahmen überschritten/);
 assert.match(h,/<div class="rule-card rule-violation"[\s\S]*?data-action="timing-plan"/);assert.match(h,/1 Verstoß/);
});
