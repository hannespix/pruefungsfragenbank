const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),S=require('../src/source-layout.js'),P=require('../src/print.js'),W=require('../src/paper.js'),D=require('../src/docx.js');
const allowance='------------------------------------das Berichtsheft ist zulässig--------------------------------------------';
function task(text='Arbeitsauftrag.\n'+allowance+'\nWeitere Angaben bleiben exakt.'){return {...C.clone(require('../demo.json').tasks[0]),text,reviewedAt:'2025-11-01T12:00:00.000Z'};}
function exam(t=task(),fields={}){return {...C.newExam({examType:t.examType,specialty:t.specialty,examYear:2026}),items:[{id:'item',originTaskId:t.id,task:C.clone(t)}],...fields};}
function sourceTask(){const t=task(),blocks=['Arbeitsauftrag.',allowance,'Weitere Angaben bleiben exakt.'].map((text,index)=>({id:'block-'+index,x:40,y:80+index*50,width:500,height:40,fontSize:12,lineHeight:15,text,originalText:text,lines:[{text,runs:[{text,bold:false,italic:false}]}]}));t.sourceLayout={version:1,sourceId:t.sourceIds[0],reference:'synthetic-reportbook-template',sourcePdfHash:'a'.repeat(64),baselineText:t.text,warnings:[],pages:[{width:595,height:842,backgroundAssetId:'background',logos:[],blocks}]};t.assetLinks=[{assetId:'background',audience:'candidate',role:'source-page'}];return t;}

