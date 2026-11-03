const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/planning.js'),B=require('../src/catalog.js'),P=require('../src/print.js'),Paper=require('../src/paper.js'),D=require('../src/docx.js'),A=require('../src/archive.js'),Zip=require('../vendor/jszip.min.js');
function task(extra={}){return {id:'fw',familyId:'fw-family',title:'Synthetische Übung',text:'Aufgabe:\nVermehren von Pflanzen\nHier: Beispiel ohne echte Prüfungsfrage',examType:'FW_AP',specialty:'Gemüsebau',category:'Praktische Arbeitsaufgabe',kind:'practical',tags:[],sourceIds:['fw-source'],assetLinks:[],criteria:[],flags:[],points:null,minutes:40,solution:'',solutionStatus:'missing',reviewStatus:'review',qualification:'Gartenbaufachwerker',...extra};}
function fixture(){const t=task(),d=C.empty();d.families=[{id:t.familyId,title:t.title}];d.tasks=[t];d.sources=[{id:'fw-source',name:'Synthetische Quelle 2025.docx',year:2025,examType:'FW_AP',specialty:'Gemüsebau',role:'Praktisches Aufgabenblatt',text:t.text,attachmentIds:[]}];return d;}
function exam(t=task()){return {...C.newExam({examType:t.examType,specialty:t.specialty,title:'Synthetische Fachwerkerprüfung'}),items:[{id:'item-fw',originTaskId:t.id,task:C.clone(t)}]};}
test('FW scope is offered and validated only for the two supported specialties',()=>{
 assert.deepEqual(C.examTypesFor('Gemüsebau'),['ZP','AP','FW_AP']);assert.deepEqual(C.examTypesFor('Zierpflanzenbau'),['ZP','AP','FW_AP']);assert.deepEqual(C.examTypesFor('Baumschule'),['ZP','AP']);
 assert.doesNotThrow(()=>C.validate(fixture()));
 for(const specialty of ['Baumschule','Obstbau','', 'GemüsebauGBF']){const d=fixture();d.tasks[0].specialty=specialty;assert.throws(()=>C.validate(d),/Fachwerker/);assert.throws(()=>C.newExam({examType:'FW_AP',specialty}),/Fachwerker/);}
 const d=fixture();d.sources[0].specialty='Baumschule';assert.throws(()=>C.validate(d),/Fachwerker/);
});
test('FW snapshots, patterns, sources and families cannot cross the AP/ZP boundary',()=>{
 const d=fixture(),e=exam();d.exams=[e];assert.doesNotThrow(()=>C.validate(d));
 assert.throws(()=>C.addItem(e,task({examType:'AP'})),/Prüfungsbereich/);
 assert.throws(()=>C.addItem(C.newExam({examType:'AP',specialty:'Gemüsebau'}),task()),/Prüfungsbereich/);
 e.items[0].task.examType='AP';assert.throws(()=>C.validate(d),/Prüfungsbereich|Familie/);
 e.items=[];e.pattern={id:'p',examType:'AP',specialty:'Gemüsebau',version:1,status:'confirmed',slots:[{categoryId:'propagation',count:1}]};assert.throws(()=>C.validate(d),/Prüfungsmuster/);
 const sourceMismatch=fixture();sourceMismatch.sources[0].examType='AP';assert.throws(()=>C.validate(sourceMismatch),/Quelle|Prüfungsbereich/);
 const families=fixture();families.tasks.push(task({id:'ap',examType:'AP',sourceIds:[]}));assert.throws(()=>C.validate(families),/familie/i);
 assert.throws(()=>C.revise(fixture(),'fw',{examType:'AP'}),/Prüfungsbereich|Familie/);
});
test('FW categories preserve harvest as a separate choice and never reuse AP workbook assignments',()=>{
 const d=fixture();assert.deepEqual(L.categories(d,'FW_AP','Gemüsebau').map(c=>c.id).sort(),['soil','plantwork','harvest','propagation'].sort());
 assert.deepEqual(L.categories(d,'FW_AP','Zierpflanzenbau').map(c=>c.id).sort(),['soil','plantwork','machinery','propagation'].sort());
 assert.equal(L.workbookScope(d.tasks[0]),null);
 for(const [text,ids] of [['Beet bepflanzen',['plantwork']],['Durchführen von Arbeiten an und mit der Pflanze - Ernten und Aufbereitung',['harvest']],['Bodenbearbeitungsmaßnahmen – Maschinelles Bearbeiten',['soil']],['Geräte und Einsatz von Maschinen',['machinery']]])assert.deepEqual(L.classify(task({specialty:text.startsWith('Geräte')?'Zierpflanzenbau':'Gemüsebau',text:'Aufgabe:\n'+text+'\nHier: Test'})).ids,ids);
 const p=L.inferPattern(d,'FW_AP','Gemüsebau');assert.doesNotThrow(()=>L.checkPattern(p));assert.equal(p.categoryCatalog,'fw-sources-2026');
 assert.throws(()=>L.checkPattern({...p,specialty:'Baumschule'}),/Fachwerker/);
 assert.throws(()=>L.checkPattern({...p,categoryCatalog:'excel-ap-2026'}),/Kategorien/);
 const wrong=fixture();Object.assign(wrong.tasks[0],{planningCategories:['propagation'],planningCategoryCatalog:'excel-ap-2026'});assert.throws(()=>C.validate(wrong),/Kategorie/);
});
test('FW family history and suggestions remain isolated from AP and ZP records',()=>{
 const d=fixture(),fw=d.tasks[0];d.tasks.push(task({id:'ap',examType:'AP',sourceIds:['ap-source']}),task({id:'zp',examType:'ZP',sourceIds:['zp-source']}));d.sources.push({id:'ap-source',year:2026},{id:'zp-source',year:2026});
 d.exams=[{id:'ap-exam',examType:'AP',specialty:'Gemüsebau'}];d.uses=[{examId:'ap-exam',date:'2026-01-02',familyIds:['fw-family'],taskIds:['ap']}];
 assert.deepEqual(L.scoped(d,'FW_AP','Gemüsebau').map(t=>t.id),['fw']);assert.equal(L.history(d,fw).sourceYear,2025);assert.equal(L.history(d,fw).confirmed,null);
 const e=exam();e.items=[];e.pattern=L.inferPattern(d,'FW_AP','Gemüsebau');e.pattern.status='confirmed';assert.deepEqual(L.propose(d,e).map(t=>t.id),['fw']);assert.deepEqual(B.search(d,{examType:'FW_AP'}).map(t=>t.id),['fw']);
});
test('FW labels appear in print, paper, catalog and native Word without becoming Zwischenprüfung',async()=>{
 const d=fixture(),e=exam(),label='Fachwerker · Abschlussprüfung';
 for(const output of [P.document(e,d),P.letterhead(e,d,null,false),Paper.pages(e,d),B.document(d,d.tasks),B.csv(d,d.tasks)]){assert.match(output,/Fachwerker · Abschlussprüfung/);assert.doesNotMatch(output,/Zwischenprüfung/);}
 const zip=await Zip.loadAsync(await D.document(e,d)),xml=(await Promise.all(Object.values(zip.files).filter(f=>/\.xml$/.test(f.name)).map(f=>f.async('string')))).join('\n');assert.ok(xml.includes(label));assert.doesNotMatch(xml,/Zwischenprüfung/);assert.ok(xml.includes('Beispiel ohne echte Prüfungsfrage'));
 assert.equal(B.package(d,d.tasks).tasks[0].examTypeLabel,label);
});
test('archive separates FW originals and gives human readable FW metadata',async()=>{
 const d=fixture();d.sources.push({...d.sources[0],id:'ap-source',examType:'AP'});const groups=A.groups(d);assert.equal(groups.length,2);const fw=groups.find(g=>g.examType==='FW_AP');
 const zip=await Zip.loadAsync((await A.package(d,[fw])).bytes),path=Object.keys(zip.files).find(p=>p.endsWith('INHALT.txt'));assert.match(await zip.file(path).async('string'),/Fachwerker · Abschlussprüfung/);const manifest=JSON.parse(await zip.file('Verzeichnis.json').async('string'));assert.equal(manifest.documents[0].examType,'FW_AP');assert.equal(manifest.documents[0].examTypeLabel,'Fachwerker · Abschlussprüfung');
});
test('FW Word and paper preserve formal qualification wording on original source pages',async()=>{
 const d=fixture(),e=exam(),t=e.items[0].task,wording='Gartenbaufachwerker · Abschlussprüfung\nSynthetischer Originalwortlaut',pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
 d.assets.push({id:'page',name:'Synthetische Seite.png',mime:'image/png',data:pixel},{id:'public-test-font',name:'Test.ttf',mime:'font/ttf',design:'bw-2024',docxFontKey:'sansRegular',fontFamily:'Export Test',data:require('./fixtures/docx-test-font.json').data});
 t.assetLinks=[{assetId:'page',audience:'candidate',role:'source-page'}];t.sourceLayout={version:1,sourceId:'fw-source',reference:'synthetic-fw',sourcePdfHash:'a'.repeat(64),baselineText:t.text,warnings:[],pages:[{width:595.3,height:841.9,backgroundAssetId:'page',logos:[],blocks:[{id:'original-fw',x:50,y:120,width:480,height:40,fontSize:12,lineHeight:15,text:wording,originalText:wording,lines:wording.split('\n').map(text=>({text,runs:[{text,bold:false,italic:false}]}))}]}]};
 assert.match(Paper.document(e,d),/Gartenbaufachwerker · Abschlussprüfung/);const zip=await Zip.loadAsync(await D.document(e,d)),xml=await zip.file('word/document.xml').async('string');assert.match(xml,/Gartenbaufachwerker · Abschlussprüfung/);assert.match(xml,/Synthetischer Originalwortlaut/);assert.doesNotMatch(xml,/Zwischenprüfung/);
});
test('manual DOCX import rejects an unsupported FW specialty before reading the file',async()=>{
 const I=require('../src/import.js');await assert.rejects(()=>I.docx({size:0,arrayBuffer:()=>{throw Error('File must not be read');}},{examType:'FW_AP',specialty:'Baumschule'}),/Fachwerker/);
});
test('FW original-page exports print the qualification independently of titles and source wording',async()=>{
 const d=fixture(),e=exam(),t=e.items[0].task,wording='Synthetischer Originalwortlaut ohne Ausbildungsbezeichnung';e.title='Prüfung 2027';
 d.assets.push({id:'page',name:'Synthetische Seite.png',mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='},{id:'public-test-font',name:'Test.ttf',mime:'font/ttf',design:'bw-2024',docxFontKey:'sansRegular',fontFamily:'Export Test',data:require('./fixtures/docx-test-font.json').data});
 t.assetLinks=[{assetId:'page',audience:'candidate',role:'source-page'}];t.sourceLayout={version:1,sourceId:'fw-source',reference:'synthetic-fw',sourcePdfHash:'a'.repeat(64),baselineText:t.text,warnings:[],pages:[{width:595.3,height:841.9,backgroundAssetId:'page',logos:[],blocks:[{id:'original-fw',x:50,y:120,width:480,height:40,fontSize:12,lineHeight:15,text:wording,originalText:wording,lines:[{text:wording,runs:[{text:wording,bold:false,italic:false}]}]}]}]};
 const before=C.clone(t),label='Gartenbaufachwerker · Abschlussprüfung · Gemüsebau';
 for(const printing of [false,true])assert.ok(Paper.pages(e,d,false,printing).includes(label));
 for(const examiner of [false,true]){
  assert.ok(Paper.document(e,d,examiner).includes(label));const zip=await Zip.loadAsync(await D.document(e,d,examiner)),footers=Object.values(zip.files).filter(f=>/^word\/footer\d+\.xml$/.test(f.name));assert.ok(footers.length>=2);
  for(const f of footers.slice(0,2))assert.ok((await f.async('string')).includes(label));
 }
 assert.deepEqual(t,before);
});
