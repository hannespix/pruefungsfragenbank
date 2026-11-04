'use strict';
// Alternatives: several tasks for one position (e.g. oral tasks for the Gemüsebau exam). They never count towards the
// regulation (number of tasks, time, points) but are printed, exported to Word, reviewed and released with the exam.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../src/core.js'),L=require('../src/planning.js'),W=require('../src/paper.js'),P=require('../src/print.js'),D=require('../src/docx.js'),R=require('../src/release.js'),Zip=require('../vendor/jszip.min.js');

function data(){
 const d=C.validate(JSON.parse(fs.readFileSync(path.join(__dirname,'../demo.json'),'utf8')));
 const zp=d.tasks.find(t=>t.examType==='ZP'&&t.specialty==='Baumschule'),ap=d.tasks.find(t=>t.examType==='AP'&&t.specialty==='Baumschule');
 const add=(src,id,over)=>{const t={...C.clone(src),id,familyId:'fam-'+id,title:over.title||id,...over};d.tasks.push(t);d.families.push({...C.clone(d.families.find(f=>f.id===src.familyId)),id:t.familyId,title:t.title});return t;};
 add(zp,'zp-plant-a',{title:'Topfen',text:'Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Topfen\nTopfen Sie zehn Pflanzen.'});
 add(zp,'zp-plant-b',{title:'Schneiden',text:'Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Schnitt\nSchneiden Sie drei Sträucher.'});
 add(zp,'zp-tool',{title:'Heckenschere warten',text:'Aufgabe: Einsatz von Werkzeug und Geräten\nHier: Heckenschere\nReinigen Sie die Messer.'});
 add(zp,'zp-prop',{title:'Stecklinge schneiden',text:'Aufgabe: Vermehren von Pflanzen\nHier: Stecklinge\nSchneiden Sie zehn Stecklinge.'});
 add(ap,'oral-1',{kind:'oral',title:'Kundengespräch Rosen',text:'Thema: Kundenberatung\nBeraten Sie eine Kundin.',minutes:15,points:20});
 add(ap,'oral-2',{kind:'oral',title:'Kundengespräch Gehölze',text:'Thema: Kundenberatung\nBeraten Sie einen Kunden.',minutes:15,points:20});
 return C.validate(d);
}
function exam(d,type){const e=C.newExam({...L.examDefaults(d,type,'Baumschule',2027),examType:type,specialty:'Baumschule',examYear:2027,pattern:L.snapshotPattern(d,L.pattern(d,type,'Baumschule'))});d.exams.push(e);return e;}
const task=(d,id)=>d.tasks.find(t=>t.id===id);

test('oral alternatives: added, listed after the oral task, never counted, and validated like the main task',()=>{
 const d=data(),e=exam(d,'AP');C.setOralItem(e,task(d,'oral-1'));const before={totals:C.totals(e),coverage:L.structureCoverage(e),oral:C.oralStatus(e)};
 const alt=C.addAlternative(e,e.oralItem.id,task(d,'oral-2'));
 assert.equal(e.oralItem.alternatives.length,1);assert.equal(C.findExamItem(e,alt.id),alt);assert.equal(C.alternativeOwner(e,alt.id),e.oralItem);
 assert.deepEqual(C.examEntries(e).map(i=>i.label),['Mündliche Prüfungsaufgabe'],'by default only the positions');
 assert.deepEqual(C.examEntries(e,{alternatives:true}).map(i=>[i.label,i.component]),[['Mündliche Prüfungsaufgabe','oral'],['Mündliche Prüfungsaufgabe · Alternative B','oral']]);
 assert.deepEqual(C.totals(e),before.totals);assert.deepEqual(L.structureCoverage(e).total,before.coverage.total);assert.deepEqual(C.oralStatus(e),before.oral);
 assert.doesNotThrow(()=>C.validate(d));
 assert.throws(()=>C.addAlternative(e,e.oralItem.id,task(d,'oral-2')),/schon/);assert.throws(()=>C.addAlternative(e,e.oralItem.id,task(d,'oral-1')),/schon/);
 assert.throws(()=>C.addAlternative(e,e.oralItem.id,d.tasks.find(t=>t.examType==='AP'&&t.kind==='practical')));
 for(const bad of ['x',[null],[{id:'a'}],Array.from({length:10},(_,n)=>({...alt,id:'alt'+n}))]){const keep=e.oralItem.alternatives;e.oralItem.alternatives=bad;assert.throws(()=>C.validate(d),/Alternativ|Prüfungsposition|Aufgabe/);e.oralItem.alternatives=keep;}
 e.oralItem.alternatives[0].task.kind='practical';assert.throws(()=>C.validate(d));e.oralItem.alternatives[0].task.kind='oral';
 assert.ok(C.readiness(e).issues.some(x=>x.startsWith('Mündliche Prüfungsaufgabe · Alternative B: ')),'an alternative needs its own review');
});

