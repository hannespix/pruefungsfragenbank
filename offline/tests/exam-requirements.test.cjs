const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/planning.js'),C=require('../src/core.js');
const makeTask=(id,type='ZP',category='plantwork',extra={})=>({id,familyId:id,title:'Synthetische Aufgabe '+id,text:'Geprüfter praktischer Auftrag.',examType:type,specialty:type==='FW_AP'?'Gemüsebau':'Baumschule',kind:'practical',planningCategories:[category],planningCategoryCatalog:type==='ZP'?'zp-general-2026':type==='FW_AP'?'fw-sources-2026':'excel-ap-2026',planningCategoryEvidence:'Synthetisch bestätigter Aufgabenkopf',category:'Praktisch',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],points:100,minutes:type==='AP'?60:type==='FW_AP'?45:30,solution:'Geprüfte Lösung',solutionStatus:'approved',reviewStatus:'approved',...extra});
const data=tasks=>({...C.empty(),tasks,families:tasks.map(t=>({id:t.familyId,title:t.title}))});
const exam=(tasks,type=tasks[0]?.examType||'ZP',specialty=tasks[0]?.specialty||'Baumschule')=>C.newExam({examType:type,specialty,examYear:2027,pattern:P.pattern(data(tasks),type,specialty)});
const withItems=(e,tasks)=>({...e,items:tasks.map(t=>({id:'item-'+t.id,originTaskId:t.id,task:t}))});

test('new ZP fixes three distinct themes even when six themes or an old six-slot pattern exist',()=>{
 const ts=['plantwork','machinery','propagation','materials','soil','maintenance'].map(id=>makeTask(id)),d=data(ts);d.patterns=[{id:'old',examType:'ZP',specialty:'Baumschule',categoryCatalog:'zp-general-2026',status:'confirmed',version:1,slots:ts.map(t=>({categoryId:t.planningCategories[0],count:1}))}];
 const before=JSON.stringify(d),p=P.pattern(d,'ZP','Baumschule');assert.equal(p.slots.length,3);assert.equal(new Set(p.slots.map(s=>s.categoryId)).size,3);assert.equal(JSON.stringify(d),before);
 assert.equal(P.examRequirements(p).totalTasks,3);assert.equal(P.examRequirements(p).themeCount,3);
 const e=withItems(exam(ts),[ts[0]]);assert.equal(P.structureCoverage(e).complete,false);assert.match(P.structureCoverage(e).issues.join(' '),/1 von 3/);
});

test('AP additions reserve space for area minima and count complex units instead of pages',()=>{
 const ts=[0,1,2].map(i=>makeTask('production'+i,'AP','propagation')),harvest=makeTask('harvest','AP','lifting'),e=exam([...ts,harvest]);
 for(const t of ts)C.addItem(e,t);C.addItem(e,harvest);C.addItem(e,makeTask('fifth','AP','plantwork'));
 const before=JSON.stringify(e);assert.throws(()=>C.addItem(e,makeTask('sixth','AP','plantwork')),/5|fünf/);assert.equal(JSON.stringify(e),before);
 const impossible=withItems(exam([harvest]),[harvest,makeTask('second','AP','lifting')]);assert.match(P.structureSelectionIssue(impossible,makeTask('third','AP','lifting')),/Bereich|Mindest/);
 const combined=makeTask('combined','AP','propagation',{minutes:240,practicalUnits:[0,1,2,3].map(i=>({title:'Eigenständige Aufgabe '+i,areaId:i===3?'area2':'area1',reason:'Gesondert bewertet.'}))});
 const c=exam([combined]);C.addItem(c,combined);C.addItem(c,makeTask('last','AP','plantwork'));assert.equal(P.structureCoverage(c).total,5);assert.equal(c.items.length,2);
});

test('Friedhof retains two plus two minima and flexible fifth task',()=>{
 const tasks=[0,1,2,3,4].map((n)=>makeTask('f'+n,'AP',n<2?'soil':'funeral',{specialty:'Friedhofsgärtnerei'}));
 const e=withItems(exam(tasks),tasks),c=P.structureCoverage(e);assert.equal(c.complete,true);assert.deepEqual(c.areas.map(a=>[a.min,a.actual]),[[2,2],[2,3]]);
});

