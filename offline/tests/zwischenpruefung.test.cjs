const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/planning.js'),C=require('../src/core.js');
const themes=[
 ['plantwork','Durchführen von Arbeiten an der Pflanze'],
 ['machinery','Einsatz von Werkzeug und Geräten'],
 ['propagation','Vermehren von Pflanzen'],
 ['materials','Be- und Verarbeiten von Materialien und Werkstoffen'],
 ['soil','Durchführen von Bodenbearbeitungsmaßnahmen'],
 ['maintenance','Durchführen von Pflegemaßnahmen an Maschinen, Geräten oder baulichen Anlagen'],
 ['harvest','Erntearbeiten'],
 ['preparation','Aufbereitung'],
 ['plantuse','Verwendung der Pflanzen']
];
function task(id,categoryId='plantwork',extra={}){return {id,familyId:id,title:'Synthetische Einzelaufgabe',text:`Aufgabe:\n${themes.find(c=>c[0]===categoryId)?.[1]||categoryId}\nHier: synthetischer Arbeitsauftrag.`,examType:'ZP',specialty:'Baumschule',kind:'practical',category:'Praktische Arbeitsaufgabe',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],points:10,minutes:20,solution:'',solutionStatus:'missing',reviewStatus:'review',...extra};}
function db(tasks=[]){return {...C.empty(),tasks,families:[...new Set(tasks.map(t=>t.familyId))].map(id=>({id,title:id}))};}
function exam(d,ids){const pattern=P.inferPattern(d,'ZP','Baumschule');if(ids)pattern.slots=ids.map(categoryId=>({categoryId,count:1}));if(pattern.slots.length)pattern.status='confirmed';return C.newExam({examType:'ZP',specialty:'Baumschule',pattern});}

test('the nine-theme master retains exact names while specialties offer their evidenced subset; AP and Fachwerker stay separate',()=>{
 const expected=themes.map(([id,label])=>({id,label}));
 assert.deepEqual(P.resolveCatalog(db(),{examType:'ZP',specialty:'*'}).map(({id,label})=>({id,label})),expected);for(const specialty of C.specialties){const scoped=P.zwischenpruefungScope({examType:'ZP',specialty});assert.deepEqual(P.categories(db(),'ZP',specialty),scoped);assert.ok(scoped.every(c=>expected.some(x=>x.id===c.id&&x.label===c.label)));}
 for(const context of [{examType:'AP',specialty:'Baumschule'},{examType:'FW_AP',specialty:'Gemüsebau'},{examType:'ZP',specialty:'Gemüsebau',qualification:'Gartenbaufachwerker 172'},{examType:'ZP',specialty:'Gemüsebau',qualification:'170'},{examType:'ZP',specialty:'Gemüsebau',qualification:'FW'},{examType:'ZP',specialty:'GaLaBau'}])assert.equal(P.zwischenpruefungScope(context),null);
 assert.equal(P.label('propagation',{examType:'AP',specialty:'Baumschule'}),'Vermehren von Gehölzen');
 assert.equal(P.categories(db(),'FW_AP','Gemüsebau').length,7);
});

test('current ZP distinguishes harvest and preparation from headings and ignores body words and old AP assignments',()=>{
 for(const [id] of themes){const t=task(id,id,{planningCategories:[],planningCategoryCatalog:'excel-ap-2026',planningCategoryEvidence:'Historische Zuordnung'}),before=structuredClone(t);assert.deepEqual(P.classify(t).ids,[id]);assert.equal(P.eligibleZwischenpruefungTask(t),!['preparation','plantuse'].includes(id));assert.deepEqual(t,before);}
 const harvest=task('harvest','harvest',{planningCategories:['lifting'],planningCategoryCatalog:'excel-ap-2026'});assert.deepEqual(P.classify(harvest).ids,['harvest']);
 const t=task('plant','plantwork',{planningCategories:['harvest','preparation'],planningCategoryCatalog:'excel-ap-2026'});t.text+=' Danach die Aufbereitung und Erntearbeiten erläutern.';assert.deepEqual(P.classify(t).ids,['plantwork']);assert.equal(P.eligibleZwischenpruefungTask(t),true);
 assert.deepEqual(P.classify(task('maintenance','Durchführung von Pflegemaßnahmen an Maschinen, Geräten und baulichen Anlagen')).ids,['maintenance']);
 assert.deepEqual(P.classify(task('machinery','Einsatz von Maschinen, Werkzeugen und Geräten')).ids,['machinery']);
 assert.deepEqual(P.classify(task('unknown','Durchführen von Pflanzenschutzmaßnahmen')).ids,['unassigned']);
});

