'use strict';
// New exam editor: the exam is a document. Outline · sheet · checklist; missing tasks are placeholder pages
// with a one-click proposal. Drafts from the classic editor must open and stay editable.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),SRC=path.join(ROOT,'src'),r=f=>require(path.join(SRC,f));
const C=r('core.js'),L=r('planning.js');

function demoData(){
 const data=C.validate(JSON.parse(fs.readFileSync(path.join(ROOT,'demo.json'),'utf8')));
 const heads=['Durchführen von Arbeiten an der Pflanze','Einsatz von Werkzeug und Geräten','Vermehren von Pflanzen'];let n=0;
 for(const t of data.tasks)if(t.examType==='ZP')t.text='Aufgabe: '+heads[n++%heads.length]+'\nHier: Synthetisches Beispiel\n'+t.text;
 // The two demo ZP tasks share one family; two more families give every theme a proposal.
 const zp=data.tasks.find(t=>t.examType==='ZP'&&t.specialty==='Baumschule'),base=data.tasks.find(t=>t.examType==='AP'&&t.specialty==='Baumschule');
 const add=(src,id,over)=>{const t={...C.clone(src),id,familyId:'fam-'+id,title:over.title||id,...over};data.tasks.push(t);data.families.push({...C.clone(data.families.find(f=>f.id===src.familyId)),id:t.familyId,title:t.title});return t;};
 add(zp,'zp-extra',{title:'Stecklinge schneiden',text:'Aufgabe: Vermehren von Pflanzen\nHier: Stecklinge\nSchneiden Sie zehn Stecklinge.',minutes:30});
 add(zp,'zp-extra2',{title:'Heckenschere warten',text:'Aufgabe: Einsatz von Werkzeug und Geräten\nHier: Heckenschere\nReinigen und ölen Sie die Messer.',minutes:25});
 // AP: four tasks for "Pflanzenproduktion", two for "Ernte und Vermarktung", one oral template.
 const apHeads=['Vermehren von Gehölzen','Anlegen von Baumschulquartieren','Durchführen von Arbeiten an der Pflanze','Aufschulen und Aufpflanzen'];
 apHeads.forEach((h,i)=>add(base,'ap1-'+i,{title:'Produktion '+(i+1),text:'Aufgabe: '+h+'\n'+base.text,minutes:40,practicalUnits:[{title:'Produktion '+(i+1),areaId:'area1',reason:'Pflanzenproduktion laut Aufgabenstellung'}]}));
 [0,1].forEach(i=>add(base,'ap2-'+i,{title:'Verkauf '+(i+1),text:'Aufgabe: '+apHeads[i]+'\n'+base.text,minutes:40,practicalUnits:[{title:'Verkauf '+(i+1),areaId:'area2',reason:'Vermarktung laut Aufgabenstellung'}]}));
 add(base,'oral-1',{kind:'oral',title:'Kundengespräch Rosen',text:'Thema: Kundenberatung\nBeraten Sie eine Kundin.',minutes:15,points:20});
 add(base,'oral-2',{kind:'oral',title:'Kundengespräch Gehölze',text:'Thema: Kundenberatung\nBeraten Sie einen Kunden.',minutes:15,points:20});
 data.workshops=[{id:'meeting',title:'Termin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];
 return C.validate(data);
}

async function ui({mode,data=demoData(),before}={}){
 const stored=new Map(mode?[['hortiexam-editor',mode]]:[]),stubs=new Map(),listeners={},mk=id=>{const el={id,value:'',innerHTML:'',textContent:'',open:false,dataset:{},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},classList:{s:new Set(),add(...x){x.forEach(v=>this.s.add(v));},remove(...x){x.forEach(v=>this.s.delete(v));},contains(x){return this.s.has(x);}}};stubs.set(id,el);return el;};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input'])mk(id);
 before?.(data);
 stubs.set('#seed',{textContent:JSON.stringify(data)});stubs.set('meta[name=hortiexam-storage]',{content:'memory'});
 const sandbox={localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v)),removeItem:k=>stored.delete(k)},HortiHistory:r('history.js'),HortiAdvisor:r('advisor.js'),HortiPointsPlan:r('points-plan.js'),HortiRelease:r('release.js'),HortiOrganization:r('organization.js'),HortiTimingPlan:r('timing-plan.js'),HortiMaterials:r('materials.js'),HortiArchive:r('archive.js'),HortiDocx:r('docx.js'),JSZip:require(path.join(ROOT,'vendor/jszip.min.js')),Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},HortiSourceLayout:r('source-layout.js'),HortiIcons:r('icons.js'),HortiCatalog:r('catalog.js'),HortiHelp:r('help.js'),HortiPaper:r('paper.js'),HortiPlanning:r('planning.js'),HortiCore:C,HortiPrint:r('print.js'),console,setTimeout,clearTimeout,confirm:()=>true,
  window:{addEventListener(){}},document:{querySelector:q=>stubs.get(q)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>listeners[n]=f}};
 await vm.runInNewContext(fs.readFileSync(path.join(SRC,'app.js'),'utf8').replace('await initStorage();','globalThis.testUI={getDb:()=>db};await initStorage();'),sandbox);
 const click=(kind,value,id)=>listeners.click({target:{closest:s=>s===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}});
 const exam=()=>sandbox.testUI.getDb().exams.at(-1);
 return {sandbox,listeners,click,stored,exam,db:()=>sandbox.testUI.getDb(),html:()=>stubs.get('#app').innerHTML,dialog:()=>stubs.get('#dialog').innerHTML,toast:()=>stubs.get('#toast').textContent};
}
const count=(h,re)=>(h.match(re)||[]).length;
const gapAdd=(h,gap)=>h.match(new RegExp(`data-editor-gap="${gap}"[\\s\\S]*?data-action="add" data-id="([^"]+)"`))?.[1];
const checklist=h=>h.slice(h.indexOf('class="editor-checklist"'));
const drop=(u,payload,dataset)=>u.listeners.drop({target:{closest:()=>({dataset,classList:{add(){},remove(){}}})},preventDefault(){},dataTransfer:{getData:()=>payload}});

