const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
async function ui(){
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../demo.json')));
 data.workshops=[{id:'meeting',title:'Testtermin',examYear:2027,meetingDate:'',specialties:['Baumschule']}];
 const elements=new Map(),listeners={};
 for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input'])elements.set(id,{innerHTML:'',textContent:'',addEventListener(){},classList:{add(){},remove(){}}});
 elements.set('#seed',{textContent:JSON.stringify(data)});elements.set('meta[name=hortiexam-storage]',{content:'memory'});
 const sandbox={HortiCatalog:require('../src/catalog.js'),HortiHelp:require('../src/help.js'),HortiPaper:require('../src/paper.js'),HortiPlanning:require('../src/planning.js'),HortiCore:require('../src/core.js'),HortiPrint:require('../src/print.js'),console,setTimeout,clearTimeout,
 window:{addEventListener(){}},document:{querySelector:q=>elements.get(q)||null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn}};
 await vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),sandbox);
 return {html:()=>elements.get('#app').innerHTML,data,click:async(kind,value,id)=>listeners.click({target:{closest:selector=>selector===`[data-${kind}]`?{dataset:{[kind]:value,id}}:null}})};
}
test('existing meeting remains usable after coordinator browses the unscoped task archive',async()=>{
 const app=await ui();await app.click('route','scope');await app.click('action','choose-type','ZP');await app.click('route','dashboard');
 assert.ok(app.html().includes('Arbeitsgruppen für 2027'));assert.ok(!app.html().includes('Hier beginnen'));
 await app.click('route','groups');assert.ok(app.html().includes('Arbeitsbereich öffnen'));
});
test('global source archive shows the existing documents on first entry and after task browsing',async()=>{
 const app=await ui();await app.click('route','import');assert.ok(app.html().includes(`${app.data.sources.length} Dokumente`));
 for(const source of app.data.sources)assert.ok(app.html().includes(source.name));
 await app.click('route','scope');await app.click('action','choose-type','AP');await app.click('action','choose-specialty','Baumschule');await app.click('route','import');
 assert.ok(app.html().includes(`${app.data.sources.length} Dokumente`));
});
test('coordinator can open the full question catalog directly and reach readable help',async()=>{const app=await ui();await app.click('route','catalog');assert.ok(app.html().includes('Fragenbank'));assert.ok(app.html().includes('bank-specialty'));assert.ok(app.html().includes('bank-export'));assert.ok(app.html().includes('bank-query'));await app.click('route','help');assert.ok(app.html().includes('Wo liegen die Daten'));});
