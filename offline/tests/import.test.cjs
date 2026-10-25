const {test}=require('node:test');const assert=require('node:assert/strict');require('../src/core.js');const I=require('../src/import.js');
test('compound unnumbered practical task stays intact',()=>{assert.equal(I.splitText('Aufgabe: Boden\nHier: Beet\nGraben Sie um.\nPflanzen Sie danach.').length,1);});
test('numbered task headings split while retaining preamble',()=>{assert.deepEqual(I.splitText('Name:\nAufgabe 1: Zählen\nZählen Sie.\nAufgabe 2: Messen\nMessen Sie.'),['Name:\nAufgabe 1: Zählen\nZählen Sie.','Aufgabe 2: Messen\nMessen Sie.']);});
test('explicit solution excluded from candidate text',()=>{assert.deepEqual(I.extractSolution('Frage: 2+2?\nLösung: 4'),{text:'Frage: 2+2?',solution:'4'});});
