/* Organizational material lists. No task wording, DOM, network or storage changes. */
(function(root){'use strict';
const clone=value=>JSON.parse(JSON.stringify(value));
const practical=task=>!!task&&(task.kind===undefined||task.kind==='practical');
const methods=['explicit-heading-v1','general-title-v1','manual'];
const fail=()=>{throw Error('Ungültige Materialliste. Text, Bestätigung und Herkunft prüfen.');};
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const bounded=(value,max)=>typeof value==='string'&&value.length<=max;

function validate(task){
 const m=task?.materials;if(m===undefined)return task;
 if(!record(m)||!bounded(m.text,20000)||!['proposal','confirmed'].includes(m.status)||!methods.includes(m.method)||!Array.isArray(m.evidence)||m.evidence.length>20||m.status==='confirmed'&&!m.text.trim())fail();
 let evidenceLength=0;
 for(const e of m.evidence){
  if(!record(e)||!bounded(e.quote,20000)||e.sourceId!==undefined&&(!bounded(e.sourceId,300)||!task.sourceIds?.includes(e.sourceId))||e.reference!==undefined&&!bounded(e.reference,1000)||e.page!==undefined&&(!Number.isInteger(e.page)||e.page<1||e.page>10000))fail();
  evidenceLength+=e.quote.length;
 }
 if(evidenceLength>40000)fail();
 return task;
}

// A named section is evidence; mentioning a material somewhere in prose is not.
const heading=/^\s*(?:\d+[.)]\s*)?(?:(?:benötigte[rs]?|erforderliche[rs]?|bereitgestellte[rs]?|vorgegebene[rs]?)\s+)?(?:material(?:ien)?(?:liste|bedarf)?(?:\s*(?:und|\/|,|&)\s*(?:hilfsmittel|werkzeuge|geräte|maschinen))*|(?:werkzeuge|hilfsmittel|geräte)(?:\s*(?:und|\/|,|&)\s*(?:material(?:ien)?|hilfsmittel|werkzeuge|geräte|maschinen))*)\s*(?::\s*(.*)|[-–]?\s*)$/i;
const section=/^\s*(?:\d+[.)]\s*)?(?:arbeitsauftrag|aufgabenstellung|aufgaben?|arbeitsplanung|arbeitsablauf|arbeitsschritte|durchführung|kontrolle|bewertung|lösung|erwartungshorizont|prüfungsgespräch|eigenreflexion|reflexion|planung|zeit(?:vorgabe|ablauf)?|name|datum|prüfling)\b/i;
const markerOnly=/^\s*([•·∙▪◦‣●\uf0b7]|\d{1,3}[.)]|[a-z][.)]|[-–—])\s*$/i;
const marked=/^\s*(?:[•·∙▪◦‣●\uf0b7]|\d{1,3}[.)]|[a-z][.)]|[-–—])(?:\s|$)/i;
const prose=/[.!?]\s*$|^(?:begründen|beschreiben|erläutern|führen|planen|prüfen|kontrollieren|beachten|notieren|bearbeiten|ermitteln)\s+sie\b/i;

function sections(units,origin){
 const found=[];
 for(let i=0;i<units.length;i++){
  const match=heading.exec(units[i].text.trim());if(!match)continue;
  const lines=[],start=i;let pending='',previousBlock=null;
  if(match[1]?.trim())lines.push(match[1].trim());
  for(let j=i+1;j<units.length;j++){
   const unit=units[j],line=unit.text.trim();
   if(!line){if(lines.length&&!pending)break;continue;}
   if(section.test(line)||heading.test(line)||!pending&&!marked.test(line)&&/:$/.test(line))break;
   const bullet=markerOnly.exec(line);
   if(bullet){if(pending)break;pending=bullet[1]==='\uf0b7'?'•':bullet[1];previousBlock=null;continue;}
   if(pending){lines.push(pending+' '+line);pending='';previousBlock=unit.block;continue;}
   if(marked.test(line)){lines.push(line.replace(/^\uf0b7/,'•'));previousBlock=unit.block;continue;}
   // Wrapped lines of one source block remain part of that literal item.
   if(lines.length&&unit.block!==undefined&&unit.block===previousBlock){lines[lines.length-1]+='\n'+line;continue;}
   // Short noun lists also occur without bullets. Imperative prose is excluded.
   if(line.length<=180&&!prose.test(line)){lines.push(line);previousBlock=unit.block;continue;}
   break;
  }
  if(lines.length){const text=lines.join('\n');found.push({text,evidence:{...origin,quote:units[start].text.trim()+'\n'+text}});}
 }
 return found;
}

