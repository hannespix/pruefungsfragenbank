/* Native Word design, built with pinned docx. Private data arrives at runtime. */
(function(root){'use strict';
const C=root.HortiCore||(typeof require==='function'?require('./core.js'):null);
const S=root.HortiSourceLayout||(typeof require==='function'?require('./source-layout.js'):null);
const P=root.HortiPrint||(typeof require==='function'?require('./print.js'):null);
const A=root.HortiDocxAssets||(typeof require==='function'?require('./docx-assets.js'):null);
const X=root.docx||(typeof require==='function'?require('../vendor/docx.umd.min.js'):null);
const Zip=root.JSZip||(typeof require==='function'?require('../vendor/jszip.min.js'):null);
const tw=pt=>Math.round(pt*20),mm=n=>Math.round(n*1440/25.4),px=pt=>pt*4/3,emu=pt=>Math.round(pt*12700);
const clean=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
const ink='2A2623',muted='625E59',line='B8B4AF',soft='F4F3F3',paperWidth=mm(174);
async function documentFile(e,input,examiner=false){
 if(!e?.items?.length)throw Error('Die Prüfung enthält keine Aufgaben.');S.assertExport(e);
 const d=await A.wordImages(e,input,examiner),fonts=A.fontAssets(d),regular=fonts.find(a=>a.docxFontKey==='sansRegular'),bold=fonts.find(a=>a.docxFontKey==='sansBold'),serif=fonts.find(a=>a.docxFontKey==='serifBold');
 if(e.items.some(i=>i.task.assetLinks.some(l=>l.design==='bw-2024'))&&(!regular||!bold||!serif))throw Error('Die geschützten Word-Schriften fehlen. Bitte den Datenbestand aktualisieren.');
 if(e.items.some(i=>i.task.sourceLayout)&&!regular)throw Error('Word-Schriften fehlen für die Prüfung der festen Originalseiten. Bitte den Datenbestand aktualisieren.');
 const sans=regular?.fontFamily||'Arial',heading=serif?.fontFamily||sans,widths=regular?{regular:A.metrics(regular),bold:A.metrics(bold||regular)}:null;
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
  return new X.Table({width:{size:widths.reduce((a,b)=>a+b,0),type:X.WidthType.DXA},columnWidths:widths,layout:X.TableLayoutType.FIXED,borders:borders(bordered?border:none),rows:rows.map(row=>new X.TableRow({cantSplit:true,tableHeader:!!row.header,height:row.height?{value:row.height,rule:X.HeightRule.ATLEAST}:undefined,children:row.cells.map((children,n)=>new X.TableCell({width:{size:widths[n],type:X.WidthType.DXA},margins:{top:padding,bottom:padding,left:padding,right:padding},verticalAlign:X.VerticalAlign.TOP,shading:row.header?{fill:soft}:undefined,children:Array.isArray(children)?children:[children]}))}))});
 }
 function image(a,maxWidth,maxHeight,floating){
  const [iw,ih]=A.imageSize(a),scale=Math.min(maxWidth/iw,maxHeight/ih);
  return new X.ImageRun({type:{'image/png':'png','image/jpeg':'jpg','image/gif':'gif'}[a.mime],data:A.bytes(a.data),transformation:{width:px(iw*scale),height:px(ih*scale)},altText:{id:String(++drawingId),title:clean(a.name),description:clean(a.name),name:'Prüfungsanlage'},...(floating?{floating}:{} )});
 }
 const anchor=(x,y,behind=false)=>({horizontalPosition:{relative:X.HorizontalPositionRelativeFrom.PAGE,offset:emu(x)},verticalPosition:{relative:X.VerticalPositionRelativeFrom.PAGE,offset:emu(y)},allowOverlap:true,layoutInCell:false,behindDocument:behind,wrap:{type:X.TextWrappingType.NONE},zIndex:behind?0:10});
 function letterhead(t){
  const links=t?t.assetLinks:e.items.flatMap(i=>i.task.assetLinks),candidates=links.filter(l=>l.role==='letterhead'&&l.audience==='candidate'),link=candidates.find(l=>l.design==='bw-2024')||candidates[0];
  const text=[p('Praktischer Prüfungstag','ExamHeader'),p('„'+e.specialty+'“','ExamHeader'),p((e.examType==='AP'?'Abschlussprüfung':'Zwischenprüfung')+' '+(e.examYear||'')+' · '+label,'ExamSmall',{spacing:{before:100,after:0}})];
  return new X.Header({children:link?[table([{cells:[[new X.Paragraph({children:[image(A.requireAsset(d,link.assetId),156,66)],spacing:{after:0}})],[p('','ExamSmall')],text]}],[mm(55),mm(10),mm(109)],{bordered:false,padding:0}),gap(0)]:text});
 }
 function footer(original=false){
  if(original)return new X.Footer({children:[p(draft?'ENTWURF · NICHT FREIGEGEBEN':(examiner?label:''),'ExamSmall',{alignment:X.AlignmentType.CENTER})]});
  return new X.Footer({children:[new X.Paragraph({style:'ExamSmall',border:{top:{...border,space:6}},tabStops:[{type:X.TabStopType.RIGHT,position:paperWidth}],children:[run(label+' · '),run(draft?'ENTWURF · NICHT FREIGEGEBEN':e.specialty),new X.TextRun({children:[new X.Tab(),'Seite ',X.PageNumber.CURRENT,' / ',X.PageNumber.TOTAL_PAGES]})]})]});
 }
 function section(children,{task=null,original=false,page={width:595.3,height:841.9},header=null,type=X.SectionType.NEXT_PAGE}={}){
  sections.push({properties:{type,page:{size:{width:tw(page.width),height:tw(page.height)},margin:original?{top:0,bottom:0,left:0,right:0,header:0,footer:240}:{top:mm(48),bottom:mm(20),left:mm(18),right:mm(18),header:mm(18),footer:mm(10)}}},headers:{default:header||(original?new X.Header({children:[p('','ExamSmall')]}):letterhead(task))},footers:{default:footer(original)},children:children.length?(original?children:[gap(0),...children]):[gap(0)]});
 }
 function identity(){return table([{height:mm(15),cells:[p('Name / Prüflingsnummer:','ExamMeta',{run:{bold:true}}),p('Datum: '+(e.date||''),'ExamMeta',{run:{bold:true}})]}],[Math.round(paperWidth*.58),paperWidth-Math.round(paperWidth*.58)],{padding:mm(3)});}
 function callout(text){return new X.Table({width:{size:paperWidth,type:X.WidthType.DXA},columnWidths:[paperWidth],borders:borders(none),rows:[new X.TableRow({cantSplit:true,children:[new X.TableCell({shading:{fill:'FFF4DF'},margins:{top:180,bottom:180,left:180,right:180},children:[p(text,'ExamMeta')]})]})]});}
 function planningBox(){return table([{height:mm(44),cells:[p('','ExamBody')]}],[paperWidth],{padding:140});}
 const graphics=(t,audience)=>t.assetLinks.filter(l=>l.audience===audience&&!['letterhead','brand-font','source-page'].includes(l.role)&&!(t.sourceLayout&&l.role==='source-embedded'));
 function graphic(l){const a=A.requireAsset(d,l.assetId);if(/^image\//.test(a.mime))return [new X.Paragraph({children:[image(a,paperWidth/20,mm(175)/20)],keepNext:true,spacing:{before:180,after:80}}),p(l.caption||a.name,'ExamSmall')];const file=P.attachments({items:[{task:{assetLinks:[l]}}]},d,true)[0];return [callout('Separate Anlage: '+(file?.path||a.name)+' – vor Ausgabe beifügen.')];}
 if(!e.items.some(i=>i.task.sourceLayout)){
  const total=C.totals(e);
  section([p((e.examType==='AP'?'Abschlussprüfung':'Zwischenprüfung')+' '+(e.examYear||''),'ExamEyebrow'),p(e.title,'ExamTitle'),p(e.specialty,'ExamSubtitle'),gap(10),table([{cells:[p('Prüfungstermin','ExamMeta',{run:{bold:true}}),p(e.date||'Noch festzulegen','ExamMeta')]},{cells:[p('Umfang','ExamMeta',{run:{bold:true}}),p(`${e.items.length} Aufgaben · ${total.points}${total.unknownPoints?' + offene':''} Punkte`,'ExamMeta')]},{cells:[p('Bearbeitungszeit','ExamMeta',{run:{bold:true}}),p(C.durationSummary(total),'ExamMeta')]}],[mm(38),paperWidth-mm(38)],{bordered:false,padding:100}),gap(14),identity(),gap(14),p('Hinweise zur Durchführung','ExamHeading'),p(e.notes||'','ExamBody'),gap(12),callout(draft?'ENTWURF · Vor Verwendung Aufgaben, Punkte, Zeiten und Lösungen fachlich prüfen.':'Freigaben vollständig')]);
 }
 function sourceText(b){
  const lines=b.text===b.originalText?b.lines.map(l=>l.runs):b.text.split('\n').map(text=>[{text,bold:false,italic:false}]);let scale=Math.min(1,b.height/Math.max(b.lineHeight,lines.length*b.lineHeight));
  for(const line of lines){const measured=line.map(r=>({...r}));while(measured.length&&!measured.at(-1).text.trimEnd())measured.pop();if(measured.length)measured.at(-1).text=measured.at(-1).text.trimEnd();const width=measured.reduce((sum,r)=>sum+widths[r.bold?'bold':'regular'](r.text)*b.fontSize,0);scale=Math.min(scale,b.width/Math.max(1,width));}
  if(scale<.78)throw Error('Text passt nicht lesbar in die Word-Vorlage: '+b.text.slice(0,80));const size=Math.floor(b.fontSize*scale*2),lineHeight=tw(b.lineHeight*scale);
  return new X.WpsShapeRun({type:'wps',altText:{id:String(++drawingId),name:'Originaltext'},transformation:{width:px(b.width),height:px(b.height+1)},floating:anchor(b.x,b.y),outline:{type:'noFill'},nonVisualProperties:{txBox:'1'},bodyProperties:{margins:{top:0,bottom:0,left:0,right:0},verticalAnchor:'t',noAutoFit:true},children:lines.map(rs=>new X.Paragraph({spacing:{before:0,after:0,line:lineHeight,lineRule:X.LineRuleType.EXACT},widowControl:false,children:rs.map(r=>run(r.text,{font:sans,size,bold:r.bold,italics:r.italic,color:ink}))}))});
 }
 for(const [n,{task:t}] of e.items.entries()){
  if(t.sourceLayout){
   for(const [index,page] of t.sourceLayout.pages.entries()){
    const logo=t.assetLinks.find(l=>l.role==='letterhead'&&l.design==='bw-2024'&&l.audience==='candidate');if(page.logos.length&&!logo)throw Error('Landeslogo fehlt für die Originalvorlage.');
    const header=new X.Header({children:[new X.Paragraph({spacing:{line:20,lineRule:X.LineRuleType.EXACT,after:0},children:[image(A.requireAsset(d,page.backgroundAssetId),page.width,page.height,anchor(0,0,true)),...page.logos.map(b=>image(A.requireAsset(d,logo.assetId),b.width,b.height,anchor(b.x,b.y)))]})]});
    section([new X.Paragraph({spacing:{line:20,lineRule:X.LineRuleType.EXACT,after:0},children:page.blocks.map(sourceText)})],{original:true,page,header,type:index?X.SectionType.NEXT_PAGE:X.SectionType.ODD_PAGE});
   }
   if(t.sourceLayout.pages.length%2)section([gap(0)],{original:true,page:t.sourceLayout.pages.at(-1)});
  }else{
   section([identity(),gap(12),p('Aufgabe '+(n+1),'ExamEyebrow'),p(t.title,'TaskTitle'),table([{cells:[p(`${t.points??'Offene'} Punkte`,'ExamMeta',{run:{bold:true}}),p('Bearbeitungszeit: '+(t.minutes==null?'noch festzulegen':t.minutes+' Minuten'),'ExamMeta')]}],[mm(50),paperWidth-mm(50)],{bordered:false,padding:80}),gap(8),...(t.pointsProposal&&t.reviewStatus!=='approved'?[callout('Punktevorschlag · Gesamt- und Teilpunkte vor dem Einsatz fachlich prüfen.'),gap(6)]:[]),...(P.timingNotes(t)?[p(P.timingNotes(t),'ExamMeta',{shading:{fill:soft}})]:[]),p(t.text),...graphics(t,'candidate').flatMap(graphic),gap(10),p('Durchführungsplanung / Bearbeitung','ExamHeading'),planningBox()],{task:t,type:X.SectionType.ODD_PAGE});
  }
 }
 for(const [n,{task:t}] of e.items.entries())if(t.sourceLayout)for(const l of graphics(t,'candidate'))section([p('Zusätzliche Anlage · Aufgabe '+(n+1),'TaskTitle'),...graphic(l)],{task:t});
 if(examiner)for(const [n,{task:t}] of e.items.entries()){
  const criteria=t.criteria.length?t.criteria:[{text:'Gesamtbewertung',answer:'Bewertungskriterien ergänzen',points:t.points}];
  const rows=[{header:true,cells:['Kriterium / Teilaufgabe','Erwartete Leistung','Max.','Erreicht'].map(v=>p(v,'ExamTable',{run:{bold:true}}))},...criteria.map(c=>({cells:[p(c.text,'ExamTable'),p(c.answer||'Erwartung ergänzen','ExamTable'),p(c.points??'offen','ExamTable'),p('','ExamTable')]}))];
  section([p('Aufgabe '+(n+1)+' · Lösung und Bewertung','TaskTitle'),p(t.title,'ExamSubtitle'),p('Lösung / Erwartungshorizont','ExamHeading'),...(t.solutionStatus!=='approved'?[callout('ENTWURF · Lösung noch fachlich prüfen und freigeben.'),gap(8)]:[]),p(t.solution||'Keine Musterlösung hinterlegt. Fachlich ergänzen und freigeben.'),gap(8),p('Bewertung','ExamHeading'),p(C.pointsLabel(t),'ExamMeta'),table(rows,[2762,4340,1381,paperWidth-8483],{padding:120}),...graphics(t,'examiner').flatMap(graphic),gap(8),p('Beobachtungen / Begründung:','ExamMeta')],{task:t});
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
 const z=await Zip.loadAsync(await X.Packer.toArrayBuffer(doc));await A.embedFonts(z,fonts);
 return z.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
const api={document:documentFile,requiredAssetIds:A.requiredAssetIds,fontAssets:A.fontAssets};root.HortiDocx=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
