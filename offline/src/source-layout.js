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
  if(!Array.isArray(p.textEdits)||p.textEdits.length>2000||p.textEdits.some(e=>!e||typeof e.id!=='string'||typeof e.text!=='string'||e.text.length>20000||e.legacy!==undefined&&typeof e.legacy!=='boolean'))fail();
  const ids=new Set(groups(p).map(g=>g.id)),seen=new Set();for(const e of p.textEdits){if(!ids.has(e.id)||seen.has(e.id))fail();seen.add(e.id);}
 }
}
function stale(t){return !!t.sourceLayout&&t.sourceLayout.baselineText!==t.text;}
function assertExport(e){const C=root.HortiCore||(typeof require==='function'?require('./core.js'):null);C.assertOralPolicy(e);for(const i of C.examEntries(e)){validate(i.task);if(stale(i.task))throw Error('Originalseiten von „'+i.task.title+'“ stimmen nicht mehr mit dem Aufgabentext überein. Text direkt auf den Vorlagenseiten bearbeiten oder eine passende Originalvorlage zuordnen.');if(i.task.sourceLayout?.warnings.length)throw Error('Originalvorlage von „'+i.task.title+'“ muss vor dem Export geprüft werden: '+i.task.sourceLayout.warnings.join(' '));}}
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
  const affected=connectedBlocks(points,point.parts.map(p=>p.block.id)),known=new Set((page.textEdits||[]).map(e=>e.id)),edits=points.filter(g=>g.id!==id&&(known.has(g.id)||g.parts.some(p=>p.whole)||g.edited&&g.parts.some(p=>affected.has(p.block.id)))).map(g=>({...((page.textEdits||[]).find(e=>e.id===g.id)||{}),id:g.id,text:g.text,...(!known.has(g.id)&&g.parts.some(p=>p.whole)?{legacy:true}:{})}));if(text!==point.originalText||point.parts.some(p=>p.whole))edits.push({id,text});
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
function displayBlocks(page){
 if(!page.textEdits?.length)return page.blocks;
 const points=groups(page),known=new Set(page.textEdits.map(e=>e.id)),affected=connectedBlocks(points,points.filter(g=>known.has(g.id)).flatMap(g=>g.parts.map(p=>p.block.id))),out=[];
 for(const g of points)if(g.parts.some(p=>affected.has(p.block.id))){if(g.parts.some(p=>p.whole))out.push((page.textEdits.find(e=>e.id===g.id)?.legacy)?g.parts[0].block:{...g.parts[0].block,text:g.text,flow:true});else if(g.edited)out.push({...g,originalText:g.originalText,lines:[],flow:true});else out.push(...g.parts.map(p=>({...p,text:p.originalText})));}
 out.push(...page.blocks.filter(b=>!affected.has(b.id)),...fragments(page).filter(p=>affected.has(p.block.id)&&!p.originalText.trim()&&!p.block.text.trim()));return out;
}
function refreshEditor(el,t){const point=el?.closest?.('.source-point');if(point)point.classList.toggle('source-point-edited',read(t,el.dataset.paperIndex)!==point.dataset.sourceOriginal);}
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
function blockHtml(b,x=0,y=0){return `<div class="source-text${b.flow?' source-text-flow':''}" style="${position({...b,x:b.x-x,y:b.y-y})};font-size:${b.fontSize}pt;line-height:${b.lineHeight}pt" data-source-block="${esc(b.id)}"><div class="source-text-content">${textHtml(b)}</div></div>`;}
function editablePoint(g,item,n,index,pointIndex){
 const original=g.parts.map(p=>blockHtml({...p,text:p.originalText},g.x,g.y)).join('');
 return `<div class="source-point${g.edited?' source-point-edited':''}" data-source-point="${esc(g.id)}" data-source-original="${esc(g.originalText)}" style="${position(g)}"><div class="source-point-original" aria-hidden="true">${original}</div><div class="source-text source-text-flow source-point-editor" style="left:0;top:0;width:100%;height:100%;font-size:${g.fontSize}pt;line-height:${g.lineHeight}pt;${g.parts.every(p=>p.lines.every(boldLine))?'font-weight:700;':''}"><div class="source-text-content" contenteditable="plaintext-only" role="textbox" aria-multiline="true" spellcheck="true" data-paper-field="source-block" data-paper-item="${esc(item.id)}" data-paper-index="${esc(g.id)}" aria-label="Originaltext ${esc(item.label||'Aufgabe '+(n+1))}, Seite ${index+1}, Textabschnitt ${pointIndex+1}">${esc(g.text)}</div></div></div>`;
}
function pages(item,e,d,n,printing,P,I){const t=item.task,s=t.sourceLayout,label=item.label||'Aufgabe '+(n+1),oral=item.component==='oral';validate(t);const logoLink=t.assetLinks.find(l=>l.role==='letterhead'&&l.design==='bw-2024'&&l.audience==='candidate'),logo=logoLink&&d.assets.find(a=>a.id===logoLink.assetId);let html='';if(!printing&&stale(t))html+='<p class="callout warning">Aufgabentext und Originalseiten weichen ab. Export gesperrt; bitte mit der Quelle abgleichen.</p>';
 for(const [index,p] of s.pages.entries()){const key=index?item.id+':page:'+index:item.id,logos=logoBoxes(t,p,index,d);const sheet=`<section class="paper-sheet paper-task source-sheet" data-source-page="${index+1}" data-paper-task="${esc(key)}" data-source-item="${esc(item.id)}" ${oral?'':`data-paper-before="${esc(item.id)}"`} style="--source-width:${p.width}pt;--source-height:${p.height}pt">${printing?'':`<div class="paper-task-tools"><span>${esc(label)} · ${index%2?'Rückseite':'Vorderseite'} · Seite ${index+1}/${s.pages.length}</span>${e.status==='used'?'':`<details class="paper-item-menu"><summary>Weitere Aktionen</summary><div>${oral?'':`<button data-action="item-up" data-id="${esc(item.id)}">${I.label('item-up','Nach oben')}</button><button data-action="item-down" data-id="${esc(item.id)}">${I.label('item-down','Nach unten')}</button>`}<button data-action="item-edit" data-id="${esc(item.id)}">Punkte, Lösung & Freigabe</button><button data-action="${oral?'oral-remove':'item-remove'}" data-id="${esc(item.id)}">Entfernen</button></div></details>`}</div>`}<div class="source-background" aria-hidden="true">${P.image(d.assets.find(a=>a.id===p.backgroundAssetId),'Originales Planungsfeld und Zeichnungen')}</div>${logos.map(l=>`<div class="source-logo" style="${position(l)}">${logo?P.image(logo,'Baden-Württemberg · Regierungspräsidium Freiburg'):'<span data-source-missing-logo>Landeslogo fehlt</span>'}</div>`).join('')}${printing||e.status==='used'?displayBlocks(p).map(b=>blockHtml(b)).join(''):groups(p).map((g,j)=>editablePoint(g,item,n,index,j)).join('')}${scopeFooter(e,item)}</section>`;
  // Editing view: pages without any editable text (reverse sides, answer areas) start collapsed; print keeps them.
  html+=(!printing&&!p.blocks.length&&!logos.length?`<details class="source-page-collapsed" data-source-collapsed="${index+1}"><summary><span class="source-page-collapsed-icon" aria-hidden="true"></span><span><strong>${esc(label)} · Seite ${index+1}/${s.pages.length}</strong> · ${index%2?'Rückseite':'Seite'} ohne bearbeitbaren Text · wird mitgedruckt</span><em>Anzeigen</em></summary>${sheet}</details>`:sheet)+(printing?'':'<div class="source-page-gap"></div>');}
 // The inserted duplex blank is only needed on paper; the editor shows a slim marker instead of a whole empty sheet.
 if(s.pages.length%2)html+=printing?`<section class="paper-sheet source-sheet source-blank" data-duplex-blank aria-label="Leere Rückseite" style="--source-width:${s.pages.at(-1).width}pt;--source-height:${s.pages.at(-1).height}pt">${scopeFooter(e,item)}</section>`:`<div class="source-blank-marker" data-duplex-blank-marker>Leere Rückseite · wird nur beim Drucken eingefügt, damit die nächste Aufgabe auf einer Vorderseite beginnt</div>`;return html;}