test('AP automatic proposals never offer a combined sheet that consumes space required by the other area',()=>{
 const invalid=makeTask('all-production','AP','propagation',{minutes:240,practicalUnits:Array.from({length:5},(_,n)=>({title:'Auftrag '+n,areaId:'area1',reason:'Getrennt bewertet.'}))});
 const d=data([invalid]),e=exam([invalid]);assert.deepEqual(P.propose(d,e),[]);
 const viable=[makeTask('first','AP','propagation'),makeTask('second','AP','propagation'),makeTask('third','AP','propagation'),makeTask('fourth','AP','lifting')];d.tasks.push(...viable);
 const offered=P.propose(d,e);assert.equal(offered.length,4);for(const t of offered)assert.doesNotThrow(()=>C.addItem(e,t));
});

test('FW proposals fill four tasks even if two use the same main theme',()=>{
 const tasks=['soil','propagation','plantwork','plantwork'].map((cat,n)=>makeTask('fw'+n,'FW_AP',cat)),d=data(tasks),e=exam(tasks),suggested=P.propose(d,e);
 assert.equal(suggested.length,4);assert.equal(new Set(suggested.flatMap(t=>t.planningCategories)).size,3);
 for(const t of suggested)C.addItem(e,t);assert.equal(P.structureCoverage(e).complete,true);assert.throws(()=>C.addItem(e,makeTask('extra','FW_AP','machinery')),/4|vier/);
 e.items[0].task.minutes=25;assert.match(P.structureCoverage(e).issues.join(' '),/160.*180/);assert.throws(()=>C.assertStructurePolicy(e),/180/);
});

test('ZP proposals cap legacy oversized patterns and rotate feasible alternatives',()=>{
 const tasks=['plantwork','machinery','propagation','materials'].flatMap(cat=>[makeTask(cat, 'ZP',cat),makeTask(cat+'other','ZP',cat)]),d=data(tasks),e=exam(tasks);
 e.pattern.slots=tasks.filter(t=>!t.id.endsWith('other')).map(t=>({categoryId:t.planningCategories[0],count:1}));
 const a=P.propose(d,e),b=P.propose(d,e);assert.equal(a.length,3);assert.equal(b.length,3);assert.equal(new Set(a.flatMap(t=>t.planningCategories)).size,3);assert.notDeepEqual(a.map(t=>t.id),b.map(t=>t.id));
 assert.equal(P.structureCoverage(withItems(e,a)).complete,false);assert.match(P.themeSelectionIssue(e),/drei|3/);
});

test('structure checks count only practical tasks and require known positive timings',()=>{
 const tasks=['plantwork','soil','propagation'].map(cat=>makeTask(cat,'ZP',cat)),e=withItems(exam(tasks),tasks);e.oralItem={task:makeTask('oral','AP','plantwork',{kind:'oral',minutes:60})};
 assert.equal(P.structureCoverage(e).total,3);assert.equal(P.structureCoverage(e).minutes,90);assert.equal(P.structureCoverage(e).complete,true);
 e.items[0].task.minutes=null;assert.equal(P.structureCoverage(e).unknownMinutes,1);assert.throws(()=>C.assertStructurePolicy(e),/Zeit/);
 e.items[0].task.minutes=150;assert.match(P.structureCoverage(e).issues.join(' '),/210.*180/);
});

test('legacy invalid drafts remain loadable and can improve without admitting new excess',()=>{
 const ts=Array.from({length:6},(_,n)=>makeTask('a'+n,'AP',n<4?'plantwork':'lifting',{minutes:40})),e=withItems(exam(ts),ts);
 assert.equal(P.structureTransitionIssue({...e,internalNotes:'Neue interne Notiz'},e),null);
 const improved={...e,items:e.items.slice(0,5)};assert.equal(P.structureTransitionIssue(improved,e),null);
 assert.match(P.structureTransitionIssue({...e,items:[...e.items,{id:'extra',task:makeTask('extra','AP')}]},e),/5|fünf/);
 const d=data(ts);d.exams=[e];const before=JSON.stringify(d);C.validate(d);assert.equal(JSON.stringify(d),before);
});

test('AP handoff rejects a category hidden in its own snapshot while allowing legacy autosave',()=>{
 const tasks=Array.from({length:5},(_,n)=>makeTask('hidden'+n,'AP',n<3?'plantwork':'lifting')),e=withItems(exam(tasks),tasks);
 assert.equal(P.structureCoverage(e).complete,true);e.pattern.categoryDefinitions.find(c=>c.id==='plantwork').hidden=true;
 assert.equal(P.structureTransitionIssue({...e,internalNotes:'Nur eine Notiz'},e),null);
 assert.equal(P.structureCoverage(e).complete,false);assert.throws(()=>C.assertStructurePolicy(e),/Thema|freigegeben/);
});
