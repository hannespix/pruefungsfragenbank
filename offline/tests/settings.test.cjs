const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/planning.js'),C=require('../src/core.js'),B=require('../src/catalog.js');
const custom='custom-11111111-2222-4333-8444-555555555555';
const task=(id='t',type='ZP',specialty='Baumschule')=>({id,familyId:'f-'+id,title:'Eine Tätigkeit',text:'Aufgabe: Vermehren von Pflanzen\nHier: Ein Arbeitsauftrag.',examType:type,specialty,kind:'practical',category:'',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],points:10,minutes:20,solution:'Antwort',solutionStatus:'approved',reviewStatus:'approved'});
const setting=(type='ZP',specialty='*')=>({id:`planning:${type}:${specialty}`,schemaVersion:1,revision:1,examType:type,specialty,categories:[]});
const project=tasks=>({...C.empty(),tasks,families:tasks.map(t=>({id:t.familyId,title:t.title}))});
const snapshot=(d,type='ZP',specialty='Baumschule',ids=['propagation'])=>L.snapshotPattern(d,{id:'p',examType:type,specialty,status:'confirmed',version:1,categoryCatalog:type==='ZP'?'zp-general-2026':type==='FW_AP'?'fw-sources-2026':'excel-ap-2026',slots:ids.map(categoryId=>({categoryId,count:1}))});

