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
 // These tests cover the classic editor, which stays switchable for a transition period.
 const sandbox={localStorage:{getItem:k=>k==='hortiexam-editor'?'klassisch':null,setItem(){},removeItem(){}},HortiHistory:r('history.js'),HortiAdvisor:r('advisor.js'),HortiPointsPlan:r('points-plan.js'),HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:r('timing-plan.js'),HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:require(path.join(ROOT,'vendor/jszip.min.js')),Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:r('planning.js'),HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
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

test('full-screen focus gives the sheet the room and the Baukasten folds into one row',async()=>{
 const u=await ui();assert.doesNotMatch(u.html(),/class="shell[^"]*sheet-focus/);assert.match(u.html(),/class="exam-board"/);
 await u.click('action','sheet-focus');let h=u.html();
 assert.match(h,/class="shell is-paper sheet-focus /);assert.match(h,/Vollbild beenden/);assert.match(h,/class="exam-board is-compact"/);assert.match(h,/data-action="library-toggle"/);assert.match(h,/class="small focus-hints/);
 await u.click('action','library-toggle');assert.match(u.html(),/sheet-focus library-hidden/);
 await u.click("action","sheet-focus");h=u.html();assert.doesNotMatch(h,/class="shell[^"]*sheet-focus/);assert.match(h,/>Vollbild</);
 await u.click('action','board-toggle');assert.match(u.html(),/class="exam-board is-compact"/);assert.match(u.html(),/aria-expanded="false"/);
});

// ---- Drag & drop everywhere: precise positions, dock targets, replace by drag, sheet grips ----
// Stub drop target with geometry: sheets split at half height, Baukasten blocks at half width.
const target=(dataset,{block=false,cls=[]}={})=>({dataset,getBoundingClientRect:()=>({left:0,top:0,right:200,bottom:100,width:200,height:100}),matches:s=>block&&s==='[data-board-item]',classList:{contains:c=>cls.includes(c),add(){},remove(){},toggle(){}}});
const dropAt=(u,payload,el,x=100,y=10)=>u.listeners.drop({target:{closest:()=>el},clientX:x,clientY:y,preventDefault(){},dataTransfer:{getData:()=>payload}});
function themedTasks(u){
 const d=u.db(),base=d.tasks.find(t=>t.id==='demo-task-0');
 const mk=(id,head)=>{const t=structuredClone(base);t.id=id;t.familyId='fam-'+id;t.title=id;t.text='Aufgabe: '+head+'\nHier: Synthetisches Beispiel\nZählen Sie die Pflanzen.';d.tasks.push(t);return t;};
 return {plant:mk('t-plant','Durchführen von Arbeiten an der Pflanze'),tool:mk('t-tool','Einsatz von Werkzeug und Geräten'),prop:mk('t-prop','Vermehren von Pflanzen'),plant2:mk('t-plant2','Durchführen von Arbeiten an der Pflanze')};
}
const origins=u=>u.db().exams.at(-1).items.map(i=>i.originTaskId);

test('drop positions: lower half inserts after, cover goes first, blocks split left/right, dock end and remove',async()=>{
 const u=await ui(),t=themedTasks(u);
 for(const x of [t.plant,t.tool,t.prop])dropAt(u,'task:'+x.id,target({dropEnd:''}));
 assert.deepEqual(origins(u),['t-plant','t-tool','t-prop'],u.toast());
 const items=()=>u.db().exams.at(-1).items,id=o=>items().find(i=>i.originTaskId===o).id;
 dropAt(u,'item:'+id('t-prop'),target({paperBefore:items()[0].id}),100,80);
 assert.deepEqual(origins(u),['t-plant','t-prop','t-tool'],'lower half of the first sheet = after it');
 dropAt(u,'item:'+id('t-tool'),target({paperBefore:items()[0].id}),100,10);
 assert.deepEqual(origins(u),['t-tool','t-plant','t-prop'],'upper half = before it');
 dropAt(u,'item:'+id('t-prop'),target({paperBefore:items()[0].id},{cls:['paper-cover']}),100,90);
 assert.deepEqual(origins(u),['t-prop','t-tool','t-plant'],'the cover always means first');
 dropAt(u,'item:'+id('t-prop'),target({dropItem:id('t-tool')},{block:true}),150,10);
 assert.deepEqual(origins(u),['t-tool','t-prop','t-plant'],'right half of a block = after it');
 const board=[...u.html().matchAll(/data-board-item="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(board,items().map(i=>i.id),'the Baukasten follows the order on the sheet');
 dropAt(u,'item:'+id('t-tool'),target({dropEnd:''}));
 assert.deepEqual(origins(u),['t-prop','t-plant','t-tool'],'dock "Ans Ende"');
 dropAt(u,'item:'+id('t-plant'),target({dropRemove:''}));
 assert.deepEqual(origins(u),['t-prop','t-tool']);assert.match(u.toast(),/entfernt.*Strg\+Z/);
 dropAt(u,'task:t-plant',target({dropRemove:''}));
 assert.deepEqual(origins(u),['t-prop','t-tool'],'a library card on "remove" changes nothing');
});

test('dragging another task of an occupied theme replaces it after asking; the same task is refused',async()=>{
 const u=await ui(),t=themedTasks(u);
 dropAt(u,'task:'+t.plant.id,target({dropSlot:'plantwork'}));assert.deepEqual(origins(u),['t-plant']);
 await u.click('action','paper-category','');
 assert.match(u.html(),/class="paper-source-task[^"]*is-draggable"[^>]*draggable="true" data-drag-task="t-plant2"/,'occupied theme stays draggable');
 assert.doesNotMatch(u.html(),/draggable="true" data-drag-task="t-plant"/,'the task already in the exam is not draggable');
 assert.match(u.html(),/class="sheet-grip" draggable="true" data-drag-item="/,'sheets carry a grip');
 u.sandbox.confirm=()=>false;dropAt(u,'task:'+t.plant2.id,target({dropEnd:''}));
 assert.deepEqual(origins(u),['t-plant'],'declined replacement keeps the exam');
 u.sandbox.confirm=()=>true;dropAt(u,'task:'+t.plant2.id,target({paperBefore:u.db().exams.at(-1).items[0].id}));
 assert.deepEqual(origins(u),['t-plant2']);assert.match(u.toast(),/ersetzt/);
 dropAt(u,'task:'+t.plant2.id,target({dropEnd:''}));
 assert.deepEqual(origins(u),['t-plant2']);assert.match(u.toast(),/bereits in der Prüfung/);
});

test('a drop outside every target during a drag is swallowed and never pastes the payload',async()=>{
 const u=await ui(),data={};let prevented=false;
 u.listeners.dragstart({target:{closest:()=>({dataset:{dragTask:'demo-task-0'},matches:()=>false,classList:{add(){},remove(){}}})},dataTransfer:{setData:(k,v)=>data[k]=v}});
 assert.equal(data['text/plain'],'task:demo-task-0');
 u.listeners.drop({target:{closest:()=>null},preventDefault(){prevented=true;},dataTransfer:{getData:()=>data['text/plain']}});
 assert.equal(prevented,true,'the browser must not insert the payload as text');assert.equal(u.db().exams.at(-1).items.length,0);
});
