import TimingPlan from '../../offline/src/timing-plan.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import C from '../../offline/src/core.js';
import P from '../../offline/src/planning.js';
import {handle,hashToken,passwordVerifier} from '../worker.js';
class D1 {
 constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));}
 prepare(sql){this.queries=(this.queries||0)+1;const db=this.db;return {sql,args:[],bind(...args){assert.ok(args.length<=100,'D1 binding limit');return {...this,args};},async first(){return db.prepare(this.sql).get(...this.args)||null;},async all(){return {results:db.prepare(this.sql).all(...this.args)};},async run(){const x=db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(x.changes)}};}};}
 async batch(queries){this.db.exec('BEGIN');try{const out=[];for(const q of queries)out.push(q.sql.trim().toUpperCase().startsWith('SELECT')?await q.all():await q.run());this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
async function setup(){
 const DB=new D1(),seed=C.validate(JSON.parse(fs.readFileSync(new URL('../../offline/demo.json',import.meta.url))));seed.workshops=[{id:'meeting',title:'Termin',examYear:2027,meetingDate:'',specialties:C.specialties}];
 const collections=['tasks','families','sources','exams','patterns','workshops','uses','assets','settings'];const meta=Object.fromEntries(Object.entries(seed).filter(([k])=>!collections.includes(k)));
 DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('meta','project',JSON.stringify(meta));for(const kind of collections)for(const x of seed[kind]){const value=structuredClone(x);if(kind==='assets'){DB.db.prepare('INSERT INTO assets VALUES(?,?)').run(x.id,x.data);value.data='';}DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run(kind,x.id,JSON.stringify(value));}
 const env={DB,INVITATION_VAULT_KEY:'ab'.repeat(32),ALLOWED_ORIGIN:'https://hannespix.github.io',ADMIN_VERIFIER:JSON.stringify(await passwordVerifier('test-only-long-password-123456789','0123456789abcdef0123456789abcdef'))};
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
test('group saves its own draft but cannot change patterns, other specialties or approve work',async()=>{const t=await setup(),g=await group(t),e=workflowExam(t.seed);const save=changes=>t.req('/api/save',{changes},g.token);assert.equal((await save([{kind:'exams',id:e.id,version:0,value:e}])).status,200);assert.equal((await save([{kind:'patterns',id:'bad',version:0,value:{id:'bad'}}])).status,403);assert.equal((await save([{kind:'exams',id:'other',version:0,value:{...e,id:'other',specialty:'Obstbau'}}])).status,403);const approved=structuredClone(e);approved.status='used';assert.equal((await save([{kind:'exams',id:e.id,version:1,value:approved}])).status,403);});
test('stored Excel category patterns remain readable while new AP exams use fixed requirements',async()=>{
 const t=await setup(),specialty='Garten- und Landschaftsbau',pattern={id:'excel-pattern',version:1,examType:'AP',specialty,status:'confirmed',categoryCatalog:'excel-ap-2026',slots:[{categoryId:'drainage',count:1}]};
 assert.equal((await t.req('/api/save',{changes:[{kind:'patterns',id:pattern.id,version:0,value:pattern}]},t.admin)).status,200);
 const g=await group(t,specialty),p=(await t.req('/api/project',undefined,g.token)).body.project.patterns.find(p=>p.id===pattern.id);
 assert.deepEqual(p,pattern);
 const e=C.newExam({examType:'AP',specialty,examYear:2027,workshopId:'meeting'});e.pattern=P.snapshotPattern({settings:[]},p);
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,403);
 const project=(await t.req('/api/project',undefined,g.token)).body.project;e.pattern=P.snapshotPattern(project,P.pattern(project,'AP',specialty));
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,200);
 const altered=structuredClone(e);delete altered.pattern.categoryCatalog;
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:1,value:altered}]},g.token)).status,403);
});
test('optimistic revisions preserve another editor changes and reject stale overwrites atomically',async()=>{const t=await setup(),e=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'}),save=changes=>t.req('/api/save',{changes},t.admin);assert.equal((await save([{kind:'exams',id:e.id,version:0,value:e}])).status,200);assert.equal((await save([{kind:'exams',id:e.id,version:1,value:{...e,title:'Winner'}}])).status,200);const second={...e,id:'second'};assert.equal((await save([{kind:'exams',id:second.id,version:0,value:second},{kind:'exams',id:e.id,version:1,value:{...e,title:'Stale'}}])).status,409);const p=(await t.req('/api/project',undefined,t.admin)).body.project;assert.equal(p.exams.find(x=>x.id===e.id).title,'Winner');assert.ok(!p.exams.some(x=>x.id==='second'));});
test('group cannot fetch unassigned assets or attach foreign tasks',async()=>{const t=await setup(),g=await group(t);const foreign=t.seed.tasks.find(x=>x.specialty!=='Baumschule');const e=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'});e.items=directItems([foreign]);assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,403);t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('assets','secret',JSON.stringify({id:'secret',mime:'image/png',name:'secret.png',data:''}));t.DB.db.prepare('INSERT INTO assets VALUES(?,?)').run('secret','c2VjcmV0');assert.equal((await t.req('/api/assets?ids=secret',undefined,g.token)).status,404);});
test('login attempts are rate limited and malformed/oversized requests are denied',async()=>{const t=await setup();for(let i=0;i<5;i++)await t.req('/api/login',{password:'wrong'});assert.equal((await t.req('/api/login',{password:'wrong'})).status,429);const r=await handle(new Request('https://api.test/api/login',{method:'POST',headers:{Origin:t.env.ALLOWED_ORIGIN,'Content-Type':'application/json'},body:'x'.repeat(20000)}),t.env);assert.equal(r.status,413);});

test('group can save and copy approved custom snapshots after source sanitization',async()=>{const t=await setup(),g=await group(t);const task=t.seed.tasks.find(x=>x.specialty==='Baumschule'&&x.kind==='practical');task.text='Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Synthetisches Beispiel.\n'+task.text;assert.equal((await t.req('/api/save',{changes:[{kind:'tasks',id:task.id,version:1,value:task}]},t.admin)).status,200);const e=workflowExam(t.seed,task.examType,task.specialty);e.pattern.slots=[{categoryId:'plantwork',count:1}];C.addItem(e,task);e.items[0].task.text+='\nFachlich angepasste Fassung';e.items[0].task.solution='Freigegebene Lösung';e.items[0].task.reviewStatus='approved';e.items[0].task.solutionStatus='approved';e.items[0].task.reviewedBy='Koordination';const asset=t.seed.assets[0];if(asset)e.items[0].task.assetLinks.push({assetId:asset.id,audience:'source',caption:'Original'});const saved=await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},t.admin);assert.equal(saved.status,200,JSON.stringify(saved.body));const p=(await t.req('/api/project',undefined,g.token)).body.project;const visible=p.exams.find(x=>x.id===e.id);visible.title+=' · Neuer Titel';assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:1,value:visible}]},g.token)).status,200);const copied={...structuredClone(visible),id:'copy-checked',basedOnExamId:e.id};copied.pattern=P.snapshotPattern(p,P.pattern(p,copied.examType,copied.specialty));copied.pattern.slots=[{categoryId:'plantwork',count:1}];const copiedResult=await t.req('/api/save',{changes:[{kind:'exams',id:copied.id,version:0,value:copied}]},g.token);assert.equal(copiedResult.status,200,JSON.stringify(copiedResult.body));visible.items[0].task.text+=' unerlaubt freigegeben';assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:2,value:visible}]},g.token)).status,403);});

