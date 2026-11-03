const {test}=require('node:test');
const assert=require('node:assert/strict');
const task=patch=>({id:'synthetic-task',title:'Aussaat vorbereiten',text:'Planen Sie die Aussaat.',kind:'practical',examType:'AP',specialty:'Gemüsebau',category:'Kulturarbeiten',tags:[],sourceIds:['source-synthetic'],...patch});
const load=()=>require('../src/materials.js');
const block=(text,{bold=false,x=40,y=100}={})=>({text,originalText:text,x,y,width:400,height:14,fontSize:12,lineHeight:14,lines:[{text,runs:[{text,bold,italic:false}]}]});

test('explicit source lists preserve raw block order, bold entries and displaced bullet bodies',()=>{
 const M=load(),t=task({sourceLayout:{sourceId:'source-synthetic',reference:'Synthetische Vorlage',pages:[{blocks:[block('Arbeitsauftrag'),block('Material:',{bold:true}),block('•',{x:60,y:165.2}),block('Saatgut laut Arbeitsauftrag',{bold:true,x:78,y:160}),block('•',{x:60,y:181.2}),block('Aussaatschalen',{x:78,y:176}),block('Durchführung:',{bold:true}),block('Diese Anweisung gehört nicht zur Materialliste.')]},{blocks:[block('Weitere Anweisung.')]}]}}),before=JSON.stringify(t);
 const m=M.extractMaterials(t);
 assert.equal(m.text,'• Saatgut laut Arbeitsauftrag\n• Aussaatschalen');
 assert.equal(m.status,'proposal');assert.equal(m.method,'explicit-heading-v1');
 assert.deepEqual(m.evidence,[{sourceId:'source-synthetic',reference:'Synthetische Vorlage',page:1,quote:'Material:\n• Saatgut laut Arbeitsauftrag\n• Aussaatschalen'}]);
 assert.equal(JSON.stringify(t),before);
});

test('plain-text extraction accepts inline lists and stops at another section or prose',()=>{
 const M=load();
 assert.equal(M.extractMaterials(task({text:'Material und Hilfsmittel: Schalen; Substrat\n• Etiketten\nPrüfungsgespräch:\nBegründung.'})).text,'Schalen; Substrat\n• Etiketten');
 assert.equal(M.extractMaterials(task({text:'Material:\n• Schalen\n• Substrat\nBegründen Sie Ihre Entscheidung.'})).text,'• Schalen\n• Substrat');
 for(const text of ['Ermitteln Sie den Materialbedarf.\nPrüfen Sie die Werkzeuge.','Material:\nDurchführung:\nArbeiten Sie sorgfältig.','Material:\nArbeitsplanung:\nWerkzeuge auswählen.'])assert.equal(M.extractMaterials(task({text})),null);
});

test('source fallback is limited to linked sources and cannot cross a source-page boundary',()=>{
 const M=load(),sources=[{id:'unrelated',text:'Material:\n• Fremder Gegenstand',reference:'Fremd'},{id:'source-synthetic',text:'Material:\n• Etiketten',reference:'Synthetische Quelle'}];
 const m=M.extractMaterials(task(),sources);assert.equal(m.text,'• Etiketten');assert.equal(m.evidence[0].sourceId,'source-synthetic');assert.equal(m.evidence[0].reference,'Synthetische Quelle');
 assert.equal(M.extractMaterials(task({sourceIds:[]}),sources),null);
 const t=task({sourceLayout:{sourceId:'source-synthetic',reference:'Seiten',pages:[{blocks:[block('Material:'),block('• Schale')]},{blocks:[block('• Geheimnis der nächsten Seite')]}]}});
 assert.equal(M.extractMaterials(t).text,'• Schale');
});

test('extraction stops at an unrecognized heading and does not revive removed material text from edited pages',()=>{
 const M=load();assert.equal(M.extractMaterials(task({text:'Material:\n• Etiketten\nZusätzliche Hinweise:\nSchalen separat beschriften'})).text,'• Etiketten');
 const t=task({sourceLayout:{sourceId:'source-synthetic',reference:'Geänderte Vorlage',edited:true,pages:[{blocks:[block('Arbeitsauftrag ohne Materialvorgabe.')]}]}});
 assert.equal(M.extractMaterials(t,[{id:'source-synthetic',text:'Material:\n• Frühere Liste'}]),null);
});

test('proposals are independent snapshots and never overwrite examiner work or affect oral tasks',()=>{
 const M=load(),t=task(),before=JSON.stringify(t),p=M.proposeMaterials(t);
 assert.equal(JSON.stringify(t),before);assert.notEqual(p,t);assert.equal(p.materials.status,'proposal');assert.equal(p.materials.method,'general-title-v1');
 assert.match(p.materials.evidence[0].quote,/Allgemeiner Vorschlag/);assert.match(p.materials.text,/Saatgut/);assert.doesNotMatch(p.materials.text,/\d/);
 const own=task({materials:{text:'Eigene Liste',status:'confirmed',method:'manual',evidence:[]}});assert.deepEqual(M.proposeMaterials(own).materials,own.materials);
 const empty=task({materials:{text:'',status:'proposal',method:'manual',evidence:[]}});assert.deepEqual(M.proposeMaterials(empty).materials,empty.materials);
 const oral=task({kind:'oral'});assert.deepEqual(M.proposeMaterials(oral),oral);assert.equal(M.extractMaterials({...oral,text:'Material:\n• Etiketten'}),null);
 const unknown=M.proposeMaterials(task({title:'Unbekannte Vorbereitung',category:'Allgemein'}));assert.match(unknown.materials.text,/Arbeitsauftrag/);assert.match(unknown.materials.evidence[0].quote,/Allgemeiner Vorschlag/);
});

