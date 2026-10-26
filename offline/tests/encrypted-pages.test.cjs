const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'horti-seal-'));
const password='test-only-long-password-4vB7NBWXAZmQ';
const seed=JSON.parse(fs.readFileSync(path.join(root,'demo.json'),'utf8'));
seed.name='PRIVATE_SENTINEL_NOT_FOR_PUBLIC_HTML';
fs.writeFileSync(path.join(temp,'seed.json'),JSON.stringify(seed));
fs.writeFileSync(path.join(temp,'password.txt'),password);
test('sealed corpus round trips, denies wrong passwords and ciphertext changes',async()=>{
  const run=cp.spawnSync(process.execPath,[path.join(root,'tools/seal.cjs'),'--seed',path.join(temp,'seed.json'),'--password-file',path.join(temp,'password.txt'),'--out',path.join(temp,'sealed')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const crypto=require('../pages/crypto.js');
  const dir=path.join(temp,'sealed'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
  const cipher=Buffer.concat(manifest.chunks.map(x=>fs.readFileSync(path.join(dir,x))));
  assert.deepEqual(await crypto.unlock(manifest,cipher,password),seed);
  await assert.rejects(crypto.unlock(manifest,cipher,'wrong-password'));
  const damaged=Buffer.from(cipher);damaged[damaged.length-1]^=1;
  await assert.rejects(crypto.unlock(manifest,damaged,password));
  await assert.rejects(crypto.unlock({...manifest,iterations:1},cipher,password));
  await assert.rejects(crypto.unlock({...manifest,chunks:['../private.json']},cipher,password));
  const second=path.join(temp,'second');
  assert.equal(cp.spawnSync(process.execPath,[path.join(root,'tools/seal.cjs'),'--seed',path.join(temp,'seed.json'),'--password-file',path.join(temp,'password.txt'),'--out',second]).status,0);
  const other=JSON.parse(fs.readFileSync(path.join(second,'manifest.json')));
  assert.notEqual(manifest.salt,other.salt);assert.notEqual(manifest.iv,other.iv);
  for(const file of fs.readdirSync(dir)){const content=fs.readFileSync(path.join(dir,file));assert.equal(content.includes(Buffer.from(seed.name)),false);assert.equal(content.includes(Buffer.from(password)),false);}
});
test('Pages build includes only launcher, public application and sealed files',()=>{
  const run=cp.spawnSync('python3',[path.join(root,'tools/build_pages.py'),'--sealed',path.join(temp,'sealed'),'--out',path.join(temp,'site')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const html=fs.readFileSync(path.join(temp,'site/index.html'),'utf8');
  assert.ok(html.includes('Passwort'));assert.ok(html.includes('PRIVATE_SEED'));
  assert.ok(!html.includes(seed.name));assert.ok(!html.includes(password));
  assert.ok(fs.existsSync(path.join(temp,'site/sealed/manifest.json')));
});
test('session-only workshop renders without touching persistent browser storage',async()=>{
  const vm=require('node:vm');let storageTouches=0;
  const elements=new Map();
  for(const id of ['#app','#toast','#dialog','#project-input','#docx-input','#asset-input'])elements.set(id,{innerHTML:'',textContent:'',addEventListener(){},classList:{add(){},remove(){}}});
  elements.set('#seed',{textContent:JSON.stringify(seed)});
  elements.set('meta[name=hortiexam-storage]',{content:'memory'});
  const sandbox={HortiDocx:require('../src/docx.js'),HortiCatalog:require('../src/catalog.js'),HortiHelp:require('../src/help.js'),HortiPaper:require('../src/paper.js'),HortiPlanning:require('../src/planning.js'),HortiSourceLayout:require('../src/source-layout.js'),HortiIcons:require('../src/icons.js'),HortiCore:require('../src/core.js'),HortiPrint:require('../src/print.js'),structuredClone,console,setTimeout,clearTimeout,
    window:{addEventListener(){}},document:{querySelector:q=>elements.get(q)||null,querySelectorAll:()=>[],addEventListener(){}},
    indexedDB:{open(){storageTouches++;throw Error('Persistent storage forbidden in Pages test');}}};
  await vm.runInNewContext(fs.readFileSync(path.join(root,'src/app.js'),'utf8'),sandbox);
  assert.equal(storageTouches,0);
  assert.ok(elements.get('#app').innerHTML.includes('Nur diese Sitzung'));
  assert.ok(elements.get('#app').innerHTML.includes('Termin vorbereiten'));
});

test('Pages build rejects extra plaintext files in the sealed input directory',()=>{
  const dir=path.join(temp,'sealed');fs.writeFileSync(path.join(dir,'accidental-private.json'),JSON.stringify(seed));
  const run=cp.spawnSync('python3',[path.join(root,'tools/build_pages.py'),'--sealed',dir,'--out',path.join(temp,'unsafe-site')],{encoding:'utf8'});
  assert.notEqual(run.status,0);assert.equal(fs.existsSync(path.join(temp,'unsafe-site')),false);
  fs.unlinkSync(path.join(dir,'accidental-private.json'));
});