test('large private assets are chunked and retrieved unchanged only after authorization',async()=>{const t=await setup(),data='YQ=='.repeat(160000),a={id:'large-private',name:'large.png',mime:'image/png',data:''};assert.equal((await t.req('/api/asset/upload',{asset:{id:a.id,data}},t.admin)).status,200);assert.ok(t.DB.db.prepare('SELECT count(*) AS n FROM asset_chunks WHERE id=?').get(a.id).n>1);assert.equal((await t.req('/api/save',{changes:[{kind:'assets',id:a.id,version:0,value:a}]},t.admin)).status,200);assert.equal((await t.req('/api/assets?ids='+a.id,undefined,t.admin)).body.assets[0].data,data);assert.equal((await t.req('/api/asset/upload',{asset:{id:a.id,data:'Yg=='}},t.admin)).status,409);});

test('bulk record saves stay within D1 query and parameter limits',async()=>{const t=await setup();t.DB.queries=0;const changes=Array.from({length:180},(_,i)=>({kind:'families',id:'batch-family-'+i,version:0,value:{id:'batch-family-'+i,title:'Batch family '+i,reviewStatus:'review'}}));const r=await t.req('/api/save',{changes},t.admin);assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(t.DB.queries<50);assert.equal(t.DB.db.prepare("SELECT count(*) AS n FROM records WHERE id LIKE 'batch-family-%'").get().n,180);});

for(const hours of [24,48])test(hours+'-hour invitations survive coordinator logout and expire at the selected boundary',async()=>{const originalNow=Date.now;let clock=originalNow();Date.now=()=>clock;try{const t=await setup(),expires=clock+hours*3600000;let r=await t.req('/api/access/open',{meetingId:'meeting',expires},t.admin);assert.equal(r.status,200);assert.equal(r.body.expires,expires);const invitation=r.body.invitations.find(i=>i.specialty==='Baumschule').token;assert.equal((await t.req('/api/access/open',{meetingId:'meeting',expires:clock+48*3600000+1},t.admin)).status,400);assert.equal(t.DB.db.prepare('SELECT expires FROM invites WHERE hash=?').get(await hashToken(invitation)).expires,expires);await t.req('/api/logout',{},t.admin);clock+=(hours-1)*3600000;const joined=await t.req('/api/join',{invitation,label:'Nächster Tag'});assert.equal(joined.status,200);const admin=(await t.req('/api/login',{password:'test-only-long-password-123456789'})).body.token;const board=(await t.req('/api/access',undefined,admin)).body;const pending=board.requests.find(r=>r.code===joined.body.code);assert.equal((await t.req('/api/access/approve',{requestId:pending.id},admin)).status,200);assert.equal((await t.req('/api/session',undefined,joined.body.token)).body.expires,expires);assert.equal((await t.req('/api/project',undefined,joined.body.token)).status,200);clock=expires;assert.equal((await t.req('/api/session',undefined,joined.body.token)).status,401);assert.equal((await t.req('/api/join',{invitation,label:'Abgelaufen'})).status,401);}finally{Date.now=originalNow;}});
test('48-hour invitations and approved devices can be revoked early',async()=>{
 const t=await setup(),opened=await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+48*3600000},t.admin);assert.equal(opened.status,200);const invitation=opened.body.invitations[0].token;
 const joined=await t.req('/api/join',{invitation,label:'Tablet'}),board=(await t.req('/api/access',undefined,t.admin)).body,pending=board.requests.find(r=>r.code===joined.body.code);
 assert.equal((await t.req('/api/access/approve',{requestId:pending.id},t.admin)).status,200);assert.equal((await t.req('/api/access/revoke',{requestId:pending.id},t.admin)).status,200);assert.equal((await t.req('/api/project',undefined,joined.body.token)).status,401);
 assert.equal((await t.req('/api/access/close',{meetingId:'meeting'},t.admin)).status,200);assert.equal((await t.req('/api/join',{invitation,label:'Again'})).status,401);
});
test('only admins can trash or restore drafts; groups cannot read or overwrite them',async()=>{const t=await setup(),g=await group(t),e=await completeStructureExam(t),save=(value,version,token=t.admin)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},token);assert.equal((await save(e,0)).status,200);const deleted={...e,deletedAt:new Date().toISOString()};assert.equal((await save(deleted,1,g.token)).status,403);assert.equal((await save(deleted,1)).status,200);assert.ok(!(await t.req('/api/project',undefined,g.token)).body.project.exams.some(x=>x.id===e.id));assert.equal((await save(e,2,g.token)).status,403);assert.equal((await save(e,2)).status,200);const used={...e,status:'used'};assert.equal((await save(used,3)).status,200);assert.equal((await save({...used,deletedAt:deleted.deletedAt},4)).status,400);assert.equal((await save(null,4)).status,400);});
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
 const g=await group(t,'Gemüsebau'),project=(await t.req('/api/project',undefined,g.token)).body.project,e=workflowExam(project,'FW_AP','Gemüsebau');C.addItem(e,fw);
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,200);
 const mixed=structuredClone(e);mixed.id='mixed';mixed.examType='AP';assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:mixed.id,version:0,value:mixed}]},g.token)).status,403);
 const other=await group(t,'Baumschule'),invalid={...C.newExam({examType:'AP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'}),examType:'FW_AP'};
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:invalid.id,version:0,value:invalid}]},other.token)).status,403);
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

test('new ZP patterns round-trip and reject group selections of combinations or repeated themes',async()=>{
 const t=await setup(),base=t.seed.tasks[0];
 const single={...structuredClone(base),planningCategoryCatalog:'zp-general-2026',planningCategories:['plantwork']},combo={...structuredClone(t.seed.tasks[1]),planningCategoryCatalog:'zp-general-2026',planningCategories:['plantwork','propagation']};
 const saved=await t.req('/api/save',{changes:[single,combo].map(value=>({kind:'tasks',id:value.id,version:1,value}))},t.admin);assert.equal(saved.status,200,JSON.stringify(saved.body));
 const g=await group(t),d=(await t.req('/api/project',undefined,g.token)).body.project;
 const e=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting',pattern:P.snapshotPattern(d,P.pattern(d,'ZP','Baumschule'))});assert.equal(e.pattern.categoryCatalog,'zp-general-2026');C.addItem(e,d.tasks.find(x=>x.id===single.id));
 const save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},g.token);assert.equal((await save(e,0)).status,200);
 const invalid=structuredClone(e);invalid.items.push({id:'combined-item',originTaskId:combo.id,task:d.tasks.find(x=>x.id===combo.id)});assert.equal((await save(invalid,1)).status,400);
 invalid.items[1]={id:'same-theme',originTaskId:single.id,task:structuredClone(invalid.items[0].task)};assert.equal((await save(invalid,1)).status,400);
 const changed=structuredClone(e);changed.items[0].task.planningCategories=['plantwork','propagation'];changed.items[0].task.reviewStatus='review';changed.items[0].task.solutionStatus='draft';assert.equal((await save(changed,1)).status,400);
 e.title+=' · bearbeitet';assert.equal((await save(e,1)).status,200);
});