test('a new ZP opens as a document: three themes chosen, one placeholder page with a proposal per theme',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 const e=u.exam(),h=u.html();
 assert.equal(e.pattern.slots.length,3,'themes are chosen automatically');assert.equal(L.themeSelectionIssue(e),null);
 assert.match(h,/class="editor-v2"/);assert.match(h,/class="editor-outline"/);assert.match(h,/class="editor-checklist"/);
 const sheet=h.slice(0,h.indexOf('class="editor-checklist'));assert.equal(count(sheet,/data-editor-gap="gap-\d"/g),3);assert.equal(count(sheet,/>Vorschlag übernehmen</g),3);
 // The checklist starts with the card of the first page in view: here the first missing task.
 assert.match(checklist(h),/data-checklist-task="gap-0"[\s\S]*Fehlt noch[\s\S]*Vorschlag übernehmen/);assert.match(checklist(h),/Ganze Prüfung/);
 // Nothing from the classic editor: no step tabs, no Baukasten, no permanent task list, no fold-out panels.
 for(const old of ['workflow-steps','exam-board','paper-library','editor-checks','Weitere Optionen'])assert.doesNotMatch(h,new RegExp(old));
 assert.equal(count(h,/class="is-next"/g),1,'exactly one next step');assert.match(checklist(h),/Aufgaben · 0 von 3/);assert.match(checklist(h),/Aufgabe 1 wählen/);
 assert.match(checklist(h),/GärtnAusbV § 8 Abs\. 4/);
});

test('one click takes a proposal; the placeholder becomes a page and the checklist moves on',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 const id=gapAdd(u.html(),'gap-0');assert.ok(id);await u.click('action','add',id);
 const e=u.exam(),h=u.html();assert.equal(e.items.length,1,u.toast());assert.equal(e.items[0].originTaskId,id);
 assert.equal(count(h,/data-editor-gap="gap-\d"/g),2);assert.match(checklist(h),/Aufgaben · 1 von 3/);
 assert.match(h,new RegExp(`class="outline-item"[^>]*data-board-item="${e.items[0].id}"`));
 assert.match(h,/data-paper-field="text"/,'the task is editable on the sheet');
});