function combine(found){
 if(!found.length)return null;
 const text=found.map(x=>x.text).join('\n\n'),evidence=found.map(x=>x.evidence);
 if(text.length>20000||evidence.length>20||evidence.some(e=>e.quote.length>20000)||evidence.reduce((sum,e)=>sum+e.quote.length,0)>40000)return null;
 return {text,status:'proposal',method:'explicit-heading-v1',evidence};
}

function extractMaterials(task,sources=[]){
 if(!practical(task))return null;
 const layout=task.sourceLayout;
 if(layout?.pages?.length){
  // Preserve extraction order: glyph geometry can put an item before its bullet.
  const found=layout.pages.flatMap((page,n)=>sections((page.blocks||[]).flatMap((b,block)=>String(b.text||'').split(/\r?\n/).map(text=>({text,block}))),{...(task.sourceIds?.includes(layout.sourceId)?{sourceId:layout.sourceId}:{}),...(typeof layout.reference==='string'?{reference:layout.reference}:{}),page:n+1}));
  const result=combine(found);if(result)return result;
 }else{
  const result=combine(sections(String(task.text||'').split(/\r?\n/).map(text=>({text})),{}));if(result)return result;
 }
 // Edited source pages are authoritative: do not resurrect an older source list.
 if(layout?.edited||layout?.pages?.some(p=>p.textEdits?.length))return null;
 for(const source of sources){
  if(!task.sourceIds?.includes(source.id))continue;
  const result=combine(sections(String(source.text||'').split(/\r?\n/).map(text=>({text})),{sourceId:source.id,...(typeof (source.reference||source.name)==='string'?{reference:source.reference||source.name}:{})}));
  if(result)return result;
 }
 return null;
}

// Separate material list documents (e.g. "Materialliste ZP 2024") of the same specialty and exam type.
// Their sections ("Aufgabe 2: …", "Station 3 …" or a task title) are matched to tasks by title words.
// Only a clear, unique match becomes a proposal; everything else is reported as unclear.
const listName=/material|bereitstell|ger(?:ä|ae)t|werkzeug|vorbereitung/i;
const blockStart=/^\s*(?:(?:prüfungs|pruefungs)?aufgabe|station|arbeitsplatz)\s*(?:nr\.?\s*)?\d+\b/i;
const fold=value=>String(value||'').toLocaleLowerCase('de').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
const stop=new Set(['aufgabe','pruefung','pruefungsaufgabe','praktische','station','arbeitsplatz','material','materialien','materialliste','werkzeuge','geraete','hilfsmittel','fuer','oder','eine','einer','einem','einen','sowie','nach','unter','ueber','beim','durch','zwischenpruefung','abschlusspruefung','originalvorlage','original']);
const words=value=>[...new Set(fold(value).split(/[^a-z0-9]+/).filter(w=>w.length>=4&&!stop.has(w)))];
const plain=value=>fold(value).replace(/[^a-z0-9]+/g,' ').trim();
function sourceYear(task,sources){return sources.find(s=>task.sourceIds?.includes(s.id)&&Number.isInteger(s.year))?.year??null;}
function listDocuments(sources){return sources.filter(s=>s&&typeof s.text==='string'&&s.text.trim()&&listName.test(`${s.name||''} ${s.role||''}`));}
function listBlocks(source,titles){
 const blocks=[];let current=null;
 for(const raw of source.text.split(/\r?\n/)){const line=raw.trim();if(!line)continue;if(blockStart.test(line)||titles.has(plain(line))){current={header:line,lines:[]};blocks.push(current);continue;}if(current)current.lines.push(line);}
 return blocks.filter(b=>b.lines.length);
}
function blockText(block,title){
 const units=block.lines.map(text=>({text})),own=combine(sections(units,{}));if(own)return own.text;
 const lines=block.lines.filter((line,n)=>!(n===0&&plain(line)===plain(title))).slice(0,40);
 return lines.map(line=>marked.test(line)?line.replace(/^/,'•'):'• '+line).join('\n');
}
function scanSourceLists(tasks,sources){
 const practicalTasks=tasks.filter(t=>practical(t)&&!t.supersededBy),documents=[],matches=[],unclear=[];
 for(const doc of listDocuments(sources)){
  const scope=practicalTasks.filter(t=>t.specialty===doc.specialty&&t.examType===doc.examType&&!t.sourceIds?.includes(doc.id)&&(doc.year==null||sourceYear(t,sources)==null||sourceYear(t,sources)===doc.year));
  const blocks=listBlocks(doc,new Set(scope.map(t=>plain(t.title))));if(!blocks.length)continue;documents.push({sourceId:doc.id,name:doc.name,blocks:blocks.length});
  for(const block of blocks){
   const head=words(block.header+' '+(block.lines[0]||'')),scored=scope.map(t=>{const w=words(t.title),hit=w.filter(x=>head.includes(x)).length;return {t,score:w.length?hit/w.length:0,hit};}).filter(x=>x.hit).sort((a,b)=>b.score-a.score);
   const best=scored[0],next=scored[1];
   if(best&&best.score>=0.6&&(!next||next.score<best.score)){const text=blockText(block,best.t.title);if(text.trim())matches.push({taskId:best.t.id,sourceId:doc.id,reference:doc.name,header:block.header,score:best.score,text:text.slice(0,20000),quote:(block.header+'\n'+block.lines.join('\n')).slice(0,20000)});else unclear.push({sourceId:doc.id,reference:doc.name,header:block.header});}
   else unclear.push({sourceId:doc.id,reference:doc.name,header:block.header});
  }
 }
 // One section per task: a second, weaker section for the same task counts as unclear.
 const kept=new Map();for(const m of matches){const prev=kept.get(m.taskId);if(!prev||m.score>prev.score){if(prev)unclear.push({sourceId:prev.sourceId,reference:prev.reference,header:prev.header});kept.set(m.taskId,m);}else unclear.push({sourceId:m.sourceId,reference:m.reference,header:m.header});}
 return {documents,matches:[...kept.values()],unclear};
}
// Confirmed or hand-written lists are never replaced; a list from the task's own text stays first choice.
function canTakeSourceList(task){const m=task.materials;return practical(task)&&(m===undefined||m.status!=='confirmed'&&m.method==='general-title-v1');}
function applySourceList(task,match){
 if(!canTakeSourceList(task))return task;const next=clone(task);
 next.sourceIds=[...new Set([...(next.sourceIds||[]),match.sourceId])];
 next.materials={text:match.text,status:'proposal',method:'explicit-heading-v1',evidence:[{sourceId:match.sourceId,reference:match.reference,quote:match.quote}]};
 return validate(next);
}