test('internal exam remarks round-trip within group permissions and reject malformed values',async()=>{
 const t=await setup(),g=await group(t),e=await completeStructureExam(t);e.internalNotes='Ausschuss an Koordination:\n<Material> & Termin klären.';const save=(value,version,token=g.token)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},token);
 assert.equal((await save(e,0)).status,200);for(const token of [g.token,t.admin])assert.equal((await t.req('/api/project',undefined,token)).body.project.exams.find(x=>x.id===e.id).internalNotes,e.internalNotes);
 for(const internalNotes of [null,{},42,'x'.repeat(20001)])assert.equal((await save({...e,internalNotes},1)).status,400);
 const foreign=await group(t,'Obstbau');assert.ok(!(await t.req('/api/project',undefined,foreign.token)).body.project.exams.some(x=>x.id===e.id));assert.equal((await save({...e,internalNotes:'Fremde Änderung'},1,foreign.token)).status,403);
 const active=await group(t),used={...e,status:'used'};assert.equal((await save(used,1,t.admin)).status,200);assert.equal((await save({...used,internalNotes:'Nachträgliche Änderung'},2,active.token)).status,403);
});

test('group draft handoff timestamps round-trip without marking use or approval',async()=>{
 const t=await setup(),g=await group(t),e=await completeStructureExam(t);e.submittedAt=e.updatedAt='2026-11-03T12:34:56.000Z';const save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},g.token);assert.equal((await save(e,0)).status,200);
 const d=(await t.req('/api/project',undefined,t.admin)).body.project,saved=d.exams.find(x=>x.id===e.id);assert.equal(saved.submittedAt,e.submittedAt);assert.equal(saved.status,'draft');assert.ok(!d.uses.some(u=>u.examId===e.id));for(const submittedAt of [null,42,{},'yesterday','2026-11-03'])assert.equal((await save({...e,submittedAt},1)).status,400);
});

const workflowSettings=(examType='ZP',specialty='*',categories=[])=>({id:`planning:${examType}:${specialty}`,schemaVersion:1,revision:1,examType,specialty,categories,defaults:{title:'Prüfung {jahr}',notes:'Organisatorischer Standard',targetMinutes:60}});
function workflowExam(d,examType='ZP',specialty='Baumschule'){return C.newExam({examType,specialty,examYear:2027,workshopId:'meeting',pattern:P.snapshotPattern(d,P.pattern(d,examType,specialty))});}
async function workflowTasks(t,specs){const tasks=specs.map(({id,...patch})=>{const task={...structuredClone(t.seed.tasks[0]),id,familyId:id+'-family',examType:'ZP',specialty:'Baumschule',kind:'practical',title:'Synthetische Arbeitsaufgabe',text:'Aufgabe: Durchführen von Arbeiten an der Pflanze\nHier: Synthetischer Arbeitsauftrag.',sourceIds:[],assetLinks:[],reviewStatus:'review',solutionStatus:'missing',solution:'',...patch};for(const key of ['planningCategories','planningCategoryCatalog','planningCategoryEvidence','practicalUnits','sourceLayout','materials'])delete task[key];return task;});const changes=tasks.flatMap(task=>[{kind:'families',id:task.familyId,version:0,value:{id:task.familyId,title:'Synthetische Familie'}},{kind:'tasks',id:task.id,version:0,value:task}]);const r=await t.req('/api/save',{changes},t.admin);assert.equal(r.status,200,JSON.stringify(r.body));return tasks;}

test('planning settings persist with optimistic locks and only relevant scopes reach a group',async()=>{
 const t=await setup(),records=[workflowSettings(),workflowSettings('AP','Baumschule'),workflowSettings('AP','Obstbau'),workflowSettings('FW_AP','Gemüsebau')],save=(value,version,token=t.admin)=>t.req('/api/save',{changes:[{kind:'settings',id:value.id,version,value}]},token);
 for(const record of records)assert.equal((await save(record,0)).status,200);const g=await group(t),view=(await t.req('/api/project',undefined,g.token)).body;assert.deepEqual(view.project.settings.map(r=>r.id).sort(),['planning:AP:Baumschule','planning:ZP:*']);assert.ok(!Object.keys(view.versions).includes('settings:planning:AP:Obstbau'));
 assert.equal((await save({...records[0],revision:2},1,g.token)).status,403);const next={...records[0],revision:2,categories:[{id:'plantwork',label:'Abgestimmtes Thema'}]};assert.equal((await save(next,1)).status,200);assert.equal((await save({...next,revision:3},1)).status,409);assert.equal((await save({...next,id:'different-id'},0)).status,400);
 const current=(await t.req('/api/project',undefined,t.admin)).body.project.settings.find(r=>r.id===next.id);assert.deepEqual(current,next);
});

test('new group ZP snapshots allow active theme subsets but reject omitted or forged definitions',async()=>{
 const t=await setup();await workflowTasks(t,[{id:'zp-subset'}]);const settings=workflowSettings('ZP','*',[{id:'soil',hidden:true}]);assert.equal((await t.req('/api/save',{changes:[{kind:'settings',id:settings.id,version:0,value:settings}]},t.admin)).status,200);const g=await group(t),d=(await t.req('/api/project',undefined,g.token)).body.project,e=workflowExam(d),save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},g.token);
 const omitted={...e,id:'omitted-snapshot'};delete omitted.pattern;assert.equal((await save(omitted,0)).status,403);e.pattern.slots=[{categoryId:'plantwork',count:1}];assert.equal((await save(e,0)).status,200);
 for(const change of [p=>p.categoryDefinitions[0].label='Forged',p=>p.settingsRevision++,p=>p.note='Unauthorized metadata']){const invalid=structuredClone(e);change(invalid.pattern);assert.equal((await save(invalid,1)).status,403);}
 for(const slots of [[{categoryId:'soil',count:1}],[{categoryId:'plantwork',count:2}],[{categoryId:'plantwork',count:1},{categoryId:'plantwork',count:1}]])assert.equal((await save({...e,pattern:{...e.pattern,slots}},1)).status,400);
 const subset={...e,pattern:{...e.pattern,slots:[]}};assert.equal((await save(subset,1)).status,200);assert.deepEqual((await t.req('/api/project',undefined,g.token)).body.project.exams.find(x=>x.id===e.id).pattern.slots,[]);
});

