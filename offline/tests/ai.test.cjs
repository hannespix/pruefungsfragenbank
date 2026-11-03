const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const modulePath=path.join(__dirname,'../src/ai.js');
const AI=fs.existsSync(modulePath)?require(modulePath):{};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function target(text='Original',field='task'){let value=text,live=true;return {label:'Aufgabenstellung',field,read:()=>value,write:v=>{value=v;},valid:()=>live,change:v=>{value=v;},detach:()=>{live=false;}};}
const enabled={enabled:true,model:'test-sonnet'};

test('opening checks availability without sending text; only explicit generation sends the selected field',async()=>{
 assert.equal(typeof AI.createSession,'function','AI session controller is available');
 const a=target('Erste Aufgabe'),b=target('Vertrauliche Lösung','solution'),calls=[],applied=[];
 const session=AI.createSession({targets:[a,b],request:async(...args)=>{calls.push(args);return args[0].endsWith('status')?enabled:{text:'Erster Vorschlag',notes:['Fachlich prüfen.'],model:'test-sonnet'};},onApply:e=>applied.push(e)});
 await session.checkStatus();
 assert.deepEqual(calls,[['/api/ai/status']]);
 session.setMode('clear');session.editProposal('Nur lokale Notiz');
 assert.equal(calls.length,1);
 await session.generate();
 assert.deepEqual(calls[1],['/api/ai/suggest',{text:'Erste Aufgabe',mode:'clear',field:'task'}]);
 assert.equal(a.read(),'Erste Aufgabe');assert.equal(b.read(),'Vertrauliche Lösung');assert.deepEqual(applied,[]);
 assert.equal(session.snapshot().proposal,'Erster Vorschlag');
});

test('closing clears transient text and ignores an outstanding generated answer',async()=>{
 const pending=deferred(),a=target();
 const session=AI.createSession({targets:[a],request:async p=>p.endsWith('status')?enabled:pending.promise});
 await session.checkStatus();const run=session.generate();session.close();
 pending.resolve({text:'Late secret answer',notes:['Late note'],model:'test-sonnet'});await run;
 assert.equal(a.read(),'Original');
 for(const key of ['original','proposal','notes','error','model'])assert.equal(session.snapshot()[key],'',key+' is cleared');
 assert.equal(session.snapshot().closed,true);assert.equal(session.accept(),false);
});

test('changing selected target discards pending answers and duplicate requests are prevented',async()=>{
 const pending=deferred(),a=target('A'),b=target('B','solution');let sent=0;
 const session=AI.createSession({targets:[a,b],request:async p=>{if(p.endsWith('status'))return enabled;sent++;return pending.promise;}});
 await session.checkStatus();const run=session.generate();await session.generate();assert.equal(sent,1);
 session.select(1);pending.resolve({text:'For A only',notes:[],model:'test-sonnet'});await run;
 assert.equal(session.snapshot().original,'B');assert.equal(session.snapshot().proposal,'');assert.equal(session.snapshot().busy,false);
 assert.equal(a.read(),'A');assert.equal(b.read(),'B');
});

test('accept and undo use stable snapshots, notify review invalidation, and never overwrite other edits',async()=>{
 const a=target(),changes=[];
 const session=AI.createSession({targets:[a],onApply:e=>changes.push(e)});
 session.editProposal('Überarbeitet');assert.equal(session.accept(),true);assert.equal(a.read(),'Überarbeitet');
 session.editProposal('Noch nicht übernommen');assert.equal(session.undo(),true);assert.equal(a.read(),'Original');
 assert.deepEqual(changes,[{field:'task'},{field:'task'}]);
 session.editProposal('Neuer Vorschlag');a.change('Manuelle Änderung');
 assert.equal(session.accept(),false);assert.equal(a.read(),'Manuelle Änderung');assert.match(session.snapshot().error,/geändert/);
 const b=target(),other=AI.createSession({targets:[b]});other.editProposal('Übernommen');other.accept();b.change('Spätere Änderung');
 assert.equal(other.undo(),false);assert.equal(b.read(),'Spätere Änderung');
 const c=target(),detached=AI.createSession({targets:[c]});detached.editProposal('Neu');c.detach();assert.equal(detached.accept(),false);
});

test('reapplying a local proposal preserves the first original for explicit undo',()=>{
 const a=target(),session=AI.createSession({targets:[a]});
 session.editProposal('Version zwei');assert.equal(session.accept(),true);
 session.editProposal('Version drei');assert.equal(session.accept(),true);assert.equal(a.read(),'Version drei');
 assert.equal(session.undo(),true);assert.equal(a.read(),'Original');
});

