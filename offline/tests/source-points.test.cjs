const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),S=require('../src/source-layout.js'),W=require('../src/paper.js'),AI=require('../src/ai.js');
const block=(id,text,x,y,width=440,bold=false)=>{const lines=text.split('\n').map(text=>({text,runs:[{text,bold,italic:false}]}));return {id,text,originalText:text,x,y,width,height:lines.length*14+1,fontSize:12,lineHeight:14,lines};};
function fixture(){
 const d=C.validate(JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../demo.json')))),t=C.clone(d.tasks[0]);
 const blocks=[block('heading','Arbeitsauftrag',40,60,200,true),block('start','Ermitteln Sie den Bedarf für die vorgesehene',40,100),block('wrap','Pflanzfläche und begründen Sie das Ergebnis.',58,114,400),block('numbers','1. Bereiten Sie das Material vor.\n2. Prüfen Sie vor dem Aufbau',40,160),block('indent','die Bauteile gemeinsam.',58,188,350),block('bullet','•',40,222,6),block('bullet-body','Beschriften Sie die ausgewählten Bauteile\nund dokumentieren Sie die Zuordnung.',58,220,400),block('next-bullet','•',40,264,6),block('next-body','Kontrollieren Sie das Arbeitsergebnis.',58,262,400),block('heading-two','Dokumentation',40,310,200,true),block('note','Notieren Sie Ihre Beobachtungen.',40,338),block('left-cell','Name:',40,380,150),block('right-cell','Datum:',320,380,150)];
 t.text=blocks.map(b=>b.text).join('\n');t.sourceLayout={version:1,sourceId:t.sourceIds[0],reference:'synthetic-paragraphs',sourcePdfHash:'a'.repeat(64),baselineText:t.text,warnings:[],pages:[{width:595.276,height:841.89,backgroundAssetId:'background-demo',logos:[],blocks},{width:595.276,height:841.89,backgroundAssetId:'background-demo',logos:[],blocks:[]}]};
 d.assets.push({id:'background-demo',name:'Seite.png',mime:'image/png',data:'YWJj'});t.assetLinks.push({assetId:'background-demo',audience:'candidate',role:'source-page'});const e=C.newExam({specialty:t.specialty,examType:t.examType});C.addItem(e,t);return {d,e,t:e.items[0].task};
}
test('source editing groups wrapped and indented continuations while separating points, headings and columns',()=>{
 assert.equal(typeof S.groups,'function');const {t}=fixture(),page=t.sourceLayout.pages[0],before=JSON.stringify(page),groups=S.groups(page);
 assert.deepEqual(groups.map(g=>g.text),['Arbeitsauftrag','Ermitteln Sie den Bedarf für die vorgesehene Pflanzfläche und begründen Sie das Ergebnis.','1. Bereiten Sie das Material vor.','2. Prüfen Sie vor dem Aufbau die Bauteile gemeinsam.','• Beschriften Sie die ausgewählten Bauteile und dokumentieren Sie die Zuordnung.','• Kontrollieren Sie das Arbeitsergebnis.','Dokumentation','Notieren Sie Ihre Beobachtungen.','Name:','Datum:']);
 assert.equal(JSON.stringify(page),before,'merely opening the editor must not rewrite sources');assert.equal(new Set(groups.map(g=>g.id)).size,groups.length);
});
test('one editable target covers each complete point and untouched print preserves original block positions and wording',()=>{
 const {d,e,t}=fixture(),before=JSON.stringify(t),html=W.pages(e,d),print=W.pages(e,d,false,true);
 assert.equal((html.match(/data-paper-field="source-block"/g)||[]).length,10);assert.match(html,/Ermitteln Sie den Bedarf für die vorgesehene Pflanzfläche/);assert.equal(JSON.stringify(t),before);
 assert.equal((print.match(/data-source-block=/g)||[]).length,t.sourceLayout.pages[0].blocks.length);assert.match(print,/left:58pt;top:114pt/);assert.doesNotMatch(print,/contenteditable|source-point-editor/);assert.equal((print.match(/data-source-page=/g)||[]).length,2);
});
test('editing a virtual point updates only its source segments and survives reloading with stable ids',()=>{
 const {e,t}=fixture(),original=C.clone(t),groups=S.groups(t.sourceLayout.pages[0]),target=groups.find(g=>g.text.startsWith('2.')),value='2. Prüfen Sie alle Bauteile vor dem Aufbau zusammen.';
 assert.equal(W.edit(e,e.items[0].id,'source-block',target.text,target.id),false);assert.equal(W.edit(e,e.items[0].id,'source-block',value,target.id),true);
 const edited=e.items[0].task,reloaded=JSON.parse(JSON.stringify(edited));assert.equal(S.read(reloaded,target.id),value);assert.deepEqual(S.groups(reloaded.sourceLayout.pages[0]).map(g=>g.id),groups.map(g=>g.id));
 assert.equal(S.read(reloaded,groups.find(g=>g.text.startsWith('1.')).id),'1. Bereiten Sie das Material vor.');assert.equal(reloaded.sourceLayout.pages[0].blocks.find(b=>b.id==='indent').text,'');assert.match(reloaded.sourceLayout.pages[0].blocks.find(b=>b.id==='numbers').text,/1\. Bereiten Sie das Material vor\.\n2\. Prüfen Sie alle/);
 for(const [n,b] of original.sourceLayout.pages[0].blocks.entries()){const now=reloaded.sourceLayout.pages[0].blocks[n];assert.equal(now.originalText,b.originalText);assert.deepEqual(now.lines,b.lines);assert.equal(now.x,b.x);assert.equal(now.y,b.y);}
 assert.equal(reloaded.text,reloaded.sourceLayout.baselineText);assert.equal(reloaded.reviewStatus,'review');assert.doesNotThrow(()=>C.checkTask(reloaded));
 assert.equal(S.edit(reloaded,target.id,target.text),true);assert.deepEqual(reloaded.sourceLayout.pages[0].blocks,original.sourceLayout.pages[0].blocks,'undo restores authoritative text and layout');
});
test('AI reads and replaces a complete connected point without including its neighbour and can undo it',async()=>{
 const {e}=fixture(),item=e.items[0],g=S.groups(item.task.sourceLayout.pages[0]).find(g=>g.text.startsWith('• Beschriften')),neighbour=S.groups(item.task.sourceLayout.pages[0]).find(g=>g.text.startsWith('• Kontrollieren')),calls=[];
 const session=AI.createSession({targets:[{field:'task',label:'Textabschnitt',read:()=>S.read(item.task,g.id),write:value=>W.edit(e,item.id,'source-block',value,g.id),valid:()=>true}],request:async(path,payload)=>{calls.push({path,payload});return path.endsWith('status')?{enabled:true}:{text:'• Beschriften und dokumentieren Sie die ausgewählten Bauteile.'};}});
 await session.checkStatus();await session.generate();assert.equal(calls[1].payload.text,g.text);assert.equal(session.accept(),true);assert.equal(S.read(item.task,neighbour.id),neighbour.text);assert.equal(session.undo(),true);assert.equal(S.read(item.task,g.id),g.text);
});
test('current Zwischenprüfung inline source edits cannot turn an individual task into a combination',()=>{
 const {e,t}=fixture(),L=require('../src/planning.js');e.examType=t.examType='ZP';e.pattern={categoryCatalog:'zp-general-2026'};L.assignCategories(t,['harvest'],'Synthetisches Generalthema');
 const g=S.groups(t.sourceLayout.pages[0])[0],before=JSON.stringify(e);
 assert.throws(()=>W.edit(e,e.items[0].id,'source-block','Erntearbeiten und Aufbereitung',g.id),/Einzelaufgaben|Kombinationsaufgaben/);assert.equal(JSON.stringify(e),before);
 delete e.pattern;assert.equal(W.edit(e,e.items[0].id,'source-block','Erntearbeiten und Aufbereitung',g.id),true,'historical exam policy remains unchanged');
});
test('source edits preserve unrelated literal blank lines and reject invalid point metadata',()=>{
 const {t}=fixture(),p=t.sourceLayout.pages[0];p.blocks.push(block('literal-lines','Abstand\n\nUnverändert',40,440));const g=S.groups(p)[1];S.edit(t,g.id,'Geänderter zusammenhängender Text.');assert.equal(p.blocks.at(-1).text,'Abstand\n\nUnverändert');
 p.textEdits.push({id:'foreign',text:'Unexpected'});assert.throws(()=>S.validate(t),/Vorlage/i);
});
test('a list point keeps close continuation sentences after a full stop or colon',()=>{
 const p={blocks:[block('point','1. Ermitteln Sie den Bedarf.',40,100),block('sentence','Begründen Sie anschließend Ihre Entscheidung:',58,114),block('details','Nennen Sie zwei nachvollziehbare Gründe.',58,128),block('next','2. Kontrollieren Sie das Ergebnis.',40,156)]};
 assert.deepEqual(S.groups(p).map(g=>g.text),['1. Ermitteln Sie den Bedarf. Begründen Sie anschließend Ihre Entscheidung: Nennen Sie zwei nachvollziehbare Gründe.','2. Kontrollieren Sie das Ergebnis.']);
});
test('editing one point leaves an unrelated older block edit byte-for-byte intact in storage and print',()=>{
 const {t}=fixture(),p=t.sourceLayout.pages[0],b=p.blocks.find(b=>b.id==='note');S.edit(t,b.id,'Manuell geändert.\nZeilenumbruch bleibt.');const original=C.clone(b),g=S.groups(p).find(g=>g.text.startsWith('2.'));
 S.edit(t,g.id,'2. Kontrollieren Sie alle Bauteile.');assert.deepEqual(b,original);assert.deepEqual(S.displayBlocks(p).find(x=>x.id===b.id),b);
 S.edit(t,g.id,g.text);assert.deepEqual(b,original);
});
test('current preparation strips obsolete reportbook allowance from edited point metadata and exported wording',()=>{
 const {e,t,d}=fixture(),g=S.groups(t.sourceLayout.pages[0]).find(g=>g.text.startsWith('2.'));S.edit(t,g.id,'2. Das Berichtsheft ist zulässig. Prüfen Sie die Bauteile.');
 e.items[0].task=C.prepareCurrentTask(t);assert.doesNotMatch(S.read(e.items[0].task,g.id),/Berichtsheft ist zulässig/i);assert.doesNotMatch(W.document(e,d),/Berichtsheft ist zulässig/i);
});
test('legacy text added to an originally blank block stays editable and survives another point edit',()=>{
 const {t}=fixture(),p=t.sourceLayout.pages[0],b=block('old-blank','',40,420);p.blocks.push(b);S.edit(t,b.id,'Alte benutzerdefinierte Ergänzung');const g=S.groups(p).find(g=>g.text.startsWith('2.'));
 assert.ok(S.groups(p).some(g=>g.text===b.text));S.edit(t,g.id,'2. Neue Prüfung der Bauteile.');assert.equal(b.text,'Alte benutzerdefinierte Ergänzung');assert.ok(S.displayBlocks(p).some(b=>b.text==='Alte benutzerdefinierte Ergänzung'));
});
test('a short bold heading inside an extracted block remains distinct from text before and after it',()=>{
 const b=block('mixed','Ermitteln Sie zunächst den vollständigen Materialbedarf\nDokumentation\nNotieren Sie danach die Ergebnisse.',40,100);b.lines[1].runs[0].bold=true;
 assert.deepEqual(S.groups({blocks:[b]}).map(g=>g.text),['Ermitteln Sie zunächst den vollständigen Materialbedarf','Dokumentation','Notieren Sie danach die Ergebnisse.']);
});
test('reportbook cleanup cannot revive an untouched point sharing a block with a neighbouring edit',()=>{
 const {t,e,d}=fixture(),p=t.sourceLayout.pages[0];p.blocks=[block('shared','1. Ermitteln Sie den Bedarf.\n2. Das Berichtsheft ist erlaubt.',40,160)];t.text=t.sourceLayout.baselineText=p.blocks[0].text;
 S.edit(t,S.groups(p)[0].id,'1. Ermitteln Sie den gesamten Bedarf.');e.items[0].task=C.prepareCurrentTask(t);
 assert.doesNotMatch(S.groups(e.items[0].task.sourceLayout.pages[0]).map(g=>g.text).join('\n'),/Berichtsheft ist erlaubt/);assert.doesNotMatch(W.document(e,d),/Berichtsheft ist erlaubt/);
});
test('ambiguous legacy multiline changes retain one stable group without losing inserted blank-line text',()=>{
 const {t}=fixture(),p=t.sourceLayout.pages[0];p.blocks=[block('legacy','1. Prüfen.\n\n2. Dokumentieren.',40,160),block('other','Separater Auftrag.',40,240)];t.text=t.sourceLayout.baselineText=p.blocks.map(b=>b.text).join('\n');S.edit(t,'legacy','1. Prüfen.\nBereits ergänzte Zusatzanweisung\n2. Dokumentieren.');
 const legacy=S.groups(p).find(g=>g.id.includes('legacy')),other=S.groups(p).find(g=>g.id.includes('other')),before=p.blocks[0].text;assert.equal(legacy.text,before);assert.match(legacy.id,/:all$/);
 S.edit(t,other.id,'Separater geänderter Auftrag.');assert.equal(p.blocks[0].text,before);assert.equal(S.read(t,legacy.id),before);assert.equal(S.groups(p).filter(g=>g.id.includes('legacy')).length,1);
});
test('legacy edits with a changed line count never expose duplicated or empty original point targets',()=>{
 const {t}=fixture(),p=t.sourceLayout.pages[0];p.blocks=[block('legacy','1. Prüfen.\n2. Dokumentieren.',40,160)];t.text=t.sourceLayout.baselineText=p.blocks[0].text;S.edit(t,'legacy','1. Prüfen Sie sorgfältig.\nZusatzsatz.\n2. Dokumentieren.');const gs=S.groups(p);
 assert.equal(gs.length,1);assert.equal(gs[0].text,p.blocks[0].text);S.edit(t,gs[0].id,'1. Prüfen Sie alle Bauteile.\n2. Dokumentieren Sie diese.');assert.equal(S.groups(p)[0].id,gs[0].id);assert.equal(S.groups(p).length,1);
});
test('reportbook cleanup synchronizes a phrase split over two edited point groups',()=>{
 const {t,e,d}=fixture(),p=t.sourceLayout.pages[0];p.blocks=[block('before','Ihr Berichtsheft',40,160),block('after','ist zugelassen.',40,200)];t.text=t.sourceLayout.baselineText=p.blocks.map(b=>b.text).join('\n');const gs=S.groups(p);S.edit(t,gs[0].id,'Das Berichtsheft');S.edit(t,gs[1].id,'ist erlaubt.');
 e.items[0].task=C.prepareCurrentTask(t);const next=e.items[0].task;assert.doesNotMatch(S.displayBlocks(next.sourceLayout.pages[0]).map(b=>b.text).join('\n'),/Berichtsheft\s+ist erlaubt/i);assert.doesNotThrow(()=>W.document(e,d));assert.doesNotMatch(W.document(e,d),/>Das Berichtsheft</);
});
test('an originally blank legacy group can be emptied and retyped without losing its identity',()=>{
 const {t,e}=fixture(),p=t.sourceLayout.pages[0];p.blocks=[block('blank','',40,160)];t.text=t.sourceLayout.baselineText='';S.edit(t,'blank','Ältere Ergänzung');const id=S.groups(p)[0].id;
 assert.equal(W.edit(e,e.items[0].id,'source-block','',id),true);assert.doesNotThrow(()=>S.validate(e.items[0].task));assert.equal(S.groups(e.items[0].task.sourceLayout.pages[0])[0].id,id);
 assert.equal(W.edit(e,e.items[0].id,'source-block','Neue Ergänzung',id),true);assert.equal(S.read(e.items[0].task,id),'Neue Ergänzung');
});
module.exports={fixture,block};
