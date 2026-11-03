const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/planning.js'),C=require('../src/core.js');
const specialties=Object.keys(L.workbookCategories);
const task=(id,specialty='Baumschule',categories=['propagation'],extra={})=>({id,familyId:id,examType:'AP',specialty,kind:'practical',title:'Aufgabe '+id,text:'Komplexe praktische Aufgabe '+id,planningCategories:categories,planningCategoryCatalog:'excel-ap-2026',planningCategoryEvidence:'Geprüfter Aufgabenkopf',category:'Praktisch',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],minutes:60,points:100,solution:'Geprüfte Lösung',solutionStatus:'approved',reviewStatus:'approved',...extra});
const unit=(title,areaId)=>({title,areaId,reason:'Eigenständig durchzuführen und gesondert zu bewerten.'});
const exam=(tasks,specialty=tasks[0]?.specialty||'Baumschule')=>({...C.newExam({examType:'AP',specialty,pattern:L.regulationPattern('AP',specialty)}),items:tasks.map(t=>({id:'item-'+t.id,originTaskId:t.id,task:t}))});
const data=tasks=>({...C.empty(),tasks,families:tasks.map(t=>({id:t.familyId,title:t.title})),sources:[],uses:[]});
const areaTasks=(specialty,a,b)=>Array.from({length:a+b},(_,i)=>task(String(i),specialty,[i<a?L.workbookCategories[specialty].find(c=>L.regulationCategory({examType:'AP',specialty},c.id).areaId==='area1').id:L.workbookCategories[specialty].find(c=>L.regulationCategory({examType:'AP',specialty},c.id).areaId==='area2').id]));
const confirm=e=>{e.regulationReview=Object.fromEntries(L.regulationChecklist(e).map(x=>[x.id,true]));e.regulationReviewKey=L.regulationReviewKey(e);return e;};

