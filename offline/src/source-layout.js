/* Source page geometry and literal wording. No source content is bundled here. */
(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail=()=>{throw Error('Ungültige Originalvorlage. Seiten und Anlagen prüfen.');};
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
function validateGeometry(t){const s=t.sourceLayout;if(s===undefined)return;if(!s||s.version!==1||!t.sourceIds.includes(s.sourceId)||typeof s.reference!=='string'||typeof s.baselineText!=='string'||typeof s.sourcePdfHash!=='string'||!/^[a-f0-9]{64}$/.test(s.sourcePdfHash)||!Array.isArray(s.pages)||!s.pages.length||s.pages.length>30||!Array.isArray(s.warnings)||s.warnings.some(x=>typeof x!=='string'))fail();const ids=new Set();for(const p of s.pages){if(!finite(p.width,100,1500)||!finite(p.height,100,1500)||!Array.isArray(p.blocks)||p.blocks.length>400||!Array.isArray(p.logos)||p.logos.length>10)fail();if(!t.assetLinks.some(l=>l.assetId===p.backgroundAssetId&&l.audience==='candidate'&&l.role==='source-page'))fail();for(const b of [...p.blocks,...p.logos]){if(!finite(b.x,0,p.width)||!finite(b.y,0,p.height)||!finite(b.width,.1,p.width+2)||!finite(b.height,.1,p.height+2)||b.x+b.width>p.width+3||b.y+b.height>p.height+3)fail();}for(const b of p.blocks){if(typeof b.id!=='string'||!b.id||ids.has(b.id)||typeof b.text!=='string'||b.text.length>20000||typeof b.originalText!=='string'||b.originalText.length>20000||!finite(b.fontSize,3,100)||!finite(b.lineHeight,3,150)||!Array.isArray(b.lines)||b.lines.length>200)fail();ids.add(b.id);for(const l of b.lines){if(typeof l.text!=='string'||!Array.isArray(l.runs)||l.runs.length>1000||l.runs.some(r=>typeof r.text!=='string'||typeof r.bold!=='boolean'||typeof r.italic!=='boolean'))fail();}}}}
function validate(t){
 validateGeometry(t);
 for(const p of t.sourceLayout?.pages||[]){
  if(p.textEdits===undefined)continue;
  if(!Array.isArray(p.textEdits)||p.textEdits.length>2000||p.textEdits.some(e=>!e||typeof e.id!=='string'||typeof e.text!=='string'||e.text.length>20000||e.legacy!==undefined&&typeof e.legacy!=='boolean'||e.width!==undefined&&(!Number.isFinite(e.width)||e.width<12||e.width>p.width)))fail();
  const ids=new Set(groups(p).map(g=>g.id)),seen=new Set();for(const e of p.textEdits){if(!ids.has(e.id)||seen.has(e.id))fail();seen.add(e.id);}
 }
}
function stale(t){return !!t.sourceLayout&&t.sourceLayout.baselineText!==t.text;}
function assertExport(e){const C=root.HortiCore||(typeof require==='function'?require('./core.js'):null);C.assertOralPolicy(e);for(const i of C.examEntries(e,{alternatives:true})){validate(i.task);if(stale(i.task))throw Error('Originalseiten von „'+i.task.title+'“ stimmen nicht mehr mit dem Aufgabentext überein. Text direkt auf den Vorlagenseiten bearbeiten oder eine passende Originalvorlage zuordnen.');if(i.task.sourceLayout?.warnings.length)throw Error('Originalvorlage von „'+i.task.title+'“ muss vor dem Export geprüft werden: '+i.task.sourceLayout.warnings.join(' '));}}
// PDF extraction keeps visual runs, not paragraph identities. Derive editing
// points from immutable source lines so their identities survive edits/reloads.
const marker=/^\s*(?:[•·∙▪◦‣]|\d{1,3}[.)]|[a-z][.)]|[-–—](?=\s|$))(?:\s|$)/i;
const markerOnly=/^\s*(?:[•·∙▪◦‣]|\d{1,3}[.)]|[a-z][.)]|[-–—])\s*$/i;
const plain=text=>String(text).replace(/[ \t]*\n[ \t]*/g,' ').trim();
const boldLine=line=>line.runs.some(r=>r.text.trim())&&line.runs.filter(r=>r.text.trim()).every(r=>r.bold);
// Old block edits can invalidate source line offsets. Keep ambiguous legacy
// blocks whole and pin their :all identity when paragraph edits are saved.
function fragments(page){
 const out=[];
 for(const b of page.blocks){
  const lines=b.lines.length?b.lines:b.originalText.split('\n').map(text=>({text,runs:[{text,bold:false,italic:false}]})),current=b.text.split('\n'),wholeId='point:'+encodeURIComponent(b.id)+':all',whole=(page.textEdits||[]).some(e=>e.id===wholeId)||!page.textEdits?.length&&b.text!==b.originalText&&(current.length!==lines.length||lines.some((l,n)=>!l.text.trim()&&current[n]?.trim())),cuts=[0];
  for(let n=1;!whole&&n<lines.length;n++)if(marker.test(lines[n].text)||!lines[n-1].text.trim()||!lines[n].text.trim()||boldLine(lines[n])!==boldLine(lines[n-1])&&(boldLine(lines[n])&&lines[n].text.trim().length<80||boldLine(lines[n-1])&&lines[n-1].text.trim().length<80))cuts.push(n);
  cuts.push(lines.length);
  for(let n=0;n<cuts.length-1;n++){
   const start=cuts[n],end=cuts[n+1],slice=lines.slice(start,end),text=slice.map(l=>l.text).join('\n');
   out.push({...b,block:b,start,end,whole,lines:slice,text,originalText:text,y:b.y+start*b.lineHeight,height:cuts.length===2?b.height:Math.min(b.height-start*b.lineHeight,(end-start-1)*b.lineHeight+Math.min(b.height,b.lineHeight+1))});
  }
 }
 return out;
}
function groupGeometry(parts){
 const x=Math.min(...parts.map(p=>p.x)),y=Math.min(...parts.map(p=>p.y)),right=Math.max(...parts.map(p=>p.x+p.width)),bottom=Math.max(...parts.map(p=>p.y+p.height)),body=parts.filter(p=>!markerOnly.test(p.originalText)),main=body[0]||parts[0];
 return {x,y,width:right-x,height:bottom-y,fontSize:main.fontSize,lineHeight:main.lineHeight,indent:Math.max(0,main.x-x),body,parts};
}
// Bullet groups (marker + text): continuation and new lines start under the item text, not under the marker.
const hanging=g=>g.parts?.length>1&&markerOnly.test(g.parts[0].originalText)&&g.indent>.5?g.indent:0;
const indentStyle=n=>n?` style="padding-left:${n}pt;text-indent:-${n}pt;tab-size:${n}pt"`:'';
// Shown with a tab after the marker so the first line's text starts exactly where the original did; stored with a space.
const tabbed=(text,n)=>n?String(text).replace(/^(\s*(?:[•·∙▪◦‣]|\d{1,3}[.)]|[a-z][.)]|[-–—]))[ \t]+/i,'$1\t'):String(text);
function groupText(parts,original=true){return parts.map(p=>{
 if(original||p.block.text===p.block.originalText)return plain(p.originalText);if(p.whole)return p.block.text;
 const lines=p.block.text.split('\n');return plain(lines.length===p.block.lines.length?lines.slice(p.start,p.end).join('\n'):p.start===0?p.block.text:'');
}).filter(Boolean).join(' ');}
function groups(page){
 const parts=fragments(page).filter(p=>p.whole||p.originalText.trim()||p.start===0&&p.block.text.trim()),used=new Set(),rows=[];
 for(const p of parts.filter(p=>markerOnly.test(p.originalText))){
  const next=parts.filter(q=>q!==p&&!used.has(q)&&!markerOnly.test(q.originalText)&&q.x>=p.x+p.width-2&&q.x-p.x<=60&&Math.abs(q.y-p.y)<=Math.max(4,p.fontSize*.45)).sort((a,b)=>a.x-b.x)[0];
  if(next){rows.push(groupGeometry([p,next]));used.add(p);used.add(next);}
 }
 for(const p of parts)if(!used.has(p))rows.push(groupGeometry([p]));
 rows.sort((a,b)=>a.y-b.y||a.x-b.x);
 const result=[];
 for(const row of rows){
  const last=result.at(-1),first=row.parts[0],prev=last?.body.at(-1)||last?.parts.at(-1),gap=last?row.y-last.y-last.height:Infinity,previous=prev?.originalText.trim()||'',next=first.originalText.trim();
  const separator=(page.rules||[]).some(r=>r.width>24&&(r.height||0)<3&&last&&r.y>=last.y+last.height-2&&r.y<=row.y+2&&r.x<Math.max(last.x+last.width,row.x+row.width)&&r.x+r.width>Math.min(last.x,row.x));
  const continuation=last&&!first.whole&&!prev.whole&&!marker.test(next)&&!separator&&gap>=-3&&gap<=Math.max(3,row.lineHeight*.48)&&Math.abs(row.fontSize-last.fontSize)<1&&Math.abs(first.x-prev.x)<=60&&row.x<last.x+last.width&&last.x<row.x+row.width&&!prev.lines.every(boldLine)&&!first.lines.every(boldLine)&&(previous.length>30||/^[a-zäöüß]/.test(next)||marker.test(last.parts[0].originalText));
  if(continuation)Object.assign(last,groupGeometry([...last.parts,...row.parts]));else result.push(row);
 }
 const edits=new Map((page.textEdits||[]).map(e=>[e.id,e.text]));
 for(const g of result){g.id='point:'+encodeURIComponent(g.parts[0].block.id)+':'+(g.parts[0].whole?'all':g.parts[0].start);g.originalText=groupText(g.parts);}
 const touched=new Set(result.filter(g=>edits.has(g.id)).flatMap(g=>g.parts.map(p=>p.block.id)));
 for(const g of result){g.text=edits.has(g.id)?edits.get(g.id):g.parts.some(p=>touched.has(p.block.id))?g.originalText:groupText(g.parts,false);g.edited=g.text!==g.originalText;}
 return result;
}
function read(t,id){for(const p of t.sourceLayout?.pages||[]){const g=groups(p).find(g=>g.id===id);if(g)return g.text;const b=p.blocks.find(b=>b.id===id);if(b)return b.text;}return '';}
function connectedBlocks(points,ids){const selected=new Set(ids);let added=true;while(added){added=false;for(const g of points)if(g.parts.some(p=>selected.has(p.block.id)))for(const p of g.parts)if(!selected.has(p.block.id)){selected.add(p.block.id);added=true;}}return selected;}
function rebuild(page,points,affected){
 const replacements=new Map();
 for(const g of points){const edit=(page.textEdits||[]).find(e=>e.id===g.id);for(const [n,p] of g.parts.entries())replacements.set(p.block.id+':'+p.start,edit?(n===0?edit.text:null):p.originalText);}
 for(const b of page.blocks)if(affected.has(b.id))b.text=fragments({...page,blocks:[b]}).map(p=>replacements.has(b.id+':'+p.start)?replacements.get(b.id+':'+p.start):p.originalText).filter(text=>text!==null).join('\n');
}
function edit(t,id,text){
 validate(t);if(typeof text!=='string'||text.length>20000)throw Error('Der Textabschnitt ist zu lang.');
 if(stale(t))throw Error('Aufgabentext und Originalseiten weichen ab. Bitte zuerst mit dem Original abgleichen.');
 const page=t.sourceLayout?.pages.find(p=>groups(p).some(g=>g.id===id)||p.blocks.some(b=>b.id===id));if(!page)throw Error('Textabschnitt der Originalvorlage fehlt.');
 const points=groups(page),point=points.find(g=>g.id===id);
 if(point){
  if(point.text===text)return false;
  const affected=connectedBlocks(points,point.parts.map(p=>p.block.id)),known=new Set((page.textEdits||[]).map(e=>e.id)),edits=points.filter(g=>g.id!==id&&(known.has(g.id)||g.parts.some(p=>p.whole)||g.edited&&g.parts.some(p=>affected.has(p.block.id)))).map(g=>({...((page.textEdits||[]).find(e=>e.id===g.id)||{}),id:g.id,text:g.text,...(!known.has(g.id)&&g.parts.some(p=>p.whole)?{legacy:true}:{})}));if(text!==point.originalText||point.parts.some(p=>p.whole))edits.push({...((page.textEdits||[]).find(e=>e.id===id)||{}),id,text});
  if(edits.length)page.textEdits=edits;else delete page.textEdits;
  rebuild(page,points,affected);
 }else{
  const block=page.blocks.find(b=>b.id===id);if(block.text===text)return false;
  if(page.textEdits?.length)throw Error('Bitte den zusammenhängenden Textabschnitt erneut öffnen.');block.text=text;
 }
 t.text=t.sourceLayout.pages.flatMap(p=>p.blocks.map(b=>b.text)).join('\n');t.sourceLayout.baselineText=t.text;t.sourceLayout.edited=true;return true;
}
// Unedited pages use the exact original blocks. Only explicit point edits get
// a shared flow area, for both HTML printing and ordinary Word paragraphs.
// Edited sections wrap at the text column, not at the random width of the PDF line. The column ends at the page's text
// edge, before a vertical rule or before the next text on the same lines. A width set by hand (textEdits[].width) wins.
function textEdge(page){const xs=page.blocks.filter(b=>String(b.originalText??b.text??'').trim()).map(b=>b.x+b.width);return Math.min(page.width-18,xs.length?Math.max(...xs):page.width-56);}
function columnRight(page,g,points=groups(page)){const right=[textEdge(page)];for(const o of points)if(o.id!==g.id&&o.y<g.y+g.height+2&&o.y+o.height>g.y-2&&o.x>=g.x+g.width-1)right.push(o.x-6);for(const r of page.rules||[])if((r.width||0)<3&&r.y<g.y+g.height&&r.y+(r.height||0)>g.y&&r.x>=g.x+g.width-1)right.push(r.x-4);return Math.max(g.x+g.width,Math.min(...right));}
function pointWidth(page,g,points=groups(page)){if(!g.edited)return g.width;const e=(page.textEdits||[]).find(x=>x.id===g.id);return Number.isFinite(e?.width)?Math.min(e.width,page.width-g.x):columnRight(page,g,points)-g.x;}
// Snap targets for the right edge: original width, text column, page text edge, and the edges of text and rules to the right.
function widthSnaps(page,g,points=groups(page)){const out=[g.width,columnRight(page,g,points)-g.x,textEdge(page)-g.x];for(const o of points)if(o.id!==g.id&&o.x>g.x+12)out.push(o.x-6-g.x,o.x+o.width-g.x);for(const r of page.rules||[])if(r.x>g.x+12)out.push(r.x-4-g.x,r.x+(r.width||0)-g.x);return [...new Set(out.filter(w=>w>=12&&g.x+w<=page.width+.5).map(w=>Math.round(w*2)/2))].sort((a,b)=>a-b);}
function setWidth(t,id,width){
 validate(t);if(stale(t))throw Error('Aufgabentext und Originalseiten weichen ab. Bitte zuerst mit dem Original abgleichen.');
 const page=t.sourceLayout?.pages.find(p=>groups(p).some(g=>g.id===id));if(!page)throw Error('Textabschnitt der Originalvorlage fehlt.');
 const points=groups(page),g=points.find(x=>x.id===id),e=(page.textEdits||[]).find(x=>x.id===id);if(!g.edited||!e)throw Error('Die Breite lässt sich nur bei bearbeiteten Textabschnitten einstellen.');
 const w=width===null||width===undefined||width===''?null:Math.round(Number(width)*2)/2;if(w!==null&&(!Number.isFinite(w)||w<12||g.x+w>page.width+.5))throw Error('Die Breite liegt außerhalb der Seite.');
 if(w===null||Math.abs(w-(columnRight(page,g,points)-g.x))<.25){if(e.width===undefined)return false;delete e.width;return true;}
 if(e.width===w)return false;e.width=w;return true;
}
function displayBlocks(page){
 if(!page.textEdits?.length)return page.blocks;
 const points=groups(page),known=new Set(page.textEdits.map(e=>e.id)),affected=connectedBlocks(points,points.filter(g=>known.has(g.id)).flatMap(g=>g.parts.map(p=>p.block.id))),out=[];
 for(const g of points)if(g.parts.some(p=>affected.has(p.block.id))){if(g.parts.some(p=>p.whole))out.push((page.textEdits.find(e=>e.id===g.id)?.legacy)?g.parts[0].block:{...g.parts[0].block,text:g.text,flow:true});else if(g.edited)out.push({...g,width:pointWidth(page,g,points),originalText:g.originalText,lines:[],flow:true,hanging:hanging(g)});else out.push(...g.parts.map(p=>({...p,text:p.originalText})));}
 out.push(...page.blocks.filter(b=>!affected.has(b.id)),...fragments(page).filter(p=>affected.has(p.block.id)&&!p.originalText.trim()&&!p.block.text.trim()));return out;
}
function refreshEditor(el,t){const point=el?.closest?.('.source-point');if(!point)return;const edited=point.classList.toggle('source-point-edited',read(t,el.dataset.paperIndex)!==point.dataset.sourceOriginal);
 // A section that becomes edited widens to its text column right away (a width set by hand stays).
 if(!point.querySelector('.source-width-handle')&&point.dataset.columnWidth)point.style.width=(edited?point.dataset.columnWidth:point.dataset.originalWidth)+'pt';}
