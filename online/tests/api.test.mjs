import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import C from '../../offline/src/core.js';
import {handle,hashToken,passwordVerifier} from '../worker.js';
class D1 {
 constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));}
 prepare(sql){this.queries=(this.queries||0)+1;const db=this.db;return {sql,args:[],bind(...args){assert.ok(args.length<=100,'D1 binding limit');return {...this,args};},async first(){return db.prepare(this.sql).get(...this.args)||null;},async all(){return {results:db.prepare(this.sql).all(...this.args)};},async run(){const x=db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(x.changes)}};}};}
 async batch(queries){this.db.exec('BEGIN');try{const out=[];for(const q of queries)out.push(q.sql.trim().toUpperCase().startsWith('SELECT')?await q.all():await q.run());this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
async function setup(){
 const DB=new D1(),seed=C.validate(JSON.parse(fs.readFileSync(new URL('../../offline/demo.json',import.meta.url))));seed.workshops=[{id:'meeting',title:'Termin',examYear:2027,meetingDate:'',specialties:C.specialties}];
 const collections=['tasks','families','sources','exams','patterns','workshops','uses','assets'];const meta=Object.fromEntries(Object.entries(seed).filter(([k])=>!collections.includes(k)));
 DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('meta','project',JSON.stringify(meta));for(const kind of collections)for(const x of seed[kind]){const value=structuredClone(x);if(kind==='assets'){DB.db.prepare('INSERT INTO assets VALUES(?,?)').run(x.id,x.data);value.data='';}DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run(kind,x.id,JSON.stringify(value));}
 const env={DB,ALLOWED_ORIGIN:'https://hannespix.github.io',ADMIN_VERIFIER:JSON.stringify(await passwordVerifier('test-only-long-password-123456789','0123456789abcdef0123456789abcdef'))};
 async function req(path,body,token){const headers={'Origin':env.ALLOWED_ORIGIN};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;const r=await handle(new Request('https://api.test'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:r.status,body:await r.json(),headers:r.headers};}
 const admin=(await req('/api/login',{password:'test-only-long-password-123456789'})).body.token;
 return {DB,env,seed,req,admin};
}
async function group(t,specialty='Baumschule'){
 const opened=await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+3600000},t.admin);assert.equal(opened.status,200);assert.ok(Number.isInteger(opened.body.generation));
 const invite=opened.body.invitations.find(x=>x.specialty===specialty).token;
 const joined=await t.req('/api/join',{invitation:invite,label:'Testgerät'});assert.equal(joined.status,200);
 const before=await t.req('/api/project',undefined,joined.body.token);assert.equal(before.status,403);
 const board=await t.req('/api/access',undefined,t.admin);const pending=board.body.requests.find(x=>x.code===joined.body.code);
 assert.equal((await t.req('/api/access/approve',{requestId:pending.id},t.admin)).status,200);
 return {token:joined.body.token,invite};
}
test('unauthenticated reads, wrong password and foreign origins cannot read private data',async()=>{const t=await setup();assert.equal((await t.req('/api/project')).status,401);assert.equal((await t.req('/api/login',{password:'wrong'})).status,401);const r=await handle(new Request('https://api.test/api/project',{headers:{Origin:'https://evil.test',Authorization:'Bearer '+t.admin}}),t.env);assert.equal(r.status,403);assert.equal((await t.req('/api/session',undefined,t.admin)).headers.get('Cache-Control'),'no-store');});
test('approval grants only the invited specialty and removes source archives',async()=>{const t=await setup(),g=await group(t),r=await t.req('/api/project',undefined,g.token);assert.equal(r.status,200);assert.ok(r.body.project.tasks.every(x=>x.specialty==='Baumschule'));assert.ok(r.body.project.sources.every(x=>!x.assetId&&x.text===''&&x.attachmentIds.length===0));assert.equal(r.body.project.workshops.length,1);assert.equal((await t.req('/api/access',undefined,g.token)).status,403);assert.equal((await t.req('/api/export',undefined,g.token)).status,403);});
test('closing and reopening a meeting revokes approved devices and previous invitations',async()=>{const t=await setup(),g=await group(t);assert.equal((await t.req('/api/access/close',{meetingId:'meeting'},t.admin)).status,200);assert.equal((await t.req('/api/project',undefined,g.token)).status,401);await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+3600000},t.admin);assert.equal((await t.req('/api/join',{invitation:g.invite,label:'Old'})).status,401);assert.equal((await t.req('/api/project',undefined,g.token)).status,401);});
test('expiry and explicit logout invalidate server sessions',async()=>{const t=await setup(),g=await group(t);t.DB.db.prepare('UPDATE access SET expires=?').run(Date.now()-1);assert.equal((await t.req('/api/session',undefined,g.token)).status,401);await t.req('/api/logout',{},t.admin);assert.equal((await t.req('/api/project',undefined,t.admin)).status,401);});
test('group saves its own draft but cannot change patterns, other specialties or approve work',async()=>{const t=await setup(),g=await group(t),e=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'});const save=changes=>t.req('/api/save',{changes},g.token);assert.equal((await save([{kind:'exams',id:e.id,version:0,value:e}])).status,200);assert.equal((await save([{kind:'patterns',id:'bad',version:0,value:{id:'bad'}}])).status,403);assert.equal((await save([{kind:'exams',id:'other',version:0,value:{...e,id:'other',specialty:'Obstbau'}}])).status,403);const approved=structuredClone(e);approved.status='used';assert.equal((await save([{kind:'exams',id:e.id,version:1,value:approved}])).status,403);});
test('Excel category patterns round-trip through the server and groups can use but not alter them',async()=>{
 const t=await setup(),specialty='Garten- und Landschaftsbau',pattern={id:'excel-pattern',version:1,examType:'AP',specialty,status:'confirmed',categoryCatalog:'excel-ap-2026',slots:[{categoryId:'drainage',count:1}]};
 assert.equal((await t.req('/api/save',{changes:[{kind:'patterns',id:pattern.id,version:0,value:pattern}]},t.admin)).status,200);
 const g=await group(t,specialty),p=(await t.req('/api/project',undefined,g.token)).body.project.patterns.find(p=>p.id===pattern.id);
 assert.deepEqual(p,pattern);
 const e=C.newExam({examType:'AP',specialty,examYear:2027,workshopId:'meeting'});e.pattern=p;
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,200);
 const altered=structuredClone(e);delete altered.pattern.categoryCatalog;
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:1,value:altered}]},g.token)).status,403);
});
test('optimistic revisions preserve another editor changes and reject stale overwrites atomically',async()=>{const t=await setup(),e=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'}),save=changes=>t.req('/api/save',{changes},t.admin);assert.equal((await save([{kind:'exams',id:e.id,version:0,value:e}])).status,200);assert.equal((await save([{kind:'exams',id:e.id,version:1,value:{...e,title:'Winner'}}])).status,200);const second={...e,id:'second'};assert.equal((await save([{kind:'exams',id:second.id,version:0,value:second},{kind:'exams',id:e.id,version:1,value:{...e,title:'Stale'}}])).status,409);const p=(await t.req('/api/project',undefined,t.admin)).body.project;assert.equal(p.exams.find(x=>x.id===e.id).title,'Winner');assert.ok(!p.exams.some(x=>x.id==='second'));});
test('group cannot fetch unassigned assets or attach foreign tasks',async()=>{const t=await setup(),g=await group(t);const foreign=t.seed.tasks.find(x=>x.specialty!=='Baumschule');const e=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'});C.addItem(e,foreign);assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,403);t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('assets','secret',JSON.stringify({id:'secret',mime:'image/png',name:'secret.png',data:''}));t.DB.db.prepare('INSERT INTO assets VALUES(?,?)').run('secret','c2VjcmV0');assert.equal((await t.req('/api/assets?ids=secret',undefined,g.token)).status,404);});
test('login attempts are rate limited and malformed/oversized requests are denied',async()=>{const t=await setup();for(let i=0;i<5;i++)await t.req('/api/login',{password:'wrong'});assert.equal((await t.req('/api/login',{password:'wrong'})).status,429);const r=await handle(new Request('https://api.test/api/login',{method:'POST',headers:{Origin:t.env.ALLOWED_ORIGIN,'Content-Type':'application/json'},body:'x'.repeat(20000)}),t.env);assert.equal(r.status,413);});

test('group can save and copy approved custom snapshots after source sanitization',async()=>{const t=await setup(),g=await group(t);const task=t.seed.tasks.find(x=>x.specialty==='Baumschule'&&x.kind==='practical');const e=C.newExam({examType:task.examType,specialty:task.specialty,examYear:2027,workshopId:'meeting'});const P=(await import('../../offline/src/planning.js')).default;const pattern={...P.pattern(t.seed,e.examType,e.specialty),slots:[{categoryId:'propagation',count:1}]};t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('patterns',pattern.id,JSON.stringify(pattern));e.pattern=pattern;C.addItem(e,task);e.items[0].task.text+='\nFachlich angepasste Fassung';e.items[0].task.solution='Freigegebene Lösung';e.items[0].task.reviewStatus='approved';e.items[0].task.solutionStatus='approved';e.items[0].task.reviewedBy='Koordination';const asset=t.seed.assets[0];if(asset)e.items[0].task.assetLinks.push({assetId:asset.id,audience:'source',caption:'Original'});const saved=await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},t.admin);assert.equal(saved.status,200,JSON.stringify(saved.body));const p=(await t.req('/api/project',undefined,g.token)).body.project;const visible=p.exams.find(x=>x.id===e.id);visible.title+=' · Neuer Titel';assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:1,value:visible}]},g.token)).status,200);const copied={...structuredClone(visible),id:'copy-checked',basedOnExamId:e.id};assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:copied.id,version:0,value:copied}]},g.token)).status,200);visible.items[0].task.text+=' unerlaubt freigegeben';assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:2,value:visible}]},g.token)).status,403);});

