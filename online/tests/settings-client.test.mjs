import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import C from '../../offline/src/core.js';
import P from '../../offline/src/planning.js';
import Print from '../../offline/src/print.js';
const client=fs.readFileSync(new URL('../client.js',import.meta.url),'utf8');
function harness(project){const calls=[];let versions={},stored=structuredClone(project);const ctx={HortiCore:C,HortiPlanning:P,HortiPrint:Print,console,setTimeout,clearTimeout,setInterval,clearInterval,fetch:async(url,init)=>{if(url.endsWith('/api/project'))return Response.json({project:structuredClone(stored),versions});if(url.endsWith('/api/save')){const b=JSON.parse(init.body);calls.push(b);for(const c of b.changes){stored[c.kind]=stored[c.kind].filter(x=>x.id!==c.id);if(c.value!==null)stored[c.kind].push(structuredClone(c.value));versions[c.kind+':'+c.id]=c.version+1;}return Response.json({versions});}throw Error('Unexpected request: '+url);}};vm.runInNewContext(client,ctx);return {o:ctx.HortiOnline,calls,getStored:()=>stored};}
test('client persists settings records and sends their server revision on later edits',async()=>{
 const h=harness(C.empty()),d=await h.o.load(),r={id:'planning:ZP:*',schemaVersion:1,revision:1,examType:'ZP',specialty:'*',categories:[{id:'plantwork',label:'Abgestimmtes Generalthema'}],defaults:{notes:'Synthetischer Standard'}};d.settings.push(r);await h.o.save(d);assert.equal(h.calls[0].changes.length,1);assert.equal(h.calls[0].changes[0].kind,'settings');assert.equal(h.calls[0].changes[0].version,0);await h.o.save(d);assert.equal(h.calls.length,1);r.revision++;r.defaults.notes='Geänderter Standard';await h.o.save(d);assert.equal(h.calls[1].changes[0].version,1);assert.equal((await h.o.load()).settings[0].defaults.notes,'Geänderter Standard');
});
test('conflict copies acquire a catalog snapshot and clear handoff and material confirmations',async()=>{
 const d=C.validate(JSON.parse(fs.readFileSync(new URL('../../offline/demo.json',import.meta.url)))),task=d.tasks.find(t=>t.examType==='AP'&&t.kind==='practical'),e=C.newExam({examType:'AP',specialty:task.specialty,examYear:2027});C.addItem(e,task);e.items[0].task.materials={text:'Synthetische Materialliste',status:'confirmed',method:'manual',evidence:[]};e.submittedAt=e.updatedAt;d.exams.push(e);const h=harness(d),loaded=await h.o.load();loaded.exams[0].title+=' changed';const result=await h.o.saveCopies(loaded),copy=result.exams.find(x=>x.id!==e.id);assert.ok(copy.pattern.categoryDefinitions.length);assert.equal(copy.submittedAt,undefined);assert.equal(copy.oralRequirementVersion,1);assert.equal(copy.materialRequirementVersion,1);assert.equal(copy.status,'draft');assert.equal(copy.items[0].task.materials.status,'proposal');assert.equal(result.exams.find(x=>x.id===e.id).items[0].task.materials.status,'confirmed');assert.equal(h.getStored().exams.find(x=>x.id===copy.id).pattern.categoryDefinitionsVersion,1);
});
