'use strict';
// Regression tests for findings of the 2026-11 code audit.
process.env.TZ='Europe/Berlin';
const {test,mock}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'src');
const r=f=>require(path.join(SRC,f));
const C=r('core.js'),P=r('planning.js'),T=r('timing-plan.js'),PP=r('points-plan.js');

function task(id,type='ZP',extra={}){return {id,familyId:id,title:'Synthetischer Arbeitsauftrag '+id,text:'Führen Sie die beschriebenen praktischen Arbeiten fachgerecht aus.',examType:type,specialty:type==='FW_AP'?'Gemüsebau':'Baumschule',kind:'practical',planningCategories:[type==='AP'?'propagation':'plantwork'],planningCategoryCatalog:type==='ZP'?'zp-general-2026':type==='FW_AP'?'fw-sources-2026':'excel-ap-2026',planningCategoryEvidence:'Bestätigter Aufgabenkopf',category:'Praktisch',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],points:100,minutes:null,solution:'Erwartete fachgerechte Ausführung',solutionStatus:'approved',reviewStatus:'approved',...extra};}
function fixture(tasks){const d={...C.empty(),tasks:C.clone(tasks),families:tasks.map(t=>({id:t.id,title:t.title}))},e=C.newExam({examType:tasks[0].examType,specialty:tasks[0].specialty,pattern:P.pattern(d,tasks[0].examType,tasks[0].specialty)});e.items=tasks.map(t=>({id:'item-'+t.id,originTaskId:t.id,task:C.clone(t)}));return {e,d};}

test('totals are rounded instead of printing 30.299999999999997 points',()=>{
 const e={items:[{task:{points:10.1,minutes:15.67}},{task:{points:20.2,minutes:15.66}}]};
 assert.deepEqual(C.totals(e),{points:30.3,minutes:31.33,unknownPoints:0,unknownMinutes:0});
});

test('fractional timing proposals still satisfy the exact Fachwerker 180 minutes',()=>{
 const {e,d}=fixture([task('fx','FW_AP',{minutes:133}),task('t1','FW_AP'),task('t2','FW_AP'),task('t3','FW_AP')]);
 const plan=T.propose(e,d);assert.ok(plan.canApply);const next=T.apply(e,d,plan);
 assert.deepEqual(P.structureCoverage(next).issues.filter(s=>/Minuten/.test(s)),[]);
});

test('point totals tolerate floating point sums from imported criteria',()=>{
 const t={...task('p'),points:3.7,text:'Gesamtpunkte: 3,7',criteria:[{id:'a',text:'A',points:2.3,answer:''},{id:'b',text:'B',points:1.4,answer:''}]};
 t.points=t.criteria.reduce((s,c)=>s+c.points,0);assert.notEqual(t.points,3.7,'precondition: raw float sum');
 assert.deepEqual(PP.sourceIssues({items:[{id:'i',task:t}],oralItem:null}).filter(s=>/widersprechen/.test(s)),[]);
});

test('proposePoints refuses to give open criteria zero points',()=>{
 const t={...task('o'),points:null,criteria:[{id:'a',text:'A',points:70,answer:''},{id:'b',text:'B',points:50,answer:''},{id:'c',text:'C',points:null,answer:''}]};
 assert.throws(()=>C.proposePoints(t),/Gesamtpunktzahl ausdrücklich festlegen/);
});

test('merge accepts ids that are Object.prototype member names',()=>{
 const t=(id,familyId)=>({id,familyId,title:'Demo',text:'Pflanzen zählen.',examType:'ZP',specialty:'Baumschule',category:'K',tags:[],sourceIds:[],assetLinks:[],criteria:[],points:null,minutes:10,solution:'',solutionStatus:'missing',reviewStatus:'review',flags:[]});
 for(const id of ['constructor','toString','hasOwnProperty','__proto__']){
  const local={...C.empty(),families:[{id:'f1',title:'A'}],tasks:[t('t1','f1')]},incoming=JSON.parse(JSON.stringify({...C.empty(),families:[{id,title:'B'}],tasks:[t('t2',id)]}));
  const merged=C.merge(local,incoming).db;assert.ok(merged.families.some(f=>f.id===id),id);assert.equal(merged.tasks.find(x=>x.id==='t2').familyId,id);
 }
});

test('recordUse and history use the local calendar day, not UTC',()=>{
 mock.timers.enable({apis:['Date'],now:new Date('2026-06-14T23:30:00Z')});// 01:30 in Berlin
 try{
  assert.equal(C.today(),'2026-06-15');
  assert.throws(()=>C.recordUse({exams:[],uses:[]},'missing','2026-06-15'),e=>!/Einsatzdatum/.test(e.message));
  assert.throws(()=>C.recordUse({exams:[],uses:[]},'missing','2026-06-16'),/Einsatzdatum/);
 }finally{mock.timers.reset();}
});

