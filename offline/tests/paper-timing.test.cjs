const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../src/core.js'),L=require('../src/planning.js'),W=require('../src/paper.js');
function fixture(){
 const task={id:'synthetic-task',familyId:'synthetic-family',title:'Synthetische Zeitprüfung',text:'Synthetischer Arbeitsauftrag',examType:'AP',specialty:'Baumschule',category:'Vermehren von Gehölzen',kind:'practical',planningCategories:['propagation'],tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],minutes:60,points:10,solution:'Synthetische Erwartung',solutionStatus:'approved',reviewStatus:'approved'};
 const e=C.newExam({examType:'AP',specialty:'Baumschule'});C.addItem(e,task);return {e,item:e.items[0]};
}
test('direct total confirmation resolves conflicting timing without changing its source evidence',()=>{
 const {e,item}=fixture();item.task.timing={method:'conflict',totalMinutes:null,phases:[],evidence:[{sourceId:'synthetic-source-a',quotes:['Zeit: 45 Minuten']},{sourceId:'synthetic-source-b',quotes:['Zeit: 60 Minuten']}]};const original=C.clone(item.task.timing);
 assert.equal(L.regulationCoverage(e).unknownMinutes,1);
 assert.equal(W.edit(e,item.id,'minutes','60'),true);
 assert.equal(item.task.timing.manualTotalMinutes,60);assert.equal(item.task.timing.referenceOnly,true);assert.deepEqual(item.task.timing,{...original,manualTotalMinutes:60,referenceOnly:true});
 assert.equal(L.regulationCoverage(e).unknownMinutes,0);assert.equal(L.regulationCoverage(e).minutes,60);assert.equal(item.task.reviewStatus,'review');
});
test('clearing a manually confirmed total keeps timing evidence and makes duration unknown',()=>{
 const {e,item}=fixture();item.task.timing={method:'explicit',totalMinutes:60,phases:[],evidence:[{sourceId:'synthetic-source',quotes:['Zeit: 60 Minuten']}],manualTotalMinutes:60,referenceOnly:true};const original=C.clone(item.task.timing);
 assert.equal(W.edit(e,item.id,'minutes',''),true);assert.equal(item.task.minutes,null);assert.deepEqual(item.task.timing,{...original,manualTotalMinutes:null});assert.equal(L.regulationCoverage(e).unknownMinutes,1);
});
test('unchanged total without source timing remains a no-op and keeps approval',()=>{
 const {e,item}=fixture(),before=JSON.stringify(e);assert.equal(W.edit(e,item.id,'minutes','60'),false);assert.equal(JSON.stringify(e),before);assert.equal(item.task.reviewStatus,'approved');assert.equal(item.task.timing,undefined);
});
