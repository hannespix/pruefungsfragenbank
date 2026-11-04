'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const I=require('../src/import.js'),C=require('../src/core.js'),W=require('../src/paper.js');

test('pasted task text is recognised without guessing',()=>{
 const r=I.parsePlain('Aufgabe 3: Gehölze schneiden\nHier: Obstbaum auslichten\nSchnitt planen (2 Pkt.)\nSchnitt ausführen (4,5 Pkt.)\nBearbeitungszeit: 60 Minuten\nLösung: Auslichtungsschnitt.');
 assert.equal(r.title,'Obstbaum auslichten');assert.deepEqual(r.criteria,[{text:'Schnitt planen',points:2},{text:'Schnitt ausführen',points:4.5}]);assert.equal(r.points,6.5);assert.equal(r.minutes,60);assert.equal(r.solution,'Auslichtungsschnitt.');assert.ok(!r.text.includes('Lösung'));
 const plain=I.parsePlain('Rasen mähen und Kanten stechen\nDie Fläche ist vorbereitet. Mähen Sie in 10 Minuten Abstand.');
 assert.equal(plain.title,'Rasen mähen und Kanten stechen');assert.equal(plain.points,null);assert.equal(plain.minutes,null,'a time without a time label is not taken as total');assert.equal(I.parsePlain('   '),null);
 assert.equal(I.parsePlain('Titel\nGesamtpunkte: 20\nTeil (5 Pkt.)').points,20);
});

test('task preview renders the real sheet; thumbnails carry no image data or editor hooks',()=>{
 const d=C.validate(JSON.parse(fs.readFileSync(path.join(__dirname,'../demo.json'),'utf8'))),t=d.tasks[0],e=C.newExam({examType:t.examType,specialty:t.specialty});
 d.assets.push({id:'pic',name:'Plan.png',mime:'image/png',data:'iVBORw0KGgo='});t.assetLinks=[...t.assetLinks,{assetId:'pic',audience:'candidate',caption:'Plan'}];
 const full=W.taskPreview(e,d,t),thumb=W.taskPreview(e,d,t,{thumb:true});
 assert.match(full,/class="paper-sheet paper-task"/);assert.ok(full.includes(t.title));assert.match(full,/data:image\/png;base64,iVBORw0KGgo=/);
 assert.ok(!/data:image\/png;base64/.test(thumb));assert.ok(!/ (?:id|data-paper-[a-z-]+|data-pending-asset)="/.test(thumb));assert.ok(thumb.includes(t.title));
});
