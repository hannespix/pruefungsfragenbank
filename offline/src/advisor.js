/* Turns readiness issues into warning cards with one-click fixes. No UI, storage or authorization:
   fixes only name existing editor actions; every fix opens a proposal or a form, nothing is applied silently. */
(function(root){'use strict';
// First matching rule wins. kind: violation (breaks the regulation), open (still missing), confirm (needs a sign-off).
const RULES=[
 {test:/Minuten überschreiten/,kind:'violation',title:'Zeitrahmen überschritten',fixes:[['timing-plan','Zeitplan ansehen']],longest:true},
 {test:/Minuten eingeplant/,kind:'open',title:'Gesamtzeit passt noch nicht',fixes:[['timing-plan','Zeiten automatisch vorschlagen']]},
 {test:/Zeitangabe\(n\) offen|Bearbeitungszeit fehlt|Zeitangaben widersprüchlich|Minuten im Zeitfeld|Teilzeiten|Gesamtzeit|Zeitbudget|Zeitvorgabe/,kind:'open',title:'Zeiten klären',fixes:[['timing-plan','Zeiten vorschlagen']],item:['minutes','Zeit eintragen']},
 {test:/Kriteriumspunkte|Gesamtpunktzahl|Punktevorschlag|Summe der Kriterien|Gesamtpunkte|Punktverteilung/,kind:'open',title:'Punkte klären',fixes:[['points-plan','Punkte verteilen']],item:['points','Punkte eintragen']},
 {test:/nur Einzelaufgaben|Kombinationsaufgabe/,kind:'violation',title:'Kombinationsaufgabe in der Zwischenprüfung',fixes:[['suggest','Einzelaufgaben vorschlagen']],item:['focus','Aufgabe ansehen']},
 {test:/höchstens eine Aufgabe je Generalthema|aus einem anderen Generalthema|mehrfach ausgewählt/,kind:'violation',title:'Thema oder Aufgabe doppelt',fixes:[['suggest','Andere Aufgabe vorschlagen']],item:['focus','Aufgabe ansehen']},
 {test:/außerhalb|nicht ausgewählt oder nicht freigegeben|nicht freigegeben\.|anderen Prüfungsbereich|keine praktische Prüfungsaufgabe|nicht zum praktischen|ohne bestätigbare Kategorie/,kind:'violation',title:'Aufgabe passt nicht zur Prüfung',fixes:[],item:['focus','Aufgabe ansehen']},
 {test:/ausgeblendete|Prüfungsmuster|Prüfungsvorgaben fehlen/,kind:'violation',title:'Vorgaben veraltet',fixes:[['apply-pattern','Aktuelle Vorgaben übernehmen']]},
 {test:/Noch keine Generalthemen|Noch keine Kategorien/,kind:'open',title:'Themen auswählen',fixes:[['suggest-themes','Themen automatisch auswählen']]},
 {test:/Mündliche Prüfungsaufgabe noch nicht ausgewählt/,kind:'open',title:'Mündliche Aufgabe fehlt',fixes:[['oral-suggest','Mündliche Aufgabe vorschlagen']]},
 {test:/^Prüfungsverordnung: .*Bestätigung offen/,kind:'confirm',title:'Bestätigung zur Prüfungsverordnung',fixes:[['paper-check','Jetzt bestätigen']]},
 {test:/seit der Freigabe geändert/,kind:'confirm',title:'Erneute Freigabe nötig',fixes:[['release-exam','Erneut freigeben']]},
 {test:/Material/,kind:'open',title:'Material bestätigen',fixes:[],item:['materials','Material prüfen']},
 {test:/fachliche Prüfung offen|Freigabe/,kind:'open',title:'Fachliche Freigabe offen',fixes:[],item:['review','Freigabe öffnen']},
 {test:/Aufgabenstellung fehlt/,kind:'open',title:'Aufgabentext fehlt',fixes:[],item:['text','Text ergänzen']},
 {test:/Quellenhinweis|Übernahme prüfen|Originalvorlage prüfen|Originalseiten/,kind:'open',title:'Übernahme aus der Quelle prüfen',fixes:[],item:['flags','Hinweise prüfen']},
 {test:/Bereich der komplexen Prüfungsaufgabe offen/,kind:'open',title:'Bereich zuordnen',fixes:[],item:['focus','Aufgabe ansehen']},
 {test:/(\d+) von (\d+) (?:praktischen|komplexen) Prüfungsaufgaben|von mindestens \d+|vorgesehenen Aufgaben|Keine Aufgaben ausgewählt|fehlen noch/,kind:'open',title:'Aufgaben fehlen',fixes:[['suggest','Fehlende Aufgaben vorschlagen']]}
];
const tooMany=/^(\d+) von (\d+) (?:praktischen|komplexen) Prüfungsaufgaben/;
/**
 * @param {string[]} issues readiness issues
 * @param {{id:string,label:string}[]} entries exam entries (to link "Aufgabe 2: …" to its item)
 * @returns {{kind:string,title:string,text:string,itemId:string|null,fixes:{action:string,id?:string,label:string}[]}[]}
 */
function advise(issues,entries=[]){
 const list=[...new Set(issues||[])],cards=[];
 const hasCount=list.some(s=>tooMany.test(s));
 for(const text of list){
  if(hasCount&&text==='Keine Aufgaben ausgewählt.')continue;
  const entry=entries.find(i=>text.startsWith(i.label+': ')),rule=RULES.find(r=>r.test.test(text));
  let kind=rule?.kind||'open',title=rule?.title||'Hinweis';const fixes=(rule?.fixes||[]).map(([action,label])=>({action,label}));
  const count=tooMany.exec(text);if(count&&Number(count[1])>Number(count[2])){kind='violation';title='Zu viele Aufgaben';fixes.length=0;fixes.push({action:'paper-check',label:'Auswahl prüfen'});}
  // Stored source times are never cut automatically: lead to the task with the longest time instead.
  if(rule?.longest){const longest=entries.filter(i=>i.task?.minutes>0).sort((a,b)=>b.task.minutes-a.task.minutes)[0];if(longest)fixes.unshift({action:'required-field',id:JSON.stringify([longest.id,'minutes']),label:'Zeit von '+longest.label+' ändern ('+longest.task.minutes+' Min.)'});}
  if(entry&&rule?.item){const [field,label]=rule.item;fixes.unshift(field==='focus'?{action:'paper-focus',id:entry.id,label}:{action:'required-field',id:JSON.stringify([entry.id,field]),label});}
  cards.push({kind,title,text:entry?text.slice(entry.label.length+2):text,itemLabel:entry?.label||null,itemId:entry?.id||null,fixes});
 }
 // Several regulation sign-offs become one card with one button.
 const confirms=cards.filter(c=>c.title==='Bestätigung zur Prüfungsverordnung');
 if(confirms.length>1){const first=confirms[0];first.title=confirms.length+' Bestätigungen zur Prüfungsverordnung offen';first.text=confirms.map(c=>c.text.replace(/^Prüfungsverordnung: /,'').replace(/ – Bestätigung offen\.?$/,'')).join(' · ');for(const c of confirms.slice(1))cards.splice(cards.indexOf(c),1);}
 const order={violation:0,open:1,confirm:2};
 return cards.sort((a,b)=>order[a.kind]-order[b.kind]);
}
const api={advise};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HortiAdvisor=api;
})(globalThis);