// Shared by editor and exported file. Shrink only to absorb CI font metrics;
// oversized edits are flagged and printing through the toolbar is blocked.
function fit(container=document){let overflow=0;for(const box of container.querySelectorAll('.source-text')){const content=box.querySelector('.source-text-content'),point=box.closest('.source-point'),active=point&&(point.classList.contains('source-point-edited')||point.matches(':focus-within'));if(point&&(box.classList.contains('source-point-editor')?!active:active)){box.classList.remove('source-overflow');box.dataset.sourceOverflow='false';box.removeAttribute('title');continue;}content.style.transform='none';const scale=Math.min(1,box.clientWidth/Math.max(1,content.scrollWidth),box.clientHeight/Math.max(1,content.scrollHeight));content.style.transform=`scale(${Math.max(.01,scale)})`;const bad=scale<.78;box.classList.toggle('source-overflow',bad);box.dataset.sourceOverflow=String(bad);if(bad)overflow++;box.removeAttribute('title');}return overflow;}
const styles=`.source-point{position:absolute}.source-point-original{position:absolute;inset:0;pointer-events:none}.source-point-editor{opacity:0}.source-point:focus-within .source-point-editor,.source-point-edited .source-point-editor{opacity:1}.source-point:focus-within .source-point-original,.source-point-edited .source-point-original{visibility:hidden}.source-text-flow .source-text-content{white-space:pre-wrap;width:100%;overflow-wrap:anywhere}.source-point-editor .source-text-content{min-height:100%}.source-sheet,.paper-print .source-sheet{position:relative!important;width:var(--source-width)!important;height:var(--source-height)!important;min-height:var(--source-height)!important;max-width:none!important;padding:0!important;overflow:visible;font-family:"BaWue Sans",Arial,sans-serif;color:#2A2623;break-after:page;break-inside:avoid}.source-background{position:absolute;inset:0;pointer-events:none}.source-background img{display:block;width:100%!important;height:100%!important;max-height:none!important;max-width:none!important}.source-logo,.source-text{position:absolute;box-sizing:border-box}.source-logo img{display:block;width:100%;height:100%;max-height:none!important;object-fit:contain;object-position:left center}.source-text-content{white-space:pre;width:max-content;min-width:1px;min-height:1em;transform-origin:top left;outline:none}.source-text-content[contenteditable]:hover,.source-text-content[contenteditable]:focus{outline:1px dashed #2a6548;background:#ffffed}.source-overflow{outline:2px solid #ae3926;background:#fff0e5}.source-page-gap{height:56px}.source-scope-footer{position:absolute;left:36pt;right:36pt;bottom:18pt;z-index:1;margin:0;padding:0;border:0;font:8pt/11pt Arial,sans-serif;text-align:center;color:#2A2623;white-space:nowrap;pointer-events:none}.source-blank>span{position:absolute;top:40%;left:15%;right:15%;font:12pt Arial;text-align:center;color:#68776e}.source-document .paper-sheet{box-sizing:border-box}.source-document .document-toolbar{display:block}.source-document .document-toolbar button{margin-right:15px}.source-document .document-status{display:block;margin-top:10px}.source-document .source-sheet{margin:0 auto 24px}.source-document .source-blank{margin-bottom:24px}.source-document .paper-sheet:not(.source-sheet){width:210mm;min-height:297mm;padding:18mm}.source-page-note{font-size:12px;color:#68776e}.source-background .asset-placeholder{display:block;margin:45% 15%;font-size:12pt}.is-paper .paper-stage[data-paper-size=fit] .source-sheet{width:var(--source-width)!important;min-height:var(--source-height)!important;padding:0!important}.source-metadata{margin:0 0 16px;padding:12px;background:#edf3e9;font-size:13px}@media(max-width:1000px){.is-paper .paper-stage[data-paper-size=fit] .source-sheet{zoom:1!important}.source-sheet .paper-task-tools{font-size:12px}}@media print{@page{size:A4;margin:0}.source-document{margin:0!important;padding:0!important;background:white!important}.source-document .paper-sheet{box-shadow:none!important;margin:0!important;break-after:page}.source-document .source-sheet{width:var(--source-width)!important;height:var(--source-height)!important;min-height:var(--source-height)!important;zoom:1!important}.source-blank>span,.source-page-gap{display:none!important}.source-text-content{outline:none!important;background:transparent!important}.source-overflow::after{content:"TEXT PASST NICHT – ENTWURF PRÜFEN";position:absolute;inset:0;background:white;color:#a00;font:10pt Arial}.source-document:has([data-source-overflow=true]) .document-toolbar{display:block!important}.source-document .paper-sheet:last-of-type{break-after:auto}.source-document .source-sheet[data-source-page="1"]{break-before:right}.source-draft .source-sheet[data-source-page="1"]::after{content:"ENTWURF · NICHT FREIGEGEBEN";position:absolute;left:10%;right:10%;top:48%;text-align:center;font:bold 22pt Arial;color:#a33535;opacity:.18;transform:rotate(-25deg);pointer-events:none}.source-document .paper-supplement{break-before:page}}`;
const api={scopeLabel,logoBoxes,logoMarginCandidate,setLogoMarginProof,validate,stale,assertExport,groups,read,edit,displayBlocks,refreshEditor,pages,fit,styles};root.HortiSourceLayout=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