test('legacy ZP drafts remain editable but legacy copies must adopt a snapshot and reject combined tasks',async()=>{
 const t=await setup(),[combo]=await workflowTasks(t,[{id:'legacy-combination',text:'Aufgabe: Erntearbeiten und Aufbereitung\nHier: Synthetisches Beispiel.'}]),legacy=C.newExam({examType:'ZP',specialty:'Baumschule',examYear:2027,workshopId:'meeting'});legacy.items=directItems([combo]);delete legacy.structureRequirementVersion;t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('exams',legacy.id,JSON.stringify(legacy));const save=(value,version,token)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},token);const g=await group(t),d=(await t.req('/api/project',undefined,g.token)).body.project;legacy.title+=' bearbeitet';assert.equal((await save(legacy,1,g.token)).status,200);
 const copied={...structuredClone(legacy),id:'legacy-copy',basedOnExamId:legacy.id};assert.equal((await save(copied,0,g.token)).status,403);copied.pattern=workflowExam(d).pattern;assert.equal((await save(copied,0,g.token)).status,400);
});

test('new oral components stay scoped, hide source assets and cannot enter practical items',async()=>{
 const t=await setup(),[oral,foreign,zpOral]=await workflowTasks(t,[{id:'oral-ap',examType:'AP',kind:'oral'},{id:'oral-other',examType:'AP',kind:'oral',specialty:'Obstbau'},{id:'oral-zp',kind:'oral'}]);
 for(const id of ['oral-visible','oral-source']){t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('assets',id,JSON.stringify({id,name:id+'.png',mime:'image/png',data:''}));t.DB.db.prepare('INSERT INTO assets VALUES(?,?)').run(id,'YQ==');}oral.assetLinks=[{assetId:'oral-visible',audience:'candidate',caption:'Anlage'},{assetId:'oral-source',audience:'source',caption:'Original'}];assert.equal((await t.req('/api/save',{changes:[{kind:'tasks',id:oral.id,version:1,value:oral}]},t.admin)).status,200);
 const g=await group(t),d=(await t.req('/api/project',undefined,g.token)).body.project;assert.ok(d.tasks.some(x=>x.id===oral.id));assert.ok(!d.tasks.some(x=>[foreign.id,zpOral.id].includes(x.id)));assert.ok(d.assets.some(x=>x.id==='oral-visible'));assert.ok(!d.assets.some(x=>x.id==='oral-source'));assert.equal((await t.req('/api/assets?ids=oral-source',undefined,g.token)).status,404);
 const e=workflowExam(d,'AP'),save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},g.token);delete e.oralRequirementVersion;delete e.materialRequirementVersion;assert.equal((await save(e,0)).status,200);const stored=(await t.req('/api/project',undefined,g.token)).body.project.exams.find(x=>x.id===e.id);assert.equal(stored.oralRequirementVersion,1);assert.equal(stored.materialRequirementVersion,1);
 const submitted={...stored,submittedAt:'2026-11-03T15:00:00.000Z',updatedAt:'2026-11-03T15:00:00.000Z'};assert.equal((await save(submitted,1)).status,400);C.setOralItem(stored,d.tasks.find(x=>x.id===oral.id));assert.equal((await save(stored,1)).status,200);
 const forged=structuredClone(stored);forged.oralItem.task.assetLinks.push({assetId:'oral-source',audience:'candidate',caption:'Leak'});assert.equal((await save(forged,2)).status,403);const wrong={...structuredClone(stored),oralItem:{id:'foreign-oral',originTaskId:foreign.id,task:foreign}};assert.equal((await save(wrong,2)).status,403);const duplicate={...structuredClone(stored),items:[structuredClone(stored.oralItem)]};assert.equal((await save(duplicate,2)).status,403);
 const foreignSource=structuredClone(stored);foreignSource.oralItem.task.sourceIds=[t.seed.sources[0].id];foreignSource.oralItem.task.reviewStatus='review';foreignSource.oralItem.task.solutionStatus='missing';assert.equal((await save(foreignSource,2)).status,403);const malformedLinks=structuredClone(stored);malformedLinks.oralItem.task.assetLinks=[null];assert.equal((await save(malformedLinks,2)).status,400);
 const zp=workflowExam(d);zp.oralItem=structuredClone(stored.oralItem);assert.equal((await save(zp,0)).status,403);
});

test('materials-only edits preserve approved snapshot content but cannot smuggle content changes or approval',async()=>{
 const t=await setup(),[task]=await workflowTasks(t,[{id:'approved-materials',reviewStatus:'approved',solutionStatus:'approved',solution:'Freigegebene synthetische Lösung.',reviewedBy:'Koordination'}]),g=await group(t),d=(await t.req('/api/project',undefined,g.token)).body.project,e=workflowExam(d);C.addItem(e,d.tasks.find(x=>x.id===task.id));const save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},g.token);assert.equal((await save(e,0)).status,200);
 e.items[0].task.materials={text:'Schalen und Etiketten',status:'confirmed',method:'manual',evidence:[]};assert.equal((await save(e,1)).status,200);assert.equal(e.items[0].task.reviewStatus,'approved');const changed=structuredClone(e);changed.items[0].task.text+=' Unerlaubte Inhaltsänderung.';assert.equal((await save(changed,2)).status,403);const forged=structuredClone(e);forged.items[0].task.materials.evidence=[{quote:'Fremde Quelle',sourceId:'foreign-source'}];assert.equal((await save(forged,2)).status,400);
});

test('workshop exam-type restrictions block new group exams and copies but preserve existing drafts',async()=>{
 const t=await setup(),g=await group(t),d=(await t.req('/api/project',undefined,g.token)).body.project,old=workflowExam(d,'AP'),save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},g.token);assert.equal((await save(old,0)).status,200);const w={...t.seed.workshops[0],examTypesBySpecialty:{Baumschule:['ZP']}};assert.equal((await t.req('/api/save',{changes:[{kind:'workshops',id:w.id,version:1,value:w}]},t.admin)).status,200);
 old.title+=' weiterbearbeitet';assert.equal((await save(old,1)).status,200);assert.equal((await save(workflowExam(d,'AP'),0)).status,403);assert.equal((await save({...structuredClone(old),id:'forbidden-copy',basedOnExamId:old.id},0)).status,403);const zp=workflowExam(d);assert.equal((await save(zp,0)).status,200);const converted={...zp,examType:'AP',pattern:old.pattern};assert.equal((await save(converted,1)).status,403);
});

test('AP and FW theme preferences use authorized snapshot categories without changing practical rules',async()=>{
 const t=await setup(),settings=workflowSettings('AP','Baumschule',[{id:'propagation',hidden:true}]);assert.equal((await t.req('/api/save',{changes:[{kind:'settings',id:settings.id,version:0,value:settings}]},t.admin)).status,200);const g=await group(t),d=(await t.req('/api/project',undefined,g.token)).body.project,e=workflowExam(d,'AP'),save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},g.token);e.selectedCategoryIds=['plantwork'];assert.equal((await save(e,0)).status,200);assert.equal(P.regulationProfile(e).totalTasks,5);for(const ids of [['propagation'],['forged'],['plantwork','plantwork']])assert.equal((await save({...e,selectedCategoryIds:ids},1)).status,400);const altered=structuredClone(e);altered.pattern.slots=[{categoryId:'plantwork',count:1}];assert.equal((await save(altered,1)).status,403);
});

