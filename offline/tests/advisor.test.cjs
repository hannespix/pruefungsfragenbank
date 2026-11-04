'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../src/advisor.js');
const entries=[{id:'item-1',label:'Aufgabe 1'},{id:'oral-1',label:'Mündliche Prüfungsaufgabe'}];

test('regulation violations come first and offer a one-click fix',()=>{
 const cards=A.advise(['1 von 3 praktischen Prüfungsaufgaben; genau 3 sind erforderlich.','500 Minuten überschreiten die 180 Minuten für die praktische Prüfung.'],entries);
 assert.equal(cards[0].kind,'violation');assert.equal(cards[0].title,'Zeitrahmen überschritten');assert.deepEqual(cards[0].fixes,[{action:'timing-plan',label:'Zeitplan ansehen'}]);
 assert.equal(cards[1].kind,'open');assert.equal(cards[1].fixes[0].action,'suggest');
});

test('item issues link to the item and its required field',()=>{
 const [card]=A.advise(['Aufgabe 1: Materialvorschlag noch durch den Prüfungsausschuss bestätigen.'],entries);
 assert.equal(card.itemId,'item-1');assert.equal(card.itemLabel,'Aufgabe 1');assert.equal(card.text,'Materialvorschlag noch durch den Prüfungsausschuss bestätigen.');
 assert.deepEqual(card.fixes[0],{action:'required-field',id:JSON.stringify(['item-1','materials']),label:'Material prüfen'});
 const [combo]=A.advise(['Aufgabe 1: Zwischenprüfung: nur Einzelaufgaben mit genau einem Generalthema; keine Kombinationsaufgaben.'],entries);
 assert.equal(combo.kind,'violation');assert.deepEqual(combo.fixes.map(f=>f.action),['paper-focus','suggest']);
});

test('regulation sign-offs are grouped and duplicate count hints dropped',()=>{
 const cards=A.advise(['0 von 5 komplexen Prüfungsaufgaben; genau fünf sind erforderlich.','Keine Aufgaben ausgewählt.','Prüfungsverordnung: Prüfungsgespräch eingeplant – Bestätigung offen.','Prüfungsverordnung: Fünf Aufgaben gleich gewichtet – Bestätigung offen.','Mündliche Prüfungsaufgabe noch nicht ausgewählt (organisatorische Vorgabe).'],entries);
 assert.ok(!cards.some(c=>c.text==='Keine Aufgaben ausgewählt.'));
 const confirm=cards.find(c=>c.kind==='confirm');assert.equal(confirm.title,'2 Bestätigungen zur Prüfungsverordnung offen');assert.equal(confirm.text,'Prüfungsgespräch eingeplant · Fünf Aufgaben gleich gewichtet');
 assert.ok(cards.some(c=>c.fixes[0]?.action==='oral-suggest'));
});

test('more tasks than allowed is a violation',()=>{
 const [card]=A.advise(['4 von 3 praktischen Prüfungsaufgaben; genau 3 sind erforderlich.'],entries);
 assert.equal(card.kind,'violation');assert.equal(card.title,'Zu viele Aufgaben');
});

test('an exceeded time budget leads to the task with the longest time',()=>{
 const [card]=A.advise(['500 Minuten überschreiten die 180 Minuten für die praktische Prüfung.'],[{id:'a',label:'Aufgabe 1',task:{minutes:40}},{id:'b',label:'Aufgabe 2',task:{minutes:460}}]);
 assert.deepEqual(card.fixes[0],{action:'required-field',id:JSON.stringify(['b','minutes']),label:'Zeit von Aufgabe 2 ändern (460 Min.)'});assert.equal(card.fixes[1].action,'timing-plan');
});