test('ZP alternatives come from the same theme; a copy to rewrite starts as a draft; promote swaps task and notes',()=>{
 const d=data(),e=exam(d,'ZP');C.addItem(e,task(d,'zp-plant-a'));const owner=e.items[0];
 assert.throws(()=>C.addAlternative(e,owner.id,task(d,'zp-tool')),/selben Thema/);
 const same=C.addAlternative(e,owner.id,task(d,'zp-plant-b'));assert.equal(L.structureCoverage(e).total,1,'still one task');
 const copy=C.copyAlternative(e,owner.id);assert.equal(copy.originTaskId,owner.originTaskId);assert.match(copy.task.title,/– Alternative$/);assert.equal(copy.task.reviewStatus,'review');assert.ok(!copy.task.reviewKey&&!copy.task.sourceReview);
 assert.doesNotThrow(()=>C.validate(d));
 // Editing an alternative on the sheet is not blocked by the theme rule of the main task.
 assert.equal(W.edit(e,same.id,'title','Schneiden von Sträuchern'),true);assert.equal(C.findExamItem(e,same.id).task.title,'Schneiden von Sträuchern');
 owner.pageNotes={0:'Hauptaufgabe'};same.pageNotes={0:'Alternative'};const mainTask=owner.task.title;
 C.promoteAlternative(e,same.id);assert.equal(e.items[0].id,owner.id,'the position keeps its place');assert.equal(e.items[0].task.title,'Schneiden von Sträuchern');assert.equal(e.items[0].pageNotes[0],'Alternative');
 assert.equal(C.findExamItem(e,same.id).task.title,mainTask);assert.equal(C.findExamItem(e,same.id).pageNotes[0],'Hauptaufgabe');
 C.removeAlternative(e,copy.id);C.removeAlternative(e,same.id);assert.equal(e.items[0].alternatives,undefined);assert.doesNotThrow(()=>C.validate(d));
});

test('the release key covers alternatives but not their notes; approval reviews them too',()=>{
 const d=data(),e=exam(d,'ZP');for(const id of ['zp-plant-a','zp-tool','zp-prop'])C.addItem(e,task(d,id));const k0=C.examReviewKey(e);
 const alt=C.addAlternative(e,e.items[0].id,task(d,'zp-plant-b')),k1=C.examReviewKey(e);assert.notEqual(k1,k0,'a new alternative changes the exam');
 alt.pageNotes={0:'Nur für uns'};assert.equal(C.examReviewKey(e),k1,'a note does not');
 const approved=R.approve(e,{reviewedBy:'Koordination'});const a2=C.findExamItem(approved,alt.id);assert.equal(a2.task.reviewStatus,'approved');assert.ok(C.taskReviewCurrent(a2.task));
});

test('alternatives appear on the sheet, in print and in Word, clearly labelled, with promote and remove in the page menu',async()=>{
 const d=data(),e=exam(d,'AP');C.setOralItem(e,task(d,'oral-1'));const alt=C.addAlternative(e,e.oralItem.id,task(d,'oral-2'));
 const sheet=W.pages(e,d,false);assert.match(sheet,/Mündliche Prüfungsaufgabe · Alternative B/);assert.match(sheet,new RegExp(`data-action="alt-promote" data-id="${alt.id}"`));assert.match(sheet,new RegExp(`data-action="alt-remove" data-id="${alt.id}"`));
 assert.match(sheet,new RegExp(`data-action="alt-open" data-id="${e.oralItem.id}"`),'the main task offers "Alternative hinzufügen"');
 assert.equal((sheet.match(/paper-component-separator/g)||[]).length,0);assert.ok(sheet.indexOf('Kundengespräch Rosen')<sheet.indexOf('Kundengespräch Gehölze'),'alternative after its task');
 for(const examiner of [false,true]){assert.match(P.document(e,d,examiner),/Kundengespräch Gehölze/);}
 const zip=await Zip.loadAsync(await D.document(e,d,true)),xml=(await Promise.all(Object.values(zip.files).filter(f=>/\.xml$/.test(f.name)).map(f=>f.async('string')))).join('\n');assert.match(xml,/Kundengespräch Gehölze/);assert.match(xml,/Alternative B/);
});

test('drafts without alternatives stay valid and render as before',()=>{
 const d=data(),e=exam(d,'ZP');C.addItem(e,task(d,'zp-plant-a'));assert.doesNotThrow(()=>C.validate(d));
 assert.deepEqual(C.examEntries(e,{alternatives:true}),C.examEntries(e));assert.doesNotMatch(W.pages(e,d,false),/Alternative B/);
});
