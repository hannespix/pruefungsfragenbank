'use strict';
// Notes per page: the authors write a note to any page; it sits above the page in the editor, is never printed
// or exported into the exam documents, does not invalidate a release, and is listed for the coordinating body.
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/print.js'),W=require('../src/paper.js'),D=require('../src/docx.js'),L=require('../src/planning.js'),O=require('../src/organization.js'),Zip=require('../vendor/jszip.min.js');
const NOTE='SEITENNOTIZ_SENTINEL_51A9';
function legacyFixture(){const d=C.empty(),task={id:'note-task',familyId:'note-family',title:'Synthetische Aufgabe',text:'Pflanzen zählen.',examType:'ZP',specialty:'Baumschule',kind:'practical',category:'Praktisch',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],points:10,minutes:20,solution:'Synthetische Lösung.',solutionStatus:'approved',reviewStatus:'approved'};L.assignCategories(task,['plantwork'],'Synthetisch bestätigte Einzelaufgabe');d.tasks.push(task);d.families.push({id:task.familyId,title:'Beispiel'});const e=C.newExam({examType:task.examType,specialty:task.specialty,examYear:2027,pattern:L.pattern(d,task.examType,task.specialty)});C.addItem(e,task);d.exams.push(e);return {d,e,item:e.items[0]};}
const block=(id,text,x,y)=>({id,text,originalText:text,x,y,width:440,height:15,fontSize:12,lineHeight:14,lines:[{text,runs:[{text,bold:false,italic:false}]}]});
function sourceFixture(){
 const d=C.validate(JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../demo.json')))),t=C.clone(d.tasks[0]);
 const pages=[[block('a','Vorderseite Arbeitsauftrag',40,60)],[block('b','Rückseite Planung',40,60)]];t.text=pages.flat().map(b=>b.text).join('\n');
 t.sourceLayout={version:1,sourceId:t.sourceIds[0],reference:'synthetic-notes',sourcePdfHash:'b'.repeat(64),baselineText:t.text,warnings:[],pages:pages.map(blocks=>({width:595.276,height:841.89,backgroundAssetId:'background-notes',logos:[],blocks}))};
 d.assets.push({id:'background-notes',name:'Seite.png',mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='});t.assetLinks.push({assetId:'background-notes',audience:'candidate',role:'source-page'});L.assignCategories(t,['plantwork'],'Synthetisch bestätigte Einzelaufgabe');
 const e=C.newExam({specialty:t.specialty,examType:t.examType,examYear:2026,pattern:L.pattern({...d,tasks:[t]},t.examType,t.specialty)});C.addItem(e,t);d.exams.push(e);return {d,e,item:e.items[0]};
}

test('page notes are optional plain text per page; malformed or oversized notes are rejected',()=>{
 const {d,item}=legacyFixture();assert.doesNotThrow(()=>C.validate(d));
 item.pageNotes={0:'Material am Vortag bestellen.\n<b>kein HTML</b>',1:''};assert.deepEqual(C.validate(d).exams[0].items[0].pageNotes,item.pageNotes);
 item.pageNotes={0:'x'.repeat(5000)};assert.doesNotThrow(()=>C.validate(d));
 for(const bad of [[],'Text',null,{a:'x'},{0:42},{0:'x'.repeat(5001)},{100:'x'}]){item.pageNotes=bad;assert.throws(()=>C.validate(d),/Seitennotizen/,JSON.stringify(bad).slice(0,40));}
 delete item.pageNotes;assert.doesNotThrow(()=>C.validate(d),'drafts without notes stay valid');
});

test('notes never enter print HTML, the exported sheets or Word documents and do not change the release key',async()=>{
 const {d,e,item}=legacyFixture(),key=C.examReviewKey(e);item.pageNotes={0:NOTE};
 assert.equal(C.examReviewKey(e),key,'a note is no content change of the exam');
 assert.match(W.pages(e,d,false),new RegExp(`class="page-note"[\\s\\S]*${NOTE}`),'the editor shows the note');
 for(const examiner of [false,true]){for(const html of [P.document(e,d,examiner),W.document(e,d,examiner),W.pages(e,d,examiner,true)])assert.ok(!html.includes(NOTE));
  const zip=await Zip.loadAsync(await D.document(e,d,examiner)),xml=(await Promise.all(Object.values(zip.files).filter(f=>/\.xml$/.test(f.name)).map(f=>f.async('string')))).join('\n');assert.ok(!xml.includes(NOTE));}
 assert.ok(!W.pages({...e,status:'used'},d,false).includes('data-action="page-note-add"'),'used exams offer no new notes');
 assert.doesNotMatch(W.pages({...e,status:'used'},d,false),/contenteditable="plaintext-only"[^>]*data-note-item/,'and show existing notes read-only');
});

test('original pages get one note per page: front and back are separate',()=>{
 const {d,e,item}=sourceFixture();let html=W.pages(e,d,false);
 assert.equal((html.match(/data-action="page-note-add" data-id="[^"]+\|(\d)"/g)||[]).length,2,'each page offers a note');
 item.pageNotes={1:'Rückseite: Linien für die Planung sind zu knapp.'};html=W.pages(e,d,false);
 const note=html.indexOf('class="page-note"'),back=html.indexOf('data-source-page="2"'),front=html.indexOf('data-source-page="1"');
 assert.ok(note>front&&note<back,'the note sits above the back page');assert.match(html,/data-note-item="[^"]+" data-note-page="1"/);
 assert.equal((html.match(/data-action="page-note-add"/g)||[]).length,1,'the page with a note needs no extra button');
});

test('the coordinating body finds all notes in "Interne Bemerkungen" of the export package',()=>{
 const {d,e,item}=sourceFixture();item.pageNotes={1:'  Rückseite prüfen.  ',0:'Vorderseite: Bild tauschen.'};
 assert.deepEqual(C.pageNoteList(e).map(n=>[n.page,n.text]),[[0,'Vorderseite: Bild tauschen.'],[1,'Rückseite prüfen.']]);
 const report=O.report(e,d,'notes'),labels=report.sections.map(s=>s.label);
 assert.ok(labels.includes('Notiz · Aufgabe 1, Seite 1')&&labels.includes('Notiz · Aufgabe 1, Seite 2'),labels.join(' | '));
 assert.match(O.document(e,d,'notes'),/Rückseite prüfen\./);
});
