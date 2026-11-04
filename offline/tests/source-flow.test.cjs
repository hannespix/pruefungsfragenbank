'use strict';
// Original pages: edited text keeps its size and pushes the content below down instead of shrinking.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../src/source-layout.js');

// A very small DOM double: just what fit() reads and writes.
class El{
 constructor(cls=[],{style={},data={},children=[],client=null,scroll=null,focus=false}={}){
  this.parentElement=null;this.children=[];this.focus=focus;this.dataset={...data};
  this.style={translate:'',height:'',top:'',lineHeight:'',transform:'',...style,getPropertyValue(k){return this[k]||'';},setProperty(k,v){this[k]=v;}};
  const set=new Set(cls);this.classList={contains:c=>set.has(c),add:(...c)=>c.forEach(x=>set.add(x)),remove:(...c)=>c.forEach(x=>set.delete(x)),toggle:(c,on)=>{on=on===undefined?!set.has(c):!!on;on?set.add(c):set.delete(c);return on;}};
  this.client=client;this.scroll=scroll;for(const c of children)this.append(c);
 }
 append(c){c.parentElement=this;this.children.push(c);}
 set className(v){for(const c of String(v).split(/\s+/).filter(Boolean))this.classList.add(c);}
 setAttribute(k,v){if(k==='style')this.styleText=v;}
 remove(){const p=this.parentElement;if(p)p.children=p.children.filter(c=>c!==this);}
 cloneNode(){const c=new El([]);c.tag=this.tag;Object.assign(c,{complete:this.complete,naturalWidth:this.naturalWidth,naturalHeight:this.naturalHeight,src:this.src,currentSrc:this.currentSrc});return c;}
 addEventListener(){}
 get clientWidth(){return this.client?.w??0;}get clientHeight(){return this.client?.h??0;}
 get scrollWidth(){return this.scroll?.w??0;}get scrollHeight(){return this.scroll?.h??0;}
 removeAttribute(){}
 one(sel){
  if(sel===':focus-within'){const walk=e=>e.focus||e.children.some(walk);return walk(this);}
  if(sel==='img:not(.source-slice-img)')return this.tag==='img'&&!this.classList.contains('source-slice-img');
  const m=/^(\.[\w-]+(?:\.[\w-]+)*)?(?:\[data-([\w-]+)\])?$/.exec(sel);if(!m)return false;
  const cls=(m[1]||'').split('.').filter(Boolean),attr=m[2]&&m[2].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  return cls.every(c=>this.classList.contains(c))&&(!attr||this.dataset[attr]!==undefined)&&!!(cls.length||attr);
 }
 matches(sel){return sel.split(',').some(part=>{const [a,b]=part.trim().split('>');return b===undefined?this.one(a.trim()):this.one(b.trim())&&!!this.parentElement?.one(a.trim());});}
 closest(sel){for(let e=this;e;e=e.parentElement)if(e.matches(sel))return e;return null;}
 all(){return this.children.flatMap(c=>[c,...c.all()]);}
 querySelectorAll(sel){return this.all().filter(e=>e.matches(sel));}
 querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
}
const pt=n=>n+'pt';
// An editor text section; `need` is the height the text would take at full size.
function point(top,height,{edited=false,need=height,width=400,id=''}={}){
 const content=new El(['source-text-content'],{scroll:{w:width,h:need}}),editor=new El(['source-text','source-text-flow','source-point-editor'],{style:{lineHeight:'12pt'},client:{w:width,h:height},children:[content]});
 const original=new El(['source-point-original'],{children:[new El(['source-text'],{client:{w:width,h:height},children:[new El(['source-text-content'],{scroll:{w:width,h:height}})]})]});
 const p=new El(['source-point',...(edited?['source-point-edited']:[])],{style:{top:pt(top),height:pt(height)},data:{id},children:[original,editor]});p.editor=editor;p.content=content;return p;
}
function sheet(items,{height=842,footer=false}={}){
 const s=new El(['source-sheet'],{style:{'--source-height':pt(height),'--source-width':'595pt'},children:[new El(['source-background']),...items,...(footer?[new El(['source-scope-footer'])]:[])]});
 return new El([],{children:[s]});
}