const scopeLabel=e=>e.examType==='FW_AP'?'Gartenbaufachwerker · Abschlussprüfung · '+e.specialty:'';
const scopeFooter=(e,item)=>{const label=[item?.component==='oral'?'Mündliche Prüfungsaufgabe':'',scopeLabel(e)].filter(Boolean).join(' · ');return label?`<div class="source-scope-footer">${esc(label)}</div>`:'';};
// Imported graphics metadata can omit raster drawings. A new FW slot requires
// an in-memory proof of the actual background pixels; imported flags never count.
const logoMarginProofs=new WeakMap();
function logoMarginCandidate(task,page,index=0){
 if(page.logos.length||!task.assetLinks.some(l=>l.role==='letterhead'&&l.design==='bw-2024'&&l.audience==='candidate')||task.examType!=='FW_AP'||index!==0||!page.blocks.length||Math.min(...page.blocks.map(b=>b.y))<54)return null;
 const box={x:page.width-176,y:14,width:140,height:34,fallback:true};
 const overlaps=b=>b.x<box.x+box.width+4&&b.x+(b.width||0)>box.x-4&&b.y<box.y+box.height+4&&b.y+(b.height||0)>box.y-4;
 return box.x>=36&&![...page.blocks,...(page.rules||[]),...(page.graphics||[])].some(overlaps)?box:null;
}
const marginKey=(page,box)=>JSON.stringify([page.backgroundAssetId,page.width,page.height,box]);
function setLogoMarginProof(page,asset,box,safe){const previous=logoMarginProofs.get(page);if(safe&&asset?.data){const next={asset,data:asset.data,key:marginKey(page,box)};logoMarginProofs.set(page,next);return !previous||previous.asset!==asset||previous.data!==next.data||previous.key!==next.key;}logoMarginProofs.delete(page);return !!previous;}
function logoBoxes(task,page,index=0,d){
 if(page.logos.length)return page.logos;
 const box=logoMarginCandidate(task,page,index),proof=logoMarginProofs.get(page);
 return box&&proof&&proof.data===proof.asset.data&&proof.key===marginKey(page,box)&&(!d||d.assets.find(a=>a.id===page.backgroundAssetId)===proof.asset)?[box]:[];
}
const position=b=>`left:${b.x}pt;top:${b.y}pt;width:${b.width}pt;height:${b.height}pt`;
function textHtml(b){if(b.text!==b.originalText)return esc(b.text);return b.lines.map(l=>l.runs.map(r=>`<span${r.bold||r.italic?` style="${r.bold?'font-weight:700;':''}${r.italic?'font-style:italic;':''}"`:''}>${esc(r.text)}</span>`).join('')).join('\n');}
function blockHtml(b,x=0,y=0){return `<div class="source-text${b.flow?' source-text-flow':''}" style="${position({...b,x:b.x-x,y:b.y-y})};font-size:${b.fontSize}pt;line-height:${b.lineHeight}pt" data-source-block="${esc(b.id)}"><div class="source-text-content"${b.flow?indentStyle(b.hanging):''}>${b.flow&&b.hanging?esc(tabbed(b.text,b.hanging)):textHtml(b)}</div></div>`;}
function editablePoint(g,item,n,index,pointIndex,page,points){
 const width=page?pointWidth(page,g,points):g.width,column=page?columnRight(page,g,points)-g.x:g.width,handle=page&&g.edited?`<span class="source-width-handle" role="slider" tabindex="0" aria-label="Breite des Textabschnitts in Punkt" aria-valuemin="12" aria-valuemax="${Math.floor(page.width-g.x)}" aria-valuenow="${Math.round(width)}" data-source-width="${esc(g.id)}" data-source-item="${esc(item.id)}" data-width="${width}" data-original="${g.width}" data-column="${column}" data-snaps="${widthSnaps(page,g,points).join(',')}" title="Breite ziehen – rastet am Seitenrand, an Spaltenkanten und an der Originalbreite ein. Pfeiltasten: feiner, Doppelklick: Spaltenbreite."></span>`:'';
 const original=g.parts.map(p=>blockHtml({...p,text:p.originalText},g.x,g.y)).join('');
 return `<div class="source-point${g.edited?' source-point-edited':''}" data-source-point="${esc(g.id)}" data-source-original="${esc(g.originalText)}" data-original-width="${g.width}" data-column-width="${column}" style="${position({...g,width})}">${handle}<div class="source-point-original" aria-hidden="true">${original}</div><div class="source-text source-text-flow source-point-editor" style="left:0;top:0;width:100%;height:100%;font-size:${g.fontSize}pt;line-height:${g.lineHeight}pt;${g.parts.every(p=>p.lines.every(boldLine))?'font-weight:700;':''}"><div class="source-text-content"${indentStyle(hanging(g))} contenteditable="plaintext-only" role="textbox" aria-multiline="true" spellcheck="true" data-paper-field="source-block" data-paper-item="${esc(item.id)}" data-paper-index="${esc(g.id)}" aria-label="Originaltext ${esc(item.label||'Aufgabe '+(n+1))}, Seite ${index+1}, Textabschnitt ${pointIndex+1}">${esc(tabbed(g.text,hanging(g)))}</div></div><button type="button" class="source-add-line" data-action="source-add-line" data-id="${esc(item.id)}|${esc(g.id)}" title="Neue Zeile am Ende dieses Textabschnitts. Der Inhalt darunter rutscht nach unten. Enter fügt an der Cursorposition eine Zeile ein.">+ Zeile</button></div>`;
}
function pages(item,e,d,n,printing,P,I){const t=item.task,s=t.sourceLayout,label=item.label||'Aufgabe '+(n+1),oral=item.component==='oral';validate(t);const logoLink=t.assetLinks.find(l=>l.role==='letterhead'&&l.design==='bw-2024'&&l.audience==='candidate'),logo=logoLink&&d.assets.find(a=>a.id===logoLink.assetId);let html='';if(!printing&&stale(t))html+='<p class="callout warning">Aufgabentext und Originalseiten weichen ab. Export gesperrt; bitte mit der Quelle abgleichen.</p>';
 for(const [index,p] of s.pages.entries()){const key=index?item.id+':page:'+index:item.id,logos=logoBoxes(t,p,index,d);const sheet=`<section class="paper-sheet paper-task source-sheet${item.alternativeOf?' paper-alternative':''}"${item.alternativeOf&&!printing?` data-alternative="${esc(label)}"`:''} data-source-page="${index+1}" data-paper-task="${esc(key)}" data-source-item="${esc(item.id)}" ${oral||item.alternativeOf?'':`data-paper-before="${esc(item.id)}"`} style="--source-width:${p.width}pt;--source-height:${p.height}pt">${printing?'':`<div class="paper-task-tools">${oral||item.alternativeOf||e.status==='used'?'':`<span class="sheet-grip" draggable="true" data-drag-item="${esc(item.id)}" title="Ziehen, um die Aufgabe zu verschieben">${I.icon('grip')}</span>`}<span>${esc(label)} · ${index%2?'Rückseite':'Vorderseite'} · Seite ${index+1}/${s.pages.length}</span>${e.status==='used'?'':'<span class="source-tools-hint">Text anklicken · Enter = neue Zeile · der Inhalt darunter rutscht mit</span>'}${e.status==='used'?'':`${item.pageNotes?.[index]===undefined?`<button class="page-note-add" data-action="page-note-add" data-id="${esc(item.id)}|${index}" title="Notiz zu dieser Seite – wird nicht gedruckt">${I.icon('note')}<span>Notiz</span></button>`:''}<details class="paper-item-menu"><summary>Weitere Aktionen</summary><div>${item.alternativeOf?`<button data-action="alt-promote" data-id="${esc(item.id)}">Als Hauptaufgabe verwenden</button>`:`<button data-action="alt-open" data-id="${esc(item.id)}">Alternative hinzufügen</button>`}${oral||item.alternativeOf?'':`<button data-action="item-up" data-id="${esc(item.id)}">${I.label('item-up','Nach oben')}</button><button data-action="item-down" data-id="${esc(item.id)}">${I.label('item-down','Nach unten')}</button>`}<button data-action="item-edit" data-id="${esc(item.id)}">Punkte, Lösung & Freigabe</button><button data-action="${item.alternativeOf?'alt-remove':oral?'oral-remove':'item-remove'}" data-id="${esc(item.id)}">Entfernen</button></div></details>`}</div>`}<div class="source-background" aria-hidden="true">${P.image(d.assets.find(a=>a.id===p.backgroundAssetId),'Originales Planungsfeld und Zeichnungen')}</div>${logos.map(l=>`<div class="source-logo" style="${position(l)}">${logo?P.image(logo,'Baden-Württemberg · Regierungspräsidium Freiburg'):'<span data-source-missing-logo>Landeslogo fehlt</span>'}</div>`).join('')}${printing||e.status==='used'?displayBlocks(p).map(b=>blockHtml(b)).join(''):groups(p).map((g,j,pts)=>editablePoint(g,item,n,index,j,p,pts)).join('')}${scopeFooter(e,item)}</section>`;
  // Editing view: pages without any editable text (reverse sides, answer areas) start collapsed; print keeps them.
  html+=(P.pageNote?P.pageNote({...item,label},index,e,printing):'')+(!printing&&!p.blocks.length&&!logos.length?`<details class="source-page-collapsed" data-source-collapsed="${index+1}"><summary><span class="source-page-collapsed-icon" aria-hidden="true"></span><span><strong>${esc(label)} · Seite ${index+1}/${s.pages.length}</strong> · ${index%2?'Rückseite':'Seite'} ohne bearbeitbaren Text · wird mitgedruckt</span><em>Anzeigen</em></summary>${sheet}</details>`:sheet)+(printing?'':'<div class="source-page-gap"></div>');}
 // The inserted duplex blank is only needed on paper; the editor shows a slim marker instead of a whole empty sheet.
 if(s.pages.length%2)html+=printing?`<section class="paper-sheet source-sheet source-blank" data-duplex-blank aria-label="Leere Rückseite" style="--source-width:${s.pages.at(-1).width}pt;--source-height:${s.pages.at(-1).height}pt">${scopeFooter(e,item)}</section>`:`<div class="source-blank-marker" data-duplex-blank-marker>Leere Rückseite · wird nur beim Drucken eingefügt, damit die nächste Aufgabe auf einer Vorderseite beginnt</div>`;return html;}