test('referenced custom settings categories cannot be removed by deleting the settings record',async()=>{
 const t=await setup(),id='custom-12345678-1234-1234-1234-123456789abc',r=workflowSettings('ZP','*',[{id,label:'Zusätzliches synthetisches Thema'}]),save=value=>t.req('/api/save',{changes:[{kind:'settings',id:r.id,version:1,value}]},t.admin);assert.equal((await t.req('/api/save',{changes:[{kind:'settings',id:r.id,version:0,value:r}]},t.admin)).status,200);const project=(await t.req('/api/project',undefined,t.admin)).body.project,e=workflowExam(project);e.pattern.slots=[{categoryId:id,count:1}];assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},t.admin)).status,200);assert.equal((await save(null)).status,400);assert.equal((await save({...r,revision:2,categories:[]})).status,400);assert.equal((await save({...r,revision:2,categories:[{id,label:'Zusätzliches synthetisches Thema',hidden:true}]})).status,200);
});

test('trusted historical admin imports stay legacy while new drafts and group copies derive current requirements',async()=>{
 const t=await setup(),legacy=C.newExam({examType:'AP',specialty:'Baumschule',examYear:2026});delete legacy.oralRequirementVersion;delete legacy.materialRequirementVersion;delete legacy.structureRequirementVersion;legacy.status='used';const save=(value,version,token=t.admin)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},token);const imported=await save(legacy,0);assert.equal(imported.status,200,JSON.stringify(imported.body));const oldYear={...structuredClone(legacy),id:'pre-2026-archive',status:'draft',examYear:2025};assert.equal((await save(oldYear,0)).status,200);
 let d=(await t.req('/api/project',undefined,t.admin)).body.project;for(const id of [legacy.id,oldYear.id]){const stored=d.exams.find(e=>e.id===id);assert.equal(stored.oralRequirementVersion,undefined);assert.equal(stored.materialRequirementVersion,undefined);}
 const current={...structuredClone(oldYear),id:'current-admin-draft',examYear:2027};assert.equal((await save(current,0)).status,200);d=(await t.req('/api/project',undefined,t.admin)).body.project;assert.equal(d.exams.find(e=>e.id===current.id).oralRequirementVersion,1);
 const assignedArchive={...structuredClone(legacy),id:'assigned-historical-archive',examYear:2027,workshopId:'meeting'};assert.equal((await save(assignedArchive,0)).status,200);const g=await group(t),visible=(await t.req('/api/project',undefined,g.token)).body.project,copy={...structuredClone(assignedArchive),id:'legacy-group-copy',status:'draft',basedOnExamId:assignedArchive.id,pattern:P.snapshotPattern(visible,P.pattern(visible,'AP','Baumschule'))};const copied=await save(copy,0,g.token);assert.equal(copied.status,200,JSON.stringify(copied.body));d=(await t.req('/api/project',undefined,g.token)).body.project;assert.equal(d.exams.find(e=>e.id===copy.id).oralRequirementVersion,1);assert.equal(d.exams.find(e=>e.id===copy.id).materialRequirementVersion,1);
});

test('Fachwerker oral selection never borrows Gärtner oral tasks and remains optional until handoff',async()=>{
 const t=await setup(),tasks=await workflowTasks(t,[{id:'oral-fw',examType:'FW_AP',specialty:'Gemüsebau',kind:'oral'},{id:'oral-gardener',examType:'AP',specialty:'Gemüsebau',kind:'oral'},{id:'practical-fw',examType:'FW_AP',specialty:'Gemüsebau',text:'Aufgabe: Durchführen von Bodenbearbeitungsmaßnahmen\nHier: Synthetische Tätigkeit.'}]),g=await group(t,'Gemüsebau'),d=(await t.req('/api/project',undefined,g.token)).body.project,e=workflowExam(d,'FW_AP','Gemüsebau'),save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},g.token);assert.equal((await save(e,0)).status,200);
 const wrong={...e,oralItem:{id:'wrong-oral',originTaskId:tasks[1].id,task:tasks[1]}};assert.equal((await save(wrong,1)).status,403);C.setOralItem(e,d.tasks.find(t=>t.id===tasks[0].id));e.submittedAt=e.updatedAt='2026-11-03T16:00:00.000Z';assert.equal((await save(e,1)).status,400);e.items=(await completeStructureExam(t,'FW_AP','Gemüsebau')).items;assert.equal((await save(e,1)).status,200);const stored=(await t.req('/api/project',undefined,g.token)).body.project.exams.find(x=>x.id===e.id);assert.equal(stored.oralItem.originTaskId,tasks[0].id);assert.equal(stored.status,'draft');
});


test('authorized exam snapshots remain stable after central category settings change',async()=>{
 const t=await setup(),g=await group(t),d=(await t.req('/api/project',undefined,g.token)).body.project,e=workflowExam(d),save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},g.token);e.pattern.slots=[{categoryId:'plantwork',count:1}];assert.equal((await save(e,0)).status,200);const settings=workflowSettings('ZP','*',[{id:'plantwork',hidden:true,label:'Neue zentrale Bezeichnung'}]);assert.equal((await t.req('/api/save',{changes:[{kind:'settings',id:settings.id,version:0,value:settings}]},t.admin)).status,200);e.title+=' alte Vorgabe';assert.equal((await save(e,1)).status,200);const copy={...structuredClone(e),id:'stable-snapshot-copy',basedOnExamId:e.id};assert.equal((await save(copy,0)).status,200);const current=(await t.req('/api/project',undefined,g.token)).body.project;assert.equal(current.exams.find(x=>x.id===e.id).pattern.categoryDefinitions.find(x=>x.id==='plantwork').hidden,false);assert.equal(current.settings[0].categories[0].hidden,true);
});

async function invitationAdmin(t){return (await t.req('/api/login',{password:'test-only-long-password-123456789'})).body.token;}
const invitationRead=(t,token=t.admin)=>t.req('/api/access/invitations',{meetingId:'meeting'},token);
function invitationState(t){return {access:t.DB.db.prepare('SELECT * FROM access').all(),invites:t.DB.db.prepare('SELECT * FROM invites ORDER BY hash').all(),sessions:t.DB.db.prepare('SELECT * FROM sessions ORDER BY hash').all(),codes:t.DB.db.prepare('SELECT * FROM invitation_codes ORDER BY specialty').all()};}

test('active invitation codes survive admin logout and a fresh login without changing approved devices',async()=>{
 const t=await setup(),g=await group(t),before=await invitationRead(t);assert.equal(before.status,200,JSON.stringify(before.body));const state=invitationState(t);await t.req('/api/logout',{},t.admin);const admin=await invitationAdmin(t),after=await invitationRead(t,admin);assert.equal(after.status,200);assert.deepEqual(after.body,before.body);assert.equal(after.body.supplemented,false);assert.equal(after.body.invitations.find(i=>i.specialty==='Baumschule').token,g.invite);assert.equal((await t.req('/api/project',undefined,g.token)).status,200);assert.deepEqual(invitationState(t).access,state.access);assert.deepEqual(invitationState(t).invites,state.invites);
 const storage=JSON.stringify(t.DB.db.prepare('SELECT * FROM invitation_codes').all()),project=JSON.stringify((await t.req('/api/export',undefined,admin)).body);for(const {token} of after.body.invitations){assert.ok(!storage.includes(token));assert.ok(!project.includes(token));}assert.equal(after.headers.get('Cache-Control'),'no-store');
});

