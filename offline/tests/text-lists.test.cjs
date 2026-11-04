'use strict';
// Word-like lists in task text: markers with a hanging indent on the sheet, in print and in Word; list editing on plain text.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../src/print.js'),W=require('../src/paper.js'),D=require('../src/docx.js'),Zip=require('../vendor/jszip.min.js');

test('list lines are recognised without mistaking ordinary sentences for lists',()=>{
 for(const [line,marker,level] of [['•\tSchere reinigen','•',0],['- Messer schärfen','-',0],['– Gerät prüfen','–',0],['1. Schritt','1.',0],['2) Schritt','2)',0],['a) Wahl','a)',0],['\t•\tUnterpunkt','•',1],['\t\t3.\tTief','3.',2],['•\t','•',0]]){const m=P.listLine(line);assert.ok(m?.list,line);assert.equal(m.marker,marker,line);assert.equal(m.level,level,line);}
 for(const line of ['z. B. so','1.5 m Abstand','-5 °C über Nacht','Aufgabe: Pflanzen','•Ohne Abstand','- '])assert.equal(P.listLine(line)?.list??false,false,line);
 assert.deepEqual(P.listLine('\tEingerückt'),{list:false,level:1,marker:'',prefix:'\t',text:'Eingerückt',numbered:false});
});

test('bullets and numbering are toggled from the toolbar without typing characters',()=>{
 const text='Aufgabe: X\nPunkt eins\nPunkt zwei\nEnde';
 let r=W.textEdit(text,12,25,'bullet');assert.equal(r.text,'Aufgabe: X\n•\tPunkt eins\n•\tPunkt zwei\nEnde');assert.equal(r.text.slice(r.start,r.end),'unkt eins\n•\tPun','the selection keeps covering the same words');
 r=W.textEdit(r.text,r.start,r.end,'number');assert.equal(r.text,'Aufgabe: X\n1.\tPunkt eins\n2.\tPunkt zwei\nEnde');
 r=W.textEdit(r.text,r.start,r.end,'number');assert.equal(r.text,text,'clicking again removes the numbering');
 r=W.textEdit('',0,0,'bullet');assert.deepEqual(r,{text:'•\t',start:2,end:2},'an empty field starts a list');
 r=W.textEdit('Erster\n\nZweiter',0,15,'bullet');assert.equal(r.text,'•\tErster\n\n•\tZweiter','empty lines stay empty');
});

test('Enter continues the list, Enter on an empty item ends it, Tab nests and numbers follow each other',()=>{
 let r=W.textEdit('•\tA\n•\tB',3,3,'enter');assert.deepEqual(r,{text:'•\tA\n•\t\n•\tB',start:6,end:6});
 r=W.textEdit(r.text,r.start,r.end,'enter');assert.deepEqual(r,{text:'•\tA\n\n•\tB',start:4,end:4},'empty item ends the list');
 r=W.textEdit('1.\tA\n2.\tB',4,4,'enter');assert.equal(r.text,'1.\tA\n2.\t\n3.\tB');
 r=W.textEdit('1.\tA\n2.\tB\n3.\tC',8,8,'indent');assert.equal(r.text,'1.\tA\n\t1.\tB\n2.\tC','nested items count on their own');
 r=W.textEdit(r.text,9,9,'outdent');assert.equal(r.text,'1.\tA\n2.\tB\n3.\tC');
 r=W.textEdit('3.\tDrei\nText',7,7,'enter');assert.equal(r.text,'3.\tDrei\n4.\t\nText','a list may start at any number');
 r=W.textEdit('a)\tErstens',10,10,'enter');assert.equal(r.text,'a)\tErstens\nb)\t');
 r=W.textEdit('Zeile eins',5,5,'newline');assert.deepEqual(r,{text:'Zeile\n eins',start:6,end:6});
 r=W.textEdit('•\tTeil eins',6,6,'enter');assert.equal(r.text,'•\tTeil\n•\t eins','Enter splits the item at the cursor');
 r=W.textEdit('1.\tA\n2.\tB',3,3,'enter');assert.equal(r.text,'1.\t\n2.\tA\n3.\tB','Enter before the text inserts an empty item above');
 assert.throws(()=>W.textEdit('x',0,0,'bold'),/Unbekannte/);
});

test('the sheet shows list items with a hanging indent and keeps the text exactly',()=>{
 assert.equal(W.richHtml('Nur Text\nzweite <Zeile>'),'Nur Text\nzweite &lt;Zeile&gt;','text without lists renders as before');
 const html=W.richHtml('Text\n•\tEins <b>\n\t1.\tSub\n\nEnde');
 assert.match(html,/<div class="pl pl-ind pl-li" style="--lvl:0"><span class="pl-pre" contenteditable="false">•\t<\/span>Eins &lt;b&gt;<\/div>/);
 assert.match(html,/<div class="pl pl-ind pl-li" style="--lvl:1"><span class="pl-pre" contenteditable="false">\t1\.\t<\/span>Sub<\/div><div class="pl"><br><\/div><div class="pl">Ende<\/div>/);
 assert.match(W.styles,/\.pl-pre\{display:inline-block/,'print and sheet share the styles');
});

const exam=text=>({title:'Liste',examType:'ZP',specialty:'Baumschule',examYear:2027,date:'2027-04-01',notes:'',items:[{id:'i1',task:{title:'Heckenschere',text,points:10,minutes:20,solution:'•\tGereinigt\n•\tGeölt',solutionStatus:'approved',reviewStatus:'approved',criteria:[{text:'Pflege',points:10,answer:'1.\tReinigen\n2.\tÖlen'}],flags:[],sourceIds:[],assetLinks:[]}}]});

test('Word shows list items as paragraphs with a hanging indent and a tab after the marker',async()=>{
 const xml=async examiner=>(await Zip.loadAsync(await D.document(exam('Aufgabe: Werkzeug\nHier: Heckenschere\n•\tSchere reinigen\n\t–\tKlingen\n•\tÖlen'),{tasks:[],assets:[]},examiner))).file('word/document.xml').async('string');
 const doc=await xml(false);
 assert.match(doc,/<w:ind w:left="360" w:hanging="360"\/>[\s\S]*?<w:t[^>]*>•<\/w:t>[\s\S]*?<w:tab\/>[\s\S]*?<w:t[^>]*>Schere reinigen<\/w:t>/);
 assert.match(doc,/<w:ind w:left="720" w:hanging="360"\/>[\s\S]*?<w:t[^>]*>–<\/w:t>[\s\S]*?Klingen/,'second level');
 assert.match(doc,/Aufgabe: Werkzeug<\/w:t>[\s\S]*?Hier: Heckenschere/,'plain lines stay one paragraph');
 const solution=await xml(true);assert.match(solution,/<w:t[^>]*>Gereinigt<\/w:t>/);assert.match(solution,/<w:t[^>]*>2\.<\/w:t>[\s\S]*?<w:tab\/>[\s\S]*?Ölen/);
});