test('confirmation requires a list, edits reset confirmation and round trips preserve it',()=>{
 const M=load(),t=task(),draft=M.setMaterials(t,'Etiketten'),confirmed=M.setMaterials(draft,'Etiketten',{confirm:true}),before=JSON.stringify(confirmed);
 assert.deepEqual(draft.materials,{text:'Etiketten',status:'proposal',method:'manual',evidence:[]});assert.equal(confirmed.materials.status,'confirmed');assert.equal(M.setMaterials(confirmed,'Etiketten').materials.status,'confirmed');
 const changed=M.setMaterials(confirmed,'Etiketten\nSchalen');assert.equal(changed.materials.status,'proposal');assert.equal(JSON.stringify(confirmed),before);
 const restored=JSON.parse(JSON.stringify(confirmed));assert.equal(M.validate(restored),restored);assert.equal(restored.materials.status,'confirmed');
 assert.throws(()=>M.setMaterials(t,' \n ',{confirm:true}),/Material/);assert.equal(M.setMaterials(confirmed,'').materials.status,'proposal');
 const copy=M.resetMaterialsConfirmation(confirmed);assert.equal(copy.materials.status,'proposal');assert.equal(copy.materials.text,'Etiketten');assert.equal(JSON.stringify(confirmed),before);
});

test('materials validation rejects malformed, oversized and foreign evidence while allowing legacy tasks',()=>{
 const M=load(),valid={text:'Etiketten',status:'proposal',method:'manual',evidence:[]};assert.doesNotThrow(()=>M.validate(task()));
 assert.doesNotThrow(()=>M.validate(task({materials:{...valid,text:'x'.repeat(20000)}})));
 for(const materials of [null,[],{...valid,text:42},{...valid,text:'x'.repeat(20001)},{...valid,status:'approved'},{...valid,status:'confirmed',text:' '},{...valid,method:'invented'},{...valid,evidence:null},{...valid,evidence:Array.from({length:21},()=>({quote:'x'}))},{...valid,evidence:[{quote:'x'.repeat(20001)}]},{...valid,evidence:[{quote:'x',sourceId:'foreign'}]},{...valid,evidence:[{quote:'x',reference:42}]},{...valid,evidence:[{quote:'x',page:0}]},{...valid,evidence:[{quote:'x',page:1.5}]}])assert.throws(()=>M.validate(task({materials})),/Material/);
 assert.doesNotThrow(()=>M.validate(task({materials:{...valid,evidence:[{quote:'Material: Etiketten',sourceId:'source-synthetic',reference:'Quelle',page:1}]}})));
});

test('material readiness is versioned and includes only practical task lists',()=>{
 const M=load(),exam={items:[{task:task()},{task:task({title:'Zweite Aufgabe',materials:{text:'Schalen',status:'proposal',method:'manual',evidence:[]}})},{task:task({kind:'oral'})}],oralItem:{task:task({kind:'oral'})}};
 assert.deepEqual(M.materialsIssues(exam),[]);exam.materialRequirementVersion=1;assert.equal(M.materialsIssues(exam).length,2);
 exam.items[0].task=M.setMaterials(exam.items[0].task,'Etiketten',{confirm:true});exam.items[1].task=M.setMaterials(exam.items[1].task,'Schalen',{confirm:true});assert.deepEqual(M.materialsIssues(exam),[]);
});

test('organizational HTML escapes input and keeps oral, task wording, solutions and internal notes out',()=>{
 const M=load(),exam={title:'Organisation <b>Test</b>',specialty:'Gemüsebau',date:'2027-05-03',internalNotes:'PRIVATE_NOTE',items:[{task:task({title:'Praktisch <script>bad()</script>',text:'TASK_WORDING',solution:'PRIVATE_SOLUTION',materials:{text:'<img src=x onerror=bad()>\nEtiketten & Stifte',status:'proposal',method:'manual',evidence:[]}})},{task:task({title:'Bestätigte Aufgabe',materials:{text:'Schalen',status:'confirmed',method:'manual',evidence:[]}})},{task:task({kind:'oral',title:'ORAL_SENTINEL'})}],oralItem:{task:task({kind:'oral',title:'SEPARATE_ORAL_SENTINEL'})}},before=JSON.stringify(exam);
 const html=M.document(exam);assert.match(html,/<!doctype html>/i);assert.match(html,/Materialübersicht/);assert.match(html,/Organisation &lt;b&gt;Test&lt;\/b&gt;/);assert.match(html,/&lt;img src=x onerror=bad\(\)&gt;/);assert.match(html,/Etiketten &amp; Stifte/);assert.match(html,/Vorschlag/);assert.match(html,/Bestätigt/);
 for(const secret of ['PRIVATE_NOTE','PRIVATE_SOLUTION','TASK_WORDING','ORAL_SENTINEL','<img src=x','<script>bad()'])assert.ok(!html.includes(secret));assert.equal(JSON.stringify(exam),before);assert.match(html,/@media print/);assert.doesNotMatch(html,/<(?:link|img|iframe)\b|https?:\/\//i);
});