test('invitation recovery is admin-only and never reveals inactive invitations',async()=>{
 const t=await setup(),g=await group(t);assert.equal((await invitationRead(t,g.token)).status,403);assert.equal((await invitationRead(t,null)).status,401);assert.equal((await t.req('/api/access/invitations',{meetingId:'unknown'},t.admin)).status,409);assert.equal((await t.req('/api/access/close',{meetingId:'meeting'},t.admin)).status,200);assert.equal((await invitationRead(t)).status,409);assert.equal(t.DB.db.prepare('SELECT count(*) AS n FROM invitation_codes').get().n,0);
});

test('hash-only active generations receive supplemental recoverable codes once and keep old links and devices',async()=>{
 const t=await setup(),g=await group(t),before=invitationState(t);t.DB.db.exec('DELETE FROM invitation_codes');const first=await invitationRead(t);assert.equal(first.status,200);assert.equal(first.body.supplemented,true);const second=await invitationRead(t);assert.equal(second.status,200);assert.equal(second.body.supplemented,false);assert.deepEqual(first.body.invitations,second.body.invitations);assert.notEqual(first.body.invitations.find(i=>i.specialty==='Baumschule').token,g.invite);assert.deepEqual(invitationState(t).access,before.access);assert.deepEqual(invitationState(t).sessions,before.sessions);assert.equal(invitationState(t).invites.length,before.invites.length*2);assert.equal((await t.req('/api/project',undefined,g.token)).status,200);assert.equal((await t.req('/api/join',{invitation:g.invite,label:'Old link still works'})).status,200);assert.equal((await t.req('/api/join',{invitation:first.body.invitations[0].token,label:'Recovered link works'})).status,200);
});

test('missing or invalid invitation vault keys fail before opening or altering active access',async()=>{
 const t=await setup(),g=await group(t),before=invitationState(t);for(const key of [undefined,'short','z'.repeat(64)]){t.env.INVITATION_VAULT_KEY=key;assert.equal((await invitationRead(t)).status,503);assert.equal((await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+3600000},t.admin)).status,503);assert.deepEqual(invitationState(t),before);assert.equal((await t.req('/api/project',undefined,g.token)).status,200);}t.env.INVITATION_VAULT_KEY='cd'.repeat(32);assert.equal((await invitationRead(t)).status,503);assert.equal((await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+3600000},t.admin)).status,503);assert.deepEqual(invitationState(t),before);
});

test('ciphertext and its bound metadata cannot be tampered with or silently replaced',async()=>{
 const t=await setup();await group(t);const original=invitationState(t),first=original.codes[0],second=original.codes[1];for(const patch of [{envelope:second.envelope},{envelope:'invalid-json'},{hash:'0'.repeat(64)},{expires:first.expires+1}]){const [key,value]=Object.entries(patch)[0];t.DB.db.prepare('UPDATE invitation_codes SET '+key+'=? WHERE meeting_id=? AND generation=? AND specialty=?').run(value,first.meeting_id,first.generation,first.specialty);const changed=invitationState(t);assert.equal((await invitationRead(t)).status,503);assert.deepEqual(invitationState(t),changed);t.DB.db.prepare('UPDATE invitation_codes SET '+key+'=? WHERE meeting_id=? AND generation=? AND specialty=?').run(first[key],first.meeting_id,first.generation,first.specialty);}assert.deepEqual(invitationState(t),original);
});

test('expiry and a replacement generation prevent recovery of stale codes',async()=>{
 const t=await setup(),g=await group(t),old=await invitationRead(t);t.DB.db.prepare('UPDATE access SET expires=? WHERE meeting_id=?').run(Date.now()-1,'meeting');assert.equal((await invitationRead(t)).status,409);const opened=await t.req('/api/access/open',{meetingId:'meeting',expires:Date.now()+3600000},t.admin);assert.equal(opened.status,200);assert.ok(opened.body.generation>old.body.generation);const recovered=await invitationRead(t);assert.deepEqual(recovered.body.invitations,opened.body.invitations);assert.ok(recovered.body.invitations.every(x=>!old.body.invitations.some(i=>i.token===x.token)));assert.ok(invitationState(t).codes.every(x=>x.generation===opened.body.generation));assert.equal((await t.req('/api/join',{invitation:g.invite,label:'Old generation'})).status,401);
});

test('simultaneous recovery of a legacy generation creates one canonical code per specialty',async()=>{
 const t=await setup();await group(t);t.DB.db.exec('DELETE FROM invitation_codes');const count=t.DB.db.prepare('SELECT count(*) AS n FROM invites').get().n,batch=t.DB.batch.bind(t.DB);let queue=Promise.resolve();t.DB.batch=queries=>{const result=queue.then(()=>batch(queries));queue=result.catch(()=>{});return result;};const results=await Promise.all(Array.from({length:5},()=>invitationRead(t)));for(const result of results){assert.equal(result.status,200,JSON.stringify(result.body));assert.deepEqual(result.body.invitations,results[0].body.invitations);}assert.equal(t.DB.db.prepare('SELECT count(*) AS n FROM invitation_codes').get().n,count);assert.equal(t.DB.db.prepare('SELECT count(*) AS n FROM invites').get().n,count*2);
});


for(const action of ['close','reopen'])test('recovery never returns stale codes when access '+action+' races with supplementation',async()=>{
 const t=await setup();await group(t);t.DB.db.exec('DELETE FROM invitation_codes');const batch=t.DB.batch.bind(t.DB);let intercepted=false,replacement;t.DB.batch=async queries=>{if(!intercepted&&queries.some(q=>q.sql.startsWith('INSERT OR IGNORE INTO invitation_codes'))){intercepted=true;replacement=await t.req('/api/access/'+(action==='close'?'close':'open'),{meetingId:'meeting',...(action==='reopen'?{expires:Date.now()+3600000}:{})},t.admin);assert.equal(replacement.status,200);}return batch(queries);};const recovered=await invitationRead(t);assert.equal(intercepted,true);assert.equal(recovered.status,409);const codes=t.DB.db.prepare('SELECT * FROM invitation_codes').all();if(action==='close')assert.equal(codes.length,0);else {assert.equal(codes.length,C.specialties.length);assert.ok(codes.every(c=>c.generation===replacement.body.generation));assert.deepEqual((await invitationRead(t)).body.invitations,replacement.body.invitations);}
});

test('a corrupt cached specialty prevents partial legacy supplementation',async()=>{
 const t=await setup();await group(t);const rows=t.DB.db.prepare('SELECT * FROM invitation_codes ORDER BY specialty').all();t.DB.db.prepare('DELETE FROM invitation_codes WHERE specialty=?').run(rows[0].specialty);t.DB.db.prepare('UPDATE invitation_codes SET envelope=? WHERE specialty=?').run('{}',rows[1].specialty);const before=invitationState(t);assert.equal((await invitationRead(t)).status,503);assert.deepEqual(invitationState(t),before);
});

