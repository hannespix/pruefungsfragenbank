import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {handle,hashToken} from '../worker.js';

class D1 {
 constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));}
 prepare(sql){const db=this.db;return {sql,args:[],bind(...args){return {...this,args};},async first(){return db.prepare(this.sql).get(...this.args)||null;},async all(){return {results:db.prepare(this.sql).all(...this.args)};},async run(){const result=db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes)}};}};}
}
const input={text:'Pflanzen Sie 12 Gehölze in 30 Minuten.',mode:'grammar',field:'task'};
const suggested={text:'Pflanzen Sie innerhalb von 30 Minuten 12 Gehölze.',notes:['Die Satzstellung wurde angepasst.']};
function provider(value=suggested,changes={}){return Response.json({id:'msg_synthetic',type:'message',role:'assistant',model:'claude-sonnet-5-5',content:[{type:'text',text:JSON.stringify(value)}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:100,output_tokens:60},...changes});}
async function setup(t){
 const DB=new D1(),env={DB,INVITATION_VAULT_KEY:'ab'.repeat(32),ALLOWED_ORIGIN:'https://example.test',ANTHROPIC_API_KEY:'synthetic-provider-key'};
 t.after(()=>DB.db.close());
 let number=0;
 async function addSession({role='admin',status='approved',meeting='meeting',specialty='Baumschule',expires=Date.now()+3600000,generation=1}={}){
  const token=(++number).toString(16).padStart(64,'0'),hash=await hashToken(token);
  if(role==='group')DB.db.prepare('INSERT OR IGNORE INTO access VALUES(?,?,1,?)').run(meeting,generation,Date.now()+3600000);
  DB.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?)').run(hash,role,status,role==='group'?meeting:null,role==='group'?specialty:null,role==='group'?generation:null,expires,'Synthetic device','000001',Date.now());
  return {token,hash};
 }
 async function req(path,body,token){const headers={Origin:env.ALLOWED_ORIGIN};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';const response=await handle(new Request('https://api.test'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:response.status,body:await response.json(),headers:response.headers};}
 const admin=await addSession();
 // Every test replaces the real external boundary, including unauthorized requests.
 const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('Unexpected external request');});
 return {DB,env,req,addSession,admin,fetch};
}

test('AI status is authenticated and missing configuration leaves manual editing available',async t=>{
 const x=await setup(t);delete x.env.ANTHROPIC_API_KEY;
 assert.equal((await x.req('/api/ai/status')).status,401);
 const status=await x.req('/api/ai/status',undefined,x.admin.token);
 assert.equal(status.status,200);assert.deepEqual(status.body,{enabled:false,model:'claude-sonnet-5-5'});assert.equal(status.headers.get('Cache-Control'),'no-store');
 const disabled=await x.req('/api/ai/suggest',input,x.admin.token);assert.equal(disabled.status,503);assert.match(disabled.body.error,/nicht eingerichtet/);
 assert.equal(x.DB.db.prepare('SELECT count(*) AS n FROM attempts').get().n,0);assert.equal(x.fetch.mock.callCount(),0);
});