test('large private assets are chunked and retrieved unchanged only after authorization',async()=>{const t=await setup(),data='YQ=='.repeat(160000),a={id:'large-private',name:'large.png',mime:'image/png',data:''};assert.equal((await t.req('/api/asset/upload',{asset:{id:a.id,data}},t.admin)).status,200);assert.ok(t.DB.db.prepare('SELECT count(*) AS n FROM asset_chunks WHERE id=?').get(a.id).n>1);assert.equal((await t.req('/api/save',{changes:[{kind:'assets',id:a.id,version:0,value:a}]},t.admin)).status,200);assert.equal((await t.req('/api/assets?ids='+a.id,undefined,t.admin)).body.assets[0].data,data);assert.equal((await t.req('/api/asset/upload',{asset:{id:a.id,data:'Yg=='}},t.admin)).status,409);});

test('bulk record saves stay within D1 query and parameter limits',async()=>{const t=await setup();t.DB.queries=0;const changes=Array.from({length:180},(_,i)=>({kind:'families',id:'batch-family-'+i,version:0,value:{id:'batch-family-'+i,title:'Batch family '+i,reviewStatus:'review'}}));const r=await t.req('/api/save',{changes},t.admin);assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(t.DB.queries<50);assert.equal(t.DB.db.prepare("SELECT count(*) AS n FROM records WHERE id LIKE 'batch-family-%'").get().n,180);});

