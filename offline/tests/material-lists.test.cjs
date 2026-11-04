'use strict';
// Material lists from separate source documents are matched to the tasks they belong to – only clear, unique matches,
// always as a proposal with evidence; confirmed or hand-written lists are never replaced.
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),M=require('../src/materials.js');

function data(){
 const d=C.validate(JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../demo.json'),'utf8')));
 const base=d.tasks.find(t=>t.examType==='ZP'&&t.specialty==='Baumschule'),exam=d.sources.find(s=>base.sourceIds.includes(s.id));exam.year=2024;
 const add=(id,title)=>{const t={...C.clone(base),id,familyId:'fam-'+id,title,text:'Aufgabe: '+title+'\nFühren Sie die Arbeit fachgerecht aus.'};delete t.materials;d.tasks.push(t);d.families.push({...C.clone(d.families.find(f=>f.id===base.familyId)),id:t.familyId,title});return t;};
 add('t-cut','Stecklinge schneiden');add('t-hedge','Heckenschere warten');add('t-pot','Topfen von Jungpflanzen');
 d.sources.push({...C.clone(exam),id:'list-2024',name:'Materialliste ZP 2024 Baumschule.docx',role:'Anlage',year:2024,assetId:undefined,attachmentIds:[],flags:[],
  text:['Materialliste Zwischenprüfung 2024','Aufgabe 1: Stecklinge schneiden','• 20 Mutterpflanzen Forsythie','• Gartenschere, scharf','• Vermehrungssubstrat','Aufgabe 2: Heckenschere warten','• Heckenschere, verschmutzt','• Reinigungsmittel und Öl','Aufgabe 3: Rasen mähen','• Rasenmäher'].join('\n')});
 d.sources.push({...C.clone(exam),id:'list-2019',name:'Materialliste ZP 2019 Baumschule.docx',role:'Anlage',year:2019,assetId:undefined,attachmentIds:[],flags:[],text:'Aufgabe 1: Stecklinge schneiden\n• Alte Liste'});
 return C.validate(d);
}

test('a material list document is split into sections and each section goes to the one matching task',()=>{
 const d=data(),r=M.scanSourceLists(d.tasks,d.sources);
 assert.deepEqual(r.documents.map(x=>x.name).sort(),['Materialliste ZP 2019 Baumschule.docx','Materialliste ZP 2024 Baumschule.docx'],'both documents are reported');
 const byTask=new Map(r.matches.map(m=>[m.taskId,m]));
 assert.match(byTask.get('t-cut').text,/Mutterpflanzen Forsythie[\s\S]*Vermehrungssubstrat/);assert.doesNotMatch(byTask.get('t-cut').text,/Heckenschere/);
 assert.match(byTask.get('t-hedge').text,/Reinigungsmittel und Öl/);assert.ok(!byTask.has('t-pot'),'no section, no proposal');
 assert.doesNotMatch(byTask.get('t-cut').text,/Alte Liste/,'a list of another year never goes to a 2024 task');
 assert.deepEqual(r.unclear.map(x=>x.reference+' · '+x.header).sort(),['Materialliste ZP 2019 Baumschule.docx · Aufgabe 1: Stecklinge schneiden','Materialliste ZP 2024 Baumschule.docx · Aufgabe 3: Rasen mähen'],'sections without a matching task are reported');
});

test('applying a match links the list document as source and stores a proposal with evidence; confirmed lists stay',()=>{
 const d=data(),r=M.scanSourceLists(d.tasks,d.sources),m=r.matches.find(x=>x.taskId==='t-cut'),t=d.tasks.find(x=>x.id==='t-cut');
 const next=M.applySourceList(t,m);assert.ok(next.sourceIds.includes('list-2024'));assert.equal(next.materials.status,'proposal');assert.equal(next.materials.evidence[0].sourceId,'list-2024');assert.match(next.materials.evidence[0].quote,/^Aufgabe 1: Stecklinge schneiden/);
 Object.assign(t,next);assert.doesNotThrow(()=>C.validate(d));
 const general={...C.clone(t),materials:{text:'• Allgemein',status:'proposal',method:'general-title-v1',evidence:[{quote:'Allgemeiner Vorschlag'}]}};assert.notEqual(M.applySourceList(general,m),general,'a general proposal is replaced');
 for(const keep of [{text:'• Eigene Liste',status:'confirmed',method:'manual',evidence:[]},{text:'• Eigene Liste',status:'proposal',method:'manual',evidence:[]},{text:'• Aus dem Aufgabentext',status:'proposal',method:'explicit-heading-v1',evidence:[{quote:'Material:'}]}]){const task={...C.clone(t),materials:keep};assert.equal(M.applySourceList(task,m),task);}
});

test('ambiguous sections are not assigned',()=>{
 const d=data();d.tasks.find(x=>x.id==='t-pot').title='Stecklinge schneiden und topfen';
 const r=M.scanSourceLists(d.tasks,d.sources);assert.equal(r.matches.find(x=>x.header.startsWith('Aufgabe 1'))?.taskId,'t-cut','the full title match wins');
 d.tasks.find(x=>x.id==='t-pot').title='Stecklinge schneiden';const again=M.scanSourceLists(d.tasks,d.sources);assert.ok(!again.matches.some(x=>x.header.startsWith('Aufgabe 1')),'two equally good tasks: no assignment');assert.ok(again.unclear.some(x=>x.header.startsWith('Aufgabe 1')));
});

test('without list documents the scan says so',()=>{
 const d=data();d.sources=d.sources.filter(s=>!s.id.startsWith('list-'));for(const t of d.tasks)t.sourceIds=t.sourceIds.filter(id=>d.sources.some(s=>s.id===id));
 const r=M.scanSourceLists(d.tasks,d.sources);assert.deepEqual(r,{documents:[],matches:[],unclear:[]});
});