test('AI suggestions use the bounded provider contract and do not persist selected or generated text',async t=>{
 const x=await setup(t);let sent;
 x.fetch.mock.mockImplementation(async(url,options)=>{sent={url,options,data:JSON.parse(options.body)};return provider();});
 const before=x.DB.db.prepare('SELECT version FROM state_clock').get().version;
 assert.deepEqual((await x.req('/api/ai/status',undefined,x.admin.token)).body,{enabled:true,model:'claude-sonnet-5-5'});
 const response=await x.req('/api/ai/suggest',input,x.admin.token);
 assert.equal(response.status,200);assert.deepEqual(response.body,{...suggested,model:'claude-sonnet-5-5'});
 assert.equal(sent.url,'https://api.anthropic.com/v1/messages');assert.equal(sent.options.method,'POST');assert.equal(sent.options.redirect,'manual');assert.equal(sent.options.headers['x-api-key'],'synthetic-provider-key');assert.equal(sent.options.headers['anthropic-version'],'2023-06-01');
 assert.equal(sent.data.model,'claude-sonnet-5-5');assert.equal(sent.data.max_tokens,4096);assert.deepEqual(sent.data.thinking,{type:'between_tools'});assert.equal(sent.data.temperature,undefined);assert.equal(sent.data.tools,undefined);assert.equal(sent.data.tool_choice,undefined);
 assert.equal(sent.data.output_config.format.type,'json_schema');assert.deepEqual(sent.data.output_config.format.schema.required,['text','notes']);assert.equal(sent.data.output_config.format.schema.additionalProperties,false);
 assert.deepEqual(sent.data.messages,[{role:'user',content:JSON.stringify(input)}]);assert.ok(sent.options.signal instanceof AbortSignal);
 assert.match(sent.data.system,/unvertrauenswürdige/);assert.match(sent.data.system,/Zahlen/);assert.match(sent.data.system,/Berichtsheft/);assert.match(sent.data.system,/keine neuen Lösungen/);assert.match(sent.data.system,/Rechtsprüfung/);
 for(const table of ['records','assets','audit'])assert.equal(x.DB.db.prepare('SELECT count(*) AS n FROM '+table).get().n,0);
 assert.equal(x.DB.db.prepare('SELECT version FROM state_clock').get().version,before);
 const counters=x.DB.db.prepare('SELECT * FROM attempts').all();assert.ok(counters.length>=3);assert.ok(!JSON.stringify(counters).includes('Pflanzen'));
});

test('only approved valid admin and group sessions can use either AI route',async t=>{
 const x=await setup(t);x.fetch.mock.mockImplementation(async()=>provider());
 for(const options of [{role:'group',status:'pending'},{role:'group',status:'revoked'},{role:'group',expires:Date.now()-1},{role:'group',generation:2},{role:'admin',status:'pending'},{role:'admin',status:'revoked'},{role:'other'}]){
  const s=await x.addSession(options);
  for(const [path,body] of [['/api/ai/status',undefined],['/api/ai/suggest',input]])assert.ok([401,403].includes((await x.req(path,body,s.token)).status),JSON.stringify(options));
 }
 assert.equal(x.fetch.mock.callCount(),0);
 const group=await x.addSession({role:'group'});assert.equal((await x.req('/api/ai/suggest',input,group.token)).status,200);
 x.DB.db.prepare('UPDATE access SET active=0').run();assert.equal((await x.req('/api/ai/suggest',input,group.token)).status,401);assert.equal(x.fetch.mock.callCount(),1);
});

test('AI rejects empty, unknown, excessive, or unrelated fields before charging the provider',async t=>{
 const x=await setup(t);
 for(const bad of [null,[],{}, {...input,text:''},{...input,text:'   '},{...input,text:123},{...input,text:'x'.repeat(6001)},{...input,mode:'solve'},{...input,field:'project'},{...input,project:{secret:'unrelated'}}]){
  assert.equal((await x.req('/api/ai/suggest',bad,x.admin.token)).status,400,JSON.stringify(bad).slice(0,100));
 }
 assert.equal((await x.req('/api/ai/suggest',{...input,text:'x'.repeat(45000)},x.admin.token)).status,413);
 assert.equal(x.fetch.mock.callCount(),0);assert.equal(x.DB.db.prepare('SELECT count(*) AS n FROM attempts').get().n,0);
});

test('AI accepts the 6000-character boundary with multibyte text and all declared modes and fields',async t=>{
 const x=await setup(t);x.fetch.mock.mockImplementation(async()=>provider());
 for(const [mode,field] of [['grammar','title'],['clear','task'],['exam','solution'],['grammar','criterion'],['clear','instruction']])assert.equal((await x.req('/api/ai/suggest',{text:'漢'.repeat(6000),mode,field},x.admin.token)).status,200);
});

