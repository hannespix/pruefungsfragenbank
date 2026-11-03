const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/print.js'),W=require('../src/paper.js'),D=require('../src/docx.js'),L=require('../src/planning.js'),Zip=require('../vendor/jszip.min.js');
function fixture(){const d=C.empty(),task={id:'notes-task',familyId:'notes-family',title:'Synthetische Aufgabe',text:'Pflanzen zählen.',examType:'ZP',specialty:'Baumschule',kind:'practical',category:'Praktisch',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],points:10,minutes:20,solution:'Synthetische Lösung.',solutionStatus:'approved',reviewStatus:'approved'};L.assignCategories(task,['plantwork'],'Synthetisch bestätigte Einzelaufgabe');d.tasks.push(task);d.families.push({id:task.familyId,title:'Beispiel'});const e=C.newExam({examType:task.examType,specialty:task.specialty,examYear:2027,pattern:L.pattern(d,task.examType,task.specialty)});C.addItem(e,task);d.exams.push(e);return {d,e};}
test('internal exam remarks accept detailed plain text and legacy omission but reject malformed or oversized values',()=>{
 const {d,e}=fixture();assert.equal(e.internalNotes,'');const note='Rückfrage an die zuständige Stelle:\n<Material> & Termin klären.';e.internalNotes=note;assert.equal(C.validate(d).exams[0].internalNotes,note);
 e.internalNotes='x'.repeat(20000);assert.doesNotThrow(()=>C.validate(d));for(const value of [null,42,{},[],true,'x'.repeat(20001)]){e.internalNotes=value;assert.throws(()=>C.validate(d),/Interne Bemerkungen/);}
 delete e.internalNotes;assert.doesNotThrow(()=>C.validate(d));
});
test('internal remarks never enter candidate or examiner previews, print HTML, or native Word documents',async()=>{
 const {d,e}=fixture(),sentinel='PRIVATE_HANDOFF_SENTINEL_6C7E';e.internalNotes=sentinel+'\nZweite vertrauliche Zeile.';e.notes='PUBLIC_EXAM_INSTRUCTION';
 for(const examiner of [false,true]){for(const html of [P.document(e,d,examiner),W.pages(e,d,examiner),W.document(e,d,examiner)]){assert.ok(!html.includes(sentinel));assert.match(html,/PUBLIC_EXAM_INSTRUCTION/);}const zip=await Zip.loadAsync(await D.document(e,d,examiner));const xml=(await Promise.all(Object.values(zip.files).filter(f=>/\.xml$/.test(f.name)).map(f=>f.async('string')))).join('\n');assert.ok(!xml.includes(sentinel));assert.match(xml,/PUBLIC_EXAM_INSTRUCTION/);}
 assert.match(JSON.stringify(d),new RegExp(sentinel));
});

test('submission timestamps are optional canonical ISO dates and do not imply approval',()=>{
 const {d,e}=fixture();assert.equal(e.submittedAt,undefined);e.submittedAt='2026-11-03T12:34:56.000Z';assert.doesNotThrow(()=>C.validate(d));assert.equal(e.status,'draft');for(const submittedAt of [null,4,{},'invalid','2026-11-03','2026-99-03T12:34:56.000Z']){e.submittedAt=submittedAt;assert.throws(()=>C.validate(d),/Vorlagezeitpunkt/);}
});