test('groups cannot reactivate an unsupported specialty theme through a legacy nine-theme snapshot',async()=>{
 const t=await setup(),specialty='Garten- und Landschaftsbau',g=await group(t,specialty),d=(await t.req('/api/project',undefined,g.token)).body.project,e=workflowExam(d,'ZP',specialty);
 delete e.pattern.specialtyThemesVersion;e.pattern.categoryDefinitions=P.resolveCatalog(null,{examType:'ZP',specialty:'*'});e.pattern.slots=[{categoryId:'soil',count:1}];
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},t.admin)).status,200);
 const tampered=structuredClone(e);tampered.pattern.slots.push({categoryId:'harvest',count:1});
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:1,value:tampered}]},g.token)).status,400);
 e.internalNotes='Bestehenden Entwurf weiter bearbeiten';assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:1,value:e}]},g.token)).status,200);
});

test('specialty ZP settings are isolated and an explicit additional theme is available only to that group',async()=>{
 const t=await setup(),specialty='Gemüsebau',record=workflowSettings('ZP',specialty,[{id:'preparation',hidden:false}]);
 assert.equal((await t.req('/api/save',{changes:[{kind:'settings',id:record.id,version:0,value:record}]},t.admin)).status,200);
 const g=await group(t,specialty),d=(await t.req('/api/project',undefined,g.token)).body.project,e=workflowExam(d,'ZP',specialty);e.pattern.slots=[{categoryId:'preparation',count:1}];
 assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,200);
 const other=await group(t,'Garten- und Landschaftsbau'),foreign=(await t.req('/api/project',undefined,other.token)).body.project;
 assert.ok(!foreign.settings.some(r=>r.id===record.id));assert.ok(!P.categories(foreign,'ZP','Garten- und Landschaftsbau').some(c=>c.id==='preparation'));
});


function directItems(tasks){return tasks.map((task,index)=>({id:'structure-item-'+index,originTaskId:task.id,task:structuredClone(task)}));}
async function completeStructureExam(t,examType='ZP',specialty='Baumschule'){
 const count=examType==='ZP'?3:examType==='AP'?5:4,headings=examType==='ZP'?['Durchführen von Arbeiten an der Pflanze','Vermehren von Pflanzen','Durchführen von Bodenbearbeitungsmaßnahmen']:Array(count).fill('Durchführen von Arbeiten an der Pflanze');
 const tasks=await workflowTasks(t,headings.map((heading,index)=>({id:'complete-'+examType+'-'+index,examType,specialty,minutes:examType==='FW_AP'?45:60,text:'Aufgabe: '+heading+'\nHier: Synthetischer Arbeitsauftrag.'})));
 if(examType==='AP')for(const [index,task] of tasks.entries())task.practicalUnits=[{title:'Komplexe Aufgabe '+(index+1),areaId:index<3?'area1':'area2',reason:'Auftrag fachlich zugeordnet.'}];
 const e=workflowExam(t.seed,examType,specialty);if(examType==='ZP')e.pattern.slots=['plantwork','propagation','soil'].map(categoryId=>({categoryId,count:1}));e.items=directItems(tasks);
 if(examType!=='ZP'){const [oral]=await workflowTasks(t,[{id:'complete-oral-'+examType,examType,specialty,kind:'oral',minutes:15}]);e.oralItem={id:'structure-oral',originTaskId:oral.id,task:oral};}
 return e;
}

test('current structure limits reject tampered task counts for groups and admins without trusting the marker',async()=>{
 for(const [examType,specialty,count] of [['ZP','Baumschule',3],['AP','Baumschule',5],['FW_AP','Gemüsebau',4]]){
  const t=await setup(),e=await completeStructureExam(t,examType,specialty),g=await group(t,specialty),save=(value,version,token)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},token);
  delete e.structureRequirementVersion;assert.equal((await save(e,0,g.token)).status,200);const stored=(await t.req('/api/project',undefined,t.admin)).body.project.exams.find(x=>x.id===e.id);assert.equal(stored.structureRequirementVersion,1);
  const tooMany=structuredClone(e);if(examType==='AP')tooMany.items[0].task.practicalUnits.push({title:'Zusätzliche komplexe Aufgabe',areaId:'area1',reason:'Zusätzlich gezählter eigenständiger Auftrag.'});else {const [extra]=await workflowTasks(t,[{id:'extra-structure-task',examType,specialty,minutes:10}]);tooMany.items.push({id:'extra-structure-item',originTaskId:extra.id,task:extra});for(const item of tooMany.items)item.task.minutes=10;}delete tooMany.structureRequirementVersion;
  for(const token of [g.token,t.admin]){const r=await save(tooMany,1,token);assert.equal(r.status,400,JSON.stringify(r.body));assert.match(r.body.error,/Aufgabe|höchstens|maximal|Struktur/i);}
  const persisted=(await t.req('/api/project',undefined,t.admin)).body.project.exams.find(x=>x.id===e.id);assert.equal(persisted.items.length,count);assert.equal(persisted.structureRequirementVersion,1);
 }
});

test('structure requirements block incomplete handoff and mark-used after client markers are removed',async()=>{
 const t=await setup(),g=await group(t),e=workflowExam(t.seed),save=(value,version,token=g.token)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},token);
 delete e.structureRequirementVersion;assert.equal((await save(e,0)).status,200);
 for(const token of [g.token,t.admin])assert.equal((await save({...e,submittedAt:'2026-11-03T18:00:00.000Z',updatedAt:'2026-11-03T18:00:00.000Z'},1,token)).status,400);
 assert.equal((await save({...e,status:'used'},1,t.admin)).status,400);
 const complete=await completeStructureExam(t);complete.submittedAt=complete.updatedAt='2026-11-03T18:00:00.000Z';assert.equal((await save(complete,0)).status,200);assert.equal((await save({...complete,status:'used'},1,t.admin)).status,200);
});

test('current structure enforces time ceilings and AP area feasibility on both save roles',async()=>{
 for(const [examType,specialty] of [['ZP','Baumschule'],['AP','Baumschule'],['FW_AP','Gemüsebau']]){
  const t=await setup(),e=await completeStructureExam(t,examType,specialty),g=await group(t,specialty),save=(value,version,token)=>t.req('/api/save',{changes:[{kind:'exams',id:value.id,version,value}]},token);assert.equal((await save(e,0,g.token)).status,200);
  const over=structuredClone(e);over.items[0].task.minutes++;delete over.structureRequirementVersion;for(const token of [g.token,t.admin])assert.equal((await save(over,1,token)).status,400);
  if(examType==='AP'){const impossible=structuredClone(e);for(const item of impossible.items)item.task.practicalUnits[0].areaId='area2';for(const token of [g.token,t.admin])assert.equal((await save(impossible,1,token)).status,400);}
 }
});