test('seven Gärtner AP profiles specify law sections, five tasks, 300 minutes and distinct area minima',()=>{
 for(const specialty of specialties){const p=L.regulationProfile({examType:'AP',specialty});assert.equal(p.totalTasks,5);assert.equal(p.maxMinutes,300);assert.deepEqual(p.areas.map(a=>a.min),specialty==='Friedhofsgärtnerei'?[2,2]:[3,1]);assert.match(p.section,/^§ (9|1[0-5])$/);assert.match(p.url,/gesetze-im-internet.de/);assert.equal(p.overallWork,specialty==='Garten- und Landschaftsbau');}
 for(const examType of ['ZP','FW_AP'])assert.equal(L.regulationProfile({examType,specialty:'Gemüsebau'}),null);
 assert.equal(L.regulationProfile({examType:'AP',specialty:'Gemüsebau',qualification:'Gartenbaufachwerker'}),null);
});
test('cross-cutting checks preserve specialty-specific sales and marketing obligations with their area scope',()=>{
 const common=['Arbeitsschutz und Arbeitssicherheit','Natur- und Umweltschutz','Rationelle Energie- und Materialverwendung','Wahrnehmen und Beurteilen von Vorgängen','Beschaffen und Auswerten von Informationen'];
 const extra={Baumschule:[],Friedhofsgärtnerei:['Verkauf und Beratung (in beiden Bereichen)'],'Garten- und Landschaftsbau':[],Gemüsebau:['Vermarkten (im Bereich Ernte und Aufbereitung)'],Obstbau:['Vermarkten (im Bereich Ernte und Aufbereitung)'],Staudengärtnerei:['Verkaufen und Beraten (im Bereich Aufbereitung und Vermarktung)'],Zierpflanzenbau:['Verkaufen und Beraten (im Bereich Pflanzenverwendung)']};
 for(const specialty of specialties){const context={examType:'AP',specialty},profile=L.regulationProfile(context),check=L.regulationChecklist(context).find(c=>c.id==='crossCutting');assert.deepEqual(profile.crossCutting,[...common,...extra[specialty]],specialty);for(const topic of profile.crossCutting)assert.ok(check.explanation.includes(topic),specialty+' '+topic);assert.ok(check.reference.includes(profile.section+' Abs. 2 Nr. 1 und 2'));}
});
test('the source quote introducing examples preserves the distinct wording in section 12',()=>{
 for(const specialty of specialties)assert.equal(L.regulationProfile({examType:'AP',specialty}).quotes.examples,specialty==='Gemüsebau'?'Für die Prüfungsaufgaben kommen insbesondere folgende Gebiete in Betracht:':'Für die Prüfungsaufgaben kommen insbesondere in Betracht:');
});
test('zero selected tasks never pass while the law adds no minimum duration',()=>{
 for(const specialty of specialties){const empty=exam([],specialty),missing=L.regulationCoverage(empty);assert.equal(missing.total,0);assert.equal(missing.complete,false);assert.equal(C.readiness(confirm(empty)).ready,false);const tasks=areaTasks(specialty,...(specialty==='Friedhofsgärtnerei'?[2,3]:[3,2])).map(t=>({...t,minutes:0}));const supplied=L.regulationCoverage(exam(tasks));assert.equal(supplied.minutes,0);assert.equal(supplied.complete,true);}
});
test('all 83 workbook labels retain provenance while only 65 statutory examples map automatically',()=>{
 let direct=0,contextual=0;for(const specialty of specialties)for(const c of L.workbookCategories[specialty]){const m=L.regulationCategory({examType:'AP',specialty},c.id);if(m.explicit){direct++;assert.ok(['area1','area2'].includes(m.areaId));}else{contextual++;assert.equal(m.areaId,null);}}
 assert.equal(direct,65);assert.equal(contextual,18);
 for(const id of ['lifting','selection']){assert.equal(L.workbookCategories.Baumschule.find(c=>c.id===id).area,1);assert.equal(L.regulationCategory({examType:'AP',specialty:'Baumschule'},id).areaId,'area2');}
 assert.equal(L.workbookCategories.Zierpflanzenbau.find(c=>c.id==='harvest').area,2);assert.equal(L.regulationCategory({examType:'AP',specialty:'Zierpflanzenbau'},'harvest').areaId,'area1');
});
test('multi-tag papers remain one unit; mixed or contextual tags require explicit task assignment',()=>{
 const same=task('same','Baumschule',['propagation','plantwork']);assert.equal(L.regulationTask(same).units.length,1);assert.equal(L.regulationTask(same).units[0].areaId,'area1');
 for(const categories of [['propagation','advice'],['presentation'],['propagation','presentation']]){const t=task('unknown','Baumschule',categories);assert.equal(L.regulationTask(t).units.length,1);assert.equal(L.regulationTask(t).units[0].areaId,null);assert.ok(L.regulationTask(t).issues.length);assert.doesNotThrow(()=>C.checkTask(t));}
 const context=task('context','Baumschule',['presentation'],{practicalUnits:[unit('Vermarktungsauftrag','area2')]});assert.equal(L.regulationTask(context).units[0].areaId,'area2');assert.equal(L.regulationTask(context).units[0].explicit,true);C.checkTask(context);
});
test('named separately assessed units are counted once each, with task duration counted only once',()=>{
 const t=task('overall','Garten- und Landschaftsbau',['siteplanning','paving','naturalstone','planting','sowing'],{minutes:300});assert.equal(L.regulationCoverage(exam([t])).total,1);
 t.practicalUnits=[unit('Plan übertragen','area1'),unit('Pflastern','area1'),unit('Naturstein bearbeiten','area1'),unit('Pflanzen setzen','area2'),unit('Ansäen','area2')];const r=L.regulationCoverage(exam([t]));assert.equal(r.total,5);assert.equal(r.minutes,300);assert.equal(r.complete,true);assert.deepEqual(r.areas.map(a=>a.actual),[3,2]);
});
test('explicit metadata rejects malformed, duplicate and unsupported assignments while inferred unknowns remain drafts',()=>{
 for(const practicalUnits of [null,{},[],[{}],[unit('A','area3')],[{title:'A',areaId:'area1',reason:''}],[{title:' ',areaId:'area1',reason:'Test'}],[unit('A','area1'),unit(' a ','area2')]])assert.throws(()=>C.checkTask(task('t','Baumschule',['propagation'],{practicalUnits})),/Prüfungsaufgabe|Zuordnung|Begründung/);
 for(const examType of ['ZP','FW_AP'])assert.throws(()=>C.checkTask(task('t','Gemüsebau',['propagation'],{examType,planningCategoryCatalog:undefined,practicalUnits:[unit('A','area1')]})),/Gärtner|Abschlussprüfung/);
 assert.throws(()=>C.checkTask(task('oral','Baumschule',['propagation'],{kind:'oral',practicalUnits:[unit('A','area1')]})),/praktisch/);
});
test('all specialties accept their two five-task boundary distributions and reject too few, too many or deficient areas',()=>{
 for(const specialty of specialties){const pairs=specialty==='Friedhofsgärtnerei'?[[2,3],[3,2]]:[[3,2],[4,1]];for(const [a,b] of pairs)assert.equal(L.regulationCoverage(exam(areaTasks(specialty,a,b))).complete,true,specialty+' '+a+':'+b);
 for(const [a,b] of [[3,1],[4,2],[5,0],...(specialty==='Friedhofsgärtnerei'?[[4,1],[1,4]]:[[2,3]])])assert.equal(L.regulationCoverage(exam(areaTasks(specialty,a,b))).complete,false,specialty+' '+a+':'+b);}
});
test('unknown-area units consume the five slots and mismatched/non-practical items cannot satisfy quotas',()=>{
 const e=exam(areaTasks('Baumschule',3,1));e.items.push({task:task('extra','Baumschule',['presentation'])});let r=L.regulationCoverage(e);assert.equal(r.total,5);assert.equal(r.complete,false);e.items[4].task.practicalUnits=[unit('Präsentation','area2')];assert.equal(L.regulationCoverage(e).total,5);assert.equal(L.regulationCoverage(e).complete,true);
 for(const patch of [{kind:'oral'},{examType:'ZP'},{specialty:'Obstbau'}]){const invalid=structuredClone(e);Object.assign(invalid.items[4].task,patch);r=L.regulationCoverage(invalid);assert.equal(r.total,4);assert.equal(r.complete,false);}
 e.items.push({task:structuredClone(e.items[0].task)});assert.equal(L.regulationCoverage(e).complete,false);
});
test('300 minutes passes, 301 and unknown or conflicting duration stay incomplete',()=>{
 const e=exam(areaTasks('Baumschule',3,2));assert.equal(L.regulationCoverage(e).complete,true);e.items[0].task.minutes=61;assert.equal(L.regulationCoverage(e).complete,false);e.items[0].task.minutes=null;assert.equal(L.regulationCoverage(e).unknownMinutes,1);assert.equal(L.regulationCoverage(e).complete,false);e.items[0].task.minutes=60;e.items[0].task.timing={method:'conflict',phases:[],evidence:[]};assert.equal(L.regulationCoverage(e).complete,false);
});
test('a conflicting duration can be explicitly resolved without losing evidence, and a stale resolution stays open',()=>{
 const e=exam(areaTasks('Baumschule',3,2)),t=e.items[0].task;t.timing={method:'conflict',totalMinutes:null,phases:[{label:'Planung',minutes:20}],evidence:[{sourceId:'source-time',quotes:['60 Minuten','90 Minuten']}]};
 const evidence=structuredClone(t.timing);assert.equal(L.regulationCoverage(e).unknownMinutes,1);assert.equal(L.regulationCoverage(e).complete,false);
 t.timing.manualTotalMinutes=60;C.checkTask(t);const resolved=L.regulationCoverage(e);assert.equal(resolved.unknownMinutes,0);assert.equal(resolved.minutes,300);assert.equal(resolved.complete,true);assert.deepEqual({...t.timing,manualTotalMinutes:undefined},{...evidence,manualTotalMinutes:undefined});
 t.minutes=50;assert.equal(L.regulationCoverage(e).unknownMinutes,1);assert.equal(L.regulationCoverage(e).complete,false);t.minutes=null;assert.equal(L.regulationCoverage(e).unknownMinutes,1);t.minutes=60;t.timing.manualTotalMinutes=null;assert.equal(L.regulationCoverage(e).unknownMinutes,1);
});
test('manual total duration metadata accepts finite nonnegative numbers or null only',()=>{
 const t=task('timed');t.timing={method:'conflict',totalMinutes:null,phases:[],evidence:[]};
 for(const manualTotalMinutes of [undefined,null,0,60,60.5])assert.doesNotThrow(()=>C.checkTask({...t,timing:{...t.timing,manualTotalMinutes}}));
 for(const manualTotalMinutes of [-1,NaN,Infinity,'60',{},true])assert.throws(()=>C.checkTask({...t,timing:{...t.timing,manualTotalMinutes}}),/Zeit/);
});
test('new AP defaults use the regulation but legacy patterns remain unchanged and cannot bypass quotas',()=>{
 const d=data([]),p=L.pattern(d,'AP','Baumschule');assert.equal(p.ruleSet,'gaertner-ap-1996-v1');assert.equal(p.categoryCatalog,'excel-ap-2026');assert.deepEqual(p.slots,[]);assert.equal(p.status,'confirmed');L.checkPattern(p);
 assert.throws(()=>L.checkPattern({...p,examType:'ZP'}));assert.throws(()=>L.checkPattern({...p,ruleSet:'unknown'}));assert.throws(()=>L.checkPattern({...p,slots:[{categoryId:'propagation',count:1}]}));
 const legacy={id:'legacy',version:1,examType:'AP',specialty:'Baumschule',status:'confirmed',slots:[{categoryId:'propagation',count:1}]};d.patterns=[legacy];const before=JSON.stringify(d);assert.equal(L.pattern(d,'AP','Baumschule'),legacy);const e=exam([task('a')]);e.pattern=structuredClone(legacy);assert.equal(L.coverage(e).complete,false);assert.equal(JSON.stringify(d),before);assert.equal(L.coverage({...exam(areaTasks('Baumschule',3,2)),pattern:legacy}).complete,true);
});
test('proposals fill deficits and flexible fifth task, preserve rotation, exclude ambiguous areas and never change existing items',()=>{
 const tasks=[task('unknown','Baumschule',['presentation']),...areaTasks('Baumschule',5,2)];tasks.forEach((t,i)=>{t.sourceIds=['s'+i];});const d=data(tasks);d.sources=tasks.map((t,i)=>({id:'s'+i,year:2010+i}));const e=exam([]),before=JSON.stringify(e);let proposed=L.propose(d,e);assert.equal(proposed.length,5);assert.ok(!proposed.some(t=>t.id==='unknown'));assert.equal(JSON.stringify(e),before);assert.equal(L.regulationCoverage(exam(proposed)).complete,true);assert.ok(proposed.some(t=>t.id==='0'));assert.ok(proposed.some(t=>t.id==='5'));
 const partial=exam(areaTasks('Baumschule',3,1));partial.items.push({task:task('u','Baumschule',['presentation'])});assert.deepEqual(L.propose(d,partial),[]);
 const full=exam(proposed);assert.deepEqual(L.propose(d,full),[]);
 const multi=task('many','Baumschule',['propagation'],{minutes:120,practicalUnits:[unit('A','area1'),unit('B','area1')]});assert.ok(L.propose(data([multi]),exam(areaTasks('Baumschule',3,1))).length===0);
});
test('readiness requires explicit, current human reviews, including GaLa overall work',()=>{
 for(const specialty of specialties){const e=exam(areaTasks(specialty,...(specialty==='Friedhofsgärtnerei'?[2,3]:[3,2])));const ids=L.regulationChecklist(e).map(x=>x.id);assert.deepEqual(ids,['conversation','crossCutting','preparation','equalWeighting',...(specialty==='Garten- und Landschaftsbau'?['overallWork']:[])]);assert.equal(C.readiness(e).ready,false);e.regulationReview=Object.fromEntries(ids.map(id=>[id,true]));assert.equal(C.readiness(e).ready,false);confirm(e);assert.equal(C.readiness(e).ready,true);e.items[0].task.text+=' geändert';assert.equal(C.readiness(e).ready,false);}
});
test('review metadata validates boolean keys and fingerprints while edits invalidate task approval',()=>{
 const tasks=areaTasks('Baumschule',3,2),d=data(tasks);d.exams=[confirm(exam(tasks))];C.validate(d);for(const regulationReview of [true,[],{conversation:'true'},{unknown:true},{overallWork:true}]){const invalid=structuredClone(d);invalid.exams[0].regulationReview=regulationReview;assert.throws(()=>C.validate(invalid),/Bestätigung|Prüfungsverordnung/);}
 for(const regulationReviewKey of [true,{},'bad']){const invalid=structuredClone(d);invalid.exams[0].regulationReviewKey=regulationReviewKey;assert.throws(()=>C.validate(invalid),/Bestätigung|Prüfungsverordnung/);}
 const key=L.regulationReviewKey(d.exams[0]);d.exams[0].updatedAt='changed';assert.equal(L.regulationReviewKey(d.exams[0]),key);d.exams[0].notes='Neue Organisation';assert.notEqual(L.regulationReviewKey(d.exams[0]),key);
 const revised=C.revise(d,'0',{practicalUnits:[unit('Eigenständige Aufgabe','area1')]});assert.equal(revised.solutionStatus,'draft');assert.equal(revised.reviewStatus,'review');
});
test('full-snapshot revisions remove explicit units and return to automatic assignment without changing the old record',()=>{
 const old=task('original','Baumschule',['propagation'],{practicalUnits:[unit('Vermarktungsauftrag','area2')],timing:{method:'explicit',totalMinutes:60,phases:[],evidence:[]}}),d=data([old]),before=structuredClone(old),replacement=structuredClone(old);delete replacement.practicalUnits;delete replacement.timing;
 const next=C.revise(d,old.id,replacement,{replace:true});assert.equal(next.practicalUnits,undefined);assert.equal(next.timing,undefined);assert.equal(L.regulationTask(next).units[0].areaId,'area1');assert.equal(L.regulationTask(next).units[0].explicit,false);assert.equal(next.reviewStatus,'review');assert.equal(next.solutionStatus,'draft');assert.equal(next.previousId,old.id);assert.notEqual(next.id,old.id);assert.deepEqual(old,{...before,supersededBy:next.id});
});
test('full-snapshot AP to ZP revisions remove AP units and retain the Fachwerker scope guard',()=>{
 const old=task('original','Gemüsebau',['propagation'],{practicalUnits:[unit('Auftrag','area1')]}),d=data([old]),replacement={...structuredClone(old),examType:'ZP'};delete replacement.practicalUnits;const next=C.revise(d,old.id,replacement,{replace:true});assert.equal(next.examType,'ZP');assert.equal(next.practicalUnits,undefined);assert.equal(L.regulationProfile(next),null);C.checkTask(next);
 const fw={...structuredClone(next),examType:'FW_AP',planningCategoryCatalog:'fw-sources-2026'},snapshot=JSON.stringify(d);assert.throws(()=>C.revise(d,next.id,fw,{replace:true}),/Fachwerker/);assert.equal(JSON.stringify(d),snapshot);
});
test('partial revisions continue to preserve optional fields unless an explicit replacement is requested',()=>{
 const old=task('original','Baumschule',['propagation'],{practicalUnits:[unit('Auftrag','area2')]}),d=data([old]),next=C.revise(d,old.id,{title:'Neuer Titel'});assert.deepEqual(next.practicalUnits,old.practicalUnits);assert.equal(next.solutionStatus,'approved');assert.equal(next.reviewStatus,'approved');assert.equal(next.title,'Neuer Titel');
});
test('ZP and Fachwerker retain their independent category patterns without AP quotas or checklist',()=>{
 for(const examType of ['ZP','FW_AP']){const t=task('t','Gemüsebau',['propagation'],{examType,planningCategoryCatalog:examType==='FW_AP'?'fw-sources-2026':'excel-ap-2026'}),d=data([t]),p=L.pattern(d,examType,t.specialty);assert.equal(p.ruleSet,undefined);p.status='confirmed';const e={examType,specialty:t.specialty,pattern:p,items:[{task:t}]};assert.equal(L.regulationCoverage(e),null);assert.deepEqual(L.regulationChecklist(e),[]);assert.equal(L.coverage(e).complete,true);}
});
