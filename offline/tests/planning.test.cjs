const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/planning.js');
const task=(id,familyId,cat,year=2020)=>({id,familyId,examType:'ZP',specialty:'GaLaBau',kind:'practical',title:id,text:'Aufgabe:\n'+cat+'\nHier: Beispiel',sourceIds:[id+'-src'],year});
const make=tasks=>({tasks,sources:tasks.map(t=>({id:t.id+'-src',year:t.year})),uses:[],exams:[],families:[],patterns:[]});
test('explicit headings yield categories, not words in the body',()=>{
 assert.deepEqual(P.classify(task('a','f','Durchführen von Bodenbearbeitungsmaßnahmen')).ids,['soil']);
 const t=task('a','f','Vermehren von Pflanzen');t.text+='\nSie sollen danach Pflanzenschutzmaßnahmen erläutern.';
 assert.deepEqual(P.classify(t).ids,['propagation']);
 assert.deepEqual(P.classify({...t,text:'Aufgaben\nVermehren von Stauden kombiniert mit Durchführen von Arbeiten an der Pflanze\nZeit: 90 Minuten'}).ids.sort(),['plantwork','propagation']);
 assert.deepEqual(P.classify({...t,text:'Unbekannte Aufgabe'}).ids,['unassigned']);
});
test('catalog and family rotation never mix exam type or specialty',()=>{
 const a=task('a','f','Vermehren von Pflanzen'),b={...task('b','g','Bodenbearbeitung'),examType:'AP'},c={...a,id:'c',specialty:'Obstbau'};
 const d=make([a,b,c]);assert.deepEqual(P.scoped(d,'ZP','GaLaBau').map(t=>t.id),['a']);
 assert.deepEqual(P.inferPattern(d,'ZP','GaLaBau').slots.map(s=>s.categoryId),['propagation']);
});
test('rotation uses latest family evidence including superseded variants and ignores future drafts',()=>{
 const a={...task('old','same','Vermehren von Pflanzen',2018),supersededBy:'new'},b=task('new','same','Vermehren von Pflanzen',2024),c=task('other','other','Vermehren von Pflanzen',2020),u=task('unknown','u','Vermehren von Pflanzen',null);
 const d=make([a,b,c,u]);d.exams=[{id:'future',date:'2030-01-01',items:[{task:c}]}];
 assert.deepEqual(P.rank(d,'ZP','GaLaBau','propagation').map(x=>x.task.id),['other','new','unknown']);
 d.uses.push({examId:'past',date:'2025-03-02',familyIds:['other'],taskIds:['other']});d.exams.push({id:'past',examType:'ZP',specialty:'GaLaBau'});
 assert.deepEqual(P.rank(d,'ZP','GaLaBau','propagation').map(x=>x.task.id),['new','other','unknown']);
 assert.equal(P.history(d,c).confirmed,'2025-03-02');assert.equal(P.history(d,b).sourceYear,2024);
});
test('combined tasks cover two slots without duplicates and preserve pattern snapshots',()=>{
 const t=task('combo','f','Vermehren von Pflanzen kombiniert mit Durchführen von Arbeiten an der Pflanze'),d=make([t]);
 const pattern=P.inferPattern(d,'ZP','GaLaBau');pattern.status='confirmed';
 const exam={examType:'ZP',specialty:'GaLaBau',pattern:structuredClone(pattern),items:[]};
 const proposed=P.propose(d,exam);assert.deepEqual(proposed.map(t=>t.id),['combo']);exam.items.push({originTaskId:t.id,task:structuredClone(t)});
 assert.equal(P.coverage(exam).complete,true);assert.deepEqual(P.propose(d,exam),[]);
 pattern.slots[0].count=2;assert.equal(P.coverage(exam).complete,true);
 exam.items.push({originTaskId:t.id,task:structuredClone(t)});assert.equal(P.coverage(exam).complete,false);
});
test('unknown and unconfirmed patterns cannot silently pass and wrong-context items are rejected',()=>{
 const t=task('a','f','Vermehren von Pflanzen'),d=make([t]),p=P.inferPattern(d,'ZP','GaLaBau');
 const e={examType:'ZP',specialty:'GaLaBau',pattern:p,items:[{task:t}]};assert.equal(P.coverage(e).complete,false);
 p.status='confirmed';assert.equal(P.coverage(e).complete,true);
 e.items[0].task={...t,examType:'AP'};assert.equal(P.coverage(e).complete,false);
 assert.throws(()=>P.checkPattern({...p,slots:[{categoryId:'propagation',count:-1}]}));
});
test('pattern metadata rejects injected markup and fractional or missing versions',()=>{
 const p=P.inferPattern(make([task('a','f','Vermehren von Pflanzen')]),'ZP','GaLaBau');
 for(const version of ['<img src=x onerror=alert(1)>',1.5,0,undefined])assert.throws(()=>P.checkPattern({...p,version}));
});
test('rotation orders confirmed dates within one year',()=>{
 const a=task('a','a','Vermehren von Pflanzen'),b=task('b','b','Vermehren von Pflanzen'),d=make([a,b]);d.exams=[{id:'a-use',examType:'ZP',specialty:'GaLaBau'},{id:'b-use',examType:'ZP',specialty:'GaLaBau'}];d.uses=[{examId:'a-use',date:'2025-12-01',familyIds:['a'],taskIds:['a']},{examId:'b-use',date:'2025-01-01',familyIds:['b'],taskIds:['b']}];assert.deepEqual(P.rank(d,'ZP','GaLaBau','propagation').map(x=>x.task.id),['b','a']);
});
test('exact pattern coverage rejects outside categories and proposals avoid greedy dead ends',()=>{
 const a=task('solo','a','Vermehren von Pflanzen',2018),b=task('combo','b','Vermehren von Pflanzen kombiniert mit Durchführen von Arbeiten an der Pflanze',2020),d=make([a,b]),p=P.inferPattern(d,'ZP','GaLaBau');p.status='confirmed';
 const e={examType:'ZP',specialty:'GaLaBau',pattern:p,items:[]};assert.deepEqual(P.propose(d,e).map(t=>t.id),['combo']);
 const extra=task('extra','extra','Durchführen von Pflanzenschutzmaßnahmen');e.items=[{task:b},{task:extra}];assert.equal(P.coverage(e).complete,false);
});
test('conflicting pattern imports cannot disappear behind a same-scope profile',()=>{
 const C=require('../src/core.js'),d=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../demo.json')));C.validate(d);
 d.patterns=[{id:'p',examType:'ZP',specialty:'Baumschule',status:'confirmed',version:1,slots:[{categoryId:'propagation',count:1}]}];const incoming=structuredClone(d);incoming.patterns[0].slots[0].count=2;
 assert.throws(()=>C.merge(d,incoming),/Prüfungsmuster/);assert.equal(d.patterns[0].slots[0].count,1);
 incoming.patterns.push({...incoming.patterns[0],id:'duplicate'});assert.throws(()=>C.validate(incoming),/Prüfungsmuster/);
 const broken=structuredClone(d);broken.tasks[0].planningCategoryEvidence={unsafe:true};assert.throws(()=>C.validate(broken));
});