test('"Alle Vorschläge übernehmen" completes a ZP within the regulation',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 assert.match(u.html(),/data-action="proposals-accept"/);await u.click('action','proposals-accept');
 const e=u.exam(),c=L.structureCoverage(e),h=u.html();
 assert.equal(c.total,3);assert.equal(c.themeCount,3);assert.ok(c.minutes<=180);assert.deepEqual(c.issues,[]);
 assert.doesNotMatch(h,/data-editor-gap=/);assert.match(checklist(h),/Aufgaben · 3 von 3/);assert.match(checklist(h),/Zeit · \d+ von höchstens 180 Min\./);
});

test('"Andere Aufgabe wählen" opens the full-screen picker for that theme; choosing or Escape closes it',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 const theme=u.exam().pattern.slots[1].categoryId;await u.click('action','picker-open',theme);
 let h=u.html();assert.match(h,/class="editor-overlay"/);assert.match(h,/Aufgabe wählen · /);
 // Suggestions first: a search field, at most six cards, the other ways as tabs.
 assert.match(h,/data-action="picker-tab" data-id="vorschlaege"[^>]*>|aria-selected="true" data-action="picker-tab" data-id="vorschlaege"/);assert.match(h,/class="picker-suggest"/);assert.doesNotMatch(h,/class="paper-library"/);
 for(const tab of ['alle','jahr','neu'])assert.match(h,new RegExp(`data-action="picker-tab" data-id="${tab}"`));
 assert.ok(count(h.slice(h.indexOf('class="picker-suggest"')),/class="paper-source-task/g)<=6);
 await u.click('action','picker-tab','alle');h=u.html();assert.match(h,/class="paper-library"/);assert.match(h,/id="paper-scope"/,'other exam types and specialties');
 await u.click('action','picker-tab','jahr');assert.match(u.html(),/class="archive-years"/);
 await u.click('action','picker-tab','neu');h=u.html();assert.match(h,/class="picker-panel"[\s\S]*data-action="new-task"/);
 await u.click('action','picker-tab','vorschlaege');h=u.html();
 assert.doesNotMatch(h,/data-action="suggest"/,'gap pages replace the bulk proposal button');
 u.listeners.keydown({key:'Escape',preventDefault(){},target:{closest:()=>null}});assert.doesNotMatch(u.html(),/class="editor-overlay"/);
 await u.click('action','picker-open',theme);h=u.html();
 const pick=[...h.slice(h.indexOf('class="editor-overlay"')).matchAll(/data-action="add" data-id="([^"]+)"/g)].map(m=>m[1])[0];assert.ok(pick);
 await u.click('action','add',pick);assert.equal(u.exam().items.length,1,u.toast());assert.doesNotMatch(u.html(),/class="editor-overlay"/);
 // A failed choice keeps the picker open with the message.
 await u.click('action','picker-open','');await u.click('action','add',pick);assert.match(u.toast(),/bereits enthalten/);assert.match(u.html(),/class="editor-overlay"/);
});

test('themes change in an overlay; the old step buttons map to overlays',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 await u.click('action','editor-overlay','themes');let h=u.html();assert.match(h,/data-workflow-theme/);assert.doesNotMatch(h,/1\. Welche Themen/);assert.doesNotMatch(h,/Weiter: passende Aufgaben/);
 await u.click('action','workflow-step','3');h=u.html();assert.match(h,/Prüfung fertigstellen/);assert.match(h,/class="finish"/);assert.doesNotMatch(h,/3\. Prüfung durchsehen/);
 await u.click('action','workflow-step','2');assert.doesNotMatch(u.html(),/class="editor-overlay"/);
 await u.click('action','workflow-step','1');assert.match(u.html(),/data-overlay="themes"/);await u.click('action','editor-overlay-close');assert.doesNotMatch(u.html(),/class="editor-overlay"/);
});