test('AI custom model is server-controlled and never copied from the client',async t=>{
 const x=await setup(t);x.env.ANTHROPIC_MODEL='claude-sonnet-5-5-custom';let model;
 x.fetch.mock.mockImplementation(async(_url,options)=>{model=JSON.parse(options.body).model;return provider();});
 assert.deepEqual((await x.req('/api/ai/status',undefined,x.admin.token)).body,{enabled:true,model:'claude-sonnet-5-5-custom'});
 assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).body.model,'claude-sonnet-5-5-custom');assert.equal(model,'claude-sonnet-5-5-custom');
 assert.equal((await x.req('/api/ai/suggest',{...input,model:'untrusted'},x.admin.token)).status,400);
});

test('AI custom models may return thinking blocks but only validated final text reaches the client',async t=>{
 const x=await setup(t);x.env.ANTHROPIC_MODEL='claude-opus-5-5';
 x.fetch.mock.mockImplementation(async()=>provider(suggested,{content:[{type:'thinking',thinking:'Provider-internal summary',signature:'synthetic-signature'},{type:'text',text:JSON.stringify(suggested)}]}));
 const response=await x.req('/api/ai/suggest',input,x.admin.token);assert.equal(response.status,200);assert.deepEqual(response.body,{...suggested,model:'claude-opus-5-5'});assert.ok(!JSON.stringify(response.body).includes('Provider-internal'));
});

for(const [reason,want] of [['refusal',422],['max_tokens',502],['tool_use',502],['pause_turn',502]])test('AI rejects provider stop reason '+reason+' without exposing partial text',async t=>{
 const x=await setup(t);x.fetch.mock.mockImplementation(async()=>provider({text:'private partial text',notes:[]},{stop_reason:reason}));
 const response=await x.req('/api/ai/suggest',input,x.admin.token);assert.equal(response.status,want);assert.equal(response.body.text,undefined);assert.ok(!JSON.stringify(response.body).includes('private partial'));
});

test('AI validates the entire result shape and local output limits',async t=>{
 const x=await setup(t);
 const invalid=[null,{text:'',notes:[]},{text:' ',notes:[]},{text:123,notes:[]},{text:'x'.repeat(8001),notes:[]},{text:'valid',notes:'bad'},{text:'valid',notes:[false]},{text:'valid',notes:['n'.repeat(301)]},{text:'valid',notes:Array(6).fill('note')},{text:'valid',notes:[],extra:'unexpected'}];
 for(const value of invalid){const s=await x.addSession();x.fetch.mock.mockImplementation(async()=>provider(value));assert.equal((await x.req('/api/ai/suggest',input,s.token)).status,502);}
 for(const changes of [{content:[]},{content:[{type:'text',text:'not JSON'}]},{content:[{type:'tool_use',name:'unexpected',input:{}}]},{content:[{type:'text',text:JSON.stringify(suggested)},{type:'text',text:JSON.stringify(suggested)}]}]){
  const s=await x.addSession();x.fetch.mock.mockImplementation(async()=>provider(suggested,changes));assert.equal((await x.req('/api/ai/suggest',input,s.token)).status,502);
 }
});

test('AI uses a Workers-compatible request and never follows provider redirects',async t=>{
 const x=await setup(t);
 x.fetch.mock.mockImplementation(async(_url,options)=>{if(options.redirect==='error')throw new TypeError('Unsupported redirect mode: error');return provider();});
 assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).status,200);
 for(const status of [301,302,303,307,308]){
  const before=x.fetch.mock.callCount();
  x.fetch.mock.mockImplementation(async(url,options)=>{assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(options.redirect,'manual');return new Response('PRIVATE_PROVIDER_BODY',{status,headers:{Location:'https://untrusted.test/collect'}});});
  const result=await x.req('/api/ai/suggest',input,x.admin.token);assert.equal(result.status,502);assert.match(result.body.error,/Weiterleitung/);assert.ok(!JSON.stringify(result.body).includes('PRIVATE_PROVIDER_BODY'));assert.equal(x.fetch.mock.callCount(),before+1);
 }
});