function generalProposal(task){
 const title=[task.title,task.category].filter(Boolean).join(' ').toLocaleLowerCase('de');let lines;
 if(/aussaat|säen|saeen/.test(title))lines=['Saatgut laut Arbeitsauftrag','Geeignete Aussaatgefäße und Aussaatsubstrat','Etiketten und Schreibmittel','Geeignete Gießmöglichkeit'];
 else if(/steckling|vermehr/.test(title))lines=['Pflanzenmaterial laut Arbeitsauftrag','Geeignetes Schneidwerkzeug','Geeignete Vermehrungsgefäße und Substrat','Etiketten und Schreibmittel'];
 else if(/bepflanz|pflanzung|pflanzen\s+(?:setzen|topfen)|topfen|umtopf/.test(title))lines=['Pflanzen laut Arbeitsauftrag','Vorgesehene Pflanzfläche oder geeignete Pflanzgefäße','Geeigneter Boden oder Substrat','Passende Pflanzwerkzeuge und Gießmöglichkeit'];
 else if(/bodenbearbeit/.test(title))lines=['Vorgesehene Arbeitsfläche','Geeignete Geräte zur geplanten Bodenbearbeitung','Benötigte Hilfsmittel laut Arbeitsauftrag','Schutzausrüstung passend zu den eingesetzten Geräten'];
 else if(/ernte|ernten|aufbereitung/.test(title))lines=['Erntegut oder Kultur laut Arbeitsauftrag','Geeignete Erntewerkzeuge','Geeignete Sammel- und Sortierbehälter','Hilfsmittel für die vorgesehene Aufbereitung'];
 else if(/schnitt|schneiden/.test(title))lines=['Pflanzen oder Pflanzenmaterial laut Arbeitsauftrag','Geeignete Schnittwerkzeuge','Behälter für Schnittgut','Schutzausrüstung passend zu den eingesetzten Werkzeugen'];
 else lines=['Materialien und Pflanzen laut Arbeitsauftrag festlegen','Geeignete Werkzeuge und Geräte auswählen','Erforderliche Hilfsmittel und Schutzausrüstung prüfen','Bereitstellung und benötigte Mengen durch den Prüfungsausschuss ergänzen'];
 return {text:lines.map(line=>'• '+line).join('\n'),status:'proposal',method:'general-title-v1',evidence:[{quote:'Allgemeiner Vorschlag anhand von Titel und Arbeitsbereich; keine belegte Materialvorgabe. Eignung, Mengen und Bereitstellung durch den Prüfungsausschuss festlegen.'}]};
}