test('AP: five tasks with the legal area minima, plus one oral task as its own placeholder',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','AP');
 let h=u.html();const list=checklist(h);
 assert.equal(count(h,/data-editor-gap="gap-\d"/g),5);assert.match(list,/Aufgaben · 0 von 5/);assert.match(list,/Pflanzenproduktion: 0 von mind\. 3/);assert.match(list,/Ernte und Vermarktung: 0 von mind\. 1/);
 assert.match(list,/Mündliche Aufgabe/);assert.match(h,/data-editor-gap="oral-gap"/);assert.match(list,/Zeit · 0 von höchstens 300 Min\./);assert.match(list,/GärtnAusbV § 9/);
 await u.click('action','proposals-accept');let c=L.structureCoverage(u.exam());assert.equal(c.total,5);assert.ok(c.areas.every(a=>a.actual>=a.min),JSON.stringify(c.areas));
 h=u.html();const oral=h.match(/data-editor-gap="oral-gap"[\s\S]*?data-action="oral-select" data-id="([^"]+)"/)?.[1];assert.equal(oral,'oral-1');
 await u.click('action','oral-select',oral);assert.equal(u.exam().oralItem.originTaskId,'oral-1');h=u.html();assert.doesNotMatch(h,/data-editor-gap=/);assert.match(checklist(h),/Kundengespräch Rosen/);
 assert.match(h,/class="outline-item is-oral"/);
});