test('undo compares the text actually written when a title input normalizes line breaks',()=>{
 let value='Alter Titel';const session=AI.createSession({targets:[{label:'Titel',field:'title',read:()=>value,write:text=>{value=text.replace(/[\r\n]/g,'');},valid:()=>true}]});
 session.editProposal('Neuer\nTitel');assert.equal(session.accept(),true);assert.equal(value,'NeuerTitel');
 assert.equal(session.snapshot().proposal,'NeuerTitel');assert.equal(session.undo(),true);assert.equal(value,'Alter Titel');
});

test('offline and missing-key states preserve manual editing; input and output bounds are enforced',async()=>{
 const a=target(),offline=AI.createSession({targets:[a]});await offline.checkStatus();
 assert.match(offline.snapshot().error,/Online/);offline.editProposal('Manuell verbessert');assert.equal(offline.accept(),true);
 const disabled=AI.createSession({targets:[target()],request:async()=>({enabled:false,model:'test-sonnet'})});
 await disabled.checkStatus();assert.match(disabled.snapshot().error,/eingerichtet|aktiviert/);assert.equal(await disabled.generate(),false);
 let posts=0;const long=AI.createSession({targets:[target('a'.repeat(6001))],request:async p=>{if(p.endsWith('status'))return enabled;posts++;return {text:'x'.repeat(8001),notes:[],model:'test-sonnet'};}});
 await long.checkStatus();assert.equal(await long.generate(),false);assert.equal(posts,0);
 const bad=AI.createSession({targets:[target()],request:async p=>p.endsWith('status')?enabled:{text:'x'.repeat(8001),notes:[],model:'test-sonnet'}});
 await bad.checkStatus();assert.equal(await bad.generate(),false);assert.equal(bad.snapshot().proposal,'');
 bad.editProposal('x'.repeat(8001));assert.equal(bad.accept(),false);
});

test('access and provider errors disclose no raw upstream details and can be retried',async()=>{
 let fail=true;
 const session=AI.createSession({targets:[target()],request:async p=>{if(p.endsWith('status'))return enabled;if(fail)throw Object.assign(new Error('sk-ant-secret provider internals'),{status:503});return {text:'Prüfen Sie …',notes:[],model:'test-sonnet'};}});
 await session.checkStatus();assert.equal(await session.generate(),false);assert.doesNotMatch(session.snapshot().error,/sk-ant|internals/);
 fail=false;assert.equal(await session.generate(),true);assert.equal(session.snapshot().proposal,'Prüfen Sie …');
});

// This small DOM double rejects HTML sinks and keeps native dialog/focus lifecycle observable.
function fakeDOM({reducedMotion=false}={}){
 const doc={activeElement:null,defaultView:{Event:class{constructor(type,options){this.type=type;Object.assign(this,options);}}}};
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners={};this.value='';this.disabled=false;this.readOnly=false;this.hidden=false;this._text='';}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set textContent(v){this._text=String(v);for(const c of this.children)c.parentNode=null;this.children=[];}
  set innerHTML(v){throw Error('Untrusted HTML sink used: '+v);}
  get isConnected(){return this===doc.body||Boolean(this.parentNode?.isConnected);}
  append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
  after(n){const i=this.parentNode.children.indexOf(this);n.parentNode=this.parentNode;this.parentNode.children.splice(i+1,0,n);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')this.id=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  hasAttribute(k){return k in this.attributes;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  dispatchEvent(ev){ev.preventDefault??=()=>{};ev.stopPropagation??=()=>{};for(const fn of this.listeners[ev.type]||[])fn(ev);return true;}
  focus(){doc.activeElement=this;}
  scrollIntoView(options){this.scrollOptions=options;}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent({type:'close'});}
  querySelectorAll(selector){const match=e=>selector.split(',').some(s=>{s=s.trim();if(s.startsWith('#'))return e.id===s.slice(1).split(':')[0]&&(!s.includes(':not')||!e.readOnly);if(s.startsWith('['))return e.hasAttribute(s.slice(1,-1));return e.tagName.toLowerCase()===s;});return this.children.flatMap(e=>[...(match(e)?[e]:[]),...e.querySelectorAll(selector)]);}
 }
 doc.createElement=tag=>new Element(tag);doc.body=new Element('body');
 const context={document:doc,console,Event:doc.defaultView.Event,matchMedia:()=>({matches:reducedMotion})};context.globalThis=context;
 vm.runInNewContext(fs.readFileSync(modulePath,'utf8'),context);
 return {doc,AI:context.HortiAI,button:(label,root=doc.body)=>root.querySelectorAll('button').find(x=>x.textContent===label)};
}