test('edited text grows at full size and moves everything below it down',()=>{
 const logo=new El(['source-logo'],{style:{top:'10pt',height:'30pt'}}),a=point(100,40,{edited:true,need:70}),b=point(160,20),c=point(400,30);
 const doc=sheet([logo,a,b,c]);
 assert.equal(S.fit(doc),0);
 assert.equal(a.style.height,'70pt','the box takes the height it needs');assert.equal(a.content.style.transform,'none','no shrinking');
 assert.equal(a.style.translate,'');assert.equal(logo.style.translate,'','content above stays');
 assert.equal(b.style.translate,'0 30pt');assert.equal(c.style.translate,'0 30pt');
 assert.equal(a.editor.dataset.sourceOverflow,'false');
});

test('table cells side by side push the next row only by the taller one',()=>{
 const left=point(200,26,{edited:true,need:52,width:228}),right=point(200,26,{edited:true,need:40,width:224}),below=point(240,26);
 S.fit(sheet([left,right,below]));
 assert.equal(below.style.translate,'0 26.25pt','max(26, 14), not the sum; moves snap to whole screen pixels (0.75pt)');assert.equal(left.style.translate,'');assert.equal(right.style.translate,'');
});

test('several growing sections add up down the page',()=>{
 const a=point(100,20,{edited:true,need:44}),b=point(140,20,{edited:true,need:32}),c=point(300,20);
 S.fit(sheet([a,b,c]));
 assert.equal(b.style.translate,'0 24pt');assert.equal(c.style.translate,'0 36pt');
});

test('when the page end is reached the section is flagged instead of shrunk',()=>{
 const a=point(100,40,{edited:true,need:760}),b=point(700,30);
 const n=S.fit(sheet([a,b]));
 assert.equal(n,1);assert.equal(a.editor.dataset.sourceOverflow,'true');assert.ok(a.editor.classList.contains('source-overflow'));
 assert.equal(a.content.style.transform,'none','still full size');
});