test('AI keeps a known provider failure when cancelling its body fails',async t=>{
 const x=await setup(t);
 x.fetch.mock.mockImplementation(async()=>new Response(new ReadableStream({cancel(){throw new Error('PRIVATE_CANCEL_ERROR');}}),{status:401}));
 const result=await x.req('/api/ai/suggest',input,x.admin.token);assert.equal(result.status,503);assert.match(result.body.error,/API-Schlüssel.*abgewiesen/);assert.ok(!JSON.stringify(result.body).includes('PRIVATE_CANCEL_ERROR'));
});

test('AI upstream errors are redacted and failed attempts are not retried',async t=>{
 const x=await setup(t),logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
 for(const [failure,status] of [[()=>Response.json({error:{message:'secret upstream details synthetic-provider-key'}},{status:401}),503],[()=>{throw new Error('secret upstream details synthetic-provider-key');},502]]){
  x.fetch.mock.mockImplementation(async()=>failure());const response=await x.req('/api/ai/suggest',input,x.admin.token);assert.equal(response.status,status);assert.ok(!JSON.stringify(response.body).includes('secret'));assert.ok(!JSON.stringify(response.body).includes('synthetic-provider-key'));
 }
 assert.equal(x.fetch.mock.callCount(),2);assert.deepEqual(logs,[]);
});

const providerFailures=[
 {status:401,type:'authentication_error',message:'invalid x-api-key',want:503,pattern:/API-Schlüssel.*abgewiesen/},
 {status:403,type:'permission_error',message:'Permission denied',want:503,pattern:/Berechtigung.*Modell/},
 {status:402,type:'billing_error',message:'Billing error',want:503,pattern:/Abrechnung.*Guthaben/},
 {status:400,type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',want:503,pattern:/API-Guthaben.*aufgebraucht/},
 {status:400,type:'invalid_request_error',message:'You have reached your specified API usage limits. You will regain access later.',want:503,pattern:/Ausgabenlimit.*erreicht/},
 {status:400,type:'invalid_request_error',message:'You have reached your specified workspace API usage limits. You will regain access later.',want:503,pattern:/Ausgabenlimit.*erreicht/},
 {status:400,type:'invalid_request_error',message:'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use.',want:503,pattern:/Arbeitsbereich.*API-Schlüssel/},
 {status:400,type:'invalid_request_error',message:'anthropic-workspace-id header must be a valid workspace ID.',want:503,pattern:/Arbeitsbereich.*API-Schlüssel/},
 {status:404,type:'not_found_error',message:'model: claude-sonnet-5-5',want:503,pattern:/Modell.*nicht verfügbar/},
 {status:404,type:'not_found_error',message:'Workspace `wrkspc_synthetic` not found.',want:503,pattern:/Arbeitsbereich.*nicht verfügbar/},
 {status:429,type:'rate_limit_error',message:'Rate limited',want:429,pattern:/Anfragelimit.*später/},
 {status:429,type:'rate_limit_error',message:'Your organization has crossed its monthly API usage threshold.',details:{error_code:'enforced_spend_limit_reached'},want:503,pattern:/Ausgabenlimit.*erreicht/},
 {status:400,type:'invalid_request_error',message:'output_config.format: unsupported request parameter',want:502,pattern:/Anfrageformat.*Konfiguration/},
 {status:529,type:'overloaded_error',message:'Overloaded',want:503,pattern:/überlastet.*später/},
 {status:500,type:'api_error',message:'Internal server failure',want:502,pattern:/vorübergehend nicht erreichbar/},
 {status:400,type:'untrusted_type',message:'Your credit balance is too low to access the Anthropic API.',want:502,pattern:/Anfrageformat.*Konfiguration/}
];
for(const sample of providerFailures)test('AI classifies provider failure without exposing its body: '+sample.status+' '+sample.type+' '+sample.message.slice(0,45),async t=>{
 const x=await setup(t),logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));t.mock.method(console,'warn',(...args)=>logs.push(args));
 x.fetch.mock.mockImplementation(async()=>Response.json({type:'error',error:{type:sample.type,message:sample.message+' PRIVATE_SELECTED_TEXT synthetic-provider-key',...(sample.details?{details:sample.details}:{})},request_id:'req_synthetic'}, {status:sample.status}));
 const result=await x.req('/api/ai/suggest',input,x.admin.token);assert.equal(result.status,sample.want);assert.match(result.body.error,sample.pattern);assert.ok(!JSON.stringify(result.body).includes('PRIVATE_SELECTED_TEXT'));assert.ok(!JSON.stringify(result.body).includes('synthetic-provider-key'));assert.deepEqual(logs,[]);assert.equal(x.fetch.mock.callCount(),1);
 // Provider configuration failures must not invalidate the user's own session.
 assert.equal((await x.req('/api/ai/status',undefined,x.admin.token)).status,200);
});