// Shared by editor and exported file (serialised there, so it must stay self-contained).
// Edited text keeps its size: its box grows and everything below it on the page (text, logos and
// the background with frames, tables and lines) moves down, like in a word processor. Empty framed
// answer areas below (e.g. "Stichwortartige Durchführungsplanung") give the space back by getting
// shorter, so their lower edge and the footer stay where they are. Only what is left moves into the
// page margin. Unedited original text only shrinks slightly to absorb CI font metrics. Text that
// no longer fits above the page end is flagged and printing through the toolbar is blocked.
function fit(container=document){
 // Moves are whole screen pixels (0.75pt), so shifted lines stay crisp.
 const pt=v=>parseFloat(v)||0,px=v=>Math.ceil(v/.75-1e-6)*.75,cache=globalThis.__hortiSourceRows||(globalThis.__hortiSourceRows=new Map());
 const flag=(box,bad)=>{box.classList.toggle('source-overflow',bad);box.dataset.sourceOverflow=String(bad);box.removeAttribute('title');};
 // Dark pixels per row of the background picture (one row per pt), or null while it cannot be read.
 const rowsOf=(img,w,h)=>{
  if(!img||!img.complete||!img.naturalWidth)return null;const src=img.currentSrc||img.src||'',key=src.length+':'+src.slice(-96)+':'+Math.round(w)+'x'+Math.round(h);if(cache.has(key))return cache.get(key);
  let rows=null;try{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));const g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);const data=g.getImageData(0,0,c.width,c.height).data;rows=new Uint32Array(c.height);for(let y=0;y<c.height;y++){let n=0;for(let i=y*c.width*4,end=i+c.width*4;i<end;i+=4)if(data[i]+data[i+1]+data[i+2]<660)n++;rows[y]=n;}}catch{rows=null;}
  cache.set(key,rows);return rows;
 };
 const sheets=container.matches?.('.source-sheet')?[container]:[...(container.querySelectorAll?.('.source-sheet')||[])];
 let overflow=0;
 for(const sheet of sheets){
  const H=pt(sheet.style.getPropertyValue('--source-height')),W=pt(sheet.style.getPropertyValue('--source-width'));
  // Undo the previous pass before measuring.
  for(const el of sheet.querySelectorAll('[data-source-shift]')){el.style.translate='';delete el.dataset.sourceShift;}
  for(const el of sheet.querySelectorAll('[data-source-grown]')){el.style.height=el.dataset.sourceGrown;delete el.dataset.sourceGrown;}
  const grown=[];
  for(const box of sheet.querySelectorAll('.source-text')){
   const content=box.querySelector('.source-text-content'),point=box.closest('.source-point'),active=point&&(point.classList.contains('source-point-edited')||point.matches(':focus-within'));
   if(!content||!box.clientWidth)continue; // not rendered (closed details, hidden thumbnails)
   if(point&&(box.classList.contains('source-point-editor')?!active:active)){flag(box,false);continue;}
   content.style.transform='none';
   if(box.classList.contains('source-text-flow')&&(!point||point.classList.contains('source-point-edited'))){
    // Edited text: same font size, the box takes the height it needs.
    const holder=point||box,have=pt(holder.style.height),need=have*content.scrollHeight/Math.max(1,box.clientHeight),line=pt(box.style.lineHeight)||12;
    flag(box,false);if(need>have+Math.max(1.5,line*.35))grown.push({holder,box,top:pt(holder.style.top),have,need,line});
    continue;
   }
   const scale=Math.min(1,box.clientWidth/Math.max(1,content.scrollWidth),box.clientHeight/Math.max(1,content.scrollHeight));
   content.style.transform=`scale(${Math.max(.01,scale)})`;const bad=scale<.78;flag(box,bad);if(bad)overflow++;
  }
  const bg=sheet.querySelector('.source-background'),img=bg?.querySelector('img:not(.source-slice-img)'),rows=H&&W?rowsOf(img,W,H):null;
  if(img&&!img.complete&&!img.dataset.sourceWait){img.dataset.sourceWait='1';img.addEventListener('load',()=>fit(sheet),{once:true});}
  // Items that move: text holders and logos, by their original position.
  const items=[...sheet.querySelectorAll('.source-point,.source-sheet>.source-text,.source-logo')].filter(el=>el.closest('.source-sheet')===sheet&&!el.parentElement.closest('.source-point')).map(el=>({el,top:pt(el.style.top),bottom:pt(el.style.top)+pt(el.dataset.sourceGrown||el.style.height)}));
  // ops: insert {y,h} adds space at y; remove {y,h,out:true} takes rows y..y+h away. Positions are original.
  const ops=[],shiftAt=y=>ops.reduce((s,o)=>o.out?(o.y+o.h<=y+.01?s-o.h:s):(o.y<=y+.01?s+o.h:s),0);
  for(const g of grown.sort((a,b)=>a.top+a.have-(b.top+b.have)||a.top-b.top)){
   g.holder.dataset.sourceGrown=g.holder.style.height;g.holder.style.height=g.need+'pt';
   // Everything that starts in the last part of the box or below it follows. Extracted lines overlap
   // their neighbours by about a point, so "below" allows for a small overlap.
   const bottom=g.top+g.have,tol=Math.max(1.5,g.line*.45),next=Math.min(H,...items.filter(i=>i.el!==g.holder&&i.top>=bottom-tol&&i.top>g.top+1).map(i=>i.top));
   let y=Math.max(g.top+1,Math.min(bottom,next-.5));
   // Cut at the cleanest background row before the next item, so no line gets stretched.
   if(rows){let best=y,score=Infinity;for(let r=Math.ceil(y);r<=Math.min(rows.length-1,bottom+14,next-.5);r++)if(rows[r]<score){score=rows[r];best=r;if(!score)break;}y=best;}
   const need=shiftAt(g.top)+g.need-g.have,has=shiftAt(y);if(need>has+.25)ops.push({y,h:px(need-has)});ops.sort((a,b)=>a.y-b.y);
  }
  const added=shiftAt(H);
  // Empty framed areas below the last cut give the space back: rows inside a frame (a few dark pixels
  // from its side lines, no horizontal line, no text). All of them shrink evenly, so writing lines stay
  // evenly spaced; none gets smaller than a quarter of its height or 16pt.
  if(added>.25&&rows){
   const from=Math.ceil(Math.max(...ops.map(o=>o.y)))+2,thr=Math.max(4,W*.04),busy=new Uint8Array(rows.length);
   for(const i of items)for(let r=Math.max(0,Math.floor(i.top)-2);r<=Math.min(rows.length-1,Math.ceil(i.bottom)+2);r++)busy[r]=1;
   const runs=[];let start=-1;
   for(let r=from;r<=rows.length;r++){const quiet=r<rows.length&&!busy[r]&&rows[r]>0&&rows[r]<=thr;if(quiet&&start<0)start=r;if(!quiet&&start>=0){if(r-start>=24)runs.push({start,len:r-start});start=-1;}}
   const room=runs.map(r=>({...r,cap:r.len-Math.max(16,r.len*.25)})).filter(r=>r.cap>=.75),total=room.reduce((s,r)=>s+r.cap,0),take=Math.min(added,total);
   if(take>.25){
    // Shares in whole pixels; the pixels lost to rounding go to the runs with room left, so the total is exact.
    const parts=room.map(r=>({r,h:Math.floor(take*r.cap/total/.75+1e-6)*.75}));let rest=Math.floor(take/.75+1e-6)*.75-parts.reduce((s,p)=>s+p.h,0);
    for(const p of [...parts].sort((a,b)=>b.r.cap-b.h-(a.r.cap-a.h))){if(rest<.75-1e-6)break;if(p.r.cap-p.h>=.75){p.h+=.75;rest-=.75;}}
    for(const p of parts)if(p.h>=.75)ops.push({y:p.r.start+Math.round((p.r.len-p.h)/2),h:p.h,out:true});
   }
   ops.sort((a,b)=>a.y-b.y);
  }
  for(const i of items){const s=shiftAt(i.top);if(Math.abs(s)>.01){i.el.style.translate=`0 ${s}pt`;i.el.dataset.sourceShift='1';}}
  // Background: the picture is re-laid in slices. An inserted gap repeats the row at the cut, so side
  // lines of frames and tables continue; removed rows simply drop out of the empty area.
  const sig=img?JSON.stringify(ops.map(o=>[o.out?1:0,Math.round(o.y*10),Math.round(o.h*10)]))+(img.complete?'':'-'):'';
  if(bg&&bg.dataset.sourceCuts!==sig){
   for(const el of bg.querySelectorAll('.source-slice'))el.remove();if(img)img.style.visibility=ops.length?'hidden':'';bg.classList.toggle('source-shifted',!!ops.length);bg.dataset.sourceCuts=sig;
   if(img&&ops.length){
    const part=(cls,top,height)=>{const div=document.createElement('div');div.className='source-slice '+cls;div.setAttribute('style',`position:absolute;left:0;width:100%;top:${top}pt;height:${height}pt;overflow:hidden`);bg.append(div);return div;};
    const piece=(a,b,at)=>{if(b-a<=.01)return;const div=part('source-slice-part',at,b-a),copy=img.cloneNode();copy.className='source-slice-img';copy.removeAttribute('data-source-wait');copy.style.visibility='visible';copy.style.position='absolute';copy.style.left='0';copy.style.setProperty('top',-a+'pt','important');copy.style.setProperty('width','100%','important');copy.style.setProperty('height',H+'pt','important');copy.setAttribute('alt','');div.append(copy);};
    let from=0,moved=0;
    for(const o of ops){
     piece(from,o.y,from+moved);
     if(o.out){moved-=o.h;from=o.y+o.h;continue;}
     const band=part('source-slice-band',o.y+moved,o.h);if(img.complete&&img.naturalWidth){try{const canvas=document.createElement('canvas'),row=Math.min(img.naturalHeight-1,Math.max(0,Math.floor(o.y/H*img.naturalHeight)));canvas.width=img.naturalWidth;canvas.height=1;canvas.getContext('2d').drawImage(img,0,row,img.naturalWidth,1,0,0,img.naturalWidth,1);canvas.setAttribute('style','display:block;width:100%;height:100%');band.append(canvas);}catch{}}
     moved+=o.h;from=o.y;
    }
    piece(from,H,from+moved);
   }
  }
  // The page ends where it ends: moved content must stay above the footer area.
  if(grown.length){
   let low=Math.max(0,...items.map(i=>i.bottom));if(rows){for(let r=rows.length-1;r>0;r--)if(rows[r]>1){low=Math.max(low,r+1);break;}}
   const limit=H-(sheet.querySelector('.source-scope-footer')?32:12),bad=low+shiftAt(low)>Math.max(low,limit)+.5;
   for(const g of grown)flag(g.box,bad);if(bad)overflow+=grown.length;
  }
 }
 return overflow;
}
const styles=`.source-point{position:absolute}.source-width-handle{position:absolute;top:-2px;right:-6px;width:12px;height:calc(100% + 4px);cursor:ew-resize;z-index:6;opacity:0;transition:opacity .15s;touch-action:none;outline:none}.source-point-edited:hover>.source-width-handle,.source-point-edited:focus-within>.source-width-handle,.source-width-handle:focus,.source-width-handle.is-dragging{opacity:1}@media(pointer:coarse){.source-point-edited>.source-width-handle{opacity:.85;width:22px;right:-11px}.source-width-handle::after{left:10px}}.source-width-handle::after{content:"";position:absolute;left:5px;top:50%;width:2px;height:min(30px,100%);transform:translateY(-50%);border-radius:2px;background:#2a6548;box-shadow:0 0 0 2px #fff}.source-width-handle:focus-visible::after{box-shadow:0 0 0 2px #fff,0 0 0 4px #73985d}.source-width-guide{position:absolute;top:0;bottom:0;width:0;border-left:1.5px dashed #2a6548;pointer-events:none;z-index:7}.source-width-guide.is-snapped{border-left-style:solid}.source-point-original{position:absolute;inset:0;pointer-events:none}.source-point-editor{opacity:0}.source-point:focus-within .source-point-editor,.source-point-edited .source-point-editor{opacity:1}.source-point:focus-within .source-point-original,.source-point-edited .source-point-original{visibility:hidden}.source-text-flow .source-text-content{white-space:pre-wrap;width:100%;box-sizing:border-box;overflow-wrap:anywhere}.source-point-editor .source-text-content{min-height:100%}.source-sheet,.paper-print .source-sheet{position:relative!important;width:var(--source-width)!important;height:var(--source-height)!important;min-height:var(--source-height)!important;max-width:none!important;padding:0!important;overflow:visible;font-family:"BaWue Sans",Arial,sans-serif;color:#2A2623;break-after:page;break-inside:avoid}.source-background{position:absolute;inset:0;pointer-events:none}.source-background img{display:block;width:100%!important;height:100%!important;max-height:none!important;max-width:none!important}.source-logo,.source-text{position:absolute;box-sizing:border-box}.source-logo img{display:block;width:100%;height:100%;max-height:none!important;object-fit:contain;object-position:left center}.source-text-content{white-space:pre;width:max-content;min-width:1px;min-height:1em;transform-origin:top left;outline:none}.source-text-content[contenteditable]:hover,.source-text-content[contenteditable]:focus{outline:1px dashed #2a6548;background:#ffffed}.source-overflow{outline:2px solid #ae3926;background:#fff0e5}.source-background.source-shifted{overflow:hidden}.source-slice{pointer-events:none}.source-page-gap{height:56px}.source-scope-footer{position:absolute;left:36pt;right:36pt;bottom:18pt;z-index:1;margin:0;padding:0;border:0;font:8pt/11pt Arial,sans-serif;text-align:center;color:#2A2623;white-space:nowrap;pointer-events:none}.source-blank>span{position:absolute;top:40%;left:15%;right:15%;font:12pt Arial;text-align:center;color:#68776e}.source-document .paper-sheet{box-sizing:border-box}.source-document .document-toolbar{display:block}.source-document .document-toolbar button{margin-right:15px}.source-document .document-status{display:block;margin-top:10px}.source-document .source-sheet{margin:0 auto 24px}.source-document .source-blank{margin-bottom:24px}.source-document .paper-sheet:not(.source-sheet){width:210mm;min-height:297mm;padding:18mm}.source-page-note{font-size:12px;color:#68776e}.source-background .asset-placeholder{display:block;margin:45% 15%;font-size:12pt}.is-paper .paper-stage[data-paper-size=fit] .source-sheet{width:var(--source-width)!important;min-height:var(--source-height)!important;padding:0!important}.source-metadata{margin:0 0 16px;padding:12px;background:#edf3e9;font-size:13px}@media(max-width:1000px){.is-paper .paper-stage[data-paper-size=fit] .source-sheet{zoom:1!important}.source-sheet .paper-task-tools{font-size:12px}}@media print{@page{size:A4;margin:0}.source-document{margin:0!important;padding:0!important;background:white!important}.source-document .paper-sheet{box-shadow:none!important;margin:0!important;break-after:page}.source-document .source-sheet{width:var(--source-width)!important;height:var(--source-height)!important;min-height:var(--source-height)!important;zoom:1!important}.source-blank>span,.source-page-gap{display:none!important}.source-text-content{outline:none!important;background:transparent!important}.source-overflow::after{content:"TEXT PASST NICHT – ENTWURF PRÜFEN";position:absolute;inset:0;background:white;color:#a00;font:10pt Arial}.source-document:has([data-source-overflow=true]) .document-toolbar{display:block!important}.source-document .paper-sheet:last-of-type{break-after:auto}.source-document .source-sheet[data-source-page="1"]{break-before:right}.source-draft .source-sheet[data-source-page="1"]::after{content:"ENTWURF · NICHT FREIGEGEBEN";position:absolute;left:10%;right:10%;top:48%;text-align:center;font:bold 22pt Arial;color:#a33535;opacity:.18;transform:rotate(-25deg);pointer-events:none}.source-document .paper-supplement{break-before:page}}`;
const api={setWidth,pointWidth,widthSnaps,columnRight,scopeLabel,logoBoxes,logoMarginCandidate,setLogoMarginProof,validate,stale,assertExport,groups,read,edit,displayBlocks,refreshEditor,pages,fit,styles};root.HortiSourceLayout=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