test('a new pass resets the previous one; unedited text keeps the small metric shrink',()=>{
 const a=point(100,40,{edited:true,need:70}),b=point(160,20),doc=sheet([a,b]);
 S.fit(doc);assert.equal(b.style.translate,'0 30pt');
 a.classList.remove('source-point-edited');S.fit(doc);
 assert.equal(a.style.height,'40pt');assert.equal(b.style.translate,'');
 // Unedited original text that is a bit wider than its box (other font metrics) shrinks slightly, as before.
 const box=new El(['source-text'],{style:{top:'50pt',height:'14pt'},client:{w:100,h:14},children:[new El(['source-text-content'],{scroll:{w:120,h:14}})]});
 const n=S.fit(sheet([box]));assert.equal(n,0);assert.match(box.children[0].style.transform,/^scale\(0\.83/);
 const wide=new El(['source-text'],{style:{top:'50pt',height:'14pt'},client:{w:100,h:14},children:[new El(['source-text-content'],{scroll:{w:200,h:14}})]});
 assert.equal(S.fit(sheet([wide])),1,'far too wide original text is still flagged');
});

test('the editor offers "+ Zeile" on every editable section, but print output does not',()=>{
 const t={sourceIds:['src'],assetLinks:[{assetId:'bg',audience:'candidate',role:'source-page'}],text:'A',sourceLayout:{version:1,sourceId:'src',reference:'r',baselineText:'A',sourcePdfHash:'a'.repeat(64),warnings:[],pages:[{width:595,height:842,backgroundAssetId:'bg',logos:[],blocks:[{id:'b1',x:60,y:90,width:400,height:20,fontSize:12,lineHeight:15,text:'A',originalText:'A',lines:[{text:'A',runs:[{text:'A',bold:false,italic:false}]}]}]}]}};
 const P={image:()=>'<img alt="">'},I={icon:()=>'',label:(a,t)=>t},d={assets:[{id:'bg',data:''}]},item={id:'item-1',task:t,label:'Aufgabe 1'};
 const editing=S.pages(item,{status:'draft'},d,0,false,P,I),printing=S.pages(item,{status:'draft'},d,0,true,P,I);
 assert.match(editing,/data-action="source-add-line" data-id="item-1\|point:b1:0"/);assert.match(editing,/Enter = neue Zeile/);
 assert.doesNotMatch(printing,/source-add-line|Enter = neue Zeile/);
});

// A page like the real templates: rows of dark pixels per pt as read from the background picture.
function framedPage({frameTop=352,frameBottom=780,lines=[]}={}){
 const rows=new Uint32Array(842);rows[80]=480;rows[frameTop]=rows[frameBottom]=480;for(let r=frameTop+1;r<frameBottom;r++)rows[r]=2;for(const y of lines)rows[y]=460;
 const img=new El(['bg-img'],{});Object.assign(img,{tag:'img',complete:true,naturalWidth:595,naturalHeight:842,currentSrc:'data:image/png;base64,FRAME'+frameTop+'-'+lines.join('.')});
 globalThis.__hortiSourceRows=new Map([[img.currentSrc.length+':'+img.currentSrc.slice(-96)+':595x842',rows]]);
 globalThis.document={createElement:()=>{const e=new El([]);e.getContext=()=>({drawImage(){}});return e;}};
 return img;
}
const pageWith=(img,items)=>{const doc=sheet(items);doc.children[0].children[0].append(img);return doc;};
test('lines that overlap their neighbour by a point still follow the growing section',()=>{
 const head=point(92,15,{edited:true,need:43}),next=point(106,29),list=point(206,14.2),item2=point(220,14.2);
 S.fit(sheet([head,next,list,item2]));
 assert.equal(next.style.translate,'0 28.5pt','the next paragraph moves although its box starts 1pt inside the heading');
 const bullet=point(206,14.2,{edited:true,need:42}),after=point(220,14.2);S.fit(sheet([bullet,after]));assert.equal(after.style.translate,'0 28.5pt','27.8pt rounded up to whole pixels');
});
test('the planning field gets shorter instead of pushing the footer off the page',()=>{
 try{
  const img=framedPage(),text=point(100,30,{edited:true,need:230}),label=point(358,13),footer=point(800,10.6),doc=pageWith(img,[text,label,footer]);
  assert.equal(S.fit(doc),0,'no overflow: the frame gives the 200pt back');
  assert.equal(label.style.translate,'0 200.25pt','the frame top with its label moves down');assert.equal(footer.style.translate,'','footer and frame bottom stay');
  const bg=doc.children[0].children[0];assert.ok(bg.classList.contains('source-shifted'));assert.ok(bg.children.some(c=>c.classList.contains('source-slice-band')),'gap below the text');
  assert.equal(text.editor.dataset.sourceOverflow,'false');
 }finally{delete globalThis.document;delete globalThis.__hortiSourceRows;}
});
test('writing lines in the planning field move closer evenly; only a full page is flagged',()=>{
 try{
  const lines=[400,450,500,550,600,650,700,750],img=framedPage({lines}),text=point(100,30,{edited:true,need:130}),footer=point(800,10.6),doc=pageWith(img,[text,footer]);
  assert.equal(S.fit(doc),0);assert.equal(footer.style.translate,'');
  const removed=doc.children[0].children[0].children.filter(c=>c.classList.contains('source-slice-part')).length;assert.ok(removed>=8,'every gap between writing lines gives some space: '+removed);
  const tooMuch=point(100,30,{edited:true,need:700}),footer2=point(800,10.6);assert.equal(S.fit(pageWith(framedPage({lines}),[tooMuch,footer2])),1,'more text than the frame can give is flagged');
 }finally{delete globalThis.document;delete globalThis.__hortiSourceRows;}
});

test('clicking into original text never shrinks it: a focused, unedited section that wraps grows like edited text',()=>{
 const a=point(100,20,{need:40}),b=point(140,20);a.content.focus=true;
 const n=S.fit(sheet([a,b]));
 assert.equal(n,0,'nothing blocks printing');assert.equal(a.content.style.transform,'none','full size, not tiny');assert.equal(a.editor.dataset.sourceOverflow,'false');
 assert.equal(a.style.height,'40pt','the box takes the extra line');assert.match(b.style.translate,/^0 20/,'the text below moves down');
 a.content.focus=false;S.fit(sheet([a,b]));assert.equal(a.style.height,'20pt','leaving it unchanged restores the original');assert.equal(b.style.translate,'');
});