test('AI malformed and oversized provider error bodies fall back safely and cancel unread data',async t=>{
 const x=await setup(t);let cancelled=false;
 const replies=[()=>new Response('<html>PRIVATE_SELECTED_TEXT</html>',{status:400}),()=>new Response(new ReadableStream({pull(c){c.enqueue(new TextEncoder().encode('PRIVATE_SELECTED_TEXT'.repeat(1000)));},cancel(){cancelled=true;}}),{status:400})];
 for(const reply of replies){x.fetch.mock.mockImplementation(async()=>reply());const result=await x.req('/api/ai/suggest',input,x.admin.token);assert.equal(result.status,502);assert.match(result.body.error,/Anfrageformat.*Konfiguration/);assert.ok(!JSON.stringify(result.body).includes('PRIVATE_SELECTED_TEXT'));}
 assert.equal(cancelled,true);
});

test('AI bounds streamed provider responses and cancels oversized bodies',async t=>{
 const x=await setup(t);let cancelled=false;
 x.fetch.mock.mockImplementation(async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(70000));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/json'}}));
 assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).status,502);assert.equal(cancelled,true);
});

test('AI timeout aborts a stalled provider request and returns a safe retry message',async t=>{
 const x=await setup(t);let started;
 const ready=new Promise(resolve=>{started=resolve;});
 t.mock.timers.enable({apis:['setTimeout']});
 x.fetch.mock.mockImplementation(async(_url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});started();}));
 const pending=x.req('/api/ai/suggest',input,x.admin.token);await ready;t.mock.timers.tick(30001);
 const response=await pending;assert.equal(response.status,504);assert.match(response.body.error,/Zeit|lange/);assert.equal(x.fetch.mock.callCount(),1);
});

for(const change of ['revoke','close','generation','expire','unapprove'])test('AI rechecks access after provider return: '+change,async t=>{
 const x=await setup(t),s=await x.addSession({role:'group'});
 x.fetch.mock.mockImplementation(async()=>{
  if(change==='revoke')x.DB.db.prepare("UPDATE sessions SET status='revoked' WHERE hash=?").run(s.hash);
  if(change==='close')x.DB.db.prepare('UPDATE access SET active=0').run();
  if(change==='generation')x.DB.db.prepare('UPDATE access SET generation=generation+1').run();
  if(change==='expire')x.DB.db.prepare('UPDATE sessions SET expires=0 WHERE hash=?').run(s.hash);
  if(change==='unapprove')x.DB.db.prepare("UPDATE sessions SET status='pending' WHERE hash=?").run(s.hash);
  return provider();
 });
 const response=await x.req('/api/ai/suggest',input,s.token);assert.ok([401,403].includes(response.status));assert.equal(response.body.text,undefined);
});

