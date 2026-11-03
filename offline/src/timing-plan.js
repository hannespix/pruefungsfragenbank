/* Evidence-based time proposals. Originals and saved positive durations stay intact. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.HortiCore;
const P=typeof module!=='undefined'&&module.exports?require('./planning.js'):root.HortiPlanning;
const S=typeof module!=='undefined'&&module.exports?require('./source-layout.js'):root.HortiSourceLayout;
const positive=n=>Number.isFinite(n)&&n>0;
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const normalized=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('de');
const complete=phases=>{const labels=phases.map(p=>p.label);return labels.includes('Durchführung')&&labels.includes('Reflexion')||labels.includes('Prüfgespräch')&&(labels.includes('Planung / Vorbereitung')||labels.includes('Durchführung'));};
const evidence=(sourceId,reference,quotes)=>({sourceId:sourceId||'',reference:reference||'',quotes:[...new Set(quotes.filter(Boolean))]});
const dedupe=values=>values.filter((v,n)=>values.findIndex(q=>C.equal(v,q))===n);

// core.extractTiming supplies known phase labels. Total detection is stricter:
// an isolated preparation, break or parenthesized substep is never a task total.
function inspect(text){
 const extraction=C.extractTiming(text),candidates=[];
 for(const line of String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){
  const totals=[...line.matchAll(/\b(?:Bearbeitungszeit|Gesamtzeit|Gesamtdauer|Zeitvorgabe|Zeitablauf|Zeit|Dauer|Insgesamt)\s*:?\s*\(?(\d+(?:[,.]\d+)?)\s*(?:Minuten|Min\.?)(?=\s|[),.;:]|$)/gi)];
  for(const m of totals){
   const prefix=line.slice(0,m.index);
   if(/(?:Planung|Vorbereitung|Durchführung|Reflexion|Reflektion|Pause|Prüfgespräch)[^.;:]*$/i.test(prefix)&&!/Gesamt|Insgesamt|Bearbeitungs/i.test(m[0]))continue;
   const minutes=Number(m[1].replace(',','.'));if(positive(minutes))candidates.push({minutes,method:'source-explicit',quotes:[line]});
  }
  const sentence=line.match(/^Sie haben\s+(\d+)\s+Minuten Zeit[.!]?$/i);
  if(sentence)candidates.push({minutes:Number(sentence[1]),method:'source-explicit',quotes:[line]});
  if(!totals.length&&/^(?:Praktische Prüfung|Prüfungsaufgabe|Arbeitsauftrag)\b/i.test(line)&&!/Planung|Vorbereitung|Reflexion|Reflektion|Pause/i.test(line)){
   const t=C.extractTiming(line);if(t.method==='explicit'&&positive(t.totalMinutes))candidates.push({minutes:t.totalMinutes,method:'source-explicit',quotes:t.evidence});
  }
 }
 if(complete(extraction.phases)){
  const minutes=round(extraction.phases.reduce((n,p)=>n+p.minutes,0));
  if(positive(minutes))candidates.push({minutes,method:'source-phase-sum',quotes:extraction.evidence});
 }
 return {candidates:dedupe(candidates),phases:extraction.phases,quotes:extraction.evidence};
}
function wholeSourceBelongs(source,t,e,d){
 const text=normalized(source.text),body=normalized(t.text),title=normalized(t.title);
 if(!text||source.examType&&source.examType!==t.examType||source.specialty&&source.specialty!==t.specialty)return false;
 const owners=[...(d?.tasks||[]),...C.examEntries(e).map(i=>i.task)];
 if(owners.some(other=>other.id!==t.id&&other.familyId!==t.familyId&&other.sourceIds?.includes(source.id)))return false;
 const headings=[...String(source.text).matchAll(/(?:^|\n)\s*(?:Aufgabe|Prüfungsaufgabe|Arbeitsauftrag)\s+(\d+)\b/gi)];
 if(new Set(headings.map(m=>m[1])).size>1||/\b(?:Gesamtprüfung|Gesamte Prüfung|Prüfungsübersicht)\b/i.test(source.text))return false;
 if(text===body)return true;
 if(body.length<40||!text.includes(body)||!title||!String(source.text).split(/\r?\n/).some(line=>normalized(line)===title))return false;
 if(t.kind!=='oral'&&/mündliche\s+prüfung/i.test(source.text))return false;
 return true;
}
function sourcesFor(t,e,d){
 const candidates=[],proof=[],phaseAmounts=[],warnings=[];
 let visibleText=t.text||'',reference='Aufgabentext',sourceId='';
 if(t.sourceLayout){
  visibleText=t.sourceLayout.pages.flatMap(p=>S.displayBlocks(p).map(b=>b.text)).join('\n');
  sourceId=t.sourceLayout.sourceId;reference=t.sourceLayout.reference||'Sichtbare Originalseiten';
  if(S.stale(t))warnings.push('Aufgabentext und sichtbare Originalseiten weichen ab; Originalvorlage prüfen.');
 }
 const visible=inspect(visibleText);
 const add=(result,id,ref)=>{
  if(result.quotes.length||result.candidates.length)proof.push(evidence(id,ref,[...result.quotes,...result.candidates.flatMap(c=>c.quotes)]));
  candidates.push(...result.candidates.map(c=>({...c,sourceId:id||'',reference:ref||''})));
  if(result.phases.length)phaseAmounts.push(round(result.phases.reduce((n,p)=>n+p.minutes,0)));
 };
 add(visible,sourceId,reference);
 const timing=t.timing;
 if(timing){
  proof.push(...(timing.evidence||[]).map(q=>evidence(q.sourceId,q.reference,q.quotes||[])));
  const groups=timing.referenceOnly?[]:(timing.evidence||[]).map(q=>inspect((q.quotes||[]).join('\n')));
  if(!timing.referenceOnly){
   // Printed task phases and each source group independently set a lower bound.
   // Taking their maximum avoids joining unrelated documents or counting the
   // same phase twice through both metadata and its supporting quotation.
   for(const phases of [timing.phases||[],...groups.map(g=>g.phases)]){
    phaseAmounts.push(round(phases.reduce((n,p)=>n+(positive(p.minutes)?p.minutes:0),0)));
   }
  }
  if(!timing.referenceOnly&&['explicit','phase-sum'].includes(timing.method)&&positive(timing.totalMinutes)){
   // Metadata is already attached to this task, not inferred from its whole PDF.
   // Validate phase totals within one evidence group; never join documents.
   const supported=timing.method==='explicit'||groups.some(g=>g.candidates.some(c=>c.minutes===timing.totalMinutes&&c.method==='source-phase-sum'))||!groups.length&&complete(timing.phases||[]);
   if(supported)candidates.push({minutes:timing.totalMinutes,method:'source-'+timing.method,quotes:(timing.evidence||[]).flatMap(q=>q.quotes||[]),sourceId:timing.evidence?.[0]?.sourceId||'',reference:timing.evidence?.[0]?.reference||'Gespeicherte Zeitbelege'});
   for(const group of groups)candidates.push(...group.candidates);
   if(!supported)warnings.push('Gespeicherte Teilzeiten ergeben keinen eindeutig belegten Gesamtauftrag; Zeit prüfen.');
  }
 }
 for(const source of d?.sources||[]){
  if(!t.sourceIds?.includes(source.id)||t.sourceLayout?.sourceId===source.id||!wholeSourceBelongs(source,t,e,d))continue;
  add(inspect(source.text),source.id,source.reference||source.name||'Originalquelle');
 }
 return {candidates:dedupe(candidates),evidence:dedupe(proof),visible,minimum:Math.max(0,...phaseAmounts),warnings};
}
function validSaved(t){return positive(t.minutes)&&!(t.timing?.method==='conflict'&&t.timing.manualTotalMinutes!==t.minutes);}
function changedExam(e,rows){
 const next=C.clone(e);let changed=false;
 for(const row of rows){
  if(!positive(row.minutes)||!['source-explicit','source-phase-sum','planning'].includes(row.method))continue;
  const item=C.findExamItem(next,row.itemId),t=item?.task;
  if(!t||positive(t.minutes)||t.timing?.method==='conflict')continue;
  t.minutes=row.minutes;t.timingProposal={minutes:row.minutes,method:row.method,explanation:row.explanation,evidence:C.clone(row.evidence)};
  t.reviewStatus='review';t.solutionStatus=t.solution?.trim()?'draft':'missing';t.reviewedBy='';delete t.reviewedAt;changed=true;
 }
 if(changed){next.status='draft';next.updatedAt=C.now();}
 return next;
}
function propose(e,d){
 const profile=P.examRequirements(e),issues=[],pending=[];
 let targetMinutes=profile?.exactMinutes||profile?.maxMinutes||null;
 if(profile&&!profile.exactMinutes&&positive(e.targetMinutes)){
  targetMinutes=Math.min(e.targetMinutes,profile.maxMinutes);
  if(e.targetMinutes>profile.maxMinutes)issues.push(`Gewünschte ${e.targetMinutes} Minuten überschreiten die Grenze von ${profile.maxMinutes} Minuten; Planung auf ${targetMinutes} Minuten begrenzt.`);
 }
 const rows=C.examEntries(e).map(item=>{
  const t=item.task,source=sourcesFor(t,e,d),practical=item.component==='practical'&&t.kind==='practical',units=practical?(profile?.examType==='AP'?Math.max(1,P.regulationTask(t,P.examContext(e)).units.length):1):0;
  const row={itemId:item.id,label:item.label,title:t.title,component:item.component,units,currentMinutes:positive(t.minutes)?t.minutes:null,minutes:null,method:'unresolved',explanation:'Bearbeitungszeit fachlich festlegen.',evidence:source.evidence};
  issues.push(...source.warnings.map(s=>item.label+': '+s));
  const totals=[...new Set(source.candidates.map(c=>c.minutes))],visibleTotals=[...new Set(source.visible.candidates.map(c=>c.minutes))];
  const mismatch=minutes=>visibleTotals.some(n=>n!==minutes);
  const visibleIssue=minutes=>`${item.label}: ${minutes} Minuten im Zeitfeld widersprechen dem sichtbaren ${t.sourceLayout?'Originalseitentext':'Aufgabentext'} (${visibleTotals.join(' / ')} Minuten). Zeiten ausdrücklich abgleichen.`;
  if(validSaved(t)){
   row.minutes=t.minutes;row.method='existing';row.explanation='Gespeicherte positive Bearbeitungszeit bleibt unverändert.';
   if(t.timingProposal?.minutes===t.minutes&&t.timingProposal.method==='planning')row.explanation='Übernommener Planungsvorschlag bleibt unverändert; keine gesetzliche Einzelaufgabendauer und keine Quellenbestätigung. '+t.timingProposal.explanation;
   if(mismatch(t.minutes))issues.push(visibleIssue(t.minutes));
   else if(totals.some(n=>n!==t.minutes))issues.push(`${item.label}: Gespeicherte ${t.minutes} Minuten weichen von Zeitbelegen (${totals.join(' / ')} Minuten) ab; fachlich prüfen.`);
   if(t.minutes+1e-8<source.minimum)issues.push(`${item.label}: Gespeicherte ${t.minutes} Minuten unterschreiten die sichtbaren oder belegten Teilzeiten (${source.minimum} Minuten); Phasen und Gesamtzeit ausdrücklich abgleichen.`);
  }else if(t.timing?.method==='conflict'||totals.length>1||totals.some(n=>n+1e-8<source.minimum)){
   row.method='conflict';row.explanation='Widersprüchliche Zeitbelege; eine Gesamtzeit muss ausdrücklich bestätigt werden.';
   issues.push(item.label+': '+row.explanation);
   if(totals.some(n=>n+1e-8<source.minimum))issues.push(`${item.label}: Gesamtzeit aus der Quelle unterschreitet belegte Teilzeiten (${source.minimum} Minuten); Phasen zuerst abgleichen.`);
   if(visibleTotals.length)issues.push(`${item.label}: Sichtbarer ${t.sourceLayout?'Originalseitentext':'Aufgabentext'} nennt ${visibleTotals.join(' / ')} Minuten; widersprüchliche Quellen zuerst abgleichen.`);
  }else if(totals.length===1){
   const candidate=source.candidates.find(c=>c.method==='source-explicit')||source.candidates[0];
   row.minutes=candidate.minutes;row.method=candidate.method;row.explanation=candidate.method==='source-phase-sum'?'Vollständige zusammengehörige Zeitphasen der Aufgabe addiert.':'Gesamtzeit aus dem Aufgabentext oder eindeutig zugehörigen Zeitbelegen.';
  }else if(practical&&profile){pending.push({row,minimum:source.minimum});}
  else if(item.component==='oral'){
   row.explanation='Mündliche Bearbeitungszeit offen; keine pauschale oder rechtliche Dauer aus der praktischen Prüfung ableiten.';issues.push(item.label+': '+row.explanation);
  }else issues.push(item.label+': Keine passende praktische Zeitvorgabe; Bearbeitungszeit ausdrücklich prüfen.');
  return row;
 });
 const practical=rows.filter(r=>r.component==='practical'&&r.units>0),selectedUnits=practical.reduce((n,r)=>n+r.units,0),reservedUnits=profile?Math.max(0,profile.totalTasks-selectedUnits):0;
 const fixed=round(practical.reduce((n,r)=>n+(positive(r.minutes)?r.minutes:0),0));
 const unresolvedUnits=practical.filter(r=>!positive(r.minutes)).reduce((n,r)=>n+r.units,0),remaining=targetMinutes===null?0:round(targetMinutes-fixed),weight=reservedUnits+unresolvedUnits;
 if(reservedUnits)issues.push(`${reservedUnits} praktische Aufgabe(n) fehlen noch; ihr Anteil am Zeitbudget bleibt reserviert.`);
 if(selectedUnits>(profile?.totalTasks??Infinity))issues.push(`${selectedUnits} praktische Aufgaben überschreiten die vorgesehenen ${profile.totalTasks}; Auswahl prüfen.`);
 // Integer hundredths keep a full allocation exact without silently altering
 // saved or source-backed values. Unresolved conflicts and absent slots reserve
 // their proportional share even though no value is applied to them.
 let allocatedWeight=0,allocatedCents=0;
 for(const {row,minimum} of pending){
  if(remaining<=0||!weight){issues.push(`${row.label}: Kein freies Zeitbudget für einen positiven Vorschlag; gespeicherte Zeiten ausdrücklich prüfen.`);continue;}
  allocatedWeight+=row.units;const cumulative=Math.round(Math.round(remaining*100)*allocatedWeight/weight),minutes=(cumulative-allocatedCents)/100;allocatedCents=cumulative;
  if(!positive(minutes)||minutes+1e-8<minimum){issues.push(`${row.label}: Verbleibender Anteil (${minutes} Minuten) reicht für die belegten Teilzeiten (${minimum} Minuten) nicht; Phasen und Gesamtzeit prüfen.`);continue;}
  row.minutes=minutes;row.method='planning';row.explanation=`Planungsvorschlag: ${remaining} verbleibende Minuten anteilig auf ${weight} noch offene praktische Aufgabe(n), einschließlich reservierter Plätze; dieses Blatt zählt ${row.units}. Keine gesetzliche Einzelaufgabendauer.${minimum?' Vorhandene Teilzeiten ergeben noch keine belegte Gesamtzeit.':''}`;
 }
 const totalMinutes=round(practical.reduce((n,r)=>n+(positive(r.minutes)?r.minutes:0),0));
 if(profile&&totalMinutes>profile.maxMinutes)issues.push(`${totalMinutes} Minuten überschreiten die praktische Gesamtzeit von ${profile.maxMinutes} Minuten. Quellenwerte bleiben erhalten; Zeiten ausdrücklich prüfen.`);
 if(profile?.exactMinutes&&totalMinutes!==profile.exactMinutes&&!practical.some(r=>!positive(r.minutes))&&!reservedUnits)issues.push(`${totalMinutes} von ${profile.exactMinutes} Minuten eingeplant; Fachwerker-Praxis benötigt 180 Minuten. Gespeicherte Zeiten bleiben unverändert; Differenz von ${round(profile.exactMinutes-totalMinutes)} Minuten ausdrücklich prüfen.`);
 if(!profile)issues.push('Für diese Prüfung liegt keine passende praktische Zeitvorgabe vor.');
 if(e.status==='used')issues.push('Bereits dokumentierte Prüfungen bleiben unverändert.');
 const candidate=changedExam(e,rows),transition=P.structureTransitionIssue(candidate,e);
 if(transition)issues.push(transition);
 const hasChanges=rows.some(r=>['source-explicit','source-phase-sum','planning'].includes(r.method)&&positive(r.minutes)&&!positive(r.currentMinutes));
 return {rows,targetMinutes,totalMinutes,issues:[...new Set(issues)],canApply:e.status!=='used'&&hasChanges&&!transition&&!(profile&&totalMinutes>profile.maxMinutes)};
}
function apply(e,d,plan){
 if(e.status==='used')throw Error('Bereits dokumentierte Prüfungen bleiben unverändert.');
 const fresh=propose(e,d);
 if(plan&&(!C.equal(plan.rows,fresh.rows)||plan.targetMinutes!==fresh.targetMinutes||plan.totalMinutes!==fresh.totalMinutes))throw Error('Zeitvorschlag ist geändert oder veraltet. Bitte neu vorschlagen lassen.');
 const next=changedExam(e,fresh.rows),issue=P.structureTransitionIssue(next,e);
 if(issue)throw Error(issue);
 if(!fresh.canApply&&(!C.equal(next.items,e.items)||!C.equal(next.oralItem,e.oralItem)))throw Error('Zeitvorschlag kann nicht übernommen werden. '+fresh.issues.join(' '));
 return next;
}
// Release checks depend only on the chosen task snapshots. Missing allocations
// are handled by planning/readiness; this list covers contradictory source text.
function sourceIssues(e){
 const issues=[];
 for(const item of C.examEntries(e)){
  const t=item.task,source=sourcesFor(t,e,null),totals=[...new Set(source.candidates.map(c=>c.minutes))],visible=[...new Set(source.visible.candidates.map(c=>c.minutes))];
  if(S.stale(t))issues.push(`${item.label}: Aufgabentext und sichtbare Originalseiten weichen ab; Originalvorlage prüfen.`);
  if(positive(t.minutes)){
   if(visible.some(n=>n!==t.minutes))issues.push(`${item.label}: ${t.minutes} Minuten im Zeitfeld widersprechen dem sichtbaren ${t.sourceLayout?'Originalseitentext':'Aufgabentext'} (${visible.join(' / ')} Minuten). Zeiten ausdrücklich abgleichen.`);
   else if(totals.some(n=>n!==t.minutes))issues.push(`${item.label}: ${t.minutes} Minuten im Zeitfeld widersprechen den zugehörigen Zeitbelegen (${totals.join(' / ')} Minuten). Zeiten ausdrücklich abgleichen.`);
   if(t.minutes+1e-8<source.minimum)issues.push(`${item.label}: ${t.minutes} Minuten unterschreiten die sichtbaren oder belegten Teilzeiten (${source.minimum} Minuten); Phasen und Gesamtzeit abgleichen.`);
  }else if(totals.length>1)issues.push(`${item.label}: Widersprüchliche Gesamtzeiten (${totals.join(' / ')} Minuten) in Aufgabentext und Zeitbelegen; ausdrücklich abgleichen.`);
  if(!positive(t.minutes)&&totals.some(n=>n+1e-8<source.minimum))issues.push(`${item.label}: Gesamtzeit aus der Quelle unterschreitet belegte Teilzeiten (${source.minimum} Minuten); Phasen zuerst abgleichen.`);
 }
 return [...new Set(issues)];
}
const api={propose,apply,sourceIssues};root.HortiTimingPlan=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