test('combined source tasks remain classified for review but cannot become eligible through a manual single-theme override',()=>{
 const combo=task('combo','Erntearbeiten und Aufbereitung');assert.deepEqual(P.classify(combo).ids,['harvest','preparation']);assert.equal(P.eligibleZwischenpruefungTask(combo),false);
 P.assignCategories(combo,['harvest'],'Manuelle Einzelzuordnung');assert.deepEqual(P.classify(combo).ids,['harvest']);assert.equal(P.eligibleZwischenpruefungTask(combo),false);
 for(const t of [task('title','plantwork',{title:'Kombinationsaufgabe'}),task('units','plantwork',{practicalUnits:[{},{}]}),task('oral','plantwork',{kind:'oral'}),task('wrong','plantwork',{examType:'AP'}),task('unknown','Unbekannt')])assert.equal(P.eligibleZwischenpruefungTask(t),false);
});

test('new patterns preselect exactly three available themes and partial pools remain incomplete',()=>{
 const d=db([task('a','plantwork'),task('b','Erntearbeiten und Aufbereitung'),task('c','Unbekannt')]),p=P.pattern(d,'ZP','Baumschule');assert.equal(p.categoryCatalog,'zp-general-2026');assert.equal(p.slots.length,3);assert.equal(p.slots[0].categoryId,'plantwork');
 const e=exam(d);C.addItem(e,d.tasks[0]);assert.equal(P.coverage(e).complete,false);assert.match(P.coverage(e).issues.join(' '),/1 von 3/);
 assert.throws(()=>P.checkPattern({...p,slots:[{categoryId:'plantwork',count:2}]}),/genau einer/);
 assert.throws(()=>P.checkPattern({...p,slots:[{categoryId:'protection',count:1}]}),/Generalthemen/);
 assert.throws(()=>P.checkPattern({...p,examType:'AP'}),/Kategorienstand/);
 const empty=P.pattern(db(),'ZP','Baumschule');assert.equal(empty.categoryCatalog,'zp-general-2026');assert.equal(empty.slots.length,3);assert.doesNotThrow(()=>P.checkPattern(empty));assert.deepEqual(P.propose(db(),{examType:'ZP',specialty:'Baumschule',pattern:empty,items:[]}),[]);assert.match(P.coverage({examType:'ZP',specialty:'Baumschule',pattern:empty,items:[]}).issues.join(' '),/0 von 3/);
 assert.doesNotThrow(()=>P.checkPattern({...empty,status:'confirmed'}));assert.equal(P.coverage({examType:'ZP',specialty:'Baumschule',pattern:{...empty,status:'confirmed'},items:[]}).complete,false);
});

test('old pattern snapshots and Excel assignments retain their old labels, counts and classification',()=>{
 const t=task('old','harvest',{planningCategories:['lifting'],planningCategoryCatalog:'excel-ap-2026'}),d=db([t]),old={id:'old-pattern',version:1,examType:'ZP',specialty:'Baumschule',status:'confirmed',categoryCatalog:'excel-ap-2026',slots:[{categoryId:'lifting',count:2}]};
 d.patterns=[old];const before=structuredClone(d);C.validate(d);assert.deepEqual(P.patternClassify(t,old).ids,['lifting']);assert.equal(P.label('propagation',{...t,pattern:old}),'Vermehren von Gehölzen');
 const unversioned={...old,categoryCatalog:undefined,slots:[{categoryId:'harvest',count:1}]};assert.deepEqual(P.patternClassify(t,unversioned).ids,['harvest']);assert.equal(P.label('harvest',{...t,pattern:unversioned}),'Ernte & Aufbereitung');assert.equal(P.coverage({examType:'ZP',specialty:'Baumschule',pattern:unversioned,items:[{task:t}]}).complete,false);
 const fresh=P.pattern(d,'ZP','Baumschule');assert.equal(fresh.categoryCatalog,'zp-general-2026');assert.equal(fresh.status,'confirmed');assert.equal(fresh.slots.length,3);assert.ok(fresh.slots.some(s=>s.categoryId==='harvest'));assert.deepEqual(d,before);
 old.slots=[{categoryId:'propagation',count:3},{categoryId:'lifting',count:1}];assert.equal(P.pattern(d,'ZP','Baumschule').slots.length,3);assert.ok(P.pattern(d,'ZP','Baumschule').slots.some(s=>s.categoryId==='propagation'));assert.equal(old.slots[0].count,3);
});

test('manual add and replacement guards reject combinations and repeated themes without touching snapshots',()=>{
 const first=task('first'),second=task('second'),combo=task('combo','Erntearbeiten und Aufbereitung'),d=db([first,second,combo]),e=exam(d,['plantwork','harvest']);
 const item=C.addItem(e,first),before=structuredClone(e);assert.throws(()=>C.addItem(e,second),/höchstens eine Aufgabe je Generalthema/);assert.throws(()=>C.addItem(e,combo),/Kombinationsaufgaben/);assert.deepEqual(e,before);
 assert.equal(P.zwischenpruefungSelectionIssue(e,second,item.id),'');assert.match(P.zwischenpruefungSelectionIssue(e,second),/höchstens/);assert.match(P.zwischenpruefungSelectionIssue(e,task('wrong','soil',{specialty:'Gemüsebau'})),/Prüfungsbereich/);
 const legacy=C.newExam({examType:'ZP',specialty:'Baumschule',pattern:{id:'legacy',version:1,examType:'ZP',specialty:'Baumschule',status:'confirmed',slots:[{categoryId:'plantwork',count:2}]}});C.addItem(legacy,first);assert.throws(()=>C.addItem(legacy,second),/höchstens eine Aufgabe/);
 const invalid={...e,items:[...e.items,{id:'duplicate',task:second},{id:'combo',task:combo}]};assert.equal(P.coverage(invalid).complete,false);assert.match(P.coverage(invalid).issues.join(' '),/anderen Generalthema/);assert.match(P.coverage(invalid).issues.join(' '),/Kombinationsaufgaben/);
});