test('drafts from the classic editor open in the new editor and stay editable',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');
 const db=u.db(),zp=db.tasks.filter(t=>t.examType==='ZP'&&t.specialty==='Baumschule'),p=L.snapshotPattern(db,L.pattern(db,'ZP','Baumschule'));
 const draft=(over,items=[])=>{const e=C.newExam({...L.examDefaults(db,'ZP','Baumschule',2027),examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting',pattern:p,...over});for(const t of items)C.addItem(e,t);db.exams.push(e);return e;};
 // Step 1 without themes (as the classic editor saved it): themes are the next step, nothing is lost.
 const s1=draft({title:'Alt · Schritt 1',workflowStep:1,pattern:{...p,slots:[]}});await u.click('action','select-exam',s1.id);let h=u.html();
 assert.match(h,/class="editor-v2"/);assert.match(checklist(h),/Themen · 0 von 3/);assert.match(checklist(h),/Themen vorschlagen/);assert.match(h,/Hier fehlt noch ein Thema/);
 await u.click('action','suggest-themes');assert.equal(db.exams.find(e=>e.id===s1.id).pattern.slots.length,3);assert.match(u.html(),/>Vorschlag übernehmen</);
 // Step 3 with tasks: opens on the sheet (no forced step), text fields stay editable, order and removal work.
 const s3=draft({title:'Alt · Schritt 3',workflowStep:3},[zp[0],db.tasks.find(t=>t.id==='zp-extra')]);
 await u.click('action','select-exam',s3.id);h=u.html();assert.doesNotMatch(h,/class="editor-overlay"/);
 assert.equal(count(h,/contenteditable="plaintext-only"[^>]*data-paper-field="text"/g),2);
 const [a,b]=s3.items.map(i=>i.id);drop(u,'item:'+b,{dropItem:a});assert.deepEqual(db.exams.find(e=>e.id===s3.id).items.map(i=>i.id),[b,a],'outline drop reorders');
 u.listeners.keydown({key:'ArrowDown',altKey:true,preventDefault(){},target:{matches:s=>s==='.outline-entry',closest:s=>s==='[data-board-item][data-drag-item]'?{dataset:{boardItem:b}}:null}});
 assert.deepEqual(db.exams.find(e=>e.id===s3.id).items.map(i=>i.id),[a,b],'Alt+arrow moves an outline entry');
 assert.equal(W_edit(u,s3.id,a,'title','Neuer Titel'),true);assert.equal(db.exams.find(e=>e.id===s3.id).items[0].task.title,'Neuer Titel');
 await u.click('action','item-remove',b);assert.equal(db.exams.find(e=>e.id===s3.id).items.length,1);assert.match(u.html(),/data-editor-gap="gap-0"/);
 // An outdated theme snapshot shows the notice with the update button instead of hiding the draft.
 const old=draft({title:'Alt · altes Muster',pattern:{...p,slots:[{categoryId:'plantwork',count:2}]}});await u.click('action','select-exam',old.id);h=checklist(u.html());
 assert.match(h,/class="checklist-legacy"/);assert.match(h,/data-action="apply-pattern"/);
 // A used exam stays read-only, offers a copy, and has no placeholders.
 const used=draft({title:'Alt · eingesetzt'},zp.slice(0,1));used.status='used';await u.click('action','select-exam',used.id);h=u.html();
 assert.doesNotMatch(h,/data-editor-gap=/);assert.doesNotMatch(h,/contenteditable="plaintext-only"/);assert.match(h,/Kopie zum Bearbeiten erstellen/);assert.doesNotMatch(h,/editor-finish/);
});
function W_edit(u,examId,itemId,field,value){const e=u.db().exams.find(x=>x.id===examId);return r('paper.js').edit(e,itemId,field,value);}

test('the classic view stays switchable and is remembered on this device',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 assert.match(u.html(),/data-action="editor-mode" data-id="klassisch"/);
 await u.click('action','editor-mode','klassisch');assert.equal(u.stored.get('hortiexam-editor'),'klassisch');
 let h=u.html();assert.doesNotMatch(h,/class="editor-v2"/);assert.match(h,/workflow-steps/);assert.match(h,/class="topbar"[\s\S]*data-action="editor-mode" data-id="neu"/);
 await u.click('action','editor-mode','neu');assert.equal(u.stored.get('hortiexam-editor'),'neu');assert.match(u.html(),/class="editor-v2"/);
 const c=await ui({mode:'klassisch'});await c.click('action','open-group','Baumschule');await c.click('action','track-new','ZP');assert.match(c.html(),/workflow-steps/);
});

test('the menu holds the rare actions; the header keeps one main action',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 const h=u.html(),head=h.slice(h.indexOf('class="topbar editor-topbar"'),h.indexOf('id="editor-menu"')),menu=h.slice(h.indexOf('id="editor-menu"'),h.indexOf('class="editor-v2'));
 assert.equal(count(head,/class="[^"]*primary[^"]*editor-finish"/g),1);assert.match(head,/popovertarget="editor-menu"/);assert.doesNotMatch(head,/<details/);
 for(const action of ['timing-plan','points-plan','internal-notes','export-exam','duplicate-exam','paper-rules','history-open','trash-exam'])assert.match(menu,new RegExp(`data-action="${action}"`),action);
 await u.click('action','history-open');await u.click('action','proposal-next');assert.match(u.toast(),/Neue Vorschläge|Keine weiteren passenden Vorschläge/);
});

test('guard for the redesign goals: with one task the controls around the sheet stay at ≤ 20 buttons and no fold-outs',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');await u.click('action','add',gapAdd(u.html(),'gap-0'));
 const h=u.html(),part=(from,to)=>{const i=h.indexOf(from);return i<0?'':h.slice(i,to?h.indexOf(to,i):undefined);};
 // Header without the closed menu, outline and checklist: what is always on screen next to the sheet.
 const chrome=part('class="topbar editor-topbar"','id="editor-menu"')+part('class="editor-outline"','</nav>')+part('class="editor-checklist"','</aside>');
 const buttons=count(chrome,/<button\b/g),words=chrome.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;
 assert.ok(buttons<=20,`${buttons} buttons`);assert.equal(count(chrome,/<details\b/g),0);assert.equal(count(chrome,/info-bubble/g),0);assert.ok(words<=200,`${words} words`);
});