function proposeMaterials(task,sources=[]){
 validate(task);const next=clone(task);
 if(!practical(next)||next.materials!==undefined)return next;
 next.materials=extractMaterials(next,sources)||generalProposal(next);return validate(next);
}

function setMaterials(task,text,{confirm=false}={}){
 validate(task);if(!bounded(text,20000)||typeof confirm!=='boolean')fail();
 const next=clone(task),previous=next.materials;
 next.materials={...(previous||{method:'manual',evidence:[]}),text,status:confirm?'confirmed':previous?.text===text?previous.status:'proposal'};
 return validate(next);
}

function resetMaterialsConfirmation(task){
 validate(task);const next=clone(task);if(next.materials)next.materials.status='proposal';return next;
}

function materialsIssues(exam){
 if(exam?.materialRequirementVersion!==1)return [];
 return (exam.items||[]).flatMap((item,n)=>{
  const t=item.task;if(!practical(t))return [];
  if(!t.materials?.text?.trim())return ['Aufgabe '+(n+1)+': Materialliste noch festlegen.'];
  return t.materials.status==='confirmed'?[]:['Aufgabe '+(n+1)+': Materialvorschlag noch durch den Prüfungsausschuss bestätigen.'];
 });
}

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function documentHtml(exam){
 const items=(exam.items||[]).filter(item=>practical(item.task));for(const item of items)validate(item.task);
 return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Materialübersicht · ${esc(exam.title)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:11pt/1.5 Arial,sans-serif;color:#203c31;max-width:850px;margin:32px auto;padding:0 20px}header{border-bottom:2px solid #365d47;padding-bottom:14px}h1{font-size:25pt;margin:8px 0}h2{font-size:15pt;margin:6px 0}p{margin:8px 0}.meta{color:#53645b;font-size:10pt}.task{margin-top:24px;break-inside:avoid}.status{display:inline-block;border:1px solid #668172;padding:3px 8px;font-size:10pt}.proposal,.missing{border-color:#996a29;background:#fff4df}.materials{white-space:pre-wrap;overflow-wrap:anywhere;border-left:3px solid #d6dfd9;padding:10px 14px}.toolbar{margin:0 0 20px}button{font:inherit;padding:10px 14px;cursor:pointer}footer{border-top:1px solid #ccd4ce;font-size:9pt;margin-top:24px;padding-top:10px}@media print{body{margin:0;padding:0;max-width:none}.toolbar{display:none}h2{break-after:avoid}.status{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="toolbar"><button onclick="window.print()">Drucken / als PDF speichern</button></div><header><p class="meta">Vertrauliche Organisationsunterlage für Prüfungsausschuss und zuständige Stelle</p><h1>Materialübersicht</h1><h2>${esc(exam.title)}</h2><p class="meta">${esc(exam.specialty)}${exam.date?' · '+esc(exam.date):''}</p><p>Materialien je praktischer Aufgabe. Vorschläge vor der Bereitstellung prüfen, ergänzen und ausdrücklich bestätigen.</p></header>${items.map((item,n)=>{const t=item.task,m=t.materials,present=!!m?.text.trim(),status=!present?'missing':m.status,caption=!present?'Noch festzulegen':m.status==='confirmed'?'Bestätigt':'Vorschlag',origin=m?.method==='general-title-v1'?'Allgemeiner Vorschlag · Eignung, Mengen und Bereitstellung festlegen.':m?.method==='explicit-heading-v1'?'Aus vorhandener Materialrubrik übernommen · für diese Prüfung prüfen.':'';return `<section class="task"><p class="meta">Praktische Aufgabe ${n+1}</p><h2>${esc(t.title)}</h2><p><span class="status ${status}">${caption}</span></p><div class="materials">${esc(present?m.text:'Materialliste durch den Prüfungsausschuss ergänzen.')}</div>${origin?`<p class="meta">${esc(origin)}</p>`:''}</section>`;}).join('')||'<p>Keine praktischen Aufgaben ausgewählt.</p>'}<footer>Organisatorische Materialplanung · Mengen, Verfügbarkeit und Sicherheit vor Ort prüfen.</footer></body></html>`;
}

const api={scanSourceLists,applySourceList,canTakeSourceList,validate,extractMaterials,proposeMaterials,setMaterials,resetMaterialsConfirmation,materialsIssues,document:documentHtml};
root.HortiMaterials=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
