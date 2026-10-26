/* Historical exports use source files, never the current edited task bank. */
(function(root){'use strict';
const Zip=root.JSZip||(typeof require==='function'?require('../vendor/jszip.min.js'):null);
const PDF=root.PDFLib||(typeof require==='function'?require('../vendor/pdf-lib.min.js'):null);
const compare=(a,b)=>String(a).localeCompare(String(b),'de',{numeric:true});
const safe=value=>String(value||'Unbenannt').normalize('NFKC').replace(/[\\/\x00-\x1f<>:"|?*]/g,'_').replace(/^\.+/,'_').slice(0,110).trim()||'Unbenannt';
const yearOf=s=>Number.isInteger(s.year)&&s.year>=1900&&s.year<=2200?s.year:null;
const dateOf=s=>{if(typeof s.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date))return '';const date=new Date(s.date+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===s.date?s.date:'';};
function component(s){if(/mündlich/i.test(s.role)||s.role==='Anlage'&&/mündlich/i.test(s.name))return 'oral';if(/praktisch/i.test(s.role))return 'practical';if(s.role==='Anlage')return 'attachment';return 'other';}
function groups(d,filters={}){
 const from=filters.from==null||filters.from===''?null:Number(filters.from),to=filters.to==null||filters.to===''?null:Number(filters.to);
 if(from!==null&&(!Number.isInteger(from)||from<1900||from>2200)||to!==null&&(!Number.isInteger(to)||to<1900||to>2200)||from!==null&&to!==null&&from>to)throw Error('Bitte einen gültigen Jahresbereich wählen.');
 const map=new Map();
 for(const s of d.sources){const year=yearOf(s),kind=component(s);
  if(filters.unknownOnly?year!==null:year===null&&(from!==null||to!==null))continue;
  if(year!==null&&(from!==null&&year<from||to!==null&&year>to))continue;
  if(filters.examType&&s.examType!==filters.examType||filters.specialty&&s.specialty!==filters.specialty)continue;
  if(filters.component!=='all'&&!['practical','attachment'].includes(kind))continue;
  const date=dateOf(s),key=JSON.stringify([year,s.examType,s.specialty,date]);
  if(!map.has(key))map.set(key,{key,year,examType:s.examType,specialty:s.specialty,date,sources:[]});map.get(key).sources.push(s);
 }
 return [...map.values()].map(g=>({...g,sources:g.sources.sort((a,b)=>compare(a.name,b.name)||compare(a.id,b.id))})).sort((a,b)=>(b.year??0)-(a.year??0)||compare(a.examType,b.examType)||compare(a.specialty,b.specialty)||compare(a.date,b.date));
}
function printAsset(d,s){const original=d.assets.find(a=>a.id===s.assetId);if(original?.mime==='application/pdf')return original;if(!/^[a-f0-9]{64}$/i.test(s.sha256||''))return null;return s.attachmentIds.map(id=>d.assets.find(a=>a.id===id)).find(a=>a?.mime==='application/pdf'&&a.archiveRole==='source-print-pdf'&&a.sourceSha256===s.sha256)||null;}
function linkedAssets(d,s){const result=[];for(const id of [s.assetId,...s.attachmentIds].filter(Boolean)){const a=d.assets.find(a=>a.id===id);if(!a)throw Error('Anlage fehlt im Bestand: '+s.name);if(a.archiveRole==='source-print-pdf'&&a.id!==printAsset(d,s)?.id)continue;if(!result.some(x=>x.id===id))result.push(a);}return result;}
function requiredAssetIds(d,collections){return [...new Set(collections.flatMap(g=>g.sources.flatMap(s=>linkedAssets(d,s).map(a=>a.id))))];}
function summary(d,g){return {documents:g.sources.length,pdfs:g.sources.filter(s=>printAsset(d,s)).length,originals:g.sources.filter(s=>s.assetId&&d.assets.some(a=>a.id===s.assetId)).length,practical:g.sources.filter(s=>component(s)==='practical').length};}
function evidence(s){return s.yearEvidence==='filename'?'Jahr aus Dateiname; Einsatz nicht bestätigt':s.yearEvidence==='document'?'Jahr aus Dokument; Einsatz gesondert prüfen':'Jahreszuordnung aus gespeicherten Metadaten; Einsatz nicht bestätigt';}
const decode=s=>Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0));
function data(a){if(!a?.data)throw Error('Anlage fehlt oder ist noch nicht geladen: '+(a?.name||'unbekannt'));return a.data;}
async function packageArchive(d,collections,{duplex=true,onProgress=()=>{}}={}){
 if(!collections.length)throw Error('Für diese Auswahl sind keine Archivunterlagen vorhanden.');
 const zip=new Zip(),missingPrint=[],missingOriginal=[],records=[],pageCounts=[];
 // Fail before building a partially populated archive.
 for(const g of collections)for(const s of g.sources)for(const a of linkedAssets(d,s))data(a);
 let totalSources=0;
 for(const [index,g] of collections.entries()){
  onProgress(index+1,collections.length);
  const folder=`${g.year??'Jahr_unbekannt'}/${safe(g.examType)}/${String(index+1).padStart(2,'0')}_${safe(g.specialty)}${g.date?'_'+g.date:''}/`;
  const merged=await PDF.PDFDocument.create(),manifest=[];let missing=0;
  for(const [n,s] of g.sources.entries()){
   totalSources++;const number=String(n+1).padStart(3,'0'),original=s.assetId&&d.assets.find(a=>a.id===s.assetId),print=printAsset(d,s),prefix=number+'_'+safe(s.name),entry={sourceId:s.id,name:s.name,year:g.year,examType:g.examType,specialty:g.specialty,date:g.date||null,role:s.role,yearEvidence:s.yearEvidence||null,originalSha256:s.sha256||null,originalPath:null,printPath:null,pages:null,firstPacketPage:null,blankReverse:false};
   if(original){entry.originalPath=folder+'Originale/'+prefix;zip.file(entry.originalPath,data(original),{base64:true});}else missingOriginal.push(s.name);
   if(print){
    entry.printPath=folder+'Druckkopien/'+number+'_'+safe(s.name.replace(/\.[^.]+$/,''))+'.pdf';zip.file(entry.printPath,data(print),{base64:true});
    let sourcePdf;try{sourcePdf=await PDF.PDFDocument.load(decode(data(print)),{updateMetadata:false});if(!sourcePdf.getPageCount())throw Error('keine Seiten');}catch{throw Error('PDF-Druckkopie ist nicht lesbar: '+s.name+'. Bitte die Originaldatei prüfen.');}
    const copied=await merged.copyPages(sourcePdf,sourcePdf.getPageIndices());entry.firstPacketPage=merged.getPageCount()+1;entry.pages=copied.length;for(const page of copied)merged.addPage(page);
    if(duplex&&copied.length%2){const last=copied.at(-1);merged.addPage([last.getWidth(),last.getHeight()]).setRotation(last.getRotation());entry.blankReverse=true;}
   }else{missing++;missingPrint.push(s.name);}
   let attachment=0;for(const a of linkedAssets(d,s)){if(a.id===original?.id||a.id===print?.id)continue;zip.file(folder+'Anlagen/'+number+'_'+String(++attachment).padStart(2,'0')+'_'+safe(a.name),data(a),{base64:true});}
   manifest.push(`${number}. ${s.name}\n   ${s.role} · ${evidence(s)}\n   ${print?'Druckkopie: '+entry.pages+' Seiten, Start im Druckpaket: '+entry.firstPacketPage+(entry.blankReverse?' (leere Rückseite ergänzt)':''):'KEINE PDF-DRUCKKOPIE – Original separat öffnen und drucken.'}${original?'':'\n   ORIGINALDATEI FEHLT.'}`);records.push(entry);
  }
  const pages=merged.getPageCount();if(pages){merged.setTitle(`Archivsammlung ${g.year??'Jahr unbekannt'} · ${g.examType} · ${g.specialty}`);merged.setCreator('Prüfungswerkstatt Gartenbau');zip.file(folder+`01_Archivsammlung${missing?'_UNVOLLSTAENDIG':''}.pdf`,await merged.save());}pageCounts.push({key:g.key,pages});
  zip.file(folder+'INHALT.txt',`${g.year??'Jahr unbekannt'} · ${g.examType} · ${g.specialty}${g.date?' · '+g.date:''}\n\nArchivsammlung nach Metadaten. Vollständigkeit, Reihenfolge und tatsächlicher Prüfungseinsatz sind nicht bestätigt. Sortierung: Dateinamen.\n${missing?'ACHTUNG: '+missing+' Unterlagen fehlen im gemeinsamen PDF. Originale separat prüfen.\n':''}\n${manifest.join('\n\n')}\n`);
 }
 zip.file('LESEN.txt',`PRÜFUNGSARCHIV – VERTRAULICHE UNTERLAGEN\n\nZIP vollständig entpacken. In jedem Jahrgangs-/Fachrichtungsordner liegt ein gemeinsames PDF zum Drucken, soweit Druckkopien vorhanden sind. Unter „Originale“ liegen unveränderte Ursprungsdateien, unter „Druckkopien“ die einzelnen PDFs und unter „Anlagen“ weitere zugehörige Dateien. INHALT.txt erklärt die Reihenfolge und Seitenzuordnung.\n\nEs sind Archivsammlungen nach Metadaten, keine Bestätigung vollständiger tatsächlich eingesetzter Prüfungssätze. Die Sortierung folgt den Dateinamen. Jahr aus Dateiname ist kein Einsatznachweis. Mehrere Termine oder Varianten können in einer Sammlung enthalten sein. Die heutige Aufgabenbank wird nicht zur Rekonstruktion des damaligen Wortlauts verwendet.\n\nHistorisches Layout bleibt erhalten. PDF-Druckkopien können aus Word konvertiert sein; im Zweifel mit der Originaldatei vergleichen. ${duplex?'Jede Unterlage beginnt auf einer Vorderseite; nötige leere Rückseiten sind eingefügt. Beidseitig an langer Kante drucken.':'Keine leeren Rückseiten ergänzt; Seitenfolge vor beidseitigem Druck kontrollieren.'} PDF-Seitengrößen und Drehungen bleiben erhalten. Bei gemischten Formaten passende Papierzufuhr wählen und mit 100 Prozent drucken; Maßstab am Original kontrollieren.\n\nDas Archiv kann Lösungen und Bewertungen enthalten. Vor Weitergabe die benötigten Teilnehmerunterlagen auswählen.\n\nFehlende PDF-Druckkopien (${missingPrint.length}):\n${missingPrint.join('\n')||'Keine innerhalb dieser Auswahl.'}\n\nFehlende Originaldateien (${missingOriginal.length}):\n${missingOriginal.join('\n')||'Keine innerhalb dieser Auswahl.'}\n`);
 zip.file('Verzeichnis.json',JSON.stringify({version:1,description:'Archivsammlung nach Quellmetadaten; Vollständigkeit und tatsächlicher Einsatz unbestätigt.',duplex,documents:records},null,2));
 return {bytes:await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),missingPrint,missingOriginal,collections:collections.length,documents:totalSources,pageCounts};
}
const api={groups,component,printAsset,requiredAssetIds,summary,evidence,package:packageArchive};root.HortiArchive=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
