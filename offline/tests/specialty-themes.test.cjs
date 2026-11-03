const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/planning.js'),C=require('../src/core.js');
const gala='Garten- und Landschaftsbau',core=['plantwork','machinery','propagation','materials','soil','maintenance'];
const ids=(d,s)=>P.categories(d,'ZP',s).map(c=>c.id);
const setting=(s,categories)=>({id:'planning:ZP:'+s,examType:'ZP',specialty:s,schemaVersion:1,revision:1,categories});
const task=(id,s=gala)=>({id,familyId:id,title:id,text:'Aufgabe: '+({harvest:'Erntearbeiten',soil:'Durchführen von Bodenbearbeitungsmaßnahmen'}[id]||id)+'\nHier: Synthetische Tätigkeit.',examType:'ZP',specialty:s,kind:'practical',category:'',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],points:10,minutes:20,solution:'',reviewStatus:'review',solutionStatus:'missing'});
test('ZP defaults follow specialty evidence and keep common statutory themes even when no originals exist',()=>{
 const expected={'Baumschule':[...core,'harvest'],'Gemüsebau':[...core,'harvest'],'Obstbau':core,'Friedhofsgärtnerei':core,[gala]:core,'Staudengärtnerei':[...core,'plantuse'],'Zierpflanzenbau':[...core,'plantuse']};
 for(const [s,want]of Object.entries(expected)){assert.deepEqual(ids(C.empty(),s),want,s);assert.deepEqual(P.zwischenpruefungScope({examType:'ZP',specialty:s}).map(c=>c.id),want,s);}
});
test('ZP settings affect only their own specialty; legacy global names cannot enable unsupported extras',()=>{
 const d=C.empty();d.settings=[setting('*',[{id:'soil',label:'Gemeinsamer Altname'},{id:'preparation',hidden:false}]),setting('Gemüsebau',[{id:'preparation',hidden:false}])];
 assert.doesNotThrow(()=>C.validate(d));assert.equal(P.settingsId({examType:'ZP',specialty:gala}),'planning:ZP:'+gala);
 assert.deepEqual(ids(d,gala),core);assert.ok(ids(d,'Gemüsebau').includes('preparation'));assert.ok(!ids(d,'Baumschule').includes('preparation'));
 assert.equal(P.categories(d,'ZP',gala).find(c=>c.id==='soil').label,'Gemeinsamer Altname');
});
test('old nine-theme snapshots remain structurally readable but cannot offer unsupported additions',()=>{
 const d=C.empty(),union=P.resolveCatalog(d,{examType:'ZP',specialty:'*'}),old={id:'old',examType:'ZP',specialty:gala,status:'confirmed',version:1,categoryCatalog:'zp-general-2026',categoryDefinitionsVersion:1,settingsRevision:0,categoryDefinitions:union,slots:[{categoryId:'harvest',count:1},{categoryId:'soil',count:1}]};
 const e=C.newExam({examType:'ZP',specialty:gala,pattern:old}),before=JSON.stringify(e);assert.doesNotThrow(()=>P.checkPattern(old));
 assert.deepEqual(P.categories(d,'ZP',gala,P.examContext(e)).map(c=>c.id),core);assert.equal(P.eligibleZwischenpruefungTask(task('harvest'),P.examContext(e)),false);assert.match(P.zwischenpruefungSelectionIssue(e,task('harvest')),/Fachrichtung|Generalthema/);
 d.tasks=[task('harvest'),task('soil')];assert.deepEqual(P.propose(d,e).map(t=>t.id),['soil']);assert.equal(JSON.stringify(e),before);
 assert.ok(P.coverage(e).issues.some(x=>/Fachrichtung|ausgeblendet/.test(x)));
});
test('new snapshots preserve deliberate specialty approval but never reopen extras in unrelated specialties',()=>{
 const d=C.empty();d.settings=[setting('Obstbau',[{id:'preparation',hidden:false}])];
 const p=P.snapshotPattern(d,{id:'p',examType:'ZP',specialty:'Obstbau',version:1,status:'confirmed',categoryCatalog:'zp-general-2026',slots:[{categoryId:'preparation',count:1}]});
 assert.equal(p.specialtyThemesVersion,1);const e=C.newExam({examType:'ZP',specialty:'Obstbau',pattern:p});assert.ok(P.categories(d,'ZP','Obstbau',P.examContext(e)).some(c=>c.id==='preparation'));assert.ok(!ids(d,gala).includes('preparation'));
 d.settings=[];assert.ok(P.categories(d,'ZP','Obstbau',P.examContext(e)).some(c=>c.id==='preparation'));
});