test('a note is added to a page with one button and removed again; outline and "Fertigstellen" show it',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');await u.click('action','add',gapAdd(u.html(),'gap-0'));
 const id=u.exam().items[0].id,add=new RegExp(`data-action="page-note-add" data-id="${id}\\|0"`);assert.match(u.html(),add);
 await u.click('action','page-note-add',id+'|0');assert.equal(u.exam().items[0].pageNotes['0'],'');let h=u.html();assert.match(h,/class="page-note"/);assert.doesNotMatch(h,add);
 u.exam().items[0].pageNotes['0']='Material am Vortag bestellen';await u.click('action','editor-overlay-close');assert.match(u.html(),/class="outline-note"[^>]*>1 Notiz</);
 await u.click('action','editor-overlay','finish');assert.match(u.html(),/Notizen auf den Seiten[\s\S]*Material am Vortag bestellen/);await u.click('action','editor-overlay-close');
 await u.click('action','page-note-remove',id+'|0');assert.equal(u.exam().items[0].pageNotes,undefined);h=u.html();assert.doesNotMatch(h,/class="page-note"/);assert.match(h,add);
});

test('alternatives to the oral task: chosen in the overlay, copied to rewrite, promoted and removed from the page menu',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','AP');
 let h=u.html();await u.click('action','oral-select',h.match(/data-editor-gap="oral-gap"[\s\S]*?data-action="oral-select" data-id="([^"]+)"/)[1]);
 const e=u.exam(),owner=e.oralItem.id;assert.match(u.html(),new RegExp(`data-action="alt-open" data-id="${owner}"`));
 await u.click('action','alt-open',owner);h=u.html();assert.match(h,/Alternative zur mündlichen Aufgabe/);assert.match(h,/data-action="alt-copy"/);assert.match(h,/data-action="new-oral-task"/);
 const pick=h.match(/data-action="alt-add" data-id="([^"]+)"/)?.[1];assert.equal(pick,'oral-2');assert.doesNotMatch(h,/data-action="oral-select"/);
 await u.click('action','alt-add',pick);assert.equal(e.oralItem.alternatives.length,1,u.toast());h=u.html();
 assert.doesNotMatch(h,/class="editor-overlay"/);assert.match(h,/class="outline-item is-alternative"[\s\S]*?Alternative B/);assert.match(checklist(h),/1 Alternative/);assert.match(checklist(h),/Aufgaben · 0 von 5/,'alternatives never count');
 await u.click('action','alt-open',owner);await u.click('action','alt-copy',owner);assert.equal(e.oralItem.alternatives.length,2);assert.match(u.html(),/Mündliche Prüfungsaufgabe · Alternative C/);
 const b=e.oralItem.alternatives[0];await u.click('action','alt-promote',b.id);assert.equal(e.oralItem.task.title,'Kundengespräch Gehölze');assert.equal(b.task.title,'Kundengespräch Rosen');
 await u.click('action','alt-remove',b.id);assert.equal(e.oralItem.alternatives.length,1);assert.match(e.oralItem.alternatives[0].task.title,/– Alternative$/,'the copy remains');assert.doesNotMatch(u.html(),/>Kundengespräch Rosen</);
});

test('ZP: "Alternative hinzufügen" lists the same theme, offers no copies from other areas and closes with Escape',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');await u.click('action','proposals-accept');
 const e=u.exam(),owner=e.items.find(i=>i.originTaskId==='zp-extra2');assert.ok(owner,'tool theme task present');
 await u.click('action','alt-open',owner.id);let h=u.html();assert.match(h,/Alternative hinzufügen/);assert.match(h,/class="alt-start"/);assert.doesNotMatch(h,/id="paper-scope"/);assert.doesNotMatch(h,/data-action="paper-replace"|data-action="adopt-task"/);
 assert.match(h,/data-action="alt-add" data-id="zp-extra2" disabled/,'the task itself cannot be its own alternative');
 await u.click('action','alt-add','demo-task-1');assert.equal(owner.alternatives?.length,1,u.toast());assert.equal(L.structureCoverage(e).total,3);
 await u.click('action','alt-open',owner.id);u.listeners.keydown({key:'Escape',preventDefault(){},target:{closest:()=>null}});h=u.html();assert.doesNotMatch(h,/class="editor-overlay"/);
 await u.click('action','picker-open','');assert.doesNotMatch(u.html(),/Als Alternative übernehmen/,'the normal picker is back');
});