test('AI per-session burst and daily budgets block calls and expire independently',async t=>{
 const x=await setup(t);x.fetch.mock.mockImplementation(async()=>provider());
 for(let i=0;i<8;i++)assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).status,200);
 assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).status,429);assert.equal(x.fetch.mock.callCount(),8);
 for(let cycle=0;cycle<4;cycle++){
  x.DB.db.prepare("UPDATE attempts SET expires=0 WHERE key LIKE 'ai:session:burst:%'").run();
  for(let i=0;i<8;i++)assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).status,200);
 }
 x.DB.db.prepare("UPDATE attempts SET expires=0 WHERE key LIKE 'ai:session:burst:%'").run();
 assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).status,429);assert.equal(x.fetch.mock.callCount(),40);
 x.DB.db.prepare('UPDATE attempts SET expires=0').run();assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).status,200);
});

test('AI group budgets survive new sessions and the global daily budget protects all roles',async t=>{
 const x=await setup(t);x.fetch.mock.mockImplementation(async()=>provider());const first=await x.addSession({role:'group'});
 assert.equal((await x.req('/api/ai/suggest',input,first.token)).status,200);
 x.DB.db.prepare("UPDATE attempts SET count=80 WHERE key LIKE 'ai:group:hour:%'").run();
 const second=await x.addSession({role:'group'});assert.equal((await x.req('/api/ai/suggest',input,second.token)).status,429);
 const other=await x.addSession({role:'group',specialty:'Obstbau'});assert.equal((await x.req('/api/ai/suggest',input,other.token)).status,200);
 x.DB.db.prepare("UPDATE attempts SET expires=0 WHERE key LIKE 'ai:group:hour:%'").run();x.DB.db.prepare("UPDATE attempts SET count=200 WHERE key LIKE 'ai:group:day:%'").run();
 assert.equal((await x.req('/api/ai/suggest',input,second.token)).status,429);
 x.DB.db.prepare("UPDATE attempts SET count=500 WHERE key='ai:global:day'").run();assert.equal((await x.req('/api/ai/suggest',input,x.admin.token)).status,429);
 assert.equal(x.fetch.mock.callCount(),2);
});

