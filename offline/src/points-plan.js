/* Visible score proposals: preserve known values and never resolve conflicts silently. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.HortiCore;
const P=typeof module!=='undefined'&&module.exports?require('./planning.js'):root.HortiPlanning;
const S=typeof module!=='undefined'&&module.exports?require('./source-layout.js'):root.HortiSourceLayout;
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const positive=n=>Number.isFinite(n)&&n>0;
function visibleTotals(t){
 const text=t.sourceLayout?t.sourceLayout.pages.flatMap(p=>S.displayBlocks(p).map(b=>b.text)).join('\n'):t.text||'',evidence=[];
 for(const line of text.split(/\r?\n/)){
  const match=line.match(/^\s*(?:Gesamtpunkte|Gesamtpunktzahl|Punkte\s+gesamt)\s*:?\s*(\d+(?:[,.]\d+)?)\b/i)||line.match(/^\s*(?:Gesamt|Insgesamt)\s*:?\s*(\d+(?:[,.]\d+)?)\s*Punkte\b/i);
  if(match)evidence.push({points:Number(match[1].replace(',','.')),sourceId:t.sourceLayout?.sourceId||'',reference:t.sourceLayout?.reference||'Aufgabentext',quotes:[line.trim()]});
 }
 return evidence;
}
function sourceIssues(e){return C.examEntries(e).flatMap(item=>{const totals=[...new Set(visibleTotals(item.task).map(q=>q.points))];return totals.length>1?[item.label+': Widersprüchliche Gesamtpunkte im sichtbaren Aufgabentext ('+totals.join(' / ')+'); ausdrücklich abgleichen.']:positive(item.task.points)&&totals.some(n=>Math.abs(n-item.task.points)>0.001)?[item.label+': '+item.task.points+' Gesamtpunkte im Punktefeld widersprechen dem sichtbaren Aufgabentext ('+totals.join(' / ')+'). Werte ausdrücklich abgleichen.']:[];});}
function rowFor(item,context){
 const t=item.task,criteria=C.clone(t.criteria),known=criteria.filter(c=>c.points!=null),missing=criteria.filter(c=>c.points==null),sum=known.reduce((n,c)=>n+c.points,0);
 const row={itemId:item.id,label:item.label,title:t.title,component:item.component,currentPoints:t.points??null,points:t.points??null,criteria,method:'existing',explanation:'Gespeicherte Gesamt- und Teilpunkte bleiben unverändert.',evidence:[],issues:[],changed:false};
 const conflict=message=>{row.method='conflict';row.explanation=message;row.issues.push(item.label+': '+message);return row;};
 try{C.checkTask(t,context);}catch(error){return conflict(error.message);}
 row.evidence=visibleTotals(t);const sourceTotals=[...new Set(row.evidence.map(q=>q.points))];
 if(sourceTotals.length>1)return conflict('Widersprüchliche Gesamtpunkte im sichtbaren Aufgabentext ('+sourceTotals.join(' / ')+'); zuerst ausdrücklich abgleichen.');
 if(t.points!=null&&sourceTotals.some(n=>Math.abs(n-t.points)>0.001))return conflict(t.points+' Gesamtpunkte im Punktefeld widersprechen dem sichtbaren Aufgabentext ('+sourceTotals[0]+'). Werte ausdrücklich abgleichen.');
 if(t.points!=null&&!positive(t.points))return conflict('Gespeicherte Gesamtpunktzahl '+t.points+' ausdrücklich prüfen; benötigt wird eine positive Punktzahl.');
 if(t.points==null){
  if(sourceTotals.length&&positive(sourceTotals[0])){row.points=sourceTotals[0];row.method='source-explicit';row.explanation='Gesamtpunkte ausdrücklich im sichtbaren Aufgabentext belegt. Fehlende Gewichtungen bleiben fachliche Vorschläge.';}
  else if(criteria.length&&!missing.length&&positive(sum)){row.points=sum;row.method='criterion-sum';row.explanation='Gesamtpunkte aus der Summe aller vorhandenen Kriteriumspunkte; keine neu erfundene Gewichtung und keine zusätzliche Quellenbestätigung.';}
  else if(sum>=100)return conflict('Bereits '+sum+' Teilpunkte vorhanden, weitere Kriteriumspunkte fehlen. Gesamtpunktzahl ausdrücklich festlegen; die 100-Punkte-Arbeitsgrundlage reicht nicht aus.');
  else {row.points=100;row.method='working-scale-100-v1';row.explanation='Vorschlag: 100 Punkte als Arbeitsgrundlage, keine amtliche Vorgabe und keine Quellenbestätigung. Gesamtpunkte und Gewichtung fachlich prüfen.';}
 }
 if(sum>row.points+0.001)return conflict(sum+' vorhandene Teilpunkte überschreiten '+row.points+' Gesamtpunkte. Werte ausdrücklich abgleichen; nichts wird umverteilt.');
 if(criteria.length&&!missing.length&&Math.abs(sum-row.points)>0.001)return conflict('Summe der vorhandenen Kriteriumspunkte ('+sum+') weicht von '+row.points+' Gesamtpunkten ab. Gesamt- oder Teilpunkte ausdrücklich korrigieren.');
 let targets=missing;
 if(!criteria.length){
  // Reuse the established rubric wording as an explicitly suggested rubric.
  const rubric=C.proposePoints({...C.clone(t),points:null},context).criteria;
  criteria.push(...rubric.map(c=>({...c,points:null})));targets=criteria;
  if(row.method==='existing'){row.method='rubric-equal';row.explanation='Gespeicherte Gesamtpunkte bleiben erhalten. Neue Bewertungskriterien und gleichmäßige Gewichtung sind ein fachlich zu prüfender Vorschlag; keine Quellenbestätigung.';}
 }
 if(targets.length){
  const remainder=row.points-sum;let assigned=0;
  targets.forEach((c,n)=>{const cumulative=n===targets.length-1?remainder:Math.min(remainder,round(remainder*(n+1)/targets.length));c.points=Number((cumulative-assigned).toPrecision(14));assigned=cumulative;});
  if(row.method==='existing'){row.method='remaining-equal';row.explanation='Gespeicherte '+row.points+' Gesamtpunkte und '+sum+' bekannte Teilpunkte bleiben erhalten.';}
  row.explanation+=' Vorschlag: die verbleibenden '+remainder+' Punkte gleichmäßig auf '+targets.length+' offene Kriterien verteilen.';
 }
 row.changed=row.points!==t.points||!C.equal(criteria,t.criteria);
 if(!row.changed&&t.pointsProposal)row.explanation='Übernommener Punktevorschlag bleibt erhalten. '+(t.pointsProposal.explanation||'Arbeitsgrundlage; keine amtliche Vorgabe oder Quellenbestätigung.');
 return row;
}
function propose(e,d){
 const rows=C.examEntries(e).map(i=>rowFor(i,P.examContext(e))),issues=rows.flatMap(r=>r.issues);
 if(e.status==='used')issues.push('Bereits dokumentierte Prüfungen bleiben unverändert.');
 return {examKey:C.contentKey(e),rows,issues,canApply:e.status!=='used'&&rows.some(r=>r.changed)&&!rows.some(r=>r.issues.length)};
}
function apply(e,d,plan){
 if(e.status==='used')throw Error('Bereits dokumentierte Prüfungen bleiben unverändert.');
 const fresh=propose(e,d);if(plan&&!C.equal(plan,fresh))throw Error('Punktevorschlag ist geändert oder veraltet. Bitte neu vorschlagen lassen.');
 const next=C.clone(e);if(!fresh.rows.some(r=>r.changed))return next;
 if(!fresh.canApply)throw Error('Punktevorschlag kann nicht übernommen werden. '+fresh.issues.join(' '));
 for(const row of fresh.rows.filter(r=>r.changed)){
  const t=C.findExamItem(next,row.itemId).task;t.points=row.points;t.criteria=C.clone(row.criteria);
  t.pointsProposal={method:row.method,total:row.points,explanation:row.explanation,evidence:C.clone(row.evidence)};
  t.reviewStatus='review';t.solutionStatus=t.solution.trim()?'draft':'missing';t.reviewedBy='';delete t.reviewedAt;delete t.reviewKey;delete t.pointsReview;
 }
 next.status='draft';next.updatedAt=C.now();delete next.regulationReview;delete next.regulationReviewKey;delete next.submittedAt;return next;
}
function approve(e,{reviewedBy}={}){
 if(e.status==='used')throw Error('Bereits dokumentierte Prüfungen bleiben unverändert.');
 const issues=sourceIssues(e),entries=C.examEntries(e);if(!entries.length)issues.push('Keine Aufgaben mit Punktverteilung ausgewählt.');
 for(const {task:t,label} of entries){if(!positive(t.points))issues.push(label+': Positive Gesamtpunktzahl fehlt; Punktevorschlag zuerst übernehmen oder Punkte ergänzen.');if(!Array.isArray(t.criteria)||t.criteria.some(c=>!Number.isFinite(c.points)||c.points<0))issues.push(label+': Kriteriumspunkte fehlen oder sind ungültig.');else if(t.criteria.length&&Math.abs(t.criteria.reduce((n,c)=>n+c.points,0)-t.points)>0.001)issues.push(label+': Summe der Kriteriumspunkte weicht von Gesamtpunkten ab.');}
 if(issues.length)throw Error('Punktverteilung noch nicht freigebbar:\n'+issues.join('\n'));
 const next=C.clone(e),reviewer=typeof reviewedBy==='string'&&reviewedBy.trim()?reviewedBy.trim():'Zuständige Stelle',at=C.now();let changed=false;
 for(const {task:t} of C.examEntries(next)){if(C.pointsReviewCurrent(t)&&t.pointsReview?.reviewedBy===reviewer)continue;t.pointsReview={contentKey:C.pointsReviewKey(t),reviewedBy:reviewer,reviewedAt:at};changed=true;}
 if(changed)next.updatedAt=at;return next;
}
const api={propose,apply,approve,sourceIssues};root.HortiPointsPlan=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