test('the reportbook rule starts in 2026 and preserves historical scopes and used originals',()=>{
 for(const [fields,want] of [[{examYear:2026},true],[{examYear:2027},true],[{examYear:2025,createdAt:'2026-11-03T12:00:00.000Z'},false],[{examYear:undefined,date:'2026-05-01'},true],[{examYear:undefined,date:'2025-05-01'},false],[{examYear:undefined,date:'',createdAt:'2026-11-03T12:00:00.000Z'},true],[{examYear:undefined,date:'',createdAt:'2025-11-03T12:00:00.000Z'},false],[{examYear:undefined,date:'',createdAt:undefined},true],[{examYear:2026,status:'used'},false]])assert.equal(C.currentExamPolicy(exam(task(),fields)),want,JSON.stringify(fields));
});
test('new current task copies remove allowance while retaining exact source provenance and unrelated wording',()=>{
 const original=sourceTask(),before=C.clone(original),copy=C.prepareCurrentTask(original);
 assert.equal(copy.text,'Arbeitsauftrag.\n\nWeitere Angaben bleiben exakt.');assert.equal(copy.sourceLayout.pages[0].blocks[1].text,'');assert.equal(copy.sourceLayout.baselineText,copy.text);assert.equal(copy.sourceLayout.edited,true);assert.equal(S.stale(copy),false);
 assert.deepEqual(copy.sourceLayout.pages[0].blocks.map(b=>b.originalText),before.sourceLayout.pages[0].blocks.map(b=>b.originalText));assert.deepEqual(copy.sourceLayout.pages[0].blocks.map(b=>b.lines),before.sourceLayout.pages[0].blocks.map(b=>b.lines));assert.deepEqual(copy.sourceIds,before.sourceIds);assert.deepEqual(copy.assetLinks,before.assetLinks);assert.deepEqual(original,before);
 assert.equal(copy.reviewStatus,'review');assert.equal(copy.solutionStatus,'draft');assert.equal(copy.reviewedBy,'');assert.ok(!copy.reviewedAt);assert.doesNotThrow(()=>C.checkTask(copy));
 assert.deepEqual(C.reportbookIssues(exam(copy)),[]);assert.doesNotMatch(W.document(exam(copy),{assets:[]}),/Berichtsheft ist zulässig/);
});
test('legacy source task text and page blocks retain their separate wording and whitespace during cleanup',()=>{
 const original=sourceTask();original.text='Quellangaben: 2025\n\n  Arbeitsauftrag.\n'+allowance+'\nWeitere Angaben bleiben exakt.\nZusatz nur im Aufgabentext.';original.sourceLayout.baselineText=original.text;const before=C.clone(original);
 const copy=C.prepareCurrentTask(original);assert.equal(copy.text,before.text.replace(allowance,''));assert.equal(copy.sourceLayout.baselineText,copy.text);assert.equal(copy.sourceLayout.pages[0].blocks[1].text,'');assert.equal(copy.sourceLayout.edited,true);assert.equal(S.stale(copy),false);
 assert.deepEqual(copy.sourceLayout.pages[0].blocks[0],before.sourceLayout.pages[0].blocks[0]);assert.deepEqual(copy.sourceLayout.pages[0].blocks[2],before.sourceLayout.pages[0].blocks[2]);assert.deepEqual(original,before);
});
function splitSource(texts){const t=sourceTask();t.sourceLayout.pages[0].blocks=texts.map((text,index)=>({...t.sourceLayout.pages[0].blocks[index],id:'split-'+index,text,originalText:text,lines:[{text,runs:[{text,bold:false,italic:false}]}]}));t.text='Zusätzliche Quellangabe.\n'+texts.join('\n');t.sourceLayout.baselineText=t.text;return t;}
test('allowance spanning source blocks is removed across both rendered fragments while preserving provenance',()=>{
 const original=splitSource(['Arbeitsauftrag.\nDas Berichtsheft ist','zulässig\nWeitere Angaben.']),before=C.clone(original),copy=C.prepareCurrentTask(original);
 assert.deepEqual(copy.sourceLayout.pages[0].blocks.map(b=>b.text),['Arbeitsauftrag.\n','\nWeitere Angaben.']);assert.equal(copy.text,'Zusätzliche Quellangabe.\nArbeitsauftrag.\n\nWeitere Angaben.');assert.equal(copy.sourceLayout.baselineText,copy.text);assert.deepEqual(C.reportbookIssues(exam(copy)),[]);assert.doesNotMatch(W.document(exam(copy),{assets:[]}),/Berichtsheft/);
 assert.deepEqual(copy.sourceLayout.pages[0].blocks.map(b=>b.originalText),before.sourceLayout.pages[0].blocks.map(b=>b.originalText));assert.deepEqual(copy.sourceLayout.pages[0].blocks.map(b=>b.lines),before.sourceLayout.pages[0].blocks.map(b=>b.lines));assert.deepEqual(original,before);
});
test('negative source statements spanning blocks remain unchanged and are not policy issues',()=>{
 for(const texts of [['Kein','Berichtsheft ist erlaubt.'],['Das Berichtsheft ist','nicht zulässig.']]){const original=splitSource(texts);assert.deepEqual(C.prepareCurrentTask(original),original);assert.deepEqual(C.reportbookIssues(exam(original)),[]);}
});
test('export guards also inspect positive allowance split across current source blocks',async()=>{
 const t=splitSource(['Das Berichtsheft ist','zulässig']);t.text=t.sourceLayout.baselineText='Abweichend zusammengefasster Aufgabentext.';const e=exam(t),d={assets:[]};
 assert.ok(C.reportbookIssues(e).length);assert.throws(()=>P.document(e,d),/Berichtsheft/);assert.throws(()=>W.document(e,d),/Berichtsheft/);await assert.rejects(()=>D.document(e,d),/Berichtsheft/);
});
test('known affirmative variants are removed without deleting neighboring text',()=>{
 for(const phrase of ['--- das Berichtsheft ist zulässig---','Das Berichtsheft darf benutzt werden.','Das Berichtsheft darf verwendet werden.','Berichtsheft ist erlaubt','Das Berichtsheft ist zugelassen','DAS BERICHTSHEFT IST ZULÄSSIG']){
  const t=task('Vorher.\n'+phrase+'\nNachher.');assert.equal(C.prepareCurrentTask(t).text,'Vorher.\n\nNachher.',phrase);
 }
});
test('prohibitions and unrelated reportbook references remain unchanged',()=>{
 for(const text of ['Das Berichtsheft ist nicht zulässig.','Das Berichtsheft darf nicht benutzt werden.','Kein Berichtsheft ist erlaubt.','Das Berichtsheft ist weder erlaubt noch zugelassen.','Das Berichtsheft bleibt zu Hause.']){
  const t=task(text);assert.deepEqual(C.prepareCurrentTask(t),t);assert.deepEqual(C.reportbookIssues(exam(t)),[],text);
 }
});
test('adding tasks sanitizes current snapshots but retains pre-2026 exam copies and the bank task',()=>{
 const t=sourceTask(),before=C.clone(t),current=C.newExam({examType:t.examType,specialty:t.specialty,examYear:2026}),old=C.newExam({examType:t.examType,specialty:t.specialty,examYear:2025});
 C.addItem(current,t);C.addItem(old,t);assert.equal(current.items[0].task.sourceLayout.pages[0].blocks[1].text,'');assert.deepEqual(old.items[0].task,t);assert.deepEqual(t,before);
});
test('policy issues cover every rendered statement field and readiness exposes the policy issue',()=>{
 const fields=[e=>e.title='Prüfung · Das Berichtsheft ist zulässig',e=>e.notes='Das Berichtsheft ist zulässig',e=>e.items[0].task.title='Aufgabe · Das Berichtsheft ist zulässig',e=>e.items[0].task.text='Das Berichtsheft ist zulässig',e=>e.items[0].task.solution='Das Berichtsheft ist zulässig',e=>e.items[0].task.criteria[0].text='Das Berichtsheft ist zulässig',e=>e.items[0].task.criteria[0].answer='Das Berichtsheft ist zulässig'];
 for(const set of fields){const e=exam(task('Arbeitsauftrag.'));set(e);assert.ok(C.reportbookIssues(e).some(x=>/Berichtsheft/.test(x)));assert.ok(C.readiness(e).issues.some(x=>/Berichtsheft/.test(x)));assert.throws(()=>C.assertExamPolicy(e),/Berichtsheft/);assert.equal(C.cleanReportbook(e),true);assert.deepEqual(C.reportbookIssues(e),[]);}
 const e=exam(sourceTask());e.items[0].task.text=e.items[0].task.sourceLayout.baselineText='No current allowance in plain text';assert.ok(C.reportbookIssues(e).some(x=>/Berichtsheft/.test(x)));
});
test('cleaning an existing exam is atomic, leaves bank originals intact and resets examination review',()=>{
 const bank=sourceTask(),before=C.clone(bank),e=exam(bank);e.notes='Hinweis.\nDas Berichtsheft ist erlaubt.';e.regulationReview={a:true};e.regulationReviewKey='old';
 assert.equal(C.cleanReportbook(e),true);assert.equal(e.notes,'Hinweis.\n');assert.equal(e.items[0].task.reviewStatus,'review');assert.deepEqual(bank,before);assert.ok(!e.regulationReview);assert.ok(!e.regulationReviewKey);assert.ok(Number.isFinite(Date.parse(e.updatedAt)));assert.equal(C.cleanReportbook(e),false);
 const broken=exam(task());broken.items.push({id:'stale',originTaskId:bank.id,task:C.clone(bank)});broken.items[1].task.text+=' Unabgeglichene Änderung.';const unchanged=C.clone(broken);assert.throws(()=>C.cleanReportbook(broken),/Originalseiten|Vorlage|Aufgabentext/);assert.deepEqual(broken,unchanged);
});
test('explicitly cleaning a fresh duplicate removes allowance even when its old year is retained',()=>{
 const old=exam(task(),{examYear:2025}),before=C.clone(old);assert.equal(C.cleanReportbook(old),false);assert.deepEqual(old,before);
 const copy=C.clone(old);copy.id='new-copy';assert.equal(C.cleanReportbook(copy,{force:true}),true);assert.doesNotMatch(copy.items[0].task.text,/Berichtsheft/);assert.deepEqual(old,before);
 const used=exam(task(),{status:'used'}),usedBefore=C.clone(used);assert.equal(C.cleanReportbook(used),false);assert.deepEqual(used,usedBefore);
 assert.equal(C.cleanReportbook(used,{force:true}),false);assert.deepEqual(used,usedBefore);
});
test('all document exports block pre-existing current allowances and retain historical reprints',async()=>{
 const d={assets:[]},e=exam(task());assert.throws(()=>P.document(e,d),/Berichtsheft/);assert.throws(()=>W.document(e,d),/Berichtsheft/);await assert.rejects(()=>D.document(e,d),/Berichtsheft/);
 const historical=exam(task(),{examYear:2025});assert.match(P.document(historical,d),/Berichtsheft ist zulässig/);assert.match(W.document(historical,d),/Berichtsheft ist zulässig/);assert.ok((await D.document(historical,d)).length>0);
 const used=exam(task(),{status:'used'});assert.match(W.document(used,d),/Berichtsheft ist zulässig/);
 C.cleanReportbook(e);assert.doesNotThrow(()=>P.document(e,d));assert.doesNotThrow(()=>W.document(e,d));assert.ok((await D.document(e,d)).length>0);
});