test('Word export strips U+FFFE/U+FFFF which XML parsers reject',async()=>{
 const Zip=require(path.join(ROOT,'vendor/jszip.min.js')),D=r('docx.js');
 const e={title:'T',examType:'ZP',specialty:'Baumschule',examYear:2027,date:'2027-04-01',notes:'',items:[{id:'i1',task:{title:'Pflanzung',text:'a￿b￾c',points:10,minutes:null,solution:'S',solutionStatus:'approved',reviewStatus:'approved',criteria:[{text:'Pflanzen',points:10,answer:'X'}],flags:[],sourceIds:[],assetLinks:[]}}]};
 const zip=await Zip.loadAsync(await D.document(e,{tasks:[],assets:[]},false)),xml=await zip.file('word/document.xml').async('string');
 assert.ok(xml.includes('abc'));assert.ok(!/[￾￿]/.test(xml));
});

test('DOCX import rounds criterion sums and finds years after underscores',async()=>{
 globalThis.JSZip=require(path.join(ROOT,'vendor/jszip.min.js'));globalThis.HortiHash=r('hash.js');
 globalThis.DOMParser=class{parseFromString(s){const paras=[...s.matchAll(/<w:p>([\s\S]*?)<\/w:p>/g)].map(m=>({getElementsByTagNameNS:()=>[...m[1].matchAll(/<w:t>([\s\S]*?)<\/w:t>/g)].map(t=>({textContent:t[1]}))}));return {querySelector:()=>null,getElementsByTagNameNS:(_,tag)=>tag==='p'?paras:[]};}};
 try{
  const I=r('import.js'),lines=['Aufgabe 1: Gehölze schneiden','Schnitt ausführen (2,3 Pkt.)','Schnittgut entsorgen (1,4 Pkt.)'];
  const z=new globalThis.JSZip();z.file('word/document.xml','<w:document><w:body>'+lines.map(l=>'<w:p><w:r><w:t>'+l+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>');
  const bytes=await z.generateAsync({type:'uint8array'}),file={name:'AP_2019-2020.docx',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)};
  const data=await I.docx(file,{specialty:'Baumschule',examType:'ZP'});
  assert.equal(data.tasks[0].points,3.7);assert.equal(data.sources[0].year,null);assert.ok(data.sources[0].flags.some(f=>/mehrdeutig/.test(f)));
 }finally{delete globalThis.DOMParser;}
});

test('offline build substitutes placeholders once, so seed text cannot pull in module code',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hortiexam-build-')),seed=JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json'),'utf8'));
 seed.tasks[0].text+=' /*HELP*/ /*CORE*/';fs.writeFileSync(path.join(dir,'seed.json'),JSON.stringify(seed));
 try{
  execFileSync('python3',[path.join(ROOT,'tools/build.py'),'--seed',path.join(dir,'seed.json'),'--out',path.join(dir,'index.html')],{stdio:'pipe'});
  const html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),raw=/<script id="seed" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.ok(JSON.parse(raw).tasks[0].text.endsWith(' /*HELP*/ /*CORE*/'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// Minimal DOM stub, same approach as the workflow UI tests.
async function ui(prepare=()=>{}){
 const data=JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json')));data.workshops=[{id:'meeting',title:'Testtermin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];prepare(data);
 const stubs=new Map(),listeners={};let download;
 const mk=(id,props={})=>{const el={id,value:'',checked:false,innerHTML:'',textContent:'',open:false,dataset:{},l:{},addEventListener(n,f){(this.l[n]??=[]).push(f);},removeEventListener(){},showModal(){this.open=true;},close(){this.open=false;},focus(){},after(){},querySelectorAll:()=>[],classList:{s:new Set(),add(...x){x.forEach(v=>this.s.add(v));},remove(...x){x.forEach(v=>this.s.delete(v));},contains(x){return this.s.has(x);}},...props};stubs.set(id,el);return el;};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input','#ready-download'])mk(id);
 stubs.set('#seed',{textContent:JSON.stringify(data)});stubs.set('meta[name=hortiexam-storage]',{content:'memory'});
 const qs=q=>stubs.has(q)?stubs.get(q):/^#task-|^\[data-(criterion|asset)-/.test(q)?mk(q):null;
 const sandbox={HortiPointsPlan:PP,HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:T,HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:require(path.join(ROOT,'vendor/jszip.min.js')),Blob,URL:{createObjectURL:b=>{download=b;return 'blob:test';},revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:P,HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
  window:{addEventListener(){}},document:{createElement:()=>({click(){}}),querySelector:qs,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f}};
 await vm.runInNewContext(fs.readFileSync(path.join(SRC,'app.js'),'utf8'),sandbox);
 const click=async(kind,value,id)=>listeners.click({target:{closest:s=>s===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}});
 return {data,stubs,mk,listeners,click,html:()=>stubs.get('#app').innerHTML,dialog:()=>stubs.get('#dialog'),toast:()=>stubs.get('#toast').textContent,backup:async()=>{await click('action','backup');return JSON.parse(await download.text());}};
}

test('Fachwerker topic names are escaped in the task editor',async()=>{
 const payload='<img src="data:," onerror="alert(1)">';
 const app=await ui(d=>{(d.settings??=[]).push({id:'planning:FW_AP:Gemüsebau',schemaVersion:1,revision:1,examType:'FW_AP',specialty:'Gemüsebau',categories:[{id:'soil',topics:[payload]}]});});
 await app.click('route','scope');await app.click('action','choose-type','FW_AP');await app.click('action','choose-specialty','Gemüsebau');await app.click('action','new-task');
 const html=app.dialog().innerHTML;assert.ok(app.dialog().open,app.toast());assert.ok(html.includes('&lt;img src=&quot;data:,'));assert.ok(!html.includes(payload));
});

test('dropping an exam item onto itself keeps the order',async()=>{
 const app=await ui(d=>{const base=d.tasks.find(t=>t.examType==='AP');const ts=[0,1,2].map(n=>{const t=JSON.parse(JSON.stringify(base));t.id='task-x'+n;t.title='Aufgabe '+n;t.familyId='family-x'+n;d.families.push({id:t.familyId,title:t.title,reviewStatus:'review'});d.tasks.push(t);return t;});
  const e=C.newExam({specialty:ts[0].specialty,examType:ts[0].examType});for(const t of ts)C.addItem(e,t);d.exams.push(e);});
 const e=app.data.exams.at(-1);await app.click('action','select-exam',e.id);
 const order=()=>[...new Set([...app.html().matchAll(/data-paper-task="([^"]+)"/g)].map(m=>m[1]))],before=order();assert.equal(before.length,3);
 app.listeners.drop({target:{closest:()=>({dataset:{dropItem:before[0]},classList:{add(){},remove(){}}})},preventDefault(){},dataTransfer:{getData:()=>'item:'+before[0]}});
 assert.deepEqual(order(),before,app.toast());
});

async function editApprovedTask(changeControl){
 let t;const app=await ui(d=>{d.workshops=[];t=d.tasks.find(x=>x.examType==='ZP');t.solution='Alte Musterlösung';t.criteria=[{id:'crit-1',text:'K1',answer:'alte Erwartung',points:2}];t.reviewStatus='approved';t.solutionStatus='approved';t.reviewedBy='Prüferin A';t.reviewKey=C.taskReviewKey(t);});
 await app.click('action','edit-task',t.id);const dlg=app.dialog().innerHTML;assert.ok(dlg.includes('task-review'),app.toast());
 const set=(q,v)=>{(app.stubs.get(q)||app.mk(q)).value=v;},val=id=>{const m=new RegExp('id="'+id+'"[^>]*value="([^"]*)"').exec(dlg);return m?m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'):'';};
 const ta=id=>{const m=new RegExp('id="'+id+'"[^>]*>([\\s\\S]*?)</textarea>').exec(dlg);return m?m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'):'';};
 set('#task-title',t.title);set('#task-text',t.text);set('#task-fr',t.specialty);set('#task-type',t.examType);set('#task-kind',t.kind||'practical');set('#task-family',t.familyId);set('#task-category',t.category);set('#task-tags',val('task-tags'));set('#task-qualification',val('task-qualification'));set('#task-points',t.points??'');set('#task-minutes',t.minutes??'');set('#task-solution',t.solution);set('#task-flags',t.flags.join('\n'));set('#task-reviewer','Prüferin A');set('#task-review','approved');set('#task-solution-status','approved');
 set('[data-criterion-text="0"]','K1');set('[data-criterion-answer="0"]','NEUE Erwartung');set('[data-criterion-points="0"]','2');
 t.assetLinks.forEach((l,i)=>{set(`[data-asset-audience="${i}"]`,l.audience);set(`[data-asset-caption="${i}"]`,l.caption||'');});
 if(app.stubs.has('#task-materials-text'))set('#task-materials-text',ta('task-materials-text'));
 changeControl(set,id=>{for(const f of app.stubs.get(id).l.change||[])f();});
 await app.click('action','save-task');const saved=await app.backup();
 const revised=saved.tasks.find(x=>x.previousId===t.id)||saved.tasks.find(x=>x.id===t.id);assert.ok(revised&&!revised.supersededBy,app.toast());return revised;
}
test('lowering only the solution status does not confirm the review of edited content',async()=>{
 const x=await editApprovedTask((set,fire)=>{set('#task-solution-status','draft');fire('#task-solution-status');});
 assert.equal(x.criteria[0].answer,'NEUE Erwartung');assert.equal(x.reviewStatus,'review');assert.equal(C.taskReviewCurrent(x),false);
});
test('an explicit approval with a named reviewer still confirms edited content',async()=>{
 const x=await editApprovedTask((set,fire)=>{set('#task-reviewer','Prüfer B');fire('#task-reviewer');});
 assert.equal(x.criteria[0].answer,'NEUE Erwartung');assert.equal(x.reviewStatus,'approved');assert.equal(x.reviewedBy,'Prüfer B');assert.equal(C.taskReviewCurrent(x),true);
});
