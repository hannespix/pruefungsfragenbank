/* Native Word design, built with pinned docx. Private data arrives at runtime. */
(function(root){'use strict';
const C=root.HortiCore||(typeof require==='function'?require('./core.js'):null);
const S=root.HortiSourceLayout||(typeof require==='function'?require('./source-layout.js'):null);
const P=root.HortiPrint||(typeof require==='function'?require('./print.js'):null);
const A=root.HortiDocxAssets||(typeof require==='function'?require('./docx-assets.js'):null);
const O=root.HortiOrganization||(typeof require==='function'?require('./organization.js'):null);
const X=root.docx||(typeof require==='function'?require('../vendor/docx.umd.min.js'):null);
const Zip=root.JSZip||(typeof require==='function'?require('../vendor/jszip.min.js'):null);
const tw=pt=>Math.round(pt*20),mm=n=>Math.round(n*1440/25.4),px=pt=>pt*4/3;
// U+FFFE/U+FFFF are not XML characters either; Word rejects document.xml containing them.
const clean=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'');
const ink='2A2623',muted='625E59',line='B8B4AF',soft='F4F3F3',paperWidth=mm(174);
// Legacy page assets contain no source wording. Decode their lossless PNG once,
// recover straight rules as native Word borders, and retain remaining figures.
async function pngPixels(asset){
 const bytes=A.bytes(asset.data);if(bytes.length<33||bytes.length>32*1024*1024||[137,80,78,71,13,10,26,10].some((v,n)=>bytes[n]!==v))throw Error('Ungültiges Originalseiten-PNG.');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width,height,depth,type;const chunks=[];
 for(let at=8;at+12<=bytes.length;){const size=view.getUint32(at);if(size>bytes.length-at-12)throw Error('Unvollständiges Originalseiten-PNG.');const tag=String.fromCharCode(...bytes.slice(at+4,at+8));if(tag==='IHDR'){if(size!==13)throw Error('Ungültiger PNG-Bildkopf.');width=view.getUint32(at+8);height=view.getUint32(at+12);depth=bytes[at+16];type=bytes[at+17];if(bytes[at+20])throw Error('Verschachteltes PNG wird nicht unterstützt.');}if(tag==='IDAT')chunks.push(bytes.slice(at+8,at+8+size));at+=size+12;}
 if(!width||!height||width>8000||height>8000||width*height>12000000)throw Error('Originalseitenbild ist zu groß für den Word-Export.');
 if(depth!==8||![0,2,4,6].includes(type)||!width||!height)throw Error('Das Originalseitenbild benötigt ein RGB-PNG für Word.');
 if(typeof DecompressionStream==='undefined')throw Error('Dieser Browser unterstützt den Word-Bildexport nicht. Bitte einen aktuellen Browser verwenden.');
 const packed=new Uint8Array(chunks.reduce((n,a)=>n+a.length,0));let offset=0;for(const a of chunks){packed.set(a,offset);offset+=a.length;}
 const channels={0:1,2:3,4:2,6:4}[type],expected=(width*channels+1)*height,raw=new Uint8Array(expected),reader=new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let read=0;try{while(true){const {done,value}=await reader.read();if(done)break;if(read+value.length>expected){await reader.cancel();throw Error('Ungültige PNG-Datenlänge.');}raw.set(value,read);read+=value.length;}}finally{reader.releaseLock();}if(read!==expected)throw Error('Unvollständige PNG-Bilddaten.');
 const stride=width*channels,pixels=new Uint8Array(width*height*3),previous=new Uint8Array(stride);let pos=0;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[pos++];if(filter>4)throw Error('Ungültiger PNG-Filter.');const row=new Uint8Array(stride);for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;row[x]=(raw[pos++]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}for(let x=0;x<width;x++){const at=x*channels,out=(y*width+x)*3,alpha=type===4?row[at+1]/255:type===6?row[at+3]/255:1;for(let c=0;c<3;c++)pixels[out+c]=Math.round(255*(1-alpha)+(type===0||type===4?row[at]:row[at+c])*alpha);}previous.set(row);}
 return {width,height,pixels};
}
// Only cache the small result, never every decoded full-page raster.
const logoMarginCache=new WeakMap();
async function prepareLogoMargins(e,d){
 let changed=false;
 for(const item of C.examEntries(e))for(const [index,page]of (item.task.sourceLayout?.pages||[]).entries()){
  const task=item.task,box=S.logoMarginCandidate(task,page,index);if(!box)continue;
  const asset=d.assets.find(a=>a.id===page.backgroundAssetId);let safe=false;
  if(asset?.mime==='image/png'&&asset.data){
   let cache=logoMarginCache.get(asset);if(!cache||cache.data!==asset.data){cache={data:asset.data,results:new Map()};logoMarginCache.set(asset,cache);}
   const key=JSON.stringify([page.width,page.height,box]);
   if(!cache.results.has(key)){
    let empty=false;try{const raster=await pngPixels(asset),{width,height,pixels}=raster;
     const x0=Math.floor((box.x-4)*width/page.width),x1=Math.ceil((box.x+box.width+4)*width/page.width),y0=Math.floor((box.y-4)*height/page.height),y1=Math.ceil((box.y+box.height+4)*height/page.height);
     empty=x0>=0&&y0>=0&&x1<=width&&y1<=height;
     for(let y=y0;empty&&y<y1;y++)for(let x=x0;x<x1;x++){const at=(y*width+x)*3;if(pixels[at]!==255||pixels[at+1]!==255||pixels[at+2]!==255){empty=false;break;}}
    }catch{/* Missing or unsupported evidence never authorizes an overlay. */}
    cache.results.set(key,empty);
   }
   safe=cache.data===asset.data&&d.assets.find(a=>a.id===page.backgroundAssetId)===asset&&cache.results.get(key);
  }
  changed=S.setLogoMarginProof(page,asset,box,safe)||changed;
 }
 return changed;
}
async function croppedPng(raster,box){
 const {width,pixels}=raster,w=box.x1-box.x0+1,h=box.y1-box.y0+1,raw=new Uint8Array((w*3+1)*h);
 for(let y=0;y<h;y++)raw.set(pixels.subarray(((y+box.y0)*width+box.x0)*3,((y+box.y0)*width+box.x0+w)*3),y*(w*3+1)+1);
 const data=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const a=new Uint8Array(data.length+12),v=new DataView(a.buffer);v.setUint32(0,data.length);a.set([...name].map(c=>c.charCodeAt(0)),4);a.set(data,8);v.setUint32(a.length-4,crc(a.subarray(4,a.length-4)));return a;};
 const ihdr=new Uint8Array(13),v=new DataView(ihdr.buffer);v.setUint32(0,w);v.setUint32(4,h);ihdr[8]=8;ihdr[9]=2;
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',data),chunk('IEND',new Uint8Array())],out=new Uint8Array(parts.reduce((n,a)=>n+a.length,0));let at=0;for(const a of parts){out.set(a,at);at+=a.length;}let binary='';for(let i=0;i<out.length;i+=8192)binary+=String.fromCharCode(...out.subarray(i,i+8192));return btoa(binary);
}
async function sourceElements(page,d){
 if(Array.isArray(page.graphics)&&Array.isArray(page.rules))return {graphics:page.graphics,rules:page.rules};
 const asset=A.requireAsset(d,page.backgroundAssetId);let raster;try{raster=await pngPixels(asset);}catch(error){throw Error('Originalseiten-PNG kann nicht für Word gelesen werden: '+(error.message||'beschädigte Bilddaten'));}const {width:w,height:h,pixels}=raster,sx=page.width/w,sy=page.height/h,mask=new Uint8Array(w*h),covered=new Uint8Array(w*h),segments=[];
 for(let n=0;n<mask.length;n++)mask[n]=Math.min(pixels[n*3],pixels[n*3+1],pixels[n*3+2])<238?1:0;
 for(const vertical of [false,true]){const major=vertical?w:h,minor=vertical?h:w,min=Math.round((vertical?12:24)/(vertical?sy:sx));let previous=[];
  for(let a=0;a<major;a++){const found=[];for(let b=0;b<minor;){const at=vertical?b*w+a:a*w+b;if(!mask[at]){b++;continue;}const start=b;while(b<minor&&mask[vertical?b*w+a:a*w+b])b++;if(b-start<min)continue;const old=previous.find(r=>Math.abs(r.start-start)<=2&&Math.abs(r.end-b)<=2);if(old){old.last=a;old.start=Math.min(old.start,start);old.end=Math.max(old.end,b);found.push(old);}else{const r={vertical,first:a,last:a,start,end:b};segments.push(r);found.push(r);}}previous=found;}
 }
 const lines=segments.filter(r=>(r.last-r.first+1)*(r.vertical?sx:sy)<=2.5);
 for(const r of lines){const x0=r.vertical?r.first:r.start,x1=r.vertical?r.last:r.end-1,y0=r.vertical?r.start:r.first,y1=r.vertical?r.end-1:r.last;Object.assign(r,{x0,x1,y0,y1});for(let y=Math.max(0,y0-1);y<=Math.min(h-1,y1+1);y++)for(let x=Math.max(0,x0-1);x<=Math.min(w-1,x1+1);x++)covered[y*w+x]=1;}
 // Components distinguish a simple response frame from a detailed diagram whose
 // own straight edges must remain part of the figure.
 const components=[],queue=new Int32Array(mask.length);for(let start=0;start<mask.length;start++){if(mask[start]!==1)continue;let head=0,tail=1,count=0,explained=0,x0=w,x1=0,y0=h,y1=0;queue[0]=start;mask[start]=2;
  while(head<tail){const at=queue[head++],x=at%w,y=Math.floor(at/w);count++;explained+=covered[at];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const next=yy*w+xx;if(mask[next]===1){mask[next]=2;queue[tail++]=next;}}}
  if(count>3)components.push({x0,x1,y0,y1,coverage:explained/count,native:explained/count>.985});
 }
 for(const c of components){
  const own=lines.filter(r=>r.x0<=c.x1+1&&r.x1>=c.x0-1&&r.y0<=c.y1+1&&r.y1>=c.y0-1),hs=own.filter(r=>!r.vertical),vs=own.filter(r=>r.vertical);
  const simpleHorizontal=hs.length===1&&!vs.length;
  const rectangle=hs.length>=2&&vs.length>=2&&hs.every(r=>Math.abs(r.x0-c.x0)<4&&Math.abs(r.x1-c.x1)<4)&&hs.some(r=>Math.abs(r.y0-c.y0)<4)&&hs.some(r=>Math.abs(r.y1-c.y1)<4)&&vs.every(r=>Math.abs(r.y0-c.y0)<4&&Math.abs(r.y1-c.y1)<4)&&vs.some(r=>Math.abs(r.x0-c.x0)<4)&&vs.some(r=>Math.abs(r.x1-c.x1)<4);
  // Older source extraction can erase a piece of the identity frame under a
  // logo. Repair only the unambiguous Name/Datum frame with known logo overlap.
  const labels=page.blocks.filter(b=>b.x/sx>=c.x0-4&&(b.x+b.width)/sx<=c.x1+4&&b.y/sy>=c.y0-4&&(b.y+b.height)/sy<=c.y1+4);
  const identity=labels.length===2&&labels.some(b=>/^Name\s*:\s*$/.test(b.text))&&labels.some(b=>/^Datum\s*:\s*$/.test(b.text));
  const logoCut=page.logos.some(l=>l.y/sy<c.y0+4&&(l.y+l.height)/sy>c.y0-4&&l.x/sx<c.x1&&(l.x+l.width)/sx>c.x0);
  const fullSides=vs.length>=2&&vs.every(r=>Math.abs(r.y0-c.y0)<4&&Math.abs(r.y1-c.y1)<4)&&vs.some(r=>Math.abs(r.x0-c.x0)<4)&&vs.some(r=>Math.abs(r.x1-c.x1)<4);
  const fullBottom=hs.some(r=>Math.abs(r.y1-c.y1)<4&&Math.abs(r.x0-c.x0)<4&&Math.abs(r.x1-c.x1)<4);
  const repair=c.coverage>.95&&identity&&logoCut&&fullSides&&fullBottom;
  if(repair){for(const r of hs.filter(r=>Math.abs(r.y0-c.y0)<4))r.suppressed=true;lines.push({vertical:false,first:c.y0,last:c.y0,start:c.x0,end:c.x1+1,x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y0});}
  c.native=c.native&&(simpleHorizontal||rectangle)||repair;
 }
 const figures=components.filter(c=>!c.native),rules=lines.filter(r=>!r.suppressed&&!figures.some(c=>r.x0<=c.x1+2&&r.x1>=c.x0-2&&r.y0<=c.y1+2&&r.y1>=c.y0-2)).map(r=>({x:(r.vertical?(r.x0+r.x1)/2:r.x0)*sx,y:(r.vertical?r.y0:(r.y0+r.y1)/2)*sy,width:r.vertical?0:(r.x1-r.x0+1)*sx,height:r.vertical?(r.y1-r.y0+1)*sy:0,lineWidth:(r.last-r.first+1)*(r.vertical?sx:sy)}));
 // Merge nearby pieces of a drawing so labels/rings remain a single inline figure.
 const bands=[];for(const c of figures.sort((a,b)=>a.y0-b.y0)){const b=bands.at(-1);if(b&&c.y0<=b.y1+Math.round(6/sy)){b.x0=Math.min(b.x0,c.x0);b.x1=Math.max(b.x1,c.x1);b.y1=Math.max(b.y1,c.y1);}else bands.push({...c});}
 const graphics=[];for(const [n,box]of bands.entries()){box.x0=Math.max(0,box.x0-2);box.x1=Math.min(w-1,box.x1+2);box.y0=Math.max(0,box.y0-2);box.y1=Math.min(h-1,box.y1+2);const assetId=page.backgroundAssetId+'-word-'+n;d.assets.push({id:assetId,name:'Originalzeichnung '+(n+1),mime:'image/png',data:await croppedPng(raster,box)});graphics.push({assetId,x:box.x0*sx,y:box.y0*sy,width:(box.x1-box.x0+1)*sx,height:(box.y1-box.y0+1)*sy});}
 return {graphics,rules};
}
async function documentFile(e,input,examiner=false){
 const entries=C.examEntries(e);if(!entries.length)throw Error('Die Prüfung enthält keine Aufgaben.');C.assertExamPolicy(e);S.assertExport(e);
 const d=await A.wordImages(e,input,examiner),fonts=A.fontAssets(d),regular=fonts.find(a=>a.docxFontKey==='sansRegular'),bold=fonts.find(a=>a.docxFontKey==='sansBold'),serif=fonts.find(a=>a.docxFontKey==='serifBold');
 if(entries.some(i=>i.task.assetLinks.some(l=>l.design==='bw-2024'))&&(!regular||!bold||!serif))throw Error('Die geschützten Word-Schriften fehlen. Bitte den Datenbestand aktualisieren.');
 if(entries.some(i=>i.task.sourceLayout)&&!regular)throw Error('Word-Schriften fehlen für die bearbeitbaren Originalseiten. Bitte den Datenbestand aktualisieren.');
 await prepareLogoMargins(e,d);
 const sans=regular?.fontFamily||'Arial',heading=serif?.fontFamily||sans;
 let drawingId=0;
 const draft=!C.readiness(e).ready,label=examiner?'Vertrauliche Prüferfassung':'Teilnehmerfassung',sections=[];
 const border={style:X.BorderStyle.SINGLE,size:4,color:line},none={style:X.BorderStyle.NONE,size:0,color:'FFFFFF'};
 const borders=value=>({top:value,bottom:value,left:value,right:value,insideHorizontal:value,insideVertical:value});
 const run=(text,options={})=>new X.TextRun({text:clean(text),...options});
 function p(text='',style='ExamBody',options={}){
  const children=String(text??'').replace(/\r\n?/g,'\n').split('\n').map((s,n)=>run(s,{...(n?{break:1}:{}),...(options.run||{})}));
  const {run:ignored,...props}=options;return new X.Paragraph({style,children,...props});
 }
 const gap=points=>new X.Paragraph({children:[],spacing:{line:20,lineRule:X.LineRuleType.EXACT,after:tw(points)},widowControl:false});
 function table(rows,widths,{bordered=true,padding=120}={}){
  return new X.Table({width:{size:widths.reduce((a,b)=>a+b,0),type:X.WidthType.DXA},columnWidths:widths,layout:X.TableLayoutType.FIXED,borders:borders(bordered?border:none),rows:rows.map(row=>new X.TableRow({cantSplit:row.keepTogether!==false,tableHeader:!!row.header,height:row.height?{value:row.height,rule:X.HeightRule.ATLEAST}:undefined,children:row.cells.map((children,n)=>new X.TableCell({width:{size:widths[n],type:X.WidthType.DXA},margins:{top:padding,bottom:padding,left:padding,right:padding},verticalAlign:X.VerticalAlign.TOP,shading:row.header?{fill:soft}:undefined,children:Array.isArray(children)?children:[children]}))}))});
 }
 function image(a,maxWidth,maxHeight){
  const [iw,ih]=A.imageSize(a),scale=Math.min(maxWidth/iw,maxHeight/ih);
  return new X.ImageRun({type:{'image/png':'png','image/jpeg':'jpg','image/gif':'gif'}[a.mime],data:A.bytes(a.data),transformation:{width:px(iw*scale),height:px(ih*scale)},altText:{id:String(++drawingId),title:clean(a.name),description:clean(a.name),name:'Prüfungsanlage'}});
 }
 function letterhead(t){
  const links=t?t.assetLinks:entries.flatMap(i=>i.task.assetLinks),candidates=links.filter(l=>l.role==='letterhead'&&l.audience==='candidate'),link=candidates.find(l=>l.design==='bw-2024')||candidates[0];
  const text=[p('Praktischer Prüfungstag','ExamHeader'),p('„'+e.specialty+'“','ExamHeader'),p((C.examTypeLabel(e.examType))+' '+(e.examYear||'')+' · '+label,'ExamSmall',{spacing:{before:100,after:0}})];
  return new X.Header({children:link?[table([{cells:[[new X.Paragraph({children:[image(A.requireAsset(d,link.assetId),156,66)],spacing:{after:0}})],[p('','ExamSmall')],text]}],[mm(55),mm(10),mm(109)],{bordered:false,padding:0}),gap(0)]:text});
 }
 function originalFooter(item){return [...(item?.component==='oral'?[p('Mündliche Prüfungsaufgabe','ExamSmall',{alignment:X.AlignmentType.CENTER,spacing:{line:220,after:0},run:{size:16,color:ink}})]:[]),...(S.scopeLabel(e)?[p(S.scopeLabel(e),'ExamSmall',{alignment:X.AlignmentType.CENTER,spacing:{line:220,after:0},run:{size:16,color:ink}})]:[]),p(draft?'ENTWURF · NICHT FREIGEGEBEN':(examiner?label:''),'ExamSmall',{alignment:X.AlignmentType.CENTER})];}
 function footer(original=false){
  if(original)return new X.Footer({children:originalFooter()});
  return new X.Footer({children:[new X.Paragraph({style:'ExamSmall',border:{top:{...border,space:6}},tabStops:[{type:X.TabStopType.RIGHT,position:paperWidth}],children:[run(label+' · '),run(draft?'ENTWURF · NICHT FREIGEGEBEN':e.specialty),new X.TextRun({children:[new X.Tab(),'Seite ',X.PageNumber.CURRENT,' / ',X.PageNumber.TOTAL_PAGES]})]})]});
 }
 function section(children,{task=null,original=false,page={width:595.3,height:841.9},header=null,sourceFooter=null,margins=null,type=X.SectionType.NEXT_PAGE}={}){
  sections.push({properties:{type,page:{size:{width:tw(page.width),height:tw(page.height)},margin:margins||(original?{top:tw(42),bottom:tw(S.scopeLabel(e)?56:42),left:tw(54),right:tw(36),header:tw(24),footer:tw(24)}:{top:mm(48),bottom:mm(20),left:mm(18),right:mm(18),header:mm(18),footer:mm(10)})}},headers:{default:header||(original?new X.Header({children:[p('','ExamSmall')]}):letterhead(task))},footers:{default:sourceFooter||footer(original)},children:children.length?(original?children:[gap(0),...children]):[gap(0)]});
 }
 function identity(){return table([{height:mm(15),cells:[p('Name / Prüflingsnummer:','ExamMeta',{run:{bold:true}}),p('Datum: '+(e.date||''),'ExamMeta',{run:{bold:true}})]}],[Math.round(paperWidth*.58),paperWidth-Math.round(paperWidth*.58)],{padding:mm(3)});}
 function callout(text){return new X.Table({width:{size:paperWidth,type:X.WidthType.DXA},columnWidths:[paperWidth],borders:borders(none),rows:[new X.TableRow({cantSplit:true,children:[new X.TableCell({shading:{fill:'FFF4DF'},margins:{top:180,bottom:180,left:180,right:180},children:[p(text,'ExamMeta')]})]})]});}
 function planningBox(){return table([{height:mm(44),cells:[p('','ExamBody')]}],[paperWidth],{padding:140});}
 const graphics=(t,audience)=>t.assetLinks.filter(l=>l.audience===audience&&!['letterhead','brand-font','source-page'].includes(l.role)&&!(t.sourceLayout&&l.role==='source-embedded'));
 function graphic(l){const a=A.requireAsset(d,l.assetId);if(/^image\//.test(a.mime))return [new X.Paragraph({children:[image(a,paperWidth/20,mm(175)/20)],keepNext:true,spacing:{before:180,after:80}}),p(l.caption||a.name,'ExamSmall')];const file=P.attachments({items:[{task:{assetLinks:[l]}}]},d,true)[0];return [callout('Separate Anlage: '+(file?.path||a.name)+' – vor Ausgabe beifügen.')];}
 if(!entries.some(i=>i.task.sourceLayout)){
  const total=C.totals(e);
  section([p((C.examTypeLabel(e.examType))+' '+(e.examYear||''),'ExamEyebrow'),p(e.title,'ExamTitle'),p(e.specialty,'ExamSubtitle'),gap(10),table([{cells:[p('Prüfungstermin','ExamMeta',{run:{bold:true}}),p(e.date||'Noch festzulegen','ExamMeta')]},{cells:[p('Umfang','ExamMeta',{run:{bold:true}}),p(`Praktischer Teil: ${e.items.length} Aufgaben · ${total.points}${total.unknownPoints?' + offene':''} Punkte`,'ExamMeta')]},{cells:[p('Bearbeitungszeit','ExamMeta',{run:{bold:true}}),p(C.durationSummary(total),'ExamMeta')]},...(e.oralItem?[{cells:[p('Mündliche Aufgabe','ExamMeta',{run:{bold:true}}),p(`${e.oralItem.task.points??'offene'} Punkte · ${e.oralItem.task.minutes??'offene'} Minuten`,'ExamMeta')]}]:[])],[mm(38),paperWidth-mm(38)],{bordered:false,padding:100}),gap(14),identity(),gap(14),p('Hinweise zur Durchführung','ExamHeading'),p(e.notes||'','ExamBody'),gap(12),callout(draft?'ENTWURF · Vor Verwendung Aufgaben, Punkte, Zeiten und Lösungen fachlich prüfen.':'Freigaben vollständig')]);
 }
 // Source coordinates guide reading order, indents and response space only.
 // All wording remains ordinary Word runs. Paragraphs may wrap and span pages.
 function sourceRuns(b){
  const original=b.text===b.originalText,lines=original?b.lines.map(l=>l.runs):String(b.text).split('\n').map(text=>[{text,bold:false,italic:false}]);
  return lines.flatMap((rs,n)=>{const soft=original&&n&&lines[n-1].map(r=>r.text).join('').trim().length>35,prefix=n?(soft?[run(' ')]:[run('',{break:1})]):[];return [...prefix,...rs.map(r=>run(r.text,{font:sans,size:Math.round(b.fontSize*2),bold:r.bold,italics:r.italic,color:ink}))];});
 }
 function sourceParagraph(blocks,left,{before=0,after=0,keepNext=false}={}){
  blocks=[...blocks].sort((a,b)=>a.x-b.x);
  const continuation=blocks.length===1&&/Fortsetzung.*Rückseite/.test(blocks[0].text);const first=blocks[0],label=blocks.length===2&&first.width<30&&blocks[1].x-first.x<55,main=label?blocks[1]:first;
  const children=[];blocks.forEach((b,n)=>{if(n)children.push(new X.TextRun({children:[new X.Tab()]}));children.push(...sourceRuns(b));});
  return new X.Paragraph({children,...(continuation?{alignment:X.AlignmentType.RIGHT}:{}),indent:{left:continuation?0:tw(Math.max(0,main.x-left)),...(label?{hanging:tw(main.x-first.x)}:{})},tabStops:blocks.slice(1).map(b=>({type:X.TabStopType.LEFT,position:tw(Math.max(0,b.x-left))})),spacing:{before:tw(before),after:tw(after),line:tw(Math.max(...blocks.map(b=>b.lineHeight))),lineRule:X.LineRuleType.AT_LEAST},keepNext,keepLines:false,widowControl:false});
 }
 function sourcePage(page,t,item,index,logos){
  const left=Math.min(54,...page.blocks.map(b=>b.x)),right=36,width=page.width-left-right;
  const headerBlocks=page.blocks.filter(b=>b.y<100&&(/Prüf/i.test(b.text)||/^\s*-\s*\d+\s*-\s*$/.test(b.text)));
  const footerBlocks=[];
  const bodyBlocks=page.blocks.filter(b=>!headerBlocks.includes(b)&&!footerBlocks.includes(b));
  const logo=t.assetLinks.find(l=>l.role==='letterhead'&&l.design==='bw-2024'&&l.audience==='candidate');
  if(logos.length&&!logo)throw Error('Landeslogo fehlt für die Originalvorlage.');
  const headerChildren=headerBlocks.map(b=>sourceParagraph([b],left));
  for(const box of logos)headerChildren.push(new X.Paragraph({children:[image(A.requireAsset(d,logo.assetId),box.width,box.height)],alignment:X.AlignmentType.RIGHT,spacing:{after:0,before:0,line:tw(box.height),lineRule:X.LineRuleType.AT_LEAST}}));
  const header=new X.Header({children:headerChildren.length?headerChildren:[p('','ExamSmall')]});
  const sourceFooter=new X.Footer({children:[...footerBlocks.map(b=>sourceParagraph([b],left)),...originalFooter(item)]});
  const rules=page.rules||[],horizontal=rules.filter(r=>r.width>24&&(r.height||0)<2.5),vertical=rules.filter(r=>r.height>12&&r.width<2.5),frames=[],usedRules=new Set(),framedBlocks=new Set();
  for(const top of horizontal){const bottoms=horizontal.filter(r=>r!==top&&r.y>top.y+12&&Math.abs(r.x-top.x)<3&&Math.abs(r.width-top.width)<3).sort((a,b)=>a.y-b.y);
   for(const bottom of bottoms){const edges=vertical.filter(r=>r.y<=top.y+3&&r.y+r.height>=bottom.y-3&&r.x>=top.x-3&&r.x<=top.x+top.width+3);if(!edges.some(r=>Math.abs(r.x-top.x)<3)||!edges.some(r=>Math.abs(r.x-top.x-top.width)<3))continue;
    const xs=[top.x,...edges.map(r=>r.x).filter(x=>x>top.x+3&&x<top.x+top.width-3),top.x+top.width].sort((a,b)=>a-b),frame={kind:'frame',y:top.y,bottom:bottom.y,x:top.x,xs,blocks:bodyBlocks.filter(b=>b.x>=top.x-2&&b.x+b.width<=top.x+top.width+3&&b.y>=top.y-3&&b.y+b.height<=bottom.y+3)};
    frame.blocks.forEach(b=>framedBlocks.add(b));frames.push(frame);[top,bottom,...edges].forEach(r=>usedRules.add(r));break;
   }
  }
  const rows=[];
  function textRows(blocks){const bullet=b=>b.width<=12&&/^[•·∙]$/.test(b.text.trim()),result=[];for(const b of [...blocks].sort((a,b)=>a.y-b.y||a.x-b.x)){const row=result.at(-1);if(row&&(Math.abs(row.y-b.y)<3||(bullet(b)||row.blocks.some(bullet))&&Math.abs(row.bottom-b.y-b.height)<3)&&row.blocks.every(a=>a.x+a.width<=b.x+2||b.x+b.width<=a.x+2)){row.blocks.push(b);row.bottom=Math.max(row.bottom,b.y+b.height);}else result.push({kind:'text',y:b.y,bottom:b.y+b.height,blocks:[b]});}return result;}
  rows.push(...textRows(bodyBlocks.filter(b=>!framedBlocks.has(b))),...frames);
  // Explicit source graphics are cropped drawings, never rendered source wording.
  for(const g of page.graphics||[]){if(bodyBlocks.some(b=>b.text.trim()&&b.x<g.x+g.width+6&&b.x+b.width>g.x-6&&b.y<g.y+g.height+3&&b.y+b.height>g.y-3))throw Error('Beschriftete Originalzeichnung kann nicht ohne veränderte Zuordnung in Word übertragen werden. Bitte die Zeichnung als eigenständige beschriftete Anlage hinterlegen.');rows.push({kind:'graphic',y:g.y,bottom:g.y+g.height,graphic:g});}
  for(const r of rules.filter(r=>!usedRules.has(r)))rows.push({kind:'rule',y:r.y,bottom:r.y+(r.height||0),rule:r});
  rows.sort((a,b)=>a.y-b.y||(a.kind==='text'?-1:1));
  const sourceTop=Math.max(36,Math.min(160,rows[0]?.y||72)),headerBottom=headerBlocks.length||logos.length?Math.max(...headerBlocks.map(b=>b.y+b.height),...logos.map(b=>b.y+b.height))+(logos.some(b=>b.fallback)?6:12):0,top=Math.max(sourceTop,headerBottom),children=[];let previous=sourceTop;
  for(const row of rows){
   const originalGap=Math.max(0,row.y-previous),before=row.kind==='frame'?Math.min(8,originalGap):originalGap<60?Math.min(18,originalGap):originalGap;
   if(row.kind==='text')children.push(sourceParagraph(row.blocks,left,{before}));
   else if(row.kind==='frame'){
    const widths=row.xs.slice(1).map((x,n)=>tw(x-row.xs[n])),cells=widths.map((_,n)=>{const blocks=row.blocks.filter(b=>b.x>=row.xs[n]-2&&b.x<row.xs[n+1]-2),content=textRows(blocks);let bottom=row.y;return content.length?content.map(r=>{const paragraph=sourceParagraph(r.blocks,row.xs[n]+4,{before:Math.max(0,r.y-bottom-4)});bottom=r.bottom;return paragraph;}):[p('','ExamSmall',{spacing:{after:0,line:20,lineRule:X.LineRuleType.AT_LEAST}})];});
    if(before>0)children.push(gap(Math.max(0,before-1)));
    children.push(new X.Table({width:{size:widths.reduce((a,b)=>a+b,0),type:X.WidthType.DXA},indent:{size:tw(row.x-left),type:X.WidthType.DXA},columnWidths:widths,layout:X.TableLayoutType.FIXED,borders:borders({...border,color:ink}),rows:[new X.TableRow({cantSplit:row.bottom-row.y<70,height:{value:tw(row.bottom-row.y),rule:X.HeightRule.ATLEAST},children:cells.map((content,n)=>new X.TableCell({width:{size:widths[n],type:X.WidthType.DXA},margins:{top:tw(4),bottom:tw(4),left:tw(4),right:tw(4)},children:content}))})]}));
   }
   else if(row.kind==='graphic'){
    const g=row.graphic;children.push(new X.Paragraph({children:[image(A.requireAsset(d,g.assetId),Math.min(g.width,width),Math.min(g.height,page.height-top-54))],indent:{left:tw(Math.max(0,g.x-left))},spacing:{before:tw(before),after:0,line:20,lineRule:X.LineRuleType.AT_LEAST},keepNext:false}));
   }else{
    const r=row.rule;children.push(new X.Paragraph({children:[],indent:{left:tw(Math.max(0,r.x-left)),right:tw(Math.max(0,page.width-right-r.x-r.width))},border:{[r.height>r.width?'left':'bottom']:{style:X.BorderStyle.SINGLE,size:Math.max(2,Math.round((r.lineWidth||r.strokeWidth||.5)*8)),color:ink,space:0}},spacing:{before:tw(Math.max(0,before-1)),after:0,line:r.height>r.width?tw(r.height):20,lineRule:X.LineRuleType.AT_LEAST},widowControl:false}));
   }
   previous=Math.max(previous,row.bottom);
  }
  if(rows.at(-1)?.kind==='frame')children.push(gap(0));
  return {children,header,sourceFooter,margins:{top:tw(top),bottom:tw(footerBlocks.length?66:S.scopeLabel(e)||item?.component==='oral'?56:42),left:tw(left),right:tw(right),header:tw(logos.some(b=>b.fallback)?logos[0].y:headerBlocks[0]?.y||36),footer:tw(24)}};
 }
 for(const [n,item] of entries.entries()){const t=item.task;
  if(t.sourceLayout){
   for(const [index,page] of t.sourceLayout.pages.entries()){
    const flow=sourcePage({...page,...await sourceElements(page,d),blocks:S.displayBlocks(page)},t,item,index,S.logoBoxes(t,page,index,d));
    section(flow.children,{original:true,page,...flow,type:index?X.SectionType.NEXT_PAGE:X.SectionType.ODD_PAGE});
   }
   if(t.sourceLayout.pages.length%2)section([gap(0)],{original:true,page:t.sourceLayout.pages.at(-1)});
  }else{
   section([identity(),gap(12),p(item.label,'ExamEyebrow'),p(t.title,'TaskTitle'),table([{cells:[p(`${t.points??'Offene'} Punkte`,'ExamMeta',{run:{bold:true}}),p('Bearbeitungszeit: '+(t.minutes==null?'noch festzulegen':t.minutes+' Minuten'),'ExamMeta')]}],[mm(50),paperWidth-mm(50)],{bordered:false,padding:80}),gap(8),...(t.pointsProposal&&t.reviewStatus!=='approved'?[callout('Punktevorschlag · Gesamt- und Teilpunkte vor dem Einsatz fachlich prüfen.'),gap(6)]:[]),...(P.timingNotes(t)?[p(P.timingNotes(t),'ExamMeta',{shading:{fill:soft}})]:[]),p(t.text),...graphics(t,'candidate').flatMap(graphic),gap(10),p(item.component==='oral'?'Vorbereitung / Notizen':'Durchführungsplanung / Bearbeitung','ExamHeading'),planningBox()],{task:t,type:X.SectionType.ODD_PAGE});
  }
 }
 for(const item of entries)if(item.task.sourceLayout)for(const l of graphics(item.task,'candidate'))section([p('Zusätzliche Anlage · '+item.label,'TaskTitle'),...graphic(l)],{task:item.task});
 if(examiner){const g=P.regulationGuidance(e);if(g){
  const compact=text=>p(text,'ExamMeta',{spacing:{line:260,after:100}}),children=[p(g.title,'TaskTitle'),compact(g.status),compact(g.areas),...g.rules.map(compact)];
  if(g.units.length)children.push(p('Ausdrücklich erklärte komplexe Prüfungsaufgaben','ExamHeading'),table([{header:true,cells:['Aufgabenblatt','Komplexe Prüfungsaufgabe','Bereich / Begründung'].map(v=>p(v,'ExamTable',{run:{bold:true}}))},...g.units.map(u=>({keepTogether:false,cells:[compact(u.document),compact(u.title),compact(u.area+(u.reason?'\n'+u.reason:'') )]}))],[mm(28),mm(62),paperWidth-mm(90)],{padding:100}));
  if(g.review.length)children.push(p('Fachliche Bestätigungen','ExamHeading'),...g.review.map(compact));
  children.push(compact(g.caution),p(g.source,'ExamSmall'),new X.Paragraph({style:'ExamSmall',children:[new X.ExternalHyperlink({link:g.url,children:[run('Amtlicher Verordnungstext',{style:'Hyperlink'})]})]}));
  section(children);
 }}
 if(examiner)for(const [n,item] of entries.entries()){const t=item.task;
  const criteria=t.criteria.length?t.criteria:[{text:'Gesamtbewertung',answer:'Bewertungskriterien ergänzen',points:t.points}];
  const rows=[{header:true,cells:['Kriterium / Teilaufgabe','Erwartete Leistung','Max.','Erreicht'].map(v=>p(v,'ExamTable',{run:{bold:true}}))},...criteria.map(c=>({keepTogether:false,cells:[p(c.text,'ExamTable'),p(c.answer||'Erwartung ergänzen','ExamTable'),p(c.points??'offen','ExamTable'),p('','ExamTable')]}))];
  section([p(item.label+' · Lösung und Bewertung','TaskTitle'),p(t.title,'ExamSubtitle'),p('Lösung / Erwartungshorizont','ExamHeading'),...(t.solutionStatus!=='approved'?[callout('ENTWURF · Lösung noch fachlich prüfen und freigeben.'),gap(8)]:[]),p(t.solution||'Keine Musterlösung hinterlegt. Fachlich ergänzen und freigeben.'),gap(8),p('Bewertung','ExamHeading'),p(C.pointsLabel(t),'ExamMeta'),table(rows,[2762,4340,1381,paperWidth-8483],{padding:120}),...graphics(t,'examiner').flatMap(graphic),gap(8),p('Beobachtungen / Begründung:','ExamMeta')],{task:t});
 }
 const style=(id,name,font,size,paragraph={},runProps={})=>({id,name,basedOn:'Normal',next:'ExamBody',quickFormat:true,run:{font,size,color:ink,...runProps},paragraph});
 const doc=new X.Document({title:clean(e.title),creator:'Prüfungswerkstatt Gartenbau',description:label,features:{updateFields:true},compatabilityModeVersion:15,styles:{default:{document:{run:{font:sans,size:22,color:ink,language:{value:'de-DE'}},paragraph:{spacing:{line:336,after:120},widowControl:true}}},paragraphStyles:[
  style('ExamBody','Prüfung – Fließtext',sans,22,{spacing:{line:336,after:120}}),
  style('ExamTitle','Prüfung – Titel',heading,48,{spacing:{before:160,after:240,line:276},keepNext:true,keepLines:true},{bold:true}),
  style('TaskTitle','Prüfung – Aufgabe',heading,40,{spacing:{before:80,after:220,line:276},keepNext:true,keepLines:true},{bold:true}),
  style('ExamHeading','Prüfung – Zwischenüberschrift',sans,26,{spacing:{before:160,after:120},keepNext:true,keepLines:true},{bold:true}),
  style('ExamSubtitle','Prüfung – Untertitel',sans,28,{spacing:{after:180},keepNext:true}),
  style('ExamHeader','Prüfung – Briefkopf',sans,24,{spacing:{line:280,after:0}},{bold:true}),
  style('ExamEyebrow','Prüfung – Aufgabenkennzeichnung',sans,20,{spacing:{after:100},keepNext:true},{bold:true}),
  style('ExamMeta','Prüfung – Angaben',sans,20,{spacing:{line:300,after:60}}),
  style('ExamSmall','Prüfung – Fußzeile',sans,17,{spacing:{line:270,after:0}},{color:muted}),
  style('ExamTable','Prüfung – Bewertung',sans,20,{spacing:{line:290,after:0},keepLines:true})
 ]},sections});
 const z=await Zip.loadAsync(await X.Packer.toArrayBuffer(doc));
 // docx adds an otherwise unstyled paragraph to each section break. Its default
 // body line height can push a full native planning table onto an extra page.
 const body=await z.file('word/document.xml').async('string');z.file('word/document.xml',body.replace(/<w:p><w:pPr><w:sectPr>/g,'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr><w:sectPr>'));await A.embedFonts(z,fonts);
 return z.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
async function organizationDocument(e,input,kind){
 const r=O.report(e,input,kind),link=O.logoLink(e),brandExam={items:[{task:{assetLinks:link?[link]:[]}}]},d=await A.wordImages(brandExam,input,false),fonts=A.fontAssets(d),sans=fonts.find(a=>a.docxFontKey==='sansRegular')?.fontFamily||'Arial',heading=fonts.find(a=>a.docxFontKey==='serifBold')?.fontFamily||'Georgia';
 const p=(text,style='OrgBody',extra={})=>new X.Paragraph({style,children:[new X.TextRun({text:clean(text)})],...extra});
 const paragraphs=text=>String(text??'').replace(/\r\n?/g,'\n').split('\n').map(line=>p(line));
 const children=[];
 if(link){const logo=A.requireAsset(d,link.assetId),[w,h]=A.imageSize(logo),scale=Math.min(210/w,85/h);children.push(new X.Paragraph({children:[new X.ImageRun({type:{'image/png':'png','image/jpeg':'jpg','image/gif':'gif'}[logo.mime],data:A.bytes(logo.data),transformation:{width:w*scale,height:h*scale},altText:{title:'Briefkopf',description:'Briefkopf der Prüfung',name:'Briefkopf'}})],spacing:{after:180}}));}
 children.push(p(r.confidential,'OrgSmall'),p(r.title,'OrgTitle'));
 for(const [label,value]of r.metadata)children.push(new X.Paragraph({style:'OrgMeta',children:[new X.TextRun({text:clean(label)+': ',bold:true}),new X.TextRun({text:clean(value)})]}));
 children.push(p(r.intro,'OrgIntro'));
 for(const s of r.sections){children.push(p(s.label,'OrgLabel'),p(s.title,'OrgHeading'));if(s.status)children.push(p(s.status,'OrgStatus'));children.push(...paragraphs(s.text));if(s.origin)children.push(p(s.origin,'OrgSmall'));}
 if(!r.sections.length)children.push(p(r.empty));
 const style=(id,font,size,paragraph={},run={})=>({id,name:id,basedOn:'Normal',next:'OrgBody',quickFormat:true,run:{font,size,color:ink,...run},paragraph});
 const doc=new X.Document({title:clean(r.title+' · '+e.title),creator:'Prüfungswerkstatt Gartenbau',description:r.confidential,features:{updateFields:true},styles:{default:{document:{run:{font:sans,size:22,color:ink,language:{value:'de-DE'}},paragraph:{spacing:{line:300,after:100},widowControl:true}}},paragraphStyles:[style('OrgBody',sans,22,{keepLines:false,spacing:{line:300,after:80}}),style('OrgTitle',heading,48,{keepNext:true,spacing:{before:120,after:260}},{bold:true}),style('OrgHeading',sans,28,{keepNext:true,spacing:{after:100}},{bold:true}),style('OrgMeta',sans,20,{spacing:{after:80}}),style('OrgIntro',sans,22,{spacing:{before:240,after:140}}),style('OrgLabel',sans,18,{keepNext:true,spacing:{before:260,after:60}},{color:muted}),style('OrgStatus',sans,20,{keepNext:true,spacing:{after:100}},{bold:true}),style('OrgSmall',sans,18,{spacing:{after:100}},{color:muted})]},sections:[{properties:{page:{size:{width:mm(210),height:mm(297)},margin:{top:mm(18),bottom:mm(22),left:mm(18),right:mm(18),footer:mm(10)}}},footers:{default:new X.Footer({children:[p(r.footer,'OrgSmall'),new X.Paragraph({style:'OrgSmall',alignment:X.AlignmentType.RIGHT,children:[new X.TextRun({children:['Seite ',X.PageNumber.CURRENT,' / ',X.PageNumber.TOTAL_PAGES]})]})]})},children}]});
 const z=await Zip.loadAsync(await X.Packer.toArrayBuffer(doc));await A.embedFonts(z,fonts);return z.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
const api={organization:organizationDocument,document:documentFile,prepareLogoMargins,requiredAssetIds:A.requiredAssetIds,fontAssets:A.fontAssets};root.HortiDocx=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
