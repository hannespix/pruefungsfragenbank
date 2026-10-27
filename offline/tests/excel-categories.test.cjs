const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/planning.js'),B=require('../src/catalog.js');
const task=(specialty,text,extra={})=>({id:'t',familyId:'f',examType:'AP',specialty,kind:'practical',title:'Originaltitel',text:'Aufgabe:\n'+text+'\nHier: Beispiel',category:'Praktische Arbeitsaufgabe',tags:[],sourceIds:[],assetLinks:[],criteria:[],flags:[],...extra});
const db=tasks=>({tasks,families:[],sources:[],uses:[],exams:[],assets:[]});
test('AP choices use specialty-specific workbook titles, including categories without archived questions',()=>{
 const choices=fr=>P.categories(db([]),'AP',fr).map(c=>c.label);
 assert.ok(choices('Baumschule').includes('Vermehren von Gehölzen'));
 assert.ok(choices('Staudengärtnerei').includes('Vermehren von Stauden'));
 assert.ok(choices('Gemüsebau').includes('Anzucht von Jungpflanzen'));
 assert.ok(choices('Garten- und Landschaftsbau').includes('Durchführen von Entwässerungsarbeiten'));
 assert.ok(!choices('Baumschule').includes('Durchführen von Pflegemaßnahmen an Grabstätten'));
 assert.equal(choices('Zierpflanzenbau').length,13);
 assert.equal(choices('Garten- und Landschaftsbau').length,12);
});
test('formerly broad categories distinguish exact official headings without rewriting originals',()=>{
 const t=task('Zierpflanzenbau','Bepflanzen von Rabatten'),before=JSON.stringify(t);
 assert.equal(P.label(P.classify(t).ids[0],t),'Bepflanzen von Rabatten');
 const fruit=task('Obstbau','Sortieren von Obst');
 assert.equal(P.label(P.classify(fruit).ids[0],fruit),'Sortieren von Obst');
 const combo=task('Friedhofsgärtnerei','Grabstätte planen, Fläche aufteilen und vermessen\nBoden bearbeiten und Grab bepflanzen');
 assert.deepEqual(P.classify(combo).ids.map(id=>P.label(id,combo)),['Grabstätte planen, Flächen aufteilen und vermessen','Boden bearbeiten und Grab bepflanzen']);
 const planting=task('Friedhofsgärtnerei','Boden bearbeiten und Grab bepflanzen');
 assert.deepEqual(P.classify(planting).ids,['planting']);
 assert.equal(JSON.stringify(t),before);
});
test('bank filters, search and all catalog exports use the same official label',()=>{
 const t=task('Baumschule','Vermehren von Bodendeckern durch Stecklinge'),d=db([t]);
 assert.equal(B.facets(d,{examType:'AP',specialty:t.specialty}).categories[0].label,'Vermehren von Gehölzen');
 assert.equal(B.search(d,{query:'Vermehren von Gehölzen'}).length,1);
 assert.equal(B.package(d,[t]).tasks[0].categories[0].label,'Vermehren von Gehölzen');
 assert.match(B.csv(d,[t]),/Vermehren von Gehölzen/);
 assert.match(B.document(d,[t]),/Vermehren von Gehölzen/);
});
test('AP workbook does not rename ZP or GBF headings and does not mutate stored pattern counts',()=>{
 const zp=task('Baumschule','Vermehren von Pflanzen',{examType:'ZP'}),gbf=task('Gemüsebau','Vermehren von Pflanzen',{qualification:'Code 172 – Zuordnung prüfen'});
 assert.equal(P.label('propagation',zp),'Pflanzen vermehren');
 assert.equal(P.label('propagation',gbf),'Pflanzen vermehren');
 const d=db([]);d.patterns=[{id:'p',version:1,examType:'AP',specialty:'Baumschule',status:'confirmed',slots:[{categoryId:'propagation',count:2}]}];
 const before=JSON.stringify(d);P.categories(d,'AP','Baumschule');P.pattern(d,'AP','Baumschule');assert.equal(JSON.stringify(d),before);
});
test('previously confirmed exam snapshots retain category coverage until their pattern is explicitly updated',()=>{
 for(const [specialty,text,id] of [['Obstbau','Sortieren von Obst','harvest'],['Zierpflanzenbau','Bepflanzen von Rabatten','planting'],['Gemüsebau','Ernten von Gemüse\nKennzeichnen und Verpacken von Gemüse','harvest']]){
  const t=task(specialty,text),d=db([t]),pattern={id:'old',version:1,examType:'AP',specialty,status:'confirmed',slots:[{categoryId:id,count:1}]};
  const e={examType:'AP',specialty,pattern,items:[{task:t}]},before=JSON.stringify(e);
  assert.equal(P.coverage(e).complete,true);assert.equal(JSON.stringify(e),before);
  assert.deepEqual(P.propose(d,{...e,items:[]}).map(t=>t.id),['t']);
  assert.equal(B.search(d,{examType:'AP',specialty,category:id,pattern}).length,1);
  assert.ok(require('../src/paper.js').navigationItem(e,{categoryId:id}));
  const fresh=P.inferPattern(d,'AP',specialty);assert.equal(fresh.categoryCatalog,'excel-ap-2026');
  fresh.status='confirmed';assert.equal(P.coverage({...e,pattern:fresh}).complete,true);
 }
});
