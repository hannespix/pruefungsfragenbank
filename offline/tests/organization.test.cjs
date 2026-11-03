const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),D=require('../src/docx.js'),O=require('../src/organization.js'),Zip=require('../vendor/jszip.min.js');
function fixture(){
 const task=(n,materials)=>({id:'t'+n,familyId:'f'+n,title:'Pflanzung '+n,text:'ÖFFENTLICHER_AUFTRAG',examType:'ZP',specialty:'Baumschule',kind:'practical',points:10,minutes:30,assetLinks:[],sourceIds:[],tags:[],flags:[],criteria:[],solution:'GEHEIME_LÖSUNG',solutionStatus:'approved',reviewStatus:'approved',...(materials?{materials}:{} )});
 const material=(text,status)=>({text,status,method:'manual',evidence:[]});
 const e={id:'e',title:'Prüfung <2027>',examType:'ZP',specialty:'Baumschule',examYear:2027,date:'2027-05-03',workshopId:'w',internalNotes:'PRIVATE_NOTIZ\nRückfrage <Betrieb> & Termin klären.\n\nZweite Passage.',notes:'Öffentlicher Hinweis',items:[task(1,material('PRIVATE_MATERIAL\n10 Töpfe\n2 Schaufeln','confirmed')),task(2,material('VORSCHLAG_MATERIAL','proposal')),task(3)].map((task,n)=>({id:'i'+n,task}))};
 const d={...C.empty(),exams:[e],workshops:[{id:'w',title:'Vorbereitung 2027',committees:[{specialty:'Baumschule',name:'Ausschuss Nord',participants:['Anna Beispiel','Ben Test']},{specialty:'Gemüsebau',name:'FREMDER_AUSSCHUSS',participants:['FREMDE_PERSON']}]}]};return {e,d};
}
async function xml(bytes){const z=await Zip.loadAsync(bytes);return (await Promise.all(Object.values(z.files).filter(f=>/\.xml$/.test(f.name)).map(f=>f.async('string')))).join('\n');}
test('organization reports include exact saved materials and remarks separately without changing data',()=>{
 const {e,d}=fixture(),before=JSON.stringify(d),m=O.document(e,d,'materials'),n=O.document(e,d,'notes');
 for(const text of ['PRIVATE_MATERIAL','VORSCHLAG_MATERIAL','Bestätigt','Vorschlag','Noch festzulegen'])assert.ok(m.includes(text));
 assert.doesNotMatch(m,/PRIVATE_NOTIZ|GEHEIME_LÖSUNG|ÖFFENTLICHER_AUFTRAG/);assert.match(n,/PRIVATE_NOTIZ/);assert.match(n,/&lt;Betrieb&gt; &amp; Termin/);assert.doesNotMatch(n,/<Betrieb>|PRIVATE_MATERIAL|GEHEIME_LÖSUNG/);
 for(const html of [m,n]){assert.match(html,/Prüfung &lt;2027&gt;/);assert.match(html,/Baumschule/);assert.match(html,/2027-05-03/);assert.match(html,/Anna Beispiel/);assert.doesNotMatch(html,/FREMDE_PERSON|FREMDER_AUSSCHUSS/);assert.match(html,/window.print/);}
 assert.equal(JSON.stringify(d),before);
});
test('empty remarks and material lists remain explicit and unexpected report types fail',()=>{
 const {e,d}=fixture();delete e.internalNotes;delete e.items[0].task.materials;
 assert.match(O.document(e,d,'notes'),/Keine internen Bemerkungen hinterlegt/);assert.match(O.document(e,d,'materials'),/Materialliste.*ergänzen/);assert.throws(()=>O.document(e,d,'other'),/Dokument/i);
});
test('organizational Word files have flowing editable paragraphs, exact long text and no participant leakage',async()=>{
 const {e,d}=fixture();e.internalNotes='START_NOTIZ\n'+('Langer Hinweis zur Vorbereitung. '.repeat(600))+'\nENDE_NOTIZ';
 const m=await xml(await D.organization(e,d,'materials')),n=await xml(await D.organization(e,d,'notes'));
 for(const text of ['PRIVATE_MATERIAL','VORSCHLAG_MATERIAL','Bestätigt','Vorschlag','Noch festzulegen'])assert.ok(m.includes(text));
 assert.match(n,/START_NOTIZ/);assert.match(n,/ENDE_NOTIZ/);assert.equal((n.match(/Langer Hinweis zur Vorbereitung\./g)||[]).length,600);
 for(const out of [m,n]){assert.doesNotMatch(out,/w:txbxContent|wps:txbx|v:textbox|<wp:anchor|GEHEIME_LÖSUNG/);assert.match(out,/Anna Beispiel/);assert.match(out,/w:pgSz/);}
 assert.doesNotMatch(n,/PRIVATE_MATERIAL/);assert.doesNotMatch(m,/START_NOTIZ/);
 for(const examiner of [false,true]){const out=await xml(await D.document(e,d,examiner));assert.doesNotMatch(out,/START_NOTIZ|PRIVATE_MATERIAL|VORSCHLAG_MATERIAL/);}
});
module.exports={fixture};

test('exported time plan includes saved times and oral separation without applying pending proposals',async()=>{
 const {e,d}=fixture();e.items[0].task.minutes=60;e.items[0].task.timingProposal={minutes:60,method:'planning',explanation:'Planung aus dem verbleibenden Zeitbudget.'};e.items[1].task.minutes=null;e.oralItem={id:'oral-plan',task:{...e.items[0].task,id:'oral-task',kind:'oral',title:'Gespräch',minutes:15}};
 const before=JSON.stringify(d),h=O.document(e,d,'timing'),w=await xml(await D.organization(e,d,'timing'));
 for(const out of [h,w]){assert.match(out,/90 Minuten/);assert.match(out,/offene Zeitangabe/);assert.match(out,/Planungsvorschlag/);assert.match(out,/Noch festzulegen/);assert.match(out,/15 Minuten/);assert.match(out,/Mündliche Prüfungsaufgabe/);assert.doesNotMatch(out,/PRIVATE_NOTIZ|PRIVATE_MATERIAL/);}
 assert.equal(JSON.stringify(d),before);assert.match(O.packageIndex(e),/05_Zeitplan.html/);
});


test('source time contradictions remain in readiness and draft exports after a time edit',async()=>{
 const {e,d}=fixture();e.items[0].task.text='Bearbeitungszeit: 45 Minuten';e.items[0].task.minutes=60;
 assert.ok(C.readiness(e).issues.some(x=>/60.*45|45.*60/.test(x)));
 const out=await xml(await D.document(e,d));assert.match(out,/ENTWURF/);assert.match(O.document(e,d,'timing'),/60.*45|45.*60/);
});
