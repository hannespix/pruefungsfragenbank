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
 get clientWidth(){return this.client?.w??0;}get clientHeight(){return this.client?.h??0;}
 get scrollWidth(){return this.scroll?.w??0;}get scrollHeight(){return this.scroll?.h??0;}
 removeAttribute(){}
 one(sel){
  if(sel===':focus-within'){const walk=e=>e.focus||e.children.some(walk);return walk(this);}
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
 assert.equal(below.style.translate,'0 26pt','max(26, 14), not the sum');assert.equal(left.style.translate,'');assert.equal(right.style.translate,'');
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
