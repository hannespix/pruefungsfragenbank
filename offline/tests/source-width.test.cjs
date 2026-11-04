'use strict';
// Original pages: edited sections wrap at the text column, the width can be set by hand and snaps to page and column edges.
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),S=require('../src/source-layout.js'),W=require('../src/paper.js'),L=require('../src/planning.js'),D=require('../src/docx.js'),Zip=require('../vendor/jszip.min.js');
const block=(id,text,x,y,width=440,bold=false)=>{const lines=text.split('\n').map(text=>({text,runs:[{text,bold,italic:false}]}));return {id,text,originalText:text,x,y,width,height:lines.length*14+1,fontSize:12,lineHeight:14,lines};};
function fixture(){
 const d=C.validate(JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../demo.json')))),t=C.clone(d.tasks[0]);
 // "Kurz" is a short PDF line (140 pt) in a 440 pt column; "Name:" has "Datum:" to its right on the same line.
 const blocks=[block('heading','Arbeitsauftrag mit einer langen Zeile über die ganze Breite',40,60,440,true),block('short','Kurz',40,100,140),block('left-cell','Name:',40,380,150),block('right-cell','Datum:',320,380,150)];
 t.text=blocks.map(b=>b.text).join('\n');t.sourceLayout={version:1,sourceId:t.sourceIds[0],reference:'synthetic-width',sourcePdfHash:'a'.repeat(64),baselineText:t.text,warnings:[],pages:[{width:595.276,height:841.89,backgroundAssetId:'background-demo',logos:[],blocks}]};
 d.assets.push({id:'background-demo',name:'Seite.png',mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='});t.assetLinks.push({assetId:'background-demo',audience:'candidate',role:'source-page'});L.assignCategories(t,['plantwork'],'Synthetisch bestätigte Einzelaufgabe');
 const e=C.newExam({specialty:t.specialty,examType:t.examType,examYear:2026,pattern:L.pattern({...d,tasks:[t]},t.examType,t.specialty)});C.addItem(e,t);return {d,e,item:e.items[0]};
}
const point=(item,start)=>S.groups(item.task.sourceLayout.pages[0]).find(g=>g.text.startsWith(start));
const shown=(item,id)=>S.displayBlocks(item.task.sourceLayout.pages[0]).find(b=>b.id===id);

test('an edited section uses the width of its text column instead of the PDF line width',()=>{
 const {e,item}=fixture(),short=point(item,'Kurz'),name=point(item,'Name:');
 assert.equal(S.pointWidth(item.task.sourceLayout.pages[0],short),140,'untouched sections keep their original width');
 assert.equal(W.edit(e,item.id,'source-block','Kurz, jetzt aber mit einem deutlich längeren Satz als vorher in der Vorlage.',short.id),true);
 assert.equal(shown(e.items[0],short.id).width,440,'to the text edge of the page (40 + 440 pt)');
 W.edit(e,item.id,'source-block','Name und Vorname der Prüfungsteilnehmerin',name.id);
 assert.equal(shown(e.items[0],name.id).width,274,'stops 6 pt before "Datum:" on the same line');
});

test('the width can be set by hand, survives further text edits and resets to the column on request',()=>{
 const {e,item}=fixture(),id=point(item,'Kurz').id;
 assert.throws(()=>W.edit(e,item.id,'source-width',300,id),/nur bei bearbeiteten/,'only edited sections');
 W.edit(e,item.id,'source-block','Kurz und etwas länger.',id);e.items[0].task.reviewStatus='approved';
 assert.equal(W.edit(e,item.id,'source-width',300.2,id),true);assert.equal(shown(e.items[0],id).width,300);assert.equal(e.items[0].task.reviewStatus,'approved','a width change is layout only');
 assert.equal(W.edit(e,item.id,'source-width',300,id),false,'unchanged');
 W.edit(e,item.id,'source-block','Kurz und noch etwas länger.',id);assert.equal(shown(e.items[0],id).width,300,'the width stays when the text changes');
 assert.throws(()=>W.edit(e,item.id,'source-width',800,id),/außerhalb der Seite/);assert.throws(()=>W.edit(e,item.id,'source-width',5,id),/außerhalb der Seite/);
 assert.equal(W.edit(e,item.id,'source-width',null,id),true);assert.equal(shown(e.items[0],id).width,440);assert.equal(e.items[0].task.sourceLayout.pages[0].textEdits.find(x=>x.id===id).width,undefined);
 const bad=C.clone(e.items[0].task);bad.sourceLayout.pages[0].textEdits[0].width=-3;assert.throws(()=>S.validate(bad),/Originalvorlage/);
});

test('the editor offers a width handle with snap targets on edited sections only',()=>{
 const {d,e,item}=fixture(),id=point(item,'Name:').id;let html=W.pages(e,d);
 assert.doesNotMatch(html,/source-width-handle/);assert.match(html,/data-original-width="150" data-column-width="274"/);
 W.edit(e,item.id,'source-block','Name und Vorname',id);html=W.pages(e,d);
 const handle=html.match(/<span class="source-width-handle"[^>]*>/)?.[0]||'';assert.match(handle,/data-width="274"/);assert.match(handle,/role="slider"/);
 const snaps=handle.match(/data-snaps="([^"]+)"/)[1].split(',').map(Number);for(const w of [150,274,440])assert.ok(snaps.includes(w),w+' in '+snaps);
 assert.doesNotMatch(W.pages(e,d,false,true),/source-width-handle|contenteditable/,'nothing of this in print');
});

test('Word uses the widened section: the right indent ends at the text column',async()=>{
 const {d,e,item}=fixture(),id=point(item,'Kurz').id;W.edit(e,item.id,'source-block','Kurz, jetzt aber mit einem deutlich längeren Satz.',id);d.assets.push({id:'test-font',name:'Test.ttf',mime:'font/ttf',design:'bw-2024',docxFontKey:'sansRegular',fontFamily:'Export Test',data:require('./fixtures/docx-test-font.json').data});
 const xml=await(await Zip.loadAsync(await D.document(e,d))).file('word/document.xml').async('string');
 const para=xml.split('<w:p>').find(p=>p.includes('deutlich längeren Satz'))||'';assert.ok(para,'paragraph found');
 const right=Number(para.match(/w:right="(\d+)"/)?.[1]||0);assert.ok(right<=Math.round((595.276-40-440)*20)+20,'right indent '+right+' leaves the column width');
});