test('"Fertigstellen": only real to-dos; point proposals, source hints and reviews never show up as open points',async()=>{
 const u=await ui({before:d=>{for(const t of d.tasks.filter(x=>x.examType==='ZP')){t.flags=['Punktevorschlag: 100 Punkte als Arbeitsgrundlage, keine amtliche Vorgabe.'];t.reviewStatus='review';}}});
 await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 await u.click('action','editor-overlay','finish');let f=u.html().slice(u.html().indexOf('class="finish"'));
 assert.match(f,/Baumschule · 0 Prüfungsaufgaben/);assert.match(f,/Noch \d+ Punkte? zu erledigen/);assert.match(f,/Aufgaben fehlen/);assert.match(f,/data-action="release-exam"[^>]*disabled/,'release waits for the to-dos');
 await u.click('action','proposals-accept');await u.click('action','editor-overlay','finish');f=u.html().slice(u.html().indexOf('class="finish"'));
 // Source hints, point proposals, material proposals and open reviews are not to-dos: the release confirms them without a list.
 assert.match(f,/Alles Nötige ist da/);assert.doesNotMatch(f,/Punktevorschlag|Punkte klären|Fachliche Freigabe offen|Material bestätigen|finish-confirm|data-action="details-open"/);assert.doesNotMatch(f,/data-action="release-exam"[^>]*disabled/);
 assert.match(f,/Punktevorschläge und Hinweise aus der Übernahme inklusive/);
 const side=u.html().slice(u.html().indexOf('<h2>Checkliste</h2>'));assert.match(side,/Angaben vollständig/);assert.doesNotMatch(side,/Angaben · \d+ offen/);
 assert.match(f,/<h3>Erledigt<\/h3>[\s\S]*3 Themen/);assert.match(f,/id="finish-note"/);assert.doesNotMatch(f,/<details/,'no fold-outs');
 for(const a of ['timing-plan','points-plan','preview-candidate','export-exam','editor-overlay-close'])assert.match(f,new RegExp(`data-action="${a}"`),a);
});

test('task details open next to the sheet instead of a pop-up; one click approves a task with its hints',async()=>{
 const u=await ui({before:d=>{const t=d.tasks.find(x=>x.id==='zp-extra');t.flags=['Punktevorschlag: 100 Punkte als Arbeitsgrundlage, keine amtliche Vorgabe.'];t.reviewStatus='review';}});
 await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');await u.click('action','proposals-accept');
 const e=u.exam(),item=e.items.find(i=>i.originTaskId==='zp-extra');
 await u.click('action','item-edit',item.id);let h=u.html();
 assert.equal(u.sandbox.document.querySelector('#dialog').open,false,'no pop-up');assert.match(h,/class="editor-checklist editor-details is-open"/);assert.doesNotMatch(h,/<h2>Checkliste<\/h2>/);
 assert.match(h,/data-detail-field="points"/);assert.match(h,/data-detail-field="materials"/);assert.match(h,/Hinweise aus der Übernahme[\s\S]*Punktevorschlag/);assert.match(h,/data-action="details-approve"/);
 assert.doesNotMatch(h,/details-materials-confirm|zu prüfen|Vorschlag<\/span>/,'no review states to work through');assert.match(h,/Nicht nötig: „Prüfung freigeben“/);
 await u.click('action','details-approve',item.id);assert.deepEqual(r('core.js').openTaskFlags(item.task),[]);if(item.task.materials?.text.trim())assert.equal(item.task.materials.status,'confirmed');assert.ok(r('core.js').taskReviewCurrent(item.task));h=u.html();assert.doesNotMatch(h,/data-action="details-approve"/);
 // Fix buttons of the advisor lead to the panel, not to the form.
 await u.click('action','required-field',JSON.stringify([item.id,'points']));assert.equal(u.sandbox.document.querySelector('#dialog').open,false);assert.match(u.html(),/editor-details/);
 await u.click('action','details-close');assert.match(u.html(),/<h2>Checkliste<\/h2>/);
 await u.click('action','details-form',item.id);assert.equal(u.sandbox.document.querySelector('#dialog').open,true,'the full form stays reachable');
});

