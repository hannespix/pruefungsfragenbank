'use strict';
// Deleting drafts as the coordinating body: directly in "Prüfungen & Ergebnisse", several at once, undo, emptying the trash.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'src'),r=f=>require(path.join(SRC,f));
const C=r('core.js');

async function ui(){
 const data=C.validate(JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json'),'utf8')));
 for(const t of data.tasks)if(t.examType==='ZP')t.text='Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Synthetisches Beispiel\n'+t.text;
 data.workshops=[{id:'meeting',title:'Termin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];
 const stubs=new Map(),listeners={},mk=id=>{const el={id,value:'',innerHTML:'',textContent:'',open:false,dataset:{},addEventListener(){},removeEventListener(){},showModal(){this.open=true;},close(){this.open=false;},classList:{s:new Set(),add(...x){x.forEach(v=>this.s.add(v));},remove(...x){x.forEach(v=>this.s.delete(v));},contains(x){return this.s.has(x);}}};stubs.set(id,el);return el;};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input'])mk(id);
 stubs.set('#seed',{textContent:JSON.stringify(data)});stubs.set('meta[name=hortiexam-storage]',{content:'memory'});
 const sandbox={HortiHistory:r('history.js'),HortiAdvisor:r('advisor.js'),HortiPointsPlan:r('points-plan.js'),HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:r('timing-plan.js'),HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:require(path.join(ROOT,'vendor/jszip.min.js')),Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:r('planning.js'),HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
  window:{addEventListener(){}},document:{querySelector:q=>stubs.get(q)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f}};
 await vm.runInNewContext(fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace('await initStorage();','globalThis.testUI={getDb:()=>db};await initStorage();'),sandbox);
 const click=(kind,value,id)=>listeners.click({target:{closest:s=>s===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}});
 const u={click,db:()=>sandbox.testUI.getDb(),html:()=>stubs.get('#app').innerHTML,dialog:()=>stubs.get('#dialog').innerHTML,toast:()=>stubs.get('#toast').textContent};
 // Three drafts of the meeting: one with a task, two empty; plus one exam that was already used.
 const d=u.db(),t=d.tasks.find(x=>x.specialty==='Baumschule'&&x.examType==='ZP');
 const L=r('planning.js'),mkExam=(title,withTask)=>{const e=C.newExam({specialty:'Baumschule',examType:'ZP',examYear:2027,workshopId:'meeting',pattern:L.pattern(d,'ZP','Baumschule')});e.title=title;if(withTask)C.addItem(e,t);d.exams.push(e);return e;};
 u.full=mkExam('Entwurf mit Aufgabe',true);u.empty1=mkExam('Leerer Entwurf A',false);u.empty2=mkExam('Leerer Entwurf B',false);
 u.used=mkExam('Eingesetzte Prüfung',true);u.used.status='used';
 await click('route','results');
 return u;
}
const exam=(u,e)=>u.db().exams.find(x=>x.id===e.id);

test('each draft has its own delete button; the used exam has none',async()=>{
 const u=await ui(),h=u.html();
 for(const e of [u.full,u.empty1,u.empty2])assert.match(h,new RegExp(`data-action="trash-row" data-id="${e.id}"`));
 assert.doesNotMatch(h,new RegExp(`data-action="trash-row" data-id="${u.used.id}"`));
 assert.match(h,/data-action="show-trash"[^>]*>.*Papierkorb \(0\)/);
});

test('"Löschen" moves the draft to the trash at once and "Rückgängig" brings it back',async()=>{
 const u=await ui();await u.click('action','trash-row',u.full.id);
 assert.ok(exam(u,u.full).deletedAt,u.toast());assert.doesNotMatch(u.dialog(),/Prüfung löschen\?/,'no extra confirmation step');
 let h=u.html();assert.match(h,/class="trash-undo"/);assert.match(h,/„Entwurf mit Aufgabe“ liegt jetzt im Papierkorb/);assert.match(h,/Papierkorb \(1\)/);
 assert.doesNotMatch(h,new RegExp(`data-action="trash-row" data-id="${u.full.id}"`));
 await u.click('action','trash-undo');
 assert.equal(exam(u,u.full).deletedAt,undefined);h=u.html();assert.doesNotMatch(h,/class="trash-undo"/);assert.match(u.toast(),/wiederhergestellt/);
});

test('several drafts: pick the empty ones, add one by hand, move all in one step',async()=>{
 const u=await ui();await u.click('action','trash-pick-mode');
 let h=u.html();assert.match(h,/class="trash-bar"/);assert.match(h,/0 von 3 ausgewählt/);assert.match(h,/Leere Entwürfe \(2\)/);
 assert.doesNotMatch(h,new RegExp(`data-action="trash-pick" data-id="${u.used.id}"`),'used exams cannot be picked');
 assert.doesNotMatch(h,/data-action="trash-row"/,'single delete buttons hide while picking');
 await u.click('action','trash-pick-empty');h=u.html();assert.match(h,/2 von 3 ausgewählt/);assert.match(h,/In den Papierkorb \(2\)/);
 assert.match(h,new RegExp(`data-action="trash-pick" data-id="${u.empty1.id}" aria-pressed="true"`));
 await u.click('action','trash-pick',u.empty1.id);assert.match(u.html(),/1 von 3 ausgewählt/);
 await u.click('action','trash-pick',u.empty1.id);await u.click('action','trash-pick',u.full.id);assert.match(u.html(),/3 von 3 ausgewählt/);
 await u.click('action','trash-selected');
 for(const e of [u.full,u.empty1,u.empty2])assert.ok(exam(u,e).deletedAt);
 assert.equal(exam(u,u.used).deletedAt,undefined);
 h=u.html();assert.doesNotMatch(h,/class="trash-bar"/);assert.match(h,/3 Entwürfe liegen jetzt im Papierkorb/);assert.match(u.toast(),/3 Entwürfe/);
 await u.click('action','trash-undo');for(const e of [u.full,u.empty1,u.empty2])assert.equal(exam(u,e).deletedAt,undefined);
});

test('the trash restores all or empties itself after one confirmation',async()=>{
 const u=await ui();await u.click('action','trash-pick-all');await u.click('action','trash-selected');
 await u.click('action','show-trash');let dlg=u.dialog();
 assert.match(dlg,/data-action="restore-all"/);assert.match(dlg,/Papierkorb leeren \(3\)/);assert.match(dlg,/gelöscht am \d{1,2}\.\d{1,2}\.\d{4}/);
 await u.click('action','restore-all');for(const e of [u.full,u.empty1,u.empty2])assert.equal(exam(u,e).deletedAt,undefined);
 await u.click('action','trash-pick-mode');await u.click('action','trash-pick-empty');await u.click('action','trash-selected');
 await u.click('action','empty-trash');dlg=u.dialog();
 assert.match(dlg,/Papierkorb leeren\?|2 Prüfungsentwürfe werden/);assert.match(dlg,/Leerer Entwurf A/);assert.match(dlg,/Endgültig löschen \(2\)/);
 assert.ok(exam(u,u.empty1),'nothing is removed before the confirmation');
 await u.click('action','confirm-empty-trash');
 assert.equal(exam(u,u.empty1),undefined);assert.equal(exam(u,u.empty2),undefined);assert.ok(exam(u,u.full));assert.ok(exam(u,u.used));
 assert.match(u.toast(),/2 Prüfungen endgültig gelöscht/);
 await u.click('action','empty-trash');assert.match(u.toast(),/Papierkorb ist leer/);
});
