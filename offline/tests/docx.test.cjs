const {test}=require('node:test'),assert=require('node:assert/strict');
const Zip=require('../vendor/jszip.min.js');
const D=(()=>{try{return require('../src/docx.js')}catch{return {document:async()=>new Uint8Array()}}})();
const pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
function fixture(){return {e:{title:'Test & Prüfung',examType:'ZP',specialty:'Baumschule',examYear:2027,date:'2027-04-01',notes:'',items:[{id:'i1',task:{title:'Pflanzung',text:'Pflanzen <zählen> & prüfen',points:10,minutes:null,solution:'SECRET_SOLUTION',solutionStatus:'approved',reviewStatus:'approved',criteria:[{text:'Pflanzen',points:10,answer:'SECRET_EXPECTATION'}],flags:[],sourceIds:['s1'],assetLinks:[{assetId:'plan',audience:'candidate',role:'plan'},{assetId:'secret',audience:'examiner',role:'solution'}]}}]},d:{tasks:[],assets:[{id:'plan',name:'Plan.png',mime:'image/png',data:pixel},{id:'secret',name:'SECRET_IMAGE.png',mime:'image/png',data:pixel}]}};}
function source(f,count=2){f.d.assets.push({id:'test-font',name:'Test.ttf',mime:'font/ttf',design:'bw-2024',docxFontKey:'sansRegular',fontFamily:'Export Test',data:require('./fixtures/docx-test-font.json').data});const t=f.e.items[0].task;t.assetLinks.push({assetId:'background',audience:'candidate',role:'source-page'});f.d.assets.push({id:'background',name:'Seite.png',mime:'image/png',data:pixel});t.sourceLayout={version:1,sourceId:'s1',reference:'D001',sourcePdfHash:'a'.repeat(64),baselineText:t.text,warnings:[],pages:Array.from({length:count},(_,n)=>({width:595.3,height:841.9,backgroundAssetId:'background',logos:[],blocks:[{id:'b'+n,x:50,y:120,width:480,height:40,fontSize:12,lineHeight:15,text:n?'Rückseite ORIGINAL':t.text,originalText:n?'Rückseite ORIGINAL':t.text,lines:[{text:n?'Rückseite ORIGINAL':t.text,runs:[{text:n?'Rückseite ORIGINAL':t.text,bold:true,italic:false}]}]}]}))};return f;}
async function unpack(f,examiner=false){return Zip.loadAsync(await D.document(f.e,f.d,examiner));}
async function allXml(z){return (await Promise.all(Object.values(z.files).filter(f=>/\.xml$/.test(f.name)).map(f=>f.async('string')))).join('\n');}
test('Word candidate is a native editable document and excludes all examiner content',async()=>{const z=await unpack(fixture()),xml=await allXml(z);assert.ok(z.file('[Content_Types].xml'));assert.match(xml,/<w:t[^>]*>Pflanzen &lt;zählen&gt; &amp; prüfen/);assert.doesNotMatch(xml,/SECRET|altChunk/);assert.equal(Object.keys(z.files).filter(n=>n.startsWith('word/media/')&&!z.files[n].dir).length,1);});
test('Word examiner contains native solution paragraphs and scoring table',async()=>{const z=await unpack(fixture(),true),xml=await allXml(z);assert.match(xml,/SECRET_SOLUTION/);assert.match(xml,/SECRET_EXPECTATION/);assert.match(xml,/<w:tbl>/);assert.match(xml,/Vertrauliche Prüferfassung/);});
test('original pages retain flowing editable wording and native reverse planning lines',async()=>{const z=await unpack(source(fixture())),xml=await allXml(z);assert.doesNotMatch(xml,/w:txbxContent|wps:txbx|v:textbox|<wp:anchor/);assert.match(xml,/Rückseite ORIGINAL/);assert.match(xml,/<w:pBdr>/);assert.match(xml,/w:pgSz w:w="11906" w:h="16838"/);assert.doesNotMatch(xml,/Durchführungsplanung \/ Bearbeitung/);assert.ok(z.file('word/header1.xml'));assert.ok(z.file('word/header2.xml'));});
test('odd original template receives an explicit blank reverse before next task',async()=>{const f=source(fixture(),1);f.e.items[0].task.assetLinks=f.e.items[0].task.assetLinks.filter(l=>l.role==='source-page');f.e.items.push({...structuredClone(f.e.items[0]),id:'i2'});const z=await unpack(f),xml=await allXml(z);assert.equal(Object.keys(z.files).filter(n=>/^word\/header\d+\.xml$/.test(n)).length,4);assert.match(xml,/w:type w:val="oddPage"/);});
test('stale original template and missing page image block Word generation',async()=>{const f=source(fixture());f.e.items[0].task.text+=' changed';await assert.rejects(()=>D.document(f.e,f.d),/Originalseiten/);f.e.items[0].task.text=f.e.items[0].task.sourceLayout.baselineText;f.d.assets.find(a=>a.id==='background').data='';await assert.rejects(()=>D.document(f.e,f.d),/Anlage/);});
test('candidate can export without examiner asset bytes, examiner cannot',async()=>{const f=fixture();f.d.assets.find(a=>a.id==='secret').data='';await unpack(f);await assert.rejects(()=>D.document(f.e,f.d,true),/Anlage/);});
module.exports={fixture,source,pixel};
test('requested BW branding cannot silently substitute missing Word fonts',async()=>{const f=fixture();f.e.items[0].task.assetLinks.push({assetId:'plan',audience:'candidate',role:'letterhead',design:'bw-2024'});await assert.rejects(()=>D.document(f.e,f.d),/Word-Schriften/);});
test('scoring rows stay together and headings repeat on continued pages',async()=>{const xml=await allXml(await unpack(fixture(),true));assert.match(xml,/<w:cantSplit\/>/);assert.match(xml,/<w:tblHeader\/>/);});
test('legacy task retains a source-embedded drawing when no page template exists',async()=>{const f=fixture();f.e.items[0].task.assetLinks[0].role='source-embedded';const z=await unpack(f);assert.ok(Object.values(z.files).some(f=>/^word\/media\//.test(f.name)&&!f.dir));});
test('unreviewed proposed points stay visibly provisional in Word',async()=>{const f=fixture();Object.assign(f.e.items[0].task,{pointsProposal:{},reviewStatus:'review'});const xml=await allXml(await unpack(f));assert.match(xml,/Punktevorschlag/);});
test('source pages cannot silently substitute missing Word fonts',async()=>{const f=source(fixture());f.d.assets=f.d.assets.filter(a=>!a.docxFontKey);const b=f.e.items[0].task.sourceLayout.pages[0].blocks[0];b.width=10;b.text=b.originalText='This long source line must never be clipped';b.lines=[{text:b.text,runs:[{text:b.text,bold:false,italic:false}]}];await assert.rejects(()=>D.document(f.e,f.d),/Word-Schriften/);});
test('Word uses reusable design styles and structured identity/metadata tables',async()=>{const z=await unpack(fixture()),styles=await z.file('word/styles.xml').async('string'),body=await z.file('word/document.xml').async('string');for(const id of ['ExamTitle','TaskTitle','ExamBody','ExamMeta'])assert.match(styles,new RegExp('w:styleId="'+id+'"'));assert.ok((body.match(/<w:tbl>/g)||[]).length>=3);assert.match(body,/Name \/ Prüflingsnummer/);assert.match(body,/Prüfungstermin/);});
test('source pages contain no shapes or textboxes and all graphics are inline',async()=>{const z=await unpack(source(fixture())),xml=await allXml(z);assert.doesNotMatch(xml,/<wps:wsp>|<wp:anchor|w:txbxContent|wps:txbx|v:textbox|<v:(?:rect|shape)/);assert.match(xml,/<wp:inline/);});

test('fixed template line spacing uses the valid exact OOXML value',async()=>{const xml=await allXml(await unpack(source(fixture())));assert.doesNotMatch(xml,/w:lineRule="exactly"/);assert.match(xml,/w:lineRule="exact"/);});
test('Word library and renderer work as browser globals without Node modules',async()=>{const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const ctx=vm.createContext({console,setTimeout,clearTimeout,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,btoa,atob});for(const name of ['vendor/jszip.min.js','vendor/docx.umd.min.js','src/source-layout.js','src/planning.js','src/core.js','src/print.js','src/docx-assets.js','src/docx.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),ctx);const f=fixture();const bytes=await ctx.HortiDocx.document(f.e,f.d);const z=await Zip.loadAsync(bytes);assert.ok(z.file('word/document.xml'));});

test('unreleased normal task sections retain a draft marker in every footer',async()=>{const f=fixture();f.e.items[0].task.reviewStatus='review';const z=await unpack(f);for(const part of Object.values(z.files).filter(f=>/^word\/footer\d+\.xml$/.test(f.name)))assert.match(await part.async('string'),/ENTWURF · NICHT FREIGEGEBEN/);});
test('drawing identifiers are unique across inline body images and headers',async()=>{const xml=await allXml(await unpack(source(fixture()))),ids=[...xml.matchAll(/<wp:docPr id="(\d+)"/g)].map(m=>m[1]);assert.ok(ids.length>0);assert.equal(new Set(ids).size,ids.length);});


test('long source edits wrap at their original font size without shape fit rejection',async()=>{
 const f=source(fixture(),1),b=f.e.items[0].task.sourceLayout.pages[0].blocks[0];b.text='LONG_EDIT '+('Langer bearbeitbarer Text mit Überlauf. '.repeat(180))+' END_EDIT';
 const xml=await allXml(await unpack(f));assert.match(xml,/LONG_EDIT/);assert.match(xml,/END_EDIT/);assert.doesNotMatch(xml,/w:txbxContent|wps:txbx|v:textbox/);assert.match(xml,/<w:sz w:val="24"/);assert.match(xml,/w:lineRule="atLeast"/);
});
test('source runs retain bold italic wording and aligned labels without textboxes',async()=>{
 const f=source(fixture(),1),page=f.e.items[0].task.sourceLayout.pages[0],b=page.blocks[0];b.text=b.originalText='Unverändert kursiv';b.lines=[{text:b.text,runs:[{text:'Unverändert ',bold:true,italic:false},{text:'kursiv',bold:false,italic:true}]}];
 page.blocks.unshift({...structuredClone(b),id:'label',text:'1.',originalText:'1.',x:32,width:12,lines:[{text:'1.',runs:[{text:'1.',bold:false,italic:false}]}]});
 const xml=await allXml(await unpack(f));assert.match(xml,/<w:b\/>/);assert.match(xml,/<w:i\/>/);assert.match(xml,/<w:tab\/>/);assert.match(xml,/w:hanging="360"/);
});
test('source drawings and answer rules export as inline images and native paragraph borders',async()=>{
 const f=source(fixture(),1),page=f.e.items[0].task.sourceLayout.pages[0];page.graphics=[{assetId:'plan',x:50,y:200,width:100,height:75}];page.rules=[{x:50,y:300,width:480,lineWidth:.5},{x:50,y:325,width:480,lineWidth:.5}];
 const xml=await allXml(await unpack(f));assert.match(xml,/<wp:inline/);assert.match(xml,/<w:pBdr>/);assert.doesNotMatch(xml,/w:txbxContent|wps:txbx|v:textbox|<wp:anchor/);
});

function rasterPng(width,height,draw=()=>{}){
 const zlib=require('node:zlib'),pixels=Buffer.alloc(width*height*3,255),dot=(x,y)=>{if(x>=0&&y>=0&&x<width&&y<height)pixels.fill(0,(y*width+x)*3,(y*width+x)*3+3);};
 draw(dot);const raw=Buffer.alloc((width*3+1)*height);for(let y=0;y<height;y++)pixels.copy(raw,y*(width*3+1)+1,y*width*3,(y+1)*width*3);
 const chunk=(tag,data)=>{const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(tag,4);data.copy(out,8);let crc=0xffffffff;for(const v of out.subarray(4,out.length-4)){crc^=v;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
test('legacy text-free PNG recovers a native response frame and preserves a rectilinear diagram as a cropped inline image',async()=>{
 const f=source(fixture(),1),page=f.e.items[0].task.sourceLayout.pages[0];page.width=400;page.height=500;page.blocks[0].x=30;page.blocks[0].width=300;page.blocks[0].y=60;
 f.e.items[0].task.assetLinks=f.e.items[0].task.assetLinks.filter(l=>l.role==='source-page');
 const data=rasterPng(400,500,dot=>{for(let x=30;x<=370;x++){dot(x,150);dot(x,230);}for(let y=150;y<=230;y++){dot(30,y);dot(370,y);}for(let x=50;x<=180;x++){dot(x,300);dot(x,420);}for(let y=300;y<=420;y++){dot(50,y);dot(180,y);}for(let x=110;x<=180;x++)dot(x,350);for(let y=300;y<=350;y++)dot(110,y);});
 f.d.assets.find(a=>a.id==='background').data=data;
 const z=await unpack(f),xml=await allXml(z);assert.match(xml,/<w:tbl>/);assert.match(xml,/<wp:inline/);assert.doesNotMatch(xml,/w:txbxContent|wps:txbx|v:textbox|<wp:anchor/);
 const media=await Promise.all(Object.values(z.files).filter(p=>/^word\/media\//.test(p.name)&&!p.dir).map(p=>p.async('nodebuffer')));assert.equal(media.length,1);assert.ok(media[0].readUInt32BE(16)<400);assert.ok(media[0].readUInt32BE(20)<500);assert.notEqual(media[0].toString('base64'),data);
});
test('malformed and huge legacy PNGs fail before unbounded allocation or output',async()=>{
 for(const kind of ['large','bad-filter','truncated']){const f=source(fixture(),1);let data=Buffer.from(rasterPng(4,4),'base64');if(kind==='large')data.writeUInt32BE(1000000,16);if(kind==='truncated')data=data.subarray(0,36);if(kind==='bad-filter'){const zlib=require('node:zlib'),raw=Buffer.alloc(52,255);for(let i=0;i<4;i++)raw[i*13]=8;const packed=zlib.deflateSync(raw),size=Buffer.alloc(4);size.writeUInt32BE(packed.length);data=Buffer.concat([data.subarray(0,33),size,Buffer.from('IDAT'),packed,Buffer.alloc(4),data.subarray(data.length-12)]);}f.d.assets.find(a=>a.id==='background').data=data.toString('base64');await assert.rejects(()=>unpack(f),/PNG|groß/);}
});
test('shared source grid borders enclose every row as native table content',async()=>{
 const f=source(fixture(),1),page=f.e.items[0].task.sourceLayout.pages[0],base=page.blocks[0];page.graphics=[];page.rules=[200,250,300].map(y=>({x:50,y,width:480,height:0,lineWidth:1})).concat([50,530].map(x=>({x,y:200,width:0,height:100,lineWidth:1})));page.blocks=[210,260].map((y,n)=>({...structuredClone(base),id:'row-'+n,x:55,width:450,y,height:20,text:'ROW '+n,originalText:'ROW '+n,lines:[{text:'ROW '+n,runs:[{text:'ROW '+n,bold:false,italic:false}]}]}));
 const z=await unpack(f),xml=await z.file('word/document.xml').async('string');assert.equal((xml.match(/<w:tr>/g)||[]).length,2);for(const n of [0,1])assert.ok([...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].some(m=>m[0].includes('ROW '+n)));
});
test('source labels overlapping a drawing fail clearly instead of changing their association',async()=>{
 const f=source(fixture(),1),page=f.e.items[0].task.sourceLayout.pages[0];page.rules=[];page.graphics=[{assetId:'plan',x:45,y:110,width:490,height:100}];await assert.rejects(()=>unpack(f),/Beschriftete Originalzeichnung/);
});
test('source bullet glyphs share their list paragraph despite different font bounding boxes',async()=>{
 const f=source(fixture(),1),page=f.e.items[0].task.sourceLayout.pages[0],base=page.blocks[0];page.graphics=[];page.rules=[];
 page.blocks=[{...base,id:'bullet',x:86.4,y:203.228,width:5.11,height:11,fontSize:10,lineHeight:10,text:'•',originalText:'•',lines:[{text:'•',runs:[{text:'•',bold:false,italic:false}]}]},{...base,id:'list-text',x:104.4,y:200,width:180,height:14.392,fontSize:12,lineHeight:13.392,text:'Synthetisches Material',originalText:'Synthetisches Material',lines:[{text:'Synthetisches Material',runs:[{text:'Synthetisches Material',bold:false,italic:false}]}]}];
 const xml=await (await unpack(f)).file('word/document.xml').async('string'),paragraphs=[...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(m=>m[0]);assert.ok(paragraphs.some(p=>p.includes('•')&&p.includes('Synthetisches Material')));assert.equal(paragraphs.filter(p=>p.includes('Synthetisches Material')).length,1);
});
test('edited connected points stay in one flowing Word paragraph and preserve adjacent points and reverse pages',async()=>{
 const f=source(fixture(),2),S=require('../src/source-layout.js'),t=f.e.items[0].task,page=t.sourceLayout.pages[0],base=page.blocks[0],make=(id,text,x,y)=>({...structuredClone(base),id,text,originalText:text,x,y,width:420,height:15,lineHeight:14,lines:[{text,runs:[{text,bold:false,italic:false}]}]});
 page.blocks=[make('first','1. Ordnen Sie die Materialien den vorgesehenen',50,120),make('continuation','Bereichen zu und begründen Sie die Auswahl.',68,134),make('second','2. Dokumentieren Sie die Kontrolle.',50,162)];
 const target=S.groups(page)[0];S.edit(t,target.id,'1. Ordnen Sie alle Materialien zu und erläutern Sie die Auswahl.');
 const xml=await (await unpack(f)).file('word/document.xml').async('string'),paragraphs=[...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(m=>m[0]);
 assert.equal(paragraphs.filter(p=>p.includes('Ordnen Sie alle Materialien')).length,1);assert.ok(paragraphs.some(p=>p.includes('2. Dokumentieren Sie die Kontrolle.')));assert.match(xml,/Rückseite ORIGINAL/);assert.doesNotMatch(xml,/v:textbox|w:txbxContent|<wp:anchor/);assert.doesNotMatch(xml,/Bereichen zu und begründen/);
 assert.match(paragraphs.find(p=>p.includes('Ordnen Sie alle Materialien')),/w:lineRule="atLeast"/);
});
test('a grouped bullet edit uses the body font in Word and does not leave marker and continuation text cells',async()=>{
 const f=source(fixture(),1),S=require('../src/source-layout.js'),t=f.e.items[0].task,page=t.sourceLayout.pages[0],base=page.blocks[0];page.graphics=[];page.rules=[];
 const make=(id,text,x,y,width,fontSize=12)=>({...structuredClone(base),id,text,originalText:text,x,y,width,height:14,lineHeight:14,fontSize,lines:[{text,runs:[{text,bold:false,italic:false}]}]});
 page.blocks=[make('marker','•',40,122,6,10),make('body','Beschriften Sie die Bauteile und ordnen Sie',58,120,420),make('wrap','sie danach zu.',58,134,420)];S.edit(t,S.groups(page)[0].id,'• Beschriften Sie die Bauteile und ordnen Sie diese anschließend zu.');
 const xml=await (await unpack(f)).file('word/document.xml').async('string'),paragraph=[...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(m=>m[0]).find(p=>p.includes('anschließend zu.'));
 assert.match(paragraph,/<w:sz w:val="24"/);assert.doesNotMatch(paragraph,/<w:tab\/>/);assert.doesNotMatch(xml,/sie danach zu\./);
});
test('legacy multirow grid and a known logo cut in Name/Datum frame stay native',async()=>{
 const f=source(fixture(),1),page=f.e.items[0].task.sourceLayout.pages[0],base=page.blocks[0];page.width=400;page.height=500;page.logos=[{x:270,y:120,width:80,height:40}];
 f.e.items[0].task.assetLinks=f.e.items[0].task.assetLinks.filter(l=>l.role==='source-page');f.e.items[0].task.assetLinks.push({assetId:'plan',role:'letterhead',audience:'candidate',design:'bw-2024'});const font=f.d.assets.find(a=>a.docxFontKey);for(const key of ['sansBold','serifBold'])f.d.assets.push({...font,id:key,docxFontKey:key});
 page.blocks=[['Name:',40,160],['Datum:',230,160],['Zelle A',40,270],['Zelle B',40,310]].map(([text,x,y],n)=>({...structuredClone(base),id:'identity-'+n,x,y,width:70,height:15,text,originalText:text,lines:[{text,runs:[{text,bold:false,italic:false}]}]}));
 f.d.assets.find(a=>a.id==='background').data=rasterPng(400,500,dot=>{for(let x=30;x<=370;x++){if(x<270||x>350)dot(x,150);dot(x,190);for(const y of [250,290,330])dot(x,y);}for(let y=150;y<=190;y++){dot(30,y);dot(220,y);dot(370,y);}for(let y=250;y<=330;y++){dot(30,y);dot(370,y);}});
 const z=await unpack(f),xml=await z.file('word/document.xml').async('string');assert.equal((xml.match(/<w:tr>/g)||[]).length,3);for(const text of ['Name:','Datum:','Zelle A','Zelle B'])assert.ok([...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].some(m=>m[0].includes(text)));
});
