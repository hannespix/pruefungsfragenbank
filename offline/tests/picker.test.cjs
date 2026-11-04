'use strict';
// Task picker in the exam editor: wide card grid with a filter bar, variants side by side, Word-like sheet toolbar.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'src'),r=f=>require(path.join(SRC,f));
const C=r('core.js');

async function ui(){
 const data=C.validate(JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json'),'utf8')));
 for(const t of data.tasks)if(t.examType==='ZP')t.text='Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Synthetisches Beispiel\n'+t.text;
 data.workshops=[{id:'meeting',title:'Termin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];
 const stubs=new Map(),listeners={},mk=id=>{const on={};const el={id,value:'',innerHTML:'',textContent:'',open:false,dataset:{},on,addEventListener(n,f){on[n]=f;},showModal(){this.open=true;},close(){this.open=false;},classList:{s:new Set(),add(...x){x.forEach(v=>this.s.add(v));},remove(...x){x.forEach(v=>this.s.delete(v));},contains(x){return this.s.has(x);}}};stubs.set(id,el);return el;};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input','#paper-year','#paper-scope','#paper-tag','#paper-sort'])mk(id);
 stubs.set('#seed',{textContent:JSON.stringify(data)});stubs.set('meta[name=hortiexam-storage]',{content:'memory'});
 const sandbox={HortiHistory:r('history.js'),HortiAdvisor:r('advisor.js'),HortiPointsPlan:r('points-plan.js'),HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:r('timing-plan.js'),HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:require(path.join(ROOT,'vendor/jszip.min.js')),Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:r('planning.js'),HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
  window:{addEventListener(){}},document:{querySelector:q=>stubs.get(q)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f}};
 await vm.runInNewContext(fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace('await initStorage();','globalThis.testUI={getDb:()=>db};await initStorage();'),sandbox);
 const click=(kind,value,id)=>listeners.click({target:{closest:s=>s===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}});
 const choose=(id,value)=>stubs.get(id).on.change({target:{value}});
 const u={click,choose,db:()=>sandbox.testUI.getDb(),html:()=>stubs.get('#app').innerHTML,toast:()=>stubs.get('#toast').textContent};
 await click('action','open-group','Baumschule');await click('action','track-new','ZP');await click('action','suggest-themes');await click('action','workflow-step','2');await click('action','paper-category','');
 return u;
}
const library=h=>h.slice(h.indexOf('<aside class="paper-library"'),h.indexOf('</aside>',h.indexOf('<aside class="paper-library"')));
const cards=h=>[...library(h).matchAll(/<article class="([^"]*)"[^>]*data-drag-task="([^"]+)"/g)].map(m=>({cls:m[1],id:m[2]}));

test('tasks are chosen from a card grid with a filter bar; nothing is hidden in fold-outs',async()=>{
 const u=await ui(),h=u.html(),lib=library(h);
 assert.match(h,/class="paper-workspace word-workspace"/);
 for(const part of ['class="library-filters"','id="paper-query"','id="paper-scope"','id="paper-year"','class="paper-task-list"','data-action="suggest"','Aufgaben automatisch ergänzen','data-action="new-task"'])assert.ok(lib.includes(part),part);
 assert.doesNotMatch(lib,/data-paper-panel="(task-|similar-|filters)/,'no "Ansehen & Herkunft", "Andere Ausführungen" or filter fold-outs');
 assert.match(lib,/data-action="task-template"/,'"Als Vorlage" sits on the card');
 assert.match(lib,/Quelle 2024|Quelle 2025/,'source year visible on the card');
 // Word-like sheet: one slim toolbar with direct buttons, zoom moved out of "Weitere Optionen"
 const bar=h.slice(h.indexOf('class="paper-preview-heading sheet-toolbar"'),h.indexOf('</div></div></div>',h.indexOf('sheet-toolbar')));
 for(const action of ['preview-candidate','export-exam','ai-paper','sheet-focus','library-toggle'])assert.match(bar,new RegExp(`data-action="${action}"`),action);
 assert.match(bar,/id="paper-zoom"/);assert.equal((h.match(/id="paper-zoom"/g)||[]).length,1);
 assert.doesNotMatch(h,/data-paper-panel="preview-options"/,'no "Ansicht & Ausgabe" drop-down');
 assert.match(h,/class="sheet-statusbar"[\s\S]*id="paper-summary"/);
 assert.match(h,/class="library-resizer" role="separator"[^>]*aria-valuenow="\d+"/);
});

test('variants of a task unfold as cards next to each other and fold again',async()=>{
 const u=await ui();let list=cards(u.html());
 assert.equal(list.length,1,'one card per family');assert.match(library(u.html()),/data-action="paper-variants" data-id="demo-family-inventory" aria-expanded="false"[^>]*>[\s\S]*?\+ 1 Ausführung</);
 await u.click('action','paper-variants','demo-family-inventory');list=cards(u.html());
 assert.deepEqual(list.map(c=>c.id).sort(),['demo-task-0','demo-task-1']);assert.equal(list.filter(c=>c.cls.includes('is-variant')).length,1);assert.match(library(u.html()),/Ausführung 2 von 2/);
 await u.click('action','paper-variants','demo-family-inventory');assert.equal(cards(u.html()).length,1);
});

test('the filter bar narrows by source year and offers tasks of the other exam type and specialties to copy',async()=>{
 const u=await ui();
 await u.choose('#paper-year','2025');assert.deepEqual(cards(u.html()).map(c=>c.id),['demo-task-1'],'only the 2025 variant');
 await u.click('action','paper-reset');assert.equal(cards(u.html()).length,1);assert.doesNotMatch(library(u.html()),/<option value="2025" selected>/);
 const ap=u.db().tasks.find(t=>t.examType==='AP'&&t.specialty==='Baumschule');
 assert.match(library(u.html()),/<option value="type:AP" >Aus Abschlussprüfung<\/option>/);
 await u.choose('#paper-scope','type:AP');let lib=library(u.html());
 assert.match(lib,/class="library-scope-note"/);assert.match(lib,new RegExp(`data-action="adopt-task" data-id="${ap.id}"`));assert.doesNotMatch(lib,/data-action="add"/,'foreign tasks are copied, not added');assert.doesNotMatch(lib,/class="paper-more"/);
 await u.choose('#paper-scope','specialties');lib=library(u.html());
 assert.ok((lib.match(/class="paper-source-task adopt-card"/g)||[]).length>=3,'ZP tasks of other specialties');assert.doesNotMatch(lib,/<span class="adopt-scope">[^<]*Baumschule/);
 await u.click('action','paper-scope-clear');assert.doesNotMatch(library(u.html()),/class="library-scope-note"|id="paper-scope">[\s\S]*?value="specialties" selected/);assert.equal(cards(u.html()).length,1);
});

test('the picker can be hidden outside full screen and the sheet takes the room',async()=>{
 const u=await ui();await u.click('action','library-toggle');let h=u.html();
 assert.match(h,/class="shell is-paper  library-hidden"/);assert.match(h,/data-action="library-toggle" aria-pressed="false"/);
 await u.click('action','library-toggle');h=u.html();assert.doesNotMatch(h,/library-hidden/);assert.match(h,/data-action="library-toggle" aria-pressed="true"/);
});

test('a used exam shows the cards read-only without copy or create actions',async()=>{
 const u=await ui(),e=u.db().exams.at(-1);C.addItem(e,u.db().tasks.find(t=>t.id==='demo-task-0'));e.status='used';await u.click('action','paper-category','');await u.click('action','paper-variants','demo-family-inventory');const lib=library(u.html());
 assert.match(lib,/Im Blatt anzeigen/,'the task in the exam');
 assert.match(lib,/Prüfung ist schreibgeschützt/);assert.doesNotMatch(lib,/id="paper-scope"|data-action="suggest"|data-action="new-task"|data-action="add"/);
});