for(const hours of [24,48])test(hours+'-hour invitations survive coordinator logout and expire at the selected boundary',async()=>{const originalNow=Date.now;let clock=originalNow();Date.now=()=>clock;try{const t=await setup(),expires=clock+hours*3600000;let r=await t.req('/api/access/open',{meetingId:'meeting',expires},t.admin);assert.equal(r.status,200);assert.equal(r.body.expires,expires);const invitation=r.body.invitations.find(i=>i.specialty==='Baumschule').token;assert.equal((await t.req('/api/access/open',{meetingId:'meeting',expires:clock+48*3600000+1},t.admin)).status,400);assert.equal(t.DB.db.prepare('SELECT expires FROM invites WHERE hash=?').get(await hashToken(invitation)).expires,expires);await t.req('/api/logout',{},t.admin);clock+=(hours-1)*3600000;const joined=await t.req('/api/join',{invitation,label:'Nächster Tag'});assert.equal(joined.status,200);const admin=(await t.req('/api/login',{password:'test-only-long-password-123456789'})).body.token;const board=(await t.req('/api/access',undefined,admin)).body;const pending=board.requests.find(r=>r.code===joined.body.code);assert.equal((await t.req('/api/access/approve',{requestId:pending.id},admin)).status,200);assert.equal((await t.req('/api/session',undefined,joined.body.token)).body.expires,expires);assert.equal((await t.req('/api/project',undefined,joined.body.token)).status,200);clock=expires;assert.equal((await t.req('/api/session',undefined,joined.body.token)).status,401);assert.equal((await t.req('/api/join',{invitation,label:'Abgelaufen'})).status,401);}finally{Date.now=originalNow;}});
test('48-hour invitations and approved devices can be revoked early',async()=>{
 const t=await setup(),opened=await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+48*3600000},t.admin);assert.equal(opened.status,200);const invitation=opened.body.invitations[0].token;
 const joined=await t.req('/api/join',{invitation,label:'Tablet'}),board=(await t.req('/api/access',undefined,t.admin)).body,pending=board.requests.find(r=>r.code===joined.body.code);
 assert.equal((await t.req('/api/access/approve',{requestId:pending.id},t.admin)).status,200);assert.equal((await t.req('/api/access/revoke',{requestId:pending.id},t.admin)).status,200);assert.equal((await t.req('/api/project',undefined,joined.body.token)).status,401);
 assert.equal((await t.req('/api/access/close',{meetingId:'meeting'},t.admin)).status,200);assert.equal((await t.req('/api/join',{invitation,label:'Again'})).status,401);
});
test('only admins can trash or restore drafts; groups cannot read or overwrite them',async()=>{const t=await setup(),g=await group(t),e=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'}),save=(value,version,token=t.admin)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},token);assert.equal((await save(e,0)).status,200);const deleted={...e,deletedAt:new Date().toISOString()};assert.equal((await save(deleted,1,g.token)).status,403);assert.equal((await save(deleted,1)).status,200);assert.ok(!(await t.req('/api/project',undefined,g.token)).body.project.exams.some(x=>x.id===e.id));assert.equal((await save(e,2,g.token)).status,403);assert.equal((await save(e,2)).status,200);const used={...e,status:'used'};assert.equal((await save(used,3)).status,200);assert.equal((await save({...used,deletedAt:deleted.deletedAt},4)).status,400);assert.equal((await save(null,4)).status,400);});
test('historical PDF attachments stay private even when the group knows their identifier',async()=>{const t=await setup(),s=t.seed.sources.find(s=>t.seed.tasks.some(x=>x.specialty==='Baumschule'&&x.sourceIds.includes(s.id))),a={id:'historical-print-copy',name:'Archiv.pdf',mime:'application/pdf',data:'',archiveRole:'source-print-pdf',sourceSha256:'a'.repeat(64)};assert.ok(s);assert.equal((await t.req('/api/asset/upload',{asset:{id:a.id,data:'JVBERi0='}},t.admin)).status,200);assert.equal((await t.req('/api/save',{changes:[{kind:'assets',id:a.id,version:0,value:a},{kind:'sources',id:s.id,version:1,value:{...s,attachmentIds:[...s.attachmentIds,a.id]}}]},t.admin)).status,200);const g=await group(t),project=(await t.req('/api/project',undefined,g.token)).body.project;assert.ok(!project.assets.some(x=>x.id===a.id));assert.ok(project.sources.every(s=>!s.attachmentIds.includes(a.id)));assert.equal((await t.req('/api/assets?ids='+a.id,undefined,g.token)).status,404);assert.equal((await t.req('/api/assets?ids='+a.id,undefined,t.admin)).status,200);});

test('permanent deletion is admin-only, trash-only and rejects stale restore or save',async()=>{
 const t=await setup(),g=await group(t),e=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'});
 const save=(value,version,token=t.admin)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},token);
 assert.equal((await save(e,0)).status,200);
 assert.equal((await save(null,1)).status,400);
 const trashed={...e,deletedAt:new Date().toISOString()};assert.equal((await save(trashed,1)).status,200);
 assert.equal((await save(null,2,g.token)).status,403);
 // A second administrator restores it before this tab's deletion request.
 assert.equal((await save(e,2)).status,200);assert.equal((await save(null,2)).status,409);
 assert.equal((await save(trashed,3)).status,200);
 const before=(await t.req('/api/project',undefined,t.admin)).body.project;
 assert.equal((await save(null,4)).status,200);
 const after=(await t.req('/api/project',undefined,t.admin)).body.project;
 assert.ok(!after.exams.some(x=>x.id===e.id));
 for(const kind of ['tasks','families','sources','assets','uses','patterns','workshops'])assert.deepEqual(after[kind],before[kind]);
 assert.equal((await save(e,4)).status,409);assert.equal((await save(null,4)).status,409);
 assert.equal(t.DB.db.prepare('SELECT COUNT(*) AS n FROM records WHERE kind=? AND id=?').get('exams',e.id).n,0);
});
test('source-backed category assignments persist and reject categories from another specialty',async()=>{
 const t=await setup(),task=structuredClone(t.seed.tasks.find(t=>t.specialty==='Baumschule'));task.planningCategoryCatalog='excel-ap-2026';task.planningCategories=['lifting'];task.planningCategoryEvidence='Synthetic source review';
 const save=(value,version)=>t.req('/api/save',{changes:[{kind:'tasks',id:task.id,version,value}]},t.admin);
 assert.equal((await save(task,1)).status,200);
 const stored=(await t.req('/api/project',undefined,t.admin)).body.project.tasks.find(x=>x.id===task.id);assert.deepEqual(stored,task);
 assert.equal((await save({...task,planningCategories:['gravecare']},2)).status,400);
 assert.equal((await save({...task,planningCategories:[]},2)).status,200);
});