test('proposals rotate all alternative families, prioritize older recorded uses and leave data untouched',()=>{
 const tasks=['old','middle','recent'].map(id=>task(id)),d=db(tasks);d.exams=tasks.map(t=>({id:t.id+'-use',examType:'ZP',specialty:'Baumschule'}));d.uses=tasks.map((t,i)=>({examId:t.id+'-use',familyIds:[t.familyId],taskIds:[t.id],date:`202${i+2}-02-01`}));
 const e=exam(d),before=structuredClone(d),proposals=Array.from({length:4},()=>P.propose(d,{...e,items:[]}).map(t=>t.familyId));assert.deepEqual(proposals,[['old'],['middle'],['recent'],['old']]);assert.deepEqual(d,before);
});

test('single-theme matching avoids family dead ends, existing themes and combinations, and varies when alternatives are feasible',()=>{
 const tasks=[task('shared-plant','plantwork',{familyId:'shared'}),task('shared-soil','soil',{familyId:'shared'}),task('own-plant','plantwork'),task('alternative-plant','plantwork'),task('combo','Durchführen von Arbeiten an der Pflanze und Durchführen von Bodenbearbeitungsmaßnahmen')],d=db(tasks),e=exam(d,['plantwork','soil']);
 const a=P.propose(d,e),b=P.propose(d,e);for(const result of [a,b]){assert.equal(result.length,2);assert.equal(new Set(result.map(t=>t.familyId)).size,2);assert.equal(new Set(result.flatMap(t=>P.classify(t).ids)).size,2);assert.ok(result.every(P.eligibleZwischenpruefungTask));}assert.notDeepEqual(a.map(t=>t.familyId),b.map(t=>t.familyId));
 C.addItem(e,tasks[1]);const remaining=P.propose(d,e);assert.equal(remaining.length,1);assert.deepEqual(P.classify(remaining[0]).ids,['plantwork']);assert.notEqual(remaining[0].familyId,'shared');
 const fixed=db([task('only')]),fixedExam=exam(fixed);assert.deepEqual(P.propose(fixed,fixedExam).map(t=>t.id),['only']);assert.deepEqual(P.propose(fixed,fixedExam).map(t=>t.id),['only']);
});

test('new manual general assignments validate without invalidating historical Excel records',()=>{
 const t=task('manual','Unbekannt');P.assignCategories(t,['preparation'],'Fachlich bestätigt');assert.equal(t.planningCategoryCatalog,'zp-general-2026');assert.doesNotThrow(()=>C.checkTask(t));assert.equal(P.eligibleZwischenpruefungTask(t),false);const context={examType:'ZP',specialty:'Baumschule',specialtyThemesVersion:1,categoryDefinitions:P.resolveCatalog(null,{examType:'ZP',specialty:'*'})};assert.equal(P.eligibleZwischenpruefungTask(t,context),true);
 assert.throws(()=>C.checkTask({...t,planningCategories:['lifting']}),/Kategorie/);assert.throws(()=>C.checkTask({...t,examType:'AP'}),/Kategorie/);
 const old=task('old','harvest',{planningCategories:['lifting'],planningCategoryCatalog:'excel-ap-2026'});assert.doesNotThrow(()=>C.checkTask(old));
});

test('when only one family exists, available variants still rotate without using a family twice',()=>{
 const d=db([task('variant-a','plantwork',{familyId:'same'}),task('variant-b','plantwork',{familyId:'same'})]),e=exam(d),first=P.propose(d,e),second=P.propose(d,e);assert.notEqual(first[0].id,second[0].id);assert.equal(first[0].familyId,second[0].familyId);assert.equal(second.length,1);
});

test('rotation rematches themes when an alternate task set uses the same families',()=>{
 const d=db(['A','B'].flatMap(familyId=>[task(familyId+'-plant','plantwork',{familyId}),task(familyId+'-soil','soil',{familyId})])),e=exam(d,['plantwork','soil']);
 const proposals=Array.from({length:4},()=>P.propose(d,e));
 for(let i=0;i<proposals.length;i++){const result=proposals[i];assert.equal(result.length,2);assert.deepEqual(result.map(t=>t.familyId).sort(),['A','B']);assert.deepEqual(result.flatMap(t=>P.classify(t).ids).sort(),['plantwork','soil']);if(i)assert.notDeepEqual(result.map(t=>t.id).sort(),proposals[i-1].map(t=>t.id).sort());}
});