test('dialog renders untrusted strings as text and Escape removes and clears it while restoring focus',async()=>{
 const {doc,AI,button}=fakeDOM(),trigger=doc.createElement('button');doc.body.append(trigger);trigger.focus();
 const malicious='<img src=x onerror=alert(1)>',a=target(malicious);
 AI.open({targets:[a],request:async p=>p.endsWith('status')?enabled:{text:malicious,notes:['<script>secret</script>'],model:'test-sonnet'}});
 await tick();const dialog=doc.body.querySelectorAll('dialog')[0];assert.equal(dialog.open,true);
 button('Vorschlag erstellen').dispatchEvent({type:'click'});await tick();
 const areas=dialog.querySelectorAll('textarea');assert.equal(areas[0].value,malicious);assert.equal(areas[1].value,malicious);
 assert.match(dialog.textContent,/<script>secret<\/script>/);assert.equal(a.read(),malicious);
 dialog.dispatchEvent({type:'cancel'});
 assert.equal(doc.body.querySelectorAll('dialog').length,0);assert.equal(dialog.textContent,'');
 assert.deepEqual(areas.map(x=>x.value),['','']);assert.equal(doc.activeElement,trigger);
});

test('form binding is idempotent, does not request automatically, excludes read-only fields, and dispatches input on accept',async()=>{
 const {doc,AI,button}=fakeDOM(),form=doc.createElement('section'),field=doc.createElement('textarea'),readonly=doc.createElement('textarea');
 field.id='task-solution';field.value='Alte Lösung';readonly.id='task-text';readonly.readOnly=true;form.append(field,readonly);doc.body.append(form);
 let requests=0,inputs=0,applied=0;field.addEventListener('input',()=>inputs++);
 const options={request:async p=>{requests++;return p.endsWith('status')?enabled:{text:'Klarere Lösung',notes:[],model:'test-sonnet'};},onApply:()=>applied++};
 AI.bindForm(form,options);AI.bindForm(form,options);
 assert.equal(form.querySelectorAll('button').length,1);assert.equal(requests,0);
 button('KI-Schreibhilfe',form).dispatchEvent({type:'click'});await tick();assert.equal(requests,1);
 button('Vorschlag erstellen').dispatchEvent({type:'click'});await tick();assert.equal(field.value,'Alte Lösung');
 button('Vorschlag übernehmen').dispatchEvent({type:'click'});assert.equal(field.value,'Klarere Lösung');assert.equal(inputs,1);assert.equal(applied,1);
 button('Übernahme rückgängig').dispatchEvent({type:'click'});assert.equal(field.value,'Alte Lösung');assert.equal(inputs,2);
 assert.equal(form.querySelectorAll('button')[0].hasAttribute('data-action'),false);AI.close();
});

test('a closed parent editor cannot receive a pending proposal even while its fields remain connected',async()=>{
 const {doc,AI,button}=fakeDOM(),form=doc.createElement('dialog'),field=doc.createElement('textarea'),pending=deferred();
 field.id='task-text';field.value='Aufgabe im Editor';form.append(field);doc.body.append(form);form.showModal();
 AI.bindForm(form,{request:async p=>p.endsWith('status')?enabled:pending.promise});
 button('KI-Schreibhilfe',form).dispatchEvent({type:'click'});await tick();
 button('Vorschlag erstellen').dispatchEvent({type:'click'});form.close();
 assert.equal(field.isConnected,true,'closing the parent preserves its DOM');
 pending.resolve({text:'Verspäteter Vorschlag',notes:[],model:'test-sonnet'});await tick();
 const aiDialog=doc.body.querySelectorAll('dialog').find(d=>d!==form),proposal=aiDialog.querySelectorAll('textarea')[1];
 assert.equal(proposal.value,'');assert.match(aiDialog.textContent,/Editor geschlossen/);
 button('Vorschlag übernehmen',aiDialog).dispatchEvent({type:'click'});assert.equal(field.value,'Aufgabe im Editor');AI.close();
});

test('a successful explicit generation reveals its proposal and respects reduced motion',async()=>{
 const {doc,AI,button}=fakeDOM({reducedMotion:true});
 AI.open({targets:[target()],request:async p=>p.endsWith('status')?enabled:{text:'Klarer Vorschlag',notes:[],model:'test-sonnet'}});
 await tick();button('Vorschlag erstellen').dispatchEvent({type:'click'});await tick();
 const proposal=doc.body.querySelectorAll('textarea')[1];assert.equal(doc.activeElement,proposal);
 assert.equal(proposal.scrollOptions.block,'nearest');assert.equal(proposal.scrollOptions.behavior,'auto');AI.close();
});

test('closing while generation is pending does not move focus when the late answer arrives',async()=>{
 const {doc,AI,button}=fakeDOM(),pending=deferred(),trigger=doc.createElement('button');doc.body.append(trigger);trigger.focus();
 AI.open({targets:[target()],request:async p=>p.endsWith('status')?enabled:pending.promise});
 await tick();button('Vorschlag erstellen').dispatchEvent({type:'click'});AI.close();
 pending.resolve({text:'Später Vorschlag',notes:[],model:'test-sonnet'});await tick();assert.equal(doc.activeElement,trigger);
});