test('new invitations are five short words, hash-only at rest, and normalize before device approval',async()=>{
 const t=await setup(),opened=await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+3600000},t.admin);
 assert.equal(opened.status,200);
 const invitation=opened.body.invitations.find(i=>i.specialty==='Baumschule').token;
 assert.match(invitation,/^[a-z]{3,8}(?:-[a-z]{3,8}){4}$/);
 const stored=t.DB.db.prepare('SELECT * FROM invites WHERE hash=?').get(await hashToken(invitation));
 assert.equal(stored.specialty,'Baumschule');assert.ok(!JSON.stringify(stored).includes(invitation));
 const joined=await t.req('/api/join',{invitation:'  '+invitation.toUpperCase().replaceAll('-',' -  ')+'  ',label:'Mein Tablet'});
 assert.equal(joined.status,200);assert.equal(joined.body.status,'pending');assert.match(joined.body.token,/^[a-f0-9]{64}$/);
 assert.equal((await t.req('/api/project',undefined,joined.body.token)).status,403);
 assert.equal((await t.req('/api/assets?ids=secret',undefined,joined.body.token)).status,403);
 const board=(await t.req('/api/access',undefined,t.admin)).body,pending=board.requests.find(r=>r.code===joined.body.code);
 assert.equal((await t.req('/api/access/approve',{requestId:pending.id},t.admin)).status,200);
 const project=(await t.req('/api/project',undefined,joined.body.token)).body.project;
 assert.ok(project.tasks.every(x=>x.specialty==='Baumschule'));
 const spaces=await t.req('/api/join',{invitation:invitation.replaceAll('-',' '),label:'Zweites Tablet'});
 assert.equal(spaces.status,200);assert.equal(spaces.body.status,'pending');
});

