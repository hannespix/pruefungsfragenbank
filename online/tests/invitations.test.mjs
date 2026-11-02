import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import C from '../../offline/src/core.js';
import P from '../../offline/src/print.js';
import H from '../../offline/src/help.js';
import {createInvitationPhrase,normalizeInvitation,invitationWords} from '../invitation-phrases.js';

const source=fs.readFileSync(new URL('../client.js',import.meta.url),'utf8');
const turn=()=>new Promise(setImmediate);
function loginHarness(hash=''){
 const elements=new Map(),calls=[],storage=new Map(),timers=new Map();let status='pending',rejectJoin=false,html='';
 const app={get innerHTML(){return html;},set innerHTML(value){html=value;for(const key of [...elements.keys()])if(!['#app','#dialog'].includes(key))elements.delete(key);for(const match of value.matchAll(/\bid="([^"]+)"/g)){const element={value:'',disabled:false,textContent:'',handlers:{},addEventListener(event,handler){this.handlers[event]=handler;},querySelector(){return this.button;}};elements.set('#'+match[1],element);}const form=elements.get('#login-form');if(form)form.button={disabled:false};}};
 const dialog={html:'',get innerHTML(){return this.html;},set innerHTML(value){this.html=value;for(const match of value.matchAll(/\bid="([^"]+)"/g))elements.set('#'+match[1],{});},open:false,classList:{add(){},remove(){}},showModal(){this.open=true;},close(){this.open=false;}};
 elements.set('#app',app);elements.set('#dialog',dialog);
 const location={hash,origin:'https://example.test',pathname:'/tool/',search:''};
 const context={HortiCore:C,HortiPrint:P,HortiHelp:H,URLSearchParams,console,location,history:{replaceState(_state,_title,url){location.hash='';this.url=url;}},document:{querySelector:q=>elements.get(q)||null},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>1,clearTimeout(){},setInterval:(fn,ms)=>{timers.set(ms,fn);return ms;},clearInterval:ms=>timers.delete(ms),fetch:async(url,init)=>{
  const body=init.body?JSON.parse(init.body):undefined;calls.push({url,body,init});
  if(url.endsWith('/api/join'))return rejectJoin?Response.json({error:'Einladung ist ungültig, abgelaufen oder gesperrt.'},{status:401}):Response.json({token:'a'.repeat(64),code:'ABC123',status:'pending',specialty:'Baumschule'});
  if(url.endsWith('/api/session'))return Response.json({role:'group',status,label:'Tablet',specialty:'Baumschule',meetingId:'meeting',expires:Date.now()+60000});
  if(url.endsWith('/api/project'))return Response.json({project:C.validate(JSON.parse(fs.readFileSync(new URL('../../offline/demo.json',import.meta.url)))),versions:{}});
  throw Error('Unexpected request '+url);
 }};
 vm.runInNewContext(source,context);
 return {o:context.HortiOnline,context,app,dialog,elements,calls,storage,timers,setStatus:value=>status=value,rejectJoin:value=>rejectJoin=value,submit:()=>{const form=elements.get('#login-form');return form.handlers.submit({preventDefault(){},target:form});}};
}

test('home offers manual word entry, posts phrase and device name, and waits for approval before reading tasks',async()=>{
 const h=loginHarness(),started=h.o.start();await turn();
 assert.match(h.app.innerHTML,/Passwort der zuständigen Stelle/);
 assert.ok(h.elements.get('#login-group'),'The home screen needs a group-join action');
 h.elements.get('#login-group').onclick();
 assert.match(h.app.innerHTML,/Arbeitsgruppe beitreten/);assert.ok(h.elements.get('#login-invitation'));
 h.elements.get('#login-invitation').value='APFEL birne wolke anker besen';h.elements.get('#login-value').value='Mein Tablet';
 await h.submit();await turn();
 assert.deepEqual(h.calls.find(c=>c.url.endsWith('/api/join')).body,{invitation:'APFEL birne wolke anker besen',label:'Mein Tablet'});
 assert.match(h.app.innerHTML,/ABC123/);assert.ok(!h.calls.some(c=>c.url.endsWith('/api/project')));
 assert.ok(![...h.storage.values()].join('').includes('APFEL'));
 h.setStatus('approved');await h.timers.get(3000)();await started;
 assert.equal(h.o.role,'group');assert.ok(h.calls.some(c=>c.url.endsWith('/api/project')));
});

test('manual invalid phrases remain editable and public help and administrator switching still work',async()=>{
 const h=loginHarness();h.o.start();await turn();
 assert.ok(h.elements.get('#login-group'),'The home screen needs a group-join action');h.elements.get('#login-group').onclick();
 h.elements.get('#login-invitation').value='wrong';h.elements.get('#login-value').value='Tablet';h.rejectJoin(true);await h.submit();
 assert.match(h.elements.get('#login-error').textContent,/ungültig/);assert.equal(h.elements.get('#login-form').button.disabled,false);
 assert.equal(h.elements.get('#login-invitation').value,'wrong');assert.equal(h.storage.size,0);
 h.elements.get('#login-help').onclick();assert.equal(h.dialog.open,true);assert.match(h.dialog.innerHTML,/Hilfe/);
 h.elements.get('#login-admin').onclick();assert.match(h.app.innerHTML,/Passwort der zuständigen Stelle/);assert.ok(!h.elements.has('#login-invitation'));
});

test('scanned legacy and phrase invitations still go straight to device-name entry and clear the fragment',async()=>{
 for(const invitation of ['b'.repeat(64),'apfel-birne-wolke-anker-besen']){
  const h=loginHarness('#invite='+invitation);h.o.start();await turn();
  assert.equal(h.context.location.hash,'');assert.match(h.app.innerHTML,/Arbeitsgruppe beitreten/);
  assert.ok(!h.elements.has('#login-invitation'));h.elements.get('#login-value').value='Scan Tablet';await h.submit();
  assert.deepEqual(h.calls.find(c=>c.url.endsWith('/api/join')).body,{invitation,label:'Scan Tablet'});
  assert.ok(!h.calls.some(c=>c.url.endsWith('/api/project')));
 }
});

test('displayed invitation codes and QR links share active-generation and expiry checks',()=>{
 const h=loginHarness(),o=h.o;
 assert.equal(typeof o.invitationCode,'function');
 o.invitations.set('meeting',[{specialty:'Baumschule',token:'apfel-birne-wolke-anker-besen'}]);
 o.invitationWindows.set('meeting',{generation:1,expires:Date.now()+60000});o.board.meetings=[{meeting_id:'meeting',active:1,generation:1,expires:Date.now()+60000}];
 assert.equal(o.invitationCode('meeting','Baumschule'),'apfel-birne-wolke-anker-besen');
 assert.equal(o.link('meeting','Baumschule'),'https://example.test/tool/#invite=apfel-birne-wolke-anker-besen');
 assert.equal(o.invitationCode('meeting','Obstbau'),null);
 for(const change of [{generation:2},{active:0},{expires:Date.now()-1}]){const before={...o.board.meetings[0]};Object.assign(o.board.meetings[0],change);assert.equal(o.invitationCode('meeting','Baumschule'),null);assert.equal(o.link('meeting','Baumschule'),null);o.board.meetings[0]=before;}
});

test('every crypto byte selects a distinct short word and all five positions are independent',()=>{
 const original=crypto.getRandomValues;let values=[0,1,127,254,255];
 const mocked=mock.method(crypto,'getRandomValues',buffer=>{assert.ok(buffer instanceof Uint8Array);assert.equal(buffer.length,5);buffer.set(values);return buffer;});
 try{
  assert.equal(createInvitationPhrase(),'adler-ahorn-hai-palme-panda');
  const observed=new Set();for(let i=0;i<256;i++){values=[i,i,i,i,i];const words=createInvitationPhrase().split('-');assert.equal(words.length,5);assert.ok(words.every(w=>w===words[0]));assert.match(words[0],/^[a-z]{3,8}$/);observed.add(words[0]);}
  assert.equal(observed.size,256);assert.equal(invitationWords.length,256);
 }finally{mocked.mock.restore();assert.equal(crypto.getRandomValues,original);}
});

test('phrase normalization accepts print separators but never strips extra characters or word boundaries',()=>{
 assert.equal(normalizeInvitation('  APFEL - Birne\tWolke\nAnker — Besen  '),'apfel-birne-wolke-anker-besen');
 assert.equal(normalizeInvitation(' ABCDEF0123456789'.repeat(4)),null);
 assert.equal(normalizeInvitation('ABCDEF0123456789'.repeat(4)),'abcdef0123456789'.repeat(4));
 for(const value of [undefined,{},'apfelbirnewolkeankerbesen','apfel-birne-wolke-anker-besen-extra','apfel-birne-wolke-anker-besen!', 'apfel\u200b-birne-wolke-anker-besen',' '.repeat(161)])assert.equal(normalizeInvitation(value),null);
});
