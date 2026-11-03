const {test}=require('node:test'),assert=require('node:assert/strict');
require('../src/core.js');const P=require('../src/print.js'),W=require('../src/paper.js'),D=require('../src/docx.js'),Zip=require('../vendor/jszip.min.js');
function fixture(specialty='Baumschule',examType='AP'){
 const categories=['propagation','soil','plantwork','lifting','selection'];
 const e={title:'Synthetische Prüfung',examType,specialty,examYear:2027,date:'2027-06-01',notes:'',status:'draft',items:categories.map((category,n)=>({id:'item-'+n,task:{id:'task-'+n,familyId:'family-'+n,examType,specialty,kind:'practical',title:'Synthetische Aufgabe '+(n+1),text:'Synthetischer Arbeitsauftrag '+(n+1),planningCategories:[category],tags:[],minutes:60,points:10+n,criteria:[],solution:'',solutionStatus:'missing',reviewStatus:'review',flags:[],sourceIds:[],assetLinks:[]}}))};
 return {e,d:{tasks:[],assets:[]}};
}
function grouped(){const f=fixture('Garten- und Landschaftsbau'),t=f.e.items[0].task;t.minutes=300;t.practicalUnits=[
 {title:'Arbeitsablauf <planen>',areaId:'area1',reason:'Synthetische Baustellenplanung'},
 {title:'Entwässerung erstellen',areaId:'area1',reason:'Synthetische Bautechnik'},
 {title:'Fläche befestigen',areaId:'area1',reason:'Synthetische Bautechnik'},
 {title:'Pflanzfläche vorbereiten',areaId:'area2',reason:'Synthetische Vegetationstechnik'},
 {title:'Pflanzung ausführen',areaId:'area2',reason:'Synthetische Vegetationstechnik'}];f.e.items=[f.e.items[0]];return f;}
async function wordBody(f,examiner){const zip=await Zip.loadAsync(await D.document(f.e,f.d,examiner));return zip.file('word/document.xml').async('string');}
test('AP examiner formats show statutory counts and equal weighting without changing candidate content',async()=>{
 const f=fixture();
 for(const render of [P.document,W.document]){const examiner=render(f.e,f.d,true),candidate=render(f.e,f.d,false);assert.match(examiner,/5 von 5 komplexe Prüfungsaufgaben/);assert.match(examiner,/je 20 %/);assert.match(examiner,/300 von höchstens 300 Minuten/);assert.match(examiner,/§ 9 Abs\. 2 und 6/);assert.doesNotMatch(candidate,/je 20 %|5 von 5 komplexe Prüfungsaufgaben/);}
 const examiner=await wordBody(f,true),candidate=await wordBody(f,false);assert.match(examiner,/5 von 5 komplexe Prüfungsaufgaben/);assert.match(examiner,/je 20 %/);assert.doesNotMatch(candidate,/je 20 %|5 von 5 komplexe Prüfungsaufgaben/);assert.doesNotMatch(examiner,/altChunk|w:txbxContent/);
});
test('declared complex tasks are named and assigned in examiner exports',async()=>{
 const f=grouped(),before=JSON.stringify(f.e);
 for(const render of [P.document,W.document]){const out=render(f.e,f.d,true);assert.match(out,/Gesamtwerk/);assert.match(out,/5 von 5 komplexe Prüfungsaufgaben/);assert.match(out,/Arbeitsablauf &lt;planen&gt;/);assert.match(out,/Baustellenabwicklung und Bautechnik/);assert.match(out,/Vegetationstechnik/);assert.match(out,/Synthetische Baustellenplanung/);assert.doesNotMatch(out,/<planen>/);}
 const xml=await wordBody(f,true);assert.match(xml,/Arbeitsablauf &lt;planen&gt;/);assert.match(xml,/Vegetationstechnik/);assert.equal(JSON.stringify(f.e),before);
});
test('category tags do not inflate exported counts and unknown duration stays open',()=>{
 const f=fixture();f.e.items=f.e.items.slice(0,1);f.e.items[0].task.planningCategories=['propagation','soil','plantwork','lifting','selection'];f.e.items[0].task.minutes=null;
 const out=W.document(f.e,f.d,true);assert.match(out,/1 von 5 komplexe Prüfungsaufgaben/);assert.match(out,/Zeitangabe.*offen|offene Zeitangabe/);assert.match(out,/Struktur noch offen/);assert.match(out,/ENTWURF|Entwurf/);
});
test('Friedhof examiner summary uses both two-task minima and other exam types stay isolated',async()=>{
 const f=fixture('Friedhofsgärtnerei'),out=P.document(f.e,f.d,true);assert.match(out,/mindestens 2.*Grabanlage/);assert.match(out,/mindestens 2.*Pflanzenproduktion, Trauerbinderei und Dekoration/);
 for(const type of ['ZP','FW_AP']){const other=fixture(type==='FW_AP'?'Gemüsebau':'Baumschule',type);assert.doesNotMatch(P.document(other.e,other.d,true),/je 20 %|Prüfungsstruktur nach/);assert.doesNotMatch(W.document(other.e,other.d,true),/je 20 %|Prüfungsstruktur nach/);assert.doesNotMatch(await wordBody(other,true),/je 20 %|Prüfungsstruktur nach/);}
});
test('examiner guidance follows identical participant original pages',()=>{
 const f=grouped(),t=f.e.items[0].task;t.sourceIds=['synthetic-source'];t.assetLinks=[{assetId:'background',audience:'candidate',role:'source-page'}];f.d.assets.push({id:'background',name:'Synthetic.png',mime:'image/png',data:'QUJD'});
 t.sourceLayout={version:1,sourceId:'synthetic-source',reference:'SYNTHETIC',sourcePdfHash:'a'.repeat(64),baselineText:t.text,warnings:[],pages:[{width:595.3,height:841.9,backgroundAssetId:'background',logos:[],graphics:[],rules:[],blocks:[{id:'block',x:50,y:120,width:480,height:40,fontSize:12,lineHeight:15,text:t.text,originalText:t.text,lines:[{text:t.text,runs:[{text:t.text,bold:false,italic:false}]}]}]}]};
 const candidate=W.pages(f.e,f.d,false,true),examiner=W.pages(f.e,f.d,true,true);assert.ok(examiner.startsWith(candidate));assert.match(examiner.slice(candidate.length),/je 20 %/);assert.equal((examiner.match(/data-source-page=/g)||[]).length,1);
});
test('examiner guidance does not present stale human confirmations as current',()=>{
 const f=fixture(),L=require('../src/planning.js');f.e.regulationReview={conversation:true,equalWeighting:true};f.e.regulationReviewKey=L.regulationReviewKey(f.e);
 assert.match(P.regulationHtml(f.e),/Bestätigt: Prüfungsgespräch/);
 f.e.items[0].task.text+=' Änderung';const out=P.regulationHtml(f.e);assert.doesNotMatch(out,/Bestätigt:/);assert.match(out,/Offen: Prüfungsgespräch/);
});