test('material lists in the sources: the report says what exists and takes matching lists over as proposals',async()=>{
 const u=await ui({before:d=>{const t=d.tasks.find(x=>x.id==='zp-extra'),src=d.sources.find(x=>t.sourceIds.includes(x.id));d.sources.push({...JSON.parse(JSON.stringify(src)),id:'list-x',name:'Materialliste ZP Baumschule.docx',role:'Anlage',year:null,assetId:undefined,attachmentIds:[],flags:[],text:'Aufgabe 1: Stecklinge schneiden\n• 20 Mutterpflanzen\n• Gartenschere\nAufgabe 5: Rasen mähen\n• Rasenmäher'});}});
 await u.click('route','import');assert.match(u.html(),/data-action="materials-scan"/);
 await u.click('action','materials-scan');const d=u.dialog();
 assert.match(d,/1 Materiallisten-Dokument/);assert.match(d,/Stecklinge schneiden/);assert.match(d,/Nicht eindeutig zugeordnet \(1\)[\s\S]*Rasen mähen/);assert.match(d,/data-action="materials-apply"/);
 await u.click('action','materials-apply');const t=u.db().tasks.find(x=>x.id==='zp-extra');
 assert.match(t.materials.text,/Gartenschere/);assert.equal(t.materials.status,'proposal');assert.ok(t.sourceIds.includes('list-x'));assert.match(u.toast(),/1 Materialliste als Vorschlag übernommen/);
 // A new exam takes the list along.
 await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');await u.click('action','proposals-accept');
 const item=u.exam().items.find(i=>i.originTaskId==='zp-extra');assert.match(item.task.materials.text,/Gartenschere/);
});

test('no info bubbles; their explanations are in the help; the checklist bar opens on phones',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');
 await u.click('action','editor-overlay','themes');assert.doesNotMatch(u.html(),/info-bubble/);
 await u.click('action','picker-open','');await u.click('action','picker-tab','alle');assert.doesNotMatch(u.html(),/info-bubble/);await u.click('action','editor-overlay-close');
 assert.match(u.html(),/data-action="checklist-toggle" aria-expanded="false">Alle zeigen/);await u.click('action','checklist-toggle');assert.match(u.html(),/class="editor-checklist is-open"/);
 for(const group of [true,false]){const help=r('help.js').view({online:false,group});assert.match(help,/Gut zu wissen beim Zusammenstellen/);assert.match(help,/So entsteht eine Prüfung/);assert.match(help,/So bedient ihr das Prüfungsblatt/);assert.doesNotMatch(help,/Vorbereitungstermin|In drei Schritten/);}
});

test('the checklist opens with a card for the task in view: text, points & time, material list and solution of that task',async()=>{
 const u=await ui();await u.click('action','open-group','Baumschule');await u.click('action','track-new','ZP');await u.click('action','proposals-accept');
 const e=u.exam(),first=e.items[0];let c=checklist(u.html());
 assert.match(c,new RegExp(`class="checklist-task[^"]*" data-checklist-task="${first.id}"`));
 for(const label of ['Aufgabenstellung','Punkte &amp; Zeit','Materialliste','Lösung','Details zur Aufgabe','Ganze Prüfung'])assert.match(c,new RegExp(label),label);
 assert.ok(c.indexOf('data-checklist-task')<c.indexOf('Ganze Prüfung'),'the task card comes first');
 // A missing material list shows up in the card of exactly this task, with a way to fill it in.
 first.task.materials={...(first.task.materials||{}),text:''};await u.click('action','details-close');c=checklist(u.html());
 const card=c.slice(c.indexOf('data-checklist-task'),c.indexOf('Ganze Prüfung'));
 assert.match(card,/Materialliste<\/strong><span>fehlt noch/);assert.match(card,new RegExp(`data-action="details-open" data-id="${first.id}"`));
 assert.match(u.html(),/class="checklist-count">\d von \d<\/span>/);
});