test('new ZP drafts allow at most three selected themes even without client structure markers',async()=>{
 const t=await setup(),g=await group(t),e=workflowExam(t.seed);e.pattern.slots=['plantwork','propagation','soil','maintenance'].map(categoryId=>({categoryId,count:1}));delete e.structureRequirementVersion;
 for(const token of [g.token,t.admin])assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},token)).status,400);
 e.pattern.slots.pop();assert.equal((await t.req('/api/save',{changes:[{kind:'exams',id:e.id,version:0,value:e}]},g.token)).status,200);
});

test('legacy invalid current drafts remain readable and autosave only when violations do not worsen',async()=>{
 const t=await setup(),e=await completeStructureExam(t);delete e.structureRequirementVersion;e.items.push({...structuredClone(e.items[0]),id:'legacy-extra-item'});e.pattern.slots.push({categoryId:'maintenance',count:1});t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('exams',e.id,JSON.stringify(e));const g=await group(t),save=(value,version,token=g.token)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},token);
 const loaded=(await t.req('/api/project',undefined,g.token)).body.project.exams.find(x=>x.id===e.id);assert.deepEqual(loaded.items,e.items);e.internalNotes='Unveränderten Altentwurf ergänzen.';assert.equal((await save(e,1)).status,200);
 const worse=structuredClone(e);worse.items.push({...structuredClone(e.items[0]),id:'another-legacy-extra'});for(const token of [g.token,t.admin])assert.equal((await save(worse,2,token)).status,400);
 assert.equal((await save({...e,submittedAt:'2026-11-03T19:00:00.000Z',updatedAt:'2026-11-03T19:00:00.000Z'},2)).status,400);assert.equal((await save({...e,status:'used'},2,t.admin)).status,400);
 e.items.pop();e.pattern.slots.pop();assert.equal((await save(e,2)).status,200);assert.equal((await save({...e,submittedAt:'2026-11-03T19:01:00.000Z',updatedAt:'2026-11-03T19:01:00.000Z'},3)).status,200);
});

test('unmodified historical used exams survive unrelated saves without structure migration',async()=>{
 const t=await setup(),legacy=workflowExam(t.seed);delete legacy.structureRequirementVersion;delete legacy.materialRequirementVersion;legacy.status='used';legacy.items=[];t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('exams',legacy.id,JSON.stringify(legacy));
 const fresh=workflowExam(t.seed),changes=[{kind:'exams',id:legacy.id,version:1,value:legacy},{kind:'exams',id:fresh.id,version:0,value:fresh}];assert.equal((await t.req('/api/save',{changes},t.admin)).status,200);const stored=(await t.req('/api/project',undefined,t.admin)).body.project.exams.find(e=>e.id===legacy.id);assert.deepEqual(stored,legacy);
});


test('AP and Fachwerker handoff needs every practical task even when the oral task is selected',async()=>{
 for(const [examType,specialty] of [['AP','Baumschule'],['FW_AP','Gemüsebau']]){
  const t=await setup(),e=await completeStructureExam(t,examType,specialty),g=await group(t,specialty),save=(value,version,token)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},token),last=e.items.pop();delete e.structureRequirementVersion;assert.equal((await save(e,0,g.token)).status,200);
  const submitted={...e,submittedAt:'2026-11-03T20:00:00.000Z',updatedAt:'2026-11-03T20:00:00.000Z'};for(const token of [g.token,t.admin])assert.equal((await save(submitted,1,token)).status,400);assert.equal((await save({...e,status:'used'},1,t.admin)).status,400);
  e.items.push(last);const completed={...e,submittedAt:submitted.submittedAt,updatedAt:submitted.updatedAt};assert.equal((await save(completed,1,g.token)).status,200);assert.equal((await save({...completed,status:'used'},2,t.admin)).status,200);
 }
});

test('Fachwerker drafts may plan less time but handoff requires the full 180 practical minutes',async()=>{
 const t=await setup(),e=await completeStructureExam(t,'FW_AP','Gemüsebau'),g=await group(t,'Gemüsebau'),save=(value,version,token)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},token);e.items[0].task.minutes=44;assert.equal((await save(e,0,g.token)).status,200);
 const submitted={...e,submittedAt:'2026-11-03T20:30:00.000Z',updatedAt:'2026-11-03T20:30:00.000Z'};for(const token of [g.token,t.admin])assert.equal((await save(submitted,1,token)).status,400);e.items[0].task.minutes=45;assert.equal((await save({...e,submittedAt:submitted.submittedAt,updatedAt:submitted.updatedAt},1,g.token)).status,200);
});


test('server-derived markers do not turn repeated legacy autosaves into a fresh handoff',async()=>{
 const t=await setup(),e=workflowExam(t.seed);delete e.structureRequirementVersion;e.submittedAt=e.updatedAt='2026-11-02T20:30:00.000Z';t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('exams',e.id,JSON.stringify(e));
 const g=await group(t),save=version=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value:e}]},g.token);assert.equal((await save(1)).status,200);assert.equal((await save(2)).status,200);const stored=(await t.req('/api/project',undefined,g.token)).body.project.exams.find(x=>x.id===e.id);assert.equal(stored.submittedAt,e.submittedAt);assert.equal(stored.structureRequirementVersion,1);
});

test('AP handoff rejects hidden snapshot categories without blocking legacy note autosaves',async()=>{
 const t=await setup(),e=await completeStructureExam(t,'AP','Baumschule');
 const category=P.classify(e.items[0].task,{context:P.examContext(e)}).ids[0];assert.ok(category);e.pattern.categoryDefinitions.find(c=>c.id===category).hidden=true;
 t.DB.db.prepare('INSERT INTO records VALUES(?,?,?,1)').run('exams',e.id,JSON.stringify(e));const g=await group(t),save=(value,version,token)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},token);
 e.internalNotes='Notiz zum bestehenden Entwurf';assert.equal((await save(e,1,g.token)).status,200);
 const submitted={...e,submittedAt:'2026-11-03T21:00:00.000Z',updatedAt:'2026-11-03T21:00:00.000Z'};
 for(const token of [g.token,t.admin])assert.equal((await save(submitted,2,token)).status,400);
 assert.equal((await save({...e,status:'used'},2,t.admin)).status,400);
});


test('group time proposals persist their origin and invalidate approval without changing bank tasks',async()=>{
 const t=await setup(),e=await completeStructureExam(t),g=await group(t);e.items[0].task.minutes=null;
 const save=(value,version)=>t.req('/api/save',{changes:[{kind:'exams',id:e.id,version,value}]},g.token);
 assert.equal((await save(e,0)).status,200);const loaded=(await t.req('/api/project',undefined,g.token)).body.project,old=loaded.exams.find(x=>x.id===e.id),before=JSON.stringify(loaded.tasks);
 const next=TimingPlan.apply(old,loaded);assert.equal(next.items[0].task.minutes,60);assert.equal(next.items[0].task.timingProposal.method,'planning');assert.equal(next.items[0].task.reviewStatus,'review');
 const saved=await save(next,1);assert.equal(saved.status,200,JSON.stringify(saved.body));const reloaded=(await t.req('/api/project',undefined,g.token)).body.project;
 assert.equal(JSON.stringify(reloaded.tasks),before);assert.equal(reloaded.exams.find(x=>x.id===e.id).items[0].task.timingProposal.method,'planning');
});
