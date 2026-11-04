'use strict';
// Task editor in steps, the unsaved-changes guard and keyboard moves of building blocks.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'src'),r=f=>require(path.join(SRC,f));
const C=r('core.js');

async function ui(){
 const data=C.validate(JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json'),'utf8')));
 const heads=['Durchführen von Arbeiten an der Pflanze','Einsatz von Werkzeug und Geräten','Vermehren von Pflanzen'];let n=0;
 for(const t of data.tasks)if(t.examType==='ZP')t.text='Aufgabe: '+heads[n++%heads.length]+'\nHier: Synthetisches Beispiel\n'+t.text;
 const extra=JSON.parse(JSON.stringify(data.tasks.find(t=>t.id==='demo-task-1')));Object.assign(extra,{id:'kbd-task',familyId:'kbd-family',title:'Werkzeug pflegen',text:'Aufgabe: Einsatz von Werkzeug und Geräten\nHier: Synthetisches Beispiel\nWerkzeug pflegen.'});data.tasks.push(extra);data.families.push({id:'kbd-family',title:'Werkzeug pflegen',reviewStatus:'review'});
 data.workshops=[{id:'meeting',title:'Termin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];
 const stubs=new Map(),listeners={},fields=[];
 const mk=id=>{const el={id,value:'',innerHTML:'',textContent:'',open:false,dataset:{},handlers:{},children:[],addEventListener(n,f){(this.handlers[n]??=[]).push(f);},showModal(){this.open=true;},close(){this.open=false;},append(c){this.children.push(c);c.parent=this;},querySelector(sel){return sel==='.discard-guard'?this.children.find(c=>c.className==='discard-guard')||null:null;},classList:{s:new Set(),add(...x){x.forEach(v=>this.s.add(v));},remove(...x){x.forEach(v=>this.s.delete(v));},contains(x){return this.s.has(x);}}};stubs.set(id,el);return el;};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input'])mk(id);
 stubs.set('#seed',{textContent:JSON.stringify(data)});stubs.set('meta[name=hortiexam-storage]',{content:'memory'});
 const dialog=stubs.get('#dialog');
 const formStubs=new Map(),querySelector=q=>{if(stubs.has(q))return stubs.get(q);if(/^#task-|^\[data-(criterion|asset|template)/.test(q)){if(!formStubs.has(q))formStubs.set(q,{value:'',checked:false,disabled:false,addEventListener(){}});return formStubs.get(q);}if(q==='#dialog [data-task-form]')return dialog.innerHTML.includes('data-task-form')?{}:null;if(q==='#dialog .discard-guard')return dialog.querySelector('.discard-guard');return null;};
 const querySelectorAll=q=>q==='#dialog input,#dialog textarea,#dialog select'?fields:[];
 const createElement=()=>({className:'',innerHTML:'',setAttribute(){},querySelector:()=>({focus(){}}),remove(){const i=this.parent?.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1);}});
 const sandbox={HortiHistory:r('history.js'),HortiAdvisor:r('advisor.js'),HortiPointsPlan:r('points-plan.js'),HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:r('timing-plan.js'),HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:require(path.join(ROOT,'vendor/jszip.min.js')),Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:r('planning.js'),HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
  window:{addEventListener(){}},document:{querySelector,querySelectorAll,createElement,addEventListener:(n,f)=>listeners[n]=f}};
 await vm.runInNewContext(fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace('await initStorage();','globalThis.testUI={getDb:()=>db};await initStorage();'),sandbox);
 const click=(kind,value,id)=>listeners.click({target:{closest:s=>s===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}});
 await click('action','open-group','Baumschule');await click('action','track-new','ZP');await click('action','suggest-themes');await click('action','workflow-step','2');
 const form=(q,value)=>{querySelector(q).value=value;};
 return {dialog,fields,form,listeners,click,db:()=>sandbox.testUI.getDb(),toast:()=>stubs.get('#toast').textContent};
}

test('the task editor is split into five steps and keeps the chosen step when it re-renders',async()=>{
 const u=await ui();await u.click('action','new-task');const h=u.dialog.innerHTML;
 assert.equal((h.match(/data-task-step="\d"/g)||[]).length,5);assert.match(h,/class="task-step is-active" data-task-step="1"/);
 assert.match(h,/data-action="task-step-next"/);assert.match(h,/<details class="task-topic-options task-context-options"><summary>Fachrichtung, Prüfungsart &amp; Bestandteil|<details class="task-topic-options task-context-options"><summary>Fachrichtung, Prüfungsart & Bestandteil/);
 for(const id of ['task-title','task-text','task-points','task-minutes','task-solution','task-review','task-reviewer','task-flags'])assert.match(h,new RegExp('id="'+id+'"'),id);
 for(const [q,v] of [['#task-fr','Baumschule'],['#task-type','ZP'],['#task-kind','practical'],['#task-title','Neue Aufgabe'],['#task-text','Text']])u.form(q,v);
 await u.click('action','task-step','2');await u.click('action','add-criterion');
 assert.match(u.dialog.innerHTML,/class="task-step is-active" data-task-step="2"/);
});

test('closing a changed task asks first; unchanged tasks close directly',async()=>{
 const u=await ui();u.fields.push({id:'task-title',value:''});await u.click('action','new-task');
 await u.click('action','close');assert.equal(u.dialog.open,false,'unchanged task closes');
 await u.click('action','new-task');u.fields[0].value='Neue Aufgabe';
 await u.click('action','close');assert.equal(u.dialog.open,true);assert.ok(u.dialog.querySelector('.discard-guard'),'guard shown');
 await u.click('action','keep-editing');assert.equal(u.dialog.querySelector('.discard-guard'),null);assert.equal(u.dialog.open,true);
 let prevented=false;for(const f of u.dialog.handlers.cancel||[])f({preventDefault(){prevented=true;}});assert.ok(prevented,'Esc is held back');
 await u.click('action','discard-task');assert.equal(u.dialog.open,false);
});

test('building blocks move with the keyboard and Escape restores the order',async()=>{
 const u=await ui(),tasks=u.db().tasks.filter(x=>x.examType==='ZP'&&x.specialty==='Baumschule');
 for(const id of ['demo-task-0','kbd-task'])await u.click('action','add',id);
 const e=u.db().exams.at(-1),order=()=>u.db().exams.find(x=>x.id===e.id).items.map(i=>i.id),start=order();assert.equal(start.length,2,u.toast());
 const key=(id,k,extra={})=>{const block={dataset:{boardItem:id,dragItem:id},classList:{add(){},remove(){}}};block.closest=()=>block;let prevented=false;u.listeners.keydown({key:k,target:block,preventDefault(){prevented=true;},...extra});return prevented;};
 assert.ok(key(start[0],'ArrowRight',{altKey:true}));assert.deepEqual(order(),[start[1],start[0]]);
 assert.equal(key(start[0],'ArrowLeft'),false,'arrows without pick-up do nothing');
 assert.ok(key(start[0],' '));key(start[0],'ArrowLeft');assert.deepEqual(order(),start);key(start[0],'Escape');assert.deepEqual(order(),[start[1],start[0]]);
});