// KI-Assistent: task drafts from a proposal.
const draftInput={proposal:'Die Prüflinge sollen eine Hecke aus Hainbuchen auf 1,20 m Höhe schneiden und das Schnittgut entsorgen.',context:{examType:'ZP',specialty:'Baumschule',kind:'practical',themes:['Durchführen von Arbeiten an der Pflanze','Einsatz von Werkzeug und Geräten']}};
const drafted={title:'Hainbuchenhecke schneiden',theme:'Durchführen von Arbeiten an der Pflanze',text:'Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Hainbuchenhecke schneiden\nSchneiden Sie die Hecke auf 1,20 m Höhe.\n•\tSchnittgut entsorgen',points:null,minutes:null,materials:['Heckenschere','Maßband'],solution:'Gerader Schnitt, Höhe 1,20 m eingehalten.',criteria:[{text:'Schnitthöhe',answer:'1,20 m eingehalten',points:null}],questions:['Wie lang ist der Heckenabschnitt?','Wie viele Punkte und Minuten sind vorgesehen?'],notes:[]};
test('task drafts use a bounded, schema-constrained request, keep nothing and ask back for missing details',async t=>{
 const x=await setup(t);let sent;x.fetch.mock.mockImplementation(async(url,options)=>{sent={url,options,data:JSON.parse(options.body)};return provider(drafted,{content:[{type:'thinking',thinking:'',signature:'s'},{type:'text',text:JSON.stringify(drafted)}]});});
 const before=x.DB.db.prepare('SELECT version FROM state_clock').get().version,response=await x.req('/api/ai/draft',{...draftInput,answers:[{question:'Gibt es eine Vorgabe zur Länge?',answer:'5 m'}]},x.admin.token);
 assert.equal(response.status,200,JSON.stringify(response.body));assert.deepEqual(response.body,{draft:drafted,model:'claude-sonnet-5-5'});
 assert.equal(sent.data.model,'claude-sonnet-5-5');assert.equal(sent.data.max_tokens,16000);assert.equal(sent.data.thinking,undefined,'adaptive thinking');assert.equal(sent.data.output_config.effort,'medium');assert.equal(sent.data.tools,undefined);
 const schema=sent.data.output_config.format.schema;assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.required,['title','theme','text','points','minutes','materials','solution','criteria','questions','notes']);assert.deepEqual(schema.properties.points.anyOf,[{type:'number'},{type:'null'}]);
 assert.ok(!JSON.stringify(schema).match(/minimum|maximum|maxLength|maxItems/),'only schema features the API supports');
 const user=JSON.parse(sent.data.messages[0].content);assert.deepEqual(Object.keys(user),['proposal','context','answers']);assert.equal(user.answers[0].answer,'5 m');
 assert.match(sent.data.system,/unvertrauenswürdige/);assert.match(sent.data.system,/Erfinde keine/);assert.match(sent.data.system,/Rückfrage/);assert.match(sent.data.system,/Berichtsheft/);
 for(const table of ['records','assets','audit'])assert.equal(x.DB.db.prepare('SELECT count(*) AS n FROM '+table).get().n,0);assert.equal(x.DB.db.prepare('SELECT version FROM state_clock').get().version,before);
 assert.ok(!JSON.stringify(x.DB.db.prepare('SELECT * FROM attempts').all()).includes('Hecke'),'counters only, no proposal text');
});
test('task drafts validate input and output strictly and are available to approved groups',async t=>{
 const x=await setup(t);x.fetch.mock.mockImplementation(async()=>provider(drafted));
 for(const bad of [{...draftInput,proposal:'zu kurz'},{...draftInput,context:{...draftInput.context,examType:'XX'}},{...draftInput,context:{...draftInput.context,kind:'written'}},{...draftInput,extra:1},{...draftInput,answers:[{question:'q',answer:'a',x:1}]},{...draftInput,draft:{...drafted,points:-1}},{...draftInput,proposal:'x'.repeat(12001)}])
  assert.equal((await x.req('/api/ai/draft',bad,x.admin.token)).status,400,JSON.stringify(bad).slice(0,90));
 assert.equal(x.fetch.mock.callCount(),0,'invalid input never reaches the provider');
 const again=await x.req('/api/ai/draft',{...draftInput,draft:drafted,answers:[{question:'Punkte?',answer:'20 Punkte, 30 Minuten'}]},x.admin.token);assert.equal(again.status,200);
 const group=await x.addSession({role:'group'});assert.equal((await x.req('/api/ai/draft',draftInput,group.token)).status,200,'groups use it for their own drafts');
 const pending=await x.addSession({role:'group',status:'pending',meeting:'other'});assert.equal((await x.req('/api/ai/draft',draftInput,pending.token)).status,403);
 for(const bad of [{...drafted,points:-5},{...drafted,title:''},{...drafted,extra:true},{...drafted,questions:['1','2','3','4','5','6']}]){x.fetch.mock.mockImplementation(async()=>provider(bad));assert.equal((await x.req('/api/ai/draft',draftInput,x.admin.token)).status,502,JSON.stringify(bad).slice(0,80));}
 x.fetch.mock.mockImplementation(async()=>provider(drafted,{stop_reason:'refusal'}));assert.equal((await x.req('/api/ai/draft',draftInput,x.admin.token)).status,422);
 delete x.env.ANTHROPIC_API_KEY;assert.equal((await x.req('/api/ai/draft',draftInput,x.admin.token)).status,503);
});