test('workbook choices differ by specialty and are shared across examination types',()=>{
 const d=make([]),ids=(type,fr)=>P.categories(d,type,fr).map(c=>c.id);
 assert.ok(ids('AP','Friedhofsgärtnerei').includes('gravecare'));
 assert.ok(!ids('AP','Baumschule').includes('gravecare'));
 assert.ok(ids('AP','Baumschule').includes('selection'));
 assert.ok(ids('ZP','Baumschule').includes('selection'));
 assert.ok(ids('AP','Zierpflanzenbau').includes('indoor'));
 assert.ok(!ids('AP','Obstbau').includes('indoor'));
 assert.deepEqual(ids('ZP','Friedhofsgärtnerei'),ids('AP','Friedhofsgärtnerei'));
 assert.ok(ids('AP','Garten- und Landschaftsbau').includes('paving'));
});
test('shared specialty categories include nutrition and grave care stays exclusive',()=>{
 const t={...task('new','f','Durchführen von Düngungs- und Bewässerungsmaßnahmen'),specialty:'Baumschule',examType:'AP'},d=make([t]);
 assert.ok(P.categories(d,'AP','Baumschule').some(c=>c.id==='nutrition'));
 assert.ok(P.categories(d,'ZP','Baumschule').some(c=>c.id==='nutrition'));
 const invalid={...t,text:'Durchführen von Pflegemaßnahmen an Grabstätten'};
 assert.deepEqual(P.classify(invalid).ids,['unassigned']);
});
test('structured GaLa planning sheet recognizes explicit category headings across its sections',()=>{
 const t={specialty:'Garten- und Landschaftsbau',examType:'AP',text:'Bewertungsblatt für die Phase I = Planungsphase\nDie Aufgaben sind:\nAusführungspläne sowie Leistungsverzeichnisse lesen und auf die Baustelle übertragen.\nErläutern Sie den Arbeitsablauf.\nHerstellen von befestigten Flächen\nNennen Sie zwei Verfahren.\nBe- und Verarbeiten von Naturstein\nBenennen Sie Materialien.\nPflanzungen vorbereiten und durchführen\nErstellen Sie einen Vorschlag.\nFlächen für Ansaaten vorbereiten und ansäen\nErläutern Sie die Schritte.'};
 assert.deepEqual(P.classify(t).ids.sort(),['siteplanning','paving','naturalstone','planting','sowing'].sort());
 assert.ok(!P.classify({...t,text:'Aufgabe:\nArbeiten an der Pflanze\nHier: Erläutern Sie das Herstellen von befestigten Flächen.'}).ids.includes('paving'));
});