test('invalid, unknown and expired phrases reveal no meeting metadata and consume the join rate limit',async()=>{
 const t=await setup(),opened=await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+3600000},t.admin),invitation=opened.body.invitations[0].token;
 const invalid=[null,42,'', 'a'.repeat(161),'apfel-birne','apfel_birne_wolke_anker_besen','apfel/birne/wolke/anker/besen','apfel\u200bbirne-wolke-anker-besen', 'apfel-birne-wolke-anker-besen', 'zebra-zebra-zebra-zebra-zebra'];
 await t.req('/api/access/close',{meetingId:'meeting'},t.admin);
 invalid.push(invitation);
 for(const value of invalid){const r=await t.req('/api/join',{invitation:value,label:'Test'});assert.equal(r.status,401);assert.deepEqual(r.body,{error:'Einladung ist ungültig, abgelaufen oder gesperrt.'});}
 for(let i=invalid.length;i<40;i++)assert.equal((await t.req('/api/join',{invitation:'wrong',label:'Test'})).status,401);
 assert.equal((await t.req('/api/join',{invitation,label:'Test'})).status,429);
 assert.equal(t.DB.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE role='group'").get().n,0);
});

test('legacy 64-hex invitations still join within their active generation and expire normally',async()=>{
 const t=await setup(),expires=Date.now()+3600000,legacy='0123456789abcdef'.repeat(4);
 const opened=await t.req('/api/access/open',{meetingId:'meeting',expires},t.admin);
 t.DB.db.prepare('INSERT INTO invites(hash,meeting_id,specialty,generation,expires) VALUES(?,?,?,?,?)').run(await hashToken(legacy),'meeting','Baumschule',opened.body.generation,expires);
 const joined=await t.req('/api/join',{invitation:legacy,label:'Legacy device'});
 assert.equal(joined.status,200);assert.equal(joined.body.status,'pending');
 assert.equal((await t.req('/api/project',undefined,joined.body.token)).status,403);
 t.DB.db.prepare('UPDATE invites SET expires=? WHERE hash=?').run(Date.now()-1,await hashToken(legacy));
 assert.equal((await t.req('/api/join',{invitation:legacy,label:'Expired'})).status,401);
});
test('FW drafts save for supported groups while AP/FW mixtures and other specialties are rejected',async()=>{
 const t=await setup(),fw=structuredClone(t.seed.tasks[0]);Object.assign(fw,{id:'fw-api',familyId:'fw-api-family',sourceIds:[],examType:'FW_AP',specialty:'Gemüsebau',qualification:'Gartenbaufachwerker',planningCategories:['soil']});delete fw.planningCategoryCatalog;
 assert.equal((await t.req('/api/save',{changes:[{kind:'families',id:fw.familyId,version:0,value:{id:fw.familyId,title:'Fachwerker-Testfamilie'}},{kind:'tasks',id:fw.id,version:0,value:fw}]},t.admin)).status,200);
 const g=await group(t,'Gemüsebau'),e=C.newExam({examType:'FW_AP',specialty:'Gemüsebau',examYear:2027,workshopId:'meeting'});C.addItem(e,fw);
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,200);
 const mixed=structuredClone(e);mixed.id='mixed';mixed.examType='AP';assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:mixed.id,version:0,value:mixed}]},g.token)).status,403);
 const other=await group(t,'Baumschule'),invalid={...C.newExam({examType:'AP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'}),examType:'FW_AP'};
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:invalid.id,version:0,value:invalid}]},other.token)).status,400);
});
test('committee rosters and history are private to the coordinator except each group current roster',async()=>{
 const t=await setup(),at='2026-11-03T12:00:00.000Z',w={...t.seed.workshops[0],committees:[{specialty:'Baumschule',name:'Aktuelle Baumschulgruppe',participants:['Anna Current'],updatedAt:at,revisions:[{name:'Vorherige Gruppe',participants:['Ben Historical'],recordedAt:at}]},{specialty:'Obstbau',name:'Andere Gruppe',participants:['Clara Foreign'],updatedAt:at,revisions:[]}]};
 const old={...w,id:'old-year',examYear:2026,committees:[{specialty:'Baumschule',name:'Vorjahr',participants:['Dora Previousyear'],updatedAt:at,revisions:[]}]};
 const saved=await t.req('/api/save',{changes:[{kind:'workshops',id:w.id,version:1,value:w},{kind:'workshops',id:old.id,version:0,value:old}]},t.admin);assert.equal(saved.status,200,JSON.stringify(saved.body));
 const g=await group(t),response=await t.req('/api/project',undefined,g.token),project=response.body.project;
 assert.deepEqual(project.workshops[0].committees,[{...w.committees[0],revisions:[]}]);assert.equal(project.workshops.length,1);assert.ok(!response.body.versions['workshops:old-year']);
 for(const name of ['Ben Historical','Clara Foreign','Dora Previousyear','Vorherige Gruppe','Andere Gruppe','Vorjahr'])assert.ok(!JSON.stringify(response.body).includes(name),name);
 assert.deepEqual((await t.req('/api/project',undefined,t.admin)).body.project.workshops.find(x=>x.id==='meeting').committees,w.committees);
 const edited={...project.workshops[0],committees:[]};assert.equal((await t.req('/api/save',{changes:[{kind:'workshops',id:w.id,version:2,value:edited}]},g.token)).status,403);
 assert.deepEqual((await t.req('/api/project',undefined,t.admin)).body.project.workshops.find(x=>x.id==='meeting').committees,w.committees);
});
test('invalid committee saves reject the entire batch and stale edits preserve history',async()=>{
 const t=await setup(),w={...t.seed.workshops[0],committees:[{specialty:'Baumschule',name:'Ausschuss',participants:['Anna'],updatedAt:'2026-11-03T12:00:00.000Z',revisions:[]}]},save=(value,version,extra=[])=>t.req('/api/save',{changes:[...extra,{kind:'workshops',id:w.id,version,value}]},t.admin);
 assert.equal((await save(w,1)).status,200);const invalid={...w,committees:[{...w.committees[0],participants:['Anna','ANNA']}]};
 assert.equal((await save(invalid,2,[{kind:'families',id:'atomic-family',version:0,value:{id:'atomic-family',title:'Must not persist'}}])).status,400);
 assert.equal((await save({...w,title:'Stale'},1)).status,409);const project=(await t.req('/api/project',undefined,t.admin)).body.project;assert.deepEqual(project.workshops.find(x=>x.id===w.id),w);assert.ok(!project.families.some(x=>x.id==='atomic-family'));
 assert.equal((await save({...w,examYear:2028},2)).status,400);assert.equal((await save({...w,specialties:['Obstbau'],committees:[]},2)).status,400);
});
test('server roster changes append history and cannot erase recorded committees or workshops',async()=>{
 const t=await setup(),w={...t.seed.workshops[0],committees:[{specialty:'Baumschule',name:'Ausschuss',participants:['Anna'],updatedAt:'2026-11-03T12:00:00.000Z',revisions:[]}]},save=(value,version)=>t.req('/api/save',{changes:[{kind:'workshops',id:w.id,version,value}]},t.admin);
 assert.equal((await save(w,1)).status,200);const old=w.committees[0],updated={...w,committees:[{...old,participants:['Ben'],updatedAt:'2026-11-03T13:00:00.000Z',revisions:[{name:old.name,participants:old.participants,recordedAt:old.updatedAt}]}]};
 assert.equal((await save(updated,2)).status,200);
 for(const value of [null,{...updated,committees:[]},{...updated,committees:[{...updated.committees[0],revisions:[]}]},{...updated,committees:[{...updated.committees[0],participants:['Clara']}]}])assert.equal((await save(value,3)).status,400);
 assert.deepEqual((await t.req('/api/project',undefined,t.admin)).body.project.workshops.find(x=>x.id===w.id),updated);
});