test('scoped settings rename without mutating matching rules or other catalogs; source IDs remain stable',()=>{
 const t=task(),d=project([t]),r=setting();r.categories=[{id:'propagation',label:'Unser neues Thema',help:'Ein Hinweis',order:0}];d.settings=[r];C.validate(d);
 assert.equal(L.resolveCatalog(d,t).find(c=>c.id==='propagation').label,'Unser neues Thema');assert.equal(L.classify(t,{context:L.projectContext(d,t)}).ids[0],'propagation');assert.notEqual(L.label('propagation',t),'Unser neues Thema');
 assert.equal(L.resolveCatalog(d,{examType:'ZP',specialty:'Gemüsebau'}).find(c=>c.id==='propagation').label,'Unser neues Thema');assert.equal(L.resolveCatalog(d,{examType:'ZP',specialty:'*'}).length,9);assert.notEqual(L.resolveCatalog(d,{examType:'AP',specialty:'Baumschule'}).find(c=>c.id==='propagation').label,'Unser neues Thema');
 assert.equal(B.facets(d).categories.find(c=>c.id==='propagation').label,'Unser neues Thema');assert.match(B.csv(d,[t]),/Unser neues Thema/);assert.equal(B.search(d,{query:'Unser neues Thema'}).length,1);
});
test('custom categories validate, filter, suggest and export with explicit project context',()=>{
 const t=task(),d=project([t]),r=setting();r.categories=[{id:custom,label:'Spezielle Arbeit'}];d.settings=[r];L.assignCategories(t,[custom],'Manuell geprüft',L.projectContext(d,t));C.validate(d);assert.throws(()=>C.checkTask(t),/Kategorie/);
 assert.deepEqual(L.classify(t,{context:L.projectContext(d,t)}).ids,[custom]);assert.deepEqual(B.facets(d).categories.map(c=>c.id),[custom]);assert.equal(B.package(d,[t]).tasks[0].categories[0].label,'Spezielle Arbeit');
 const e=C.newExam({examType:'ZP',specialty:'Baumschule',pattern:snapshot(d,'ZP','Baumschule',[custom])});assert.deepEqual(L.propose(d,e).map(t=>t.id),['t']);C.addItem(e,t);d.exams.push(e);C.validate(d);assert.equal(L.coverage(e).complete,false);assert.match(L.coverage(e).issues.join(' '),/1 von 3/);
});
test('new exam definitions freeze labels while legacy snapshots retain original labels',()=>{
 const d=project([task()]),r=setting();r.categories=[{id:'propagation',label:'Stand A'}];d.settings=[r];const e=C.newExam({examType:'ZP',specialty:'Baumschule',pattern:snapshot(d)});C.addItem(e,d.tasks[0]);d.exams.push(e);const old=JSON.stringify(e);r.categories[0].label='Stand B';r.revision++;
 C.validate(d);assert.equal(L.label('propagation',L.examContext(e)),'Stand A');assert.equal(JSON.stringify(e),old);assert.equal(L.label('propagation',{...e,pattern:{...e.pattern,categoryDefinitions:undefined}}),'Vermehren von Pflanzen');
 assert.equal(L.label('propagation',L.projectContext(d,e)),'Stand A'); // Explicit exam context wins over the live project.
});
test('hidden IDs remain valid in bank and saved exams but disappear from new choices and suggestions',()=>{
 const t=task(),d=project([t]),r=setting();d.settings=[r];const e=C.newExam({examType:'ZP',specialty:'Baumschule',pattern:snapshot(d)});C.addItem(e,t);d.exams.push(e);r.categories=[{id:'propagation',hidden:true}];r.revision++;
 C.validate(d);assert.ok(!L.categories(d,'ZP','Baumschule').some(c=>c.id==='propagation'));assert.equal(L.coverage(e).complete,false);assert.match(L.coverage(e).issues.join(' '),/1 von 3/);assert.deepEqual(L.rank(d,'ZP','Baumschule','propagation'),[]);
 const fresh=C.newExam({examType:'ZP',specialty:'Baumschule',pattern:snapshot(d)});assert.throws(()=>C.addItem(fresh,t),/aktiven Generalthemen/);assert.deepEqual(L.propose(d,fresh),[]);fresh.items=[structuredClone(e.items[0])];assert.equal(L.coverage(fresh).complete,false);
});
test('settings cannot erase referenced custom IDs, inject unsupported rules, or use malformed IDs',()=>{
 const t=task(),d=project([t]),r=setting();r.categories=[{id:custom,label:'Eigenes Thema'}];d.settings=[r];L.assignCategories(t,[custom],'Prüfung',L.projectContext(d,t));const next={...structuredClone(r),revision:2,categories:[]};assert.throws(()=>L.checkSettings(next,r,d),/ausblenden/);
 assert.throws(()=>L.checkSettings({...r,totalTasks:1}),/Unbekannte/);assert.throws(()=>L.checkSettings({...r,categories:[{id:'custom-untrusted',label:'X'}]}),/kennung/);assert.throws(()=>L.checkSettings({...r,categories:[{id:'propagation',label:'X',areaId:'area2'}]}),/Unbekannte/);
 const hidden={...structuredClone(r),revision:2};hidden.categories[0].hidden=true;assert.doesNotThrow(()=>L.checkSettings(hidden,r,d));
});
test('custom AP category never gains statutory area merely from an administrative category',()=>{
 const t=task('ap','AP'),d=project([t]),r=setting('AP','Baumschule');r.categories=[{id:custom,label:'Eigene AP-Arbeit'}];d.settings=[r];L.assignCategories(t,[custom],'Manuell',L.projectContext(d,t));C.validate(d);assert.equal(L.regulationTask(t,L.projectContext(d,t)).units[0].areaId,null);
 t.practicalUnits=[{title:'Selbständige Arbeit',areaId:'area1',reason:'Fachlich anhand des Auftrags geprüft.'}];C.validate(d);assert.equal(L.regulationTask(t,L.projectContext(d,t)).units[0].areaId,'area1');assert.equal(L.regulationProfile(t).totalTasks,5);assert.equal(L.regulationProfile(t).maxMinutes,300);
});
test('portable settings survive subset/JSON and conflicting merges reject atomically',()=>{
 const t=task(),d=project([t]),r=setting();r.categories=[{id:custom,label:'Eigenes Thema'}];d.settings=[r];L.assignCategories(t,[custom],'Geprüft',L.projectContext(d,t));const partial=C.subset(d,'Baumschule');assert.equal(partial.settings[0].id,r.id);C.validate(JSON.parse(JSON.stringify(partial)));
 const incoming=structuredClone(d);incoming.settings[0].categories[0].label='Andere Bezeichnung';incoming.settings[0].revision++;const before=JSON.stringify(d);assert.throws(()=>C.merge(d,incoming),/Grundeinstellungen/);assert.equal(JSON.stringify(d),before);assert.equal(C.merge(d,d).db.settings.length,1);
});
test('defaults substitute known placeholders, preserve literal text, and never relax AP duration',()=>{
 const d=project([]),r=setting('AP','Baumschule');r.defaults={title:'{pruefungsart} {fachrichtung} {jahr} {unknown}',notes:'Jahr {jahr}',targetMinutes:240};d.settings=[r];L.checkSettings(r);assert.deepEqual(L.examDefaults(d,'AP','Baumschule',2027),{title:'Abschlussprüfung Baumschule 2027 {unknown}',notes:'Jahr 2027',targetMinutes:240});assert.throws(()=>L.checkSettings({...r,defaults:{targetMinutes:301}}),/Zielzeit/);
});
test('incomplete ZP selection can be saved without satisfying coverage',()=>{const d=project([]),p=snapshot(d,'ZP','Baumschule',[]);assert.doesNotThrow(()=>L.checkPattern(p));assert.equal(L.coverage({examType:'ZP',specialty:'Baumschule',pattern:p,items:[]}).complete,false);});
test('AP selected themes filter proposals without changing practical legal coverage',()=>{const a=task('a','AP'),b=task('b','AP');L.assignCategories(a,['propagation'],'Geprüft');L.assignCategories(b,['selection'],'Geprüft');const d=project([a,b]),e=C.newExam({examType:'AP',specialty:'Baumschule',pattern:L.snapshotPattern(d,L.regulationPattern('AP','Baumschule')),selectedCategoryIds:['propagation']});assert.deepEqual(L.propose(d,e).map(t=>t.id),['a']);assert.equal(L.regulationCoverage(e).profile.totalTasks,5);d.exams.push(e);C.validate(d);e.selectedCategoryIds=['nonexistent'];assert.throws(()=>C.validate(d),/Themenauswahl/);});

test('empty new Fachwerker snapshots remain saveable unfinished drafts and workflow step is bounded',()=>{const d=project([]),p=L.snapshotPattern(d,L.inferPattern(d,'FW_AP','Gemüsebau')),e=C.newExam({examType:'FW_AP',specialty:'Gemüsebau',pattern:p,workflowStep:1});d.exams.push(e);assert.doesNotThrow(()=>C.validate(d));assert.equal(L.coverage(e).complete,false);e.workflowStep=4;assert.throws(()=>C.validate(d),/Bearbeitungsschritt/);});

test('adding a custom Fachwerker category does not crash automatic classification of ordinary source tasks',()=>{const t=task('fw','FW_AP','Gemüsebau'),d=project([t]),r=setting('FW_AP','Gemüsebau');r.categories=[{id:custom,label:'Eigene Fachwerker-Arbeit'}];d.settings=[r];const context=L.projectContext(d,t);assert.deepEqual(L.classify(t,{context}).ids,['propagation']);t.text='Aufgabe: Noch ungeklärte Tätigkeit';assert.deepEqual(L.classify(t,{context}).ids,['unassigned']);L.assignCategories(t,[custom],'Bestätigt',context);assert.deepEqual(L.classify(t,{context}).ids,[custom]);C.validate(d);});
