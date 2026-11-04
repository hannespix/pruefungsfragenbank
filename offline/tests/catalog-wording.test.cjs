'use strict';
// Use history in plain words: "Familieneinsatz" confused users.
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../src/catalog.js');
test('the use history speaks of uses and templates, not of "Familieneinsatz"',()=>{
 assert.equal(B.historyLabel({confirmed:'2024-04-12',sourceYear:2023}),'Zuletzt in einer Prüfung eingesetzt am 12.04.2024 (diese oder eine ähnliche Ausführung) · Jüngste Vorlage aus 2023');
 assert.equal(B.historyLabel({confirmed:null,sourceYear:null}),'Noch kein Einsatz in einer Prüfung erfasst · Jahr der Vorlage unbekannt');
 const header=B.csv({tasks:[],families:[],sources:[],uses:[],exams:[]},[]).split('\n')[0];
 assert.match(header,/Zuletzt eingesetzt \(auch ähnliche Ausführung\)/);assert.doesNotMatch(header,/Familie/);
});
