'use strict';
// Theme of an oral task: category unless it only says "oral", otherwise the first tag.
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),D=require('../src/docx.js'),Zip=require('../vendor/jszip.min.js');
test('the theme of an oral task comes from its category or first tag, never from a generic label',()=>{
 assert.equal(C.oralTheme({category:'Pflanzenschutz',tags:['x']}),'Pflanzenschutz');
 for(const generic of ['Mündliche Aufgabe','Mündliche Prüfungsaufgabe','mündliche Prüfung','Fachgespräch','',' '])assert.equal(C.oralTheme({category:generic,tags:[' ','Kundenberatung']}),'Kundenberatung',generic);
 assert.equal(C.oralTheme({category:'Mündliche Aufgabe',tags:[]}),'');assert.equal(C.oralTheme(null),'');
});
test('Word names the oral section with its theme on the cover and above the task',async()=>{
 const e=C.newExam({examType:'AP',specialty:'Baumschule',title:'Thema',examYear:2027}),oral={id:'o1',familyId:'f-o1',title:'Kundengespräch',text:'Beraten Sie.',examType:'AP',specialty:'Baumschule',kind:'oral',category:'Kundenberatung',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],points:20,minutes:15,solution:'x',solutionStatus:'approved',reviewStatus:'approved'};
 C.setOralItem(e,oral);const xml=await(await Zip.loadAsync(await D.document(e,{tasks:[],assets:[]}))).file('word/document.xml').async('string');
 assert.match(xml,/Mündliche Prüfungsaufgabe · Thema: Kundenberatung/);assert.match(xml,/Thema: Kundenberatung · 20 Punkte · 15 Minuten/);assert.doesNotMatch(xml,/>Mündliche Aufgabe</);
});
