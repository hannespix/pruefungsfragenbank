(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.HortiAI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const INPUT_LIMIT=6000,OUTPUT_LIMIT=8000;
 const FIELDS=new Set(['title','task','solution','criterion','instruction']);
 const MODES={
  grammar:{label:'Rechtschreibung und Grammatik',description:'Sprachliche Fehler korrigieren; Inhalt und fachliche Aussagen erhalten.'},
  clear:{label:'Klarer und verständlicher',description:'Sätze leichter verständlich formulieren; Fachbegriffe und Anforderungen erhalten. Keine zertifizierte Leichte Sprache.'},
  exam:{label:'Prüfungsgerecht formulieren',description:'Arbeitsaufträge eindeutig formulieren; Lösungen, Fakten, Reihenfolge, Punkte und Zeit nicht ergänzen oder verändern.'}
 };
 const OFFLINE='Die KI-Schreibhilfe ist nur mit einer Verbindung zur Online-Version verfügbar. Du kannst den Text weiterhin selbst bearbeiten.';
 const DISABLED='Die KI-Schreibhilfe ist noch nicht eingerichtet oder derzeit deaktiviert. Du kannst den Text weiterhin selbst bearbeiten.';
 const STALE='Der Text wurde inzwischen geändert oder der Editor geschlossen. Bitte schließe die Schreibhilfe und öffne sie beim aktuellen Text erneut.';
 // Only exact application-owned messages may pass through; never arbitrary provider details.
 const SAFE_ERRORS=new Set([
  "Anthropic hat das Anfrageformat abgelehnt. Die zuständige Stelle muss die Konfiguration der Sprachhilfe prüfen.",
  "Anthropic hat das Anfragelimit erreicht. Bitte später erneut versuchen.",
  "Anthropic hat den API-Schlüssel abgewiesen. Die zuständige Stelle muss den Schlüssel prüfen und die Einrichtung erneut ausführen.",
  "Anthropic hat die Abrechnung abgewiesen. Die zuständige Stelle muss Zahlungsdaten und API-Guthaben prüfen.",
  "Anthropic hat eine unerwartete Weiterleitung geliefert. Die zuständige Stelle muss die Verbindung prüfen.",
  "Anthropic ist vorübergehend überlastet. Bitte später erneut versuchen.",
  "Anthropic verlangt einen zugeordneten Arbeitsbereich. Die zuständige Stelle muss einen auf diesen Arbeitsbereich begrenzten API-Schlüssel einrichten.",
  "Das Anthropic-API-Guthaben ist aufgebraucht. Die zuständige Stelle muss das Guthaben in der Claude Console prüfen und auffüllen.",
  "Das Anthropic-Ausgabenlimit wurde erreicht. Die zuständige Stelle muss das Limit in der Claude Console prüfen.",
  "Das konfigurierte Anthropic-Modell ist nicht verfügbar. Die zuständige Stelle muss Modellname und Modellzugriff prüfen.",
  "Dem Anthropic-API-Schlüssel fehlt die Berechtigung für das Modell oder den Arbeitsbereich. Bitte die zuständige Stelle informieren.",
  "Der Anthropic-Arbeitsbereich ist nicht verfügbar. Die zuständige Stelle muss Arbeitsbereich und API-Schlüssel prüfen.",
  "Der Vorschlag wurde nicht vollständig erstellt. Bitte kürzeren Text versuchen.",
  "Die Sprachhilfe hat eine zu große Antwort geliefert. Bitte kürzeren Text versuchen.",
  "Die Sprachhilfe hat keine verwertbare Antwort geliefert.",
  "Die Sprachhilfe hat keinen gültigen Vorschlag geliefert. Bitte erneut versuchen.",
  "Die Sprachhilfe hat zu lange gebraucht. Bitte später erneut versuchen.",
  "Die Sprachhilfe ist noch nicht eingerichtet. Sie können den Text weiterhin manuell bearbeiten.",
  "Für diesen Text konnte die Sprachhilfe keinen Vorschlag erstellen. Bitte manuell bearbeiten.",
  "Die Antwort von Anthropic konnte nicht vollständig gelesen werden. Bitte später erneut versuchen.",
  "Die Verbindung zu Anthropic konnte nicht hergestellt werden. Bitte später erneut versuchen."
]);
 function errorMessage(error){
  if(error?.status===401||error?.status===403)return 'Dein Zugang ist nicht mehr freigegeben. Bitte prüfe deine Anmeldung. Es wurde kein Text übernommen.';
  if([422,429,502,503,504].includes(error?.status)&&SAFE_ERRORS.has(error?.message))return error.message;
  if(error?.status===429)return 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut. Der Originaltext bleibt erhalten.';
  if(error?.status===503)return 'Die KI-Schreibhilfe ist momentan nicht verfügbar. Bitte versuche es später erneut oder bearbeite den Text selbst.';
  return 'Der Vorschlag konnte nicht geladen werden. Bitte prüfe die Verbindung und versuche es erneut. Du kannst den Text weiterhin selbst bearbeiten.';
 }
 function createSession(options={}){
  let targets=(options.targets||[]).filter(t=>t&&FIELDS.has(t.field)&&typeof t.read==='function'&&typeof t.write==='function'&&typeof t.valid==='function');
  let request=typeof options.request==='function'?options.request:null,onApply=options.onApply;
  let generation=0,statusGeneration=0,listeners=new Set();
  const state={closed:false,index:0,label:'',field:'',mode:'grammar',original:'',proposal:'',notes:'',model:'',busy:false,checking:false,enabled:false,error:'',notice:'',accepted:null};
  const snapshot=()=>({...state});
  const emit=()=>{for(const listener of listeners)listener(snapshot());};
  const target=()=>targets[state.index];
  const valid=()=>{try{return Boolean(target()?.valid());}catch(_){return false;}};
  function currentMatches(value){try{return valid()&&target().read()===value;}catch(_){return false;}}
  function select(index){
   if(state.closed||!Number.isInteger(index)||!targets[index])return false;
   generation++;state.index=index;state.label=String(target().label||'Text');state.field=target().field;
   state.busy=false;state.proposal='';state.notes='';state.accepted=null;state.notice='';state.error='';
   try{state.original=String(target().read()??'');}catch(_){state.original='';}
   if(!valid())state.error=STALE;
   else if(!request)state.error=OFFLINE;
   else if(!state.enabled&&!state.checking)state.error=DISABLED;
   emit();return true;
  }
  async function checkStatus(){
   if(state.closed)return false;
   if(!request){state.error=OFFLINE;emit();return false;}
   const token=++statusGeneration;state.checking=true;state.enabled=false;state.error='';emit();
   try{
    const response=await request('/api/ai/status');
    if(state.closed||token!==statusGeneration)return false;
    state.enabled=response?.enabled===true;
    state.model=typeof response?.model==='string'?response.model.slice(0,100):'';
    state.error=state.enabled?'':DISABLED;
    return state.enabled;
   }catch(error){if(!state.closed&&token===statusGeneration)state.error=errorMessage(error);return false;}
   finally{if(!state.closed&&token===statusGeneration){state.checking=false;emit();}}
  }
  function setMode(mode){
   if(state.closed||!MODES[mode]||state.mode===mode)return;
   generation++;state.mode=mode;state.busy=false;state.notes='';emit();
  }
  function editProposal(text){if(!state.closed){state.proposal=String(text);state.error='';state.notice='';emit();}}
  async function generate(){
   if(state.closed||state.busy||state.checking)return false;
   if(!request||!state.enabled){state.error=request?DISABLED:OFFLINE;emit();return false;}
   if(!currentMatches(state.accepted===null?state.original:state.accepted)){state.error=STALE;emit();return false;}
   if(!state.original.trim()||state.original.length>INPUT_LIMIT){state.error='Bitte wähle einen vorhandenen Text mit höchstens 6.000 Zeichen. Lange Texte zuerst im Editor in kleinere Abschnitte teilen.';emit();return false;}
   const token=++generation;
   const payload={text:state.original,mode:state.mode,field:state.field};
   state.busy=true;state.error='';state.notice='';state.notes='';emit();
   try{
    const response=await request('/api/ai/suggest',payload);
    if(state.closed||token!==generation)return false;
    if(!currentMatches(state.accepted===null?state.original:state.accepted)){state.proposal='';state.error=STALE;return false;}
    if(typeof response?.text!=='string'||!response.text.trim()||response.text.length>OUTPUT_LIMIT)throw Error('Invalid suggestion');
    state.proposal=response.text;
    state.notes=(Array.isArray(response.notes)?response.notes.filter(n=>typeof n==='string').join('\n'):typeof response.notes==='string'?response.notes:'').slice(0,3000);
    if(typeof response.model==='string')state.model=response.model.slice(0,100);
    return true;
   }catch(error){if(!state.closed&&token===generation)state.error=errorMessage(error);return false;}
   finally{if(!state.closed&&token===generation){state.busy=false;emit();}}
  }
  function accept(){
   if(state.closed||state.busy)return false;
   if(!currentMatches(state.accepted===null?state.original:state.accepted)){state.error=STALE;emit();return false;}
   if(!state.proposal.trim()||state.proposal.length>OUTPUT_LIMIT){state.error='Bitte prüfe den Vorschlag. Er muss Text enthalten und darf höchstens 8.000 Zeichen lang sein.';emit();return false;}
   if(state.proposal===(state.accepted===null?state.original:state.accepted))return false;
   const value=state.proposal;
   try{
    const destination=target();destination.write(value);
    if(state.closed)return false;
    // Native single-line inputs remove line breaks; keep the exact stored value for stale checks and undo.
    state.accepted=String(destination.read()??'');state.proposal=state.accepted;
   }catch(_){state.error='Der Text konnte nicht übernommen werden. Bitte prüfe den geöffneten Editor.';emit();return false;}
   state.error='';state.notice='Übernommen. Bitte fachlich prüfen und die Aufgabe wie gewohnt speichern.';
   if(typeof onApply==='function')onApply({field:state.field});
   emit();return true;
  }
  function undo(){
   if(state.closed||state.accepted===null)return false;
   if(!currentMatches(state.accepted)){state.error=STALE;emit();return false;}
   generation++;state.busy=false;
   try{target().write(state.original);}catch(_){state.error='Die Übernahme konnte nicht rückgängig gemacht werden. Bitte prüfe den geöffneten Editor.';emit();return false;}
   state.accepted=null;state.error='';state.notice='Übernahme rückgängig gemacht. Der Originaltext steht wieder im Editor.';
   if(typeof onApply==='function')onApply({field:state.field});
   emit();return true;
  }
  function close(){
   if(state.closed)return;
   generation++;statusGeneration++;state.closed=true;state.busy=false;state.checking=false;state.enabled=false;state.accepted=null;
   for(const key of ['label','field','original','proposal','notes','model','error','notice'])state[key]='';
   targets=[];request=null;onApply=null;emit();listeners.clear();
  }
  select(0);
  return {snapshot,select,checkStatus,setMode,editProposal,generate,accept,undo,close,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);}};
 }
 let active=null,nextId=0;
 const bindings=new WeakMap();
 function close(){if(active)active.close();}
 function open(options={}){
  close();
  const doc=root.document;
  if(!doc?.body||!Array.isArray(options.targets)||!options.targets.length)return null;
  const previousFocus=doc.activeElement,session=createSession(options),id='horti-ai-'+(++nextId);
  const element=(tag,text,className)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const button=(text,className,handler)=>{const node=element('button',text,className);node.type='button';node.addEventListener('click',ev=>{ev.preventDefault();handler();});return node;};
  const label=(text,control)=>{const node=element('label',text);node.setAttribute('for',control.id);return node;};
  const dialog=element('dialog',undefined,'ai-dialog');dialog.setAttribute('aria-labelledby',id+'-title');dialog.setAttribute('aria-describedby',id+'-privacy');
  const heading=element('h2','KI-Schreibhilfe');heading.id=id+'-title';
  const head=element('div',undefined,'modal-head');
  const closeButton=button('Schließen','ghost',finish);closeButton.setAttribute('aria-label','KI-Schreibhilfe schließen');head.append(heading,closeButton);
  const body=element('div',undefined,'modal-body ai-body');
  const privacy=element('p','Erst mit „Vorschlag erstellen“ wird nur der hier ausgewählte Originaltext über Cloudflare an Anthropic gesendet. Die Aufgabenbank, Bilder und Namenslisten werden nicht automatisch mitgeschickt. Enthält dieser Text Namen oder vertrauliche Angaben, werden diese mitgesendet; entferne sie bei Bedarf vorher im Editor.','ai-privacy');privacy.id=id+'-privacy';body.append(privacy);
  let selector=null;
  if(options.targets.length>1){
   const field=element('div',undefined,'field');selector=element('select');selector.id=id+'-target';
   options.targets.forEach((target,index)=>{const option=element('option',String(target.label||'Text'));option.value=String(index);selector.append(option);});
   selector.addEventListener('change',()=>session.select(Number(selector.value)));field.append(label('Welchen Text verbessern?',selector),selector);body.append(field);
  }else body.append(element('p',String(options.targets[0].label||'Text'),'ai-target-name'));
  const controls=element('div',undefined,'ai-controls'),modeField=element('div'),mode=element('select');mode.id=id+'-mode';
  for(const [value,item] of Object.entries(MODES)){const option=element('option',item.label);option.value=value;mode.append(option);}
  mode.addEventListener('change',()=>session.setMode(mode.value));modeField.append(label('Was soll verbessert werden?',mode),mode);
  const generateButton=button('Vorschlag erstellen','primary',async()=>{
   if(!await session.generate()||session.snapshot().closed||active?.dialog!==dialog||!session.snapshot().proposal)return;
   proposal.focus({preventScroll:true});
   proposal.scrollIntoView?.({block:'nearest',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth'});
  });controls.append(modeField,generateButton);
  const description=element('p',undefined,'tiny ai-mode-help');description.id=id+'-mode-help';mode.setAttribute('aria-describedby',description.id);
  const availability=element('p',undefined,'tiny ai-availability');availability.setAttribute('aria-live','polite');body.append(controls,description,availability);
  const compare=element('div',undefined,'ai-comparison'),originalPanel=element('div'),proposalPanel=element('div');
  const original=element('textarea');original.id=id+'-original';original.readOnly=true;original.rows=12;original.setAttribute('aria-describedby',id+'-count');
  const count=element('p',undefined,'tiny');count.id=id+'-count';originalPanel.append(label('Originaltext · wird gesendet',original),original,count);
  const proposal=element('textarea');proposal.id=id+'-proposal';proposal.rows=12;proposal.maxLength=OUTPUT_LIMIT;proposal.placeholder='Der Vorschlag erscheint hier. Du kannst ihn vor der Übernahme bearbeiten.';
  proposal.addEventListener('input',()=>session.editProposal(proposal.value));proposalPanel.append(label('Vorschlag · vor Übernahme bearbeiten',proposal),proposal);
  const proposalHelp=element('p','Die Übernahme ändert nur diesen Text. Prüfe anschließend Fachlichkeit, Lösung, Teilaufgaben, Punkte und Zeit.','tiny');proposalPanel.append(proposalHelp);
  compare.append(originalPanel,proposalPanel);body.append(compare);
  const notes=element('p',undefined,'ai-notes');
  const error=element('p',undefined,'ai-error');error.setAttribute('role','alert');
  const notice=element('p',undefined,'ai-notice');notice.setAttribute('role','status');
  body.append(notes,error,notice);
  const foot=element('div',undefined,'modal-foot ai-footer');
  const undoButton=button('Übernahme rückgängig','',()=>session.undo());
  const doneButton=button('Fertig','',finish),acceptButton=button('Vorschlag übernehmen','primary',()=>session.accept());foot.append(undoButton,doneButton,acceptButton);
  dialog.append(head,body,foot);
  function render(state){
   if(state.closed)return;
   original.value=state.original;
   if(proposal.value!==state.proposal)proposal.value=state.proposal;
   if(selector)selector.value=String(state.index);
   mode.value=state.mode;mode.disabled=state.busy;
   description.textContent=MODES[state.mode].description;
   count.textContent=state.original.length.toLocaleString('de-DE')+' / 6.000 Zeichen';
   availability.textContent=state.checking?'Verfügbarkeit wird geprüft …':state.busy?'Vorschlag wird erstellt …':state.enabled?'Bereit'+(state.model?' · Modell: '+state.model:''):'';
   dialog.setAttribute('aria-busy',String(state.busy||state.checking));
   generateButton.disabled=!state.enabled||state.checking||state.busy||!state.original.trim()||state.original.length>INPUT_LIMIT;
   proposal.disabled=state.busy;
   acceptButton.disabled=state.busy||!state.proposal.trim()||state.proposal.length>OUTPUT_LIMIT||state.proposal===(state.accepted===null?state.original:state.accepted);
   undoButton.hidden=state.accepted===null;undoButton.disabled=state.busy;
   notes.textContent=state.notes?'Hinweise zum Vorschlag:\n'+state.notes:'';notes.hidden=!state.notes;
   error.textContent=state.error;error.hidden=!state.error;notice.textContent=state.notice;notice.hidden=!state.notice;
  }
  let finished=false;
  function finish(){
   if(finished)return;finished=true;
   session.close();original.value='';proposal.value='';notes.textContent='';error.textContent='';notice.textContent='';
   if(dialog.open)dialog.close();dialog.textContent='';dialog.remove();
   if(active?.dialog===dialog)active=null;
   if(previousFocus?.isConnected&&typeof previousFocus.focus==='function')previousFocus.focus();
  }
  dialog.addEventListener('cancel',ev=>{ev.preventDefault();finish();});dialog.addEventListener('close',finish);
  // Do not let the application's delegated action handler interpret events inside this independent dialog.
  dialog.addEventListener('click',ev=>ev.stopPropagation());
  session.subscribe(render);active={close:finish,dialog};doc.body.append(dialog);render(session.snapshot());dialog.showModal();
  (selector||mode).focus();session.checkStatus();
  return {close:finish};
 }
 function bindForm(container,options={}){
  if(!container?.querySelectorAll)return;
  const definitions=[
   ['#task-title','title','Titel'],['#task-text:not([readonly])','task','Aufgabenstellung'],['#task-solution','solution','Lösung / Erwartungshorizont'],
   ['[data-template-block]','instruction','Originaltextblock'],['[data-criterion-text]','criterion','Bewertungskriterium'],['[data-criterion-answer]','criterion','Erwartete Leistung']
  ];
  for(const [selector,field,label] of definitions){
   let number=0;
   for(const input of container.querySelectorAll(selector)){
    number++;
    if(input.readOnly||input.disabled)continue;
    if(bindings.has(input)){bindings.get(input).options=options;continue;}
    const binding={options};bindings.set(input,binding);
    const editorDialog=container.tagName==='DIALOG'?container:container.closest?.('dialog');
    const valid=()=>input.isConnected&&!input.readOnly&&!input.disabled&&(!editorDialog||editorDialog.open);
    const doc=input.ownerDocument||root.document,button=doc.createElement('button');button.type='button';button.className='small ai-field-button';button.textContent='KI-Schreibhilfe';
    const fieldLabel=label+(selector.startsWith('[')?' '+number:'');button.setAttribute('aria-label','KI-Schreibhilfe für '+fieldLabel);
    button.addEventListener('click',ev=>{
     ev.preventDefault();ev.stopPropagation();
     if(!valid())return;
     open({request:binding.options.request,onApply:binding.options.onApply,targets:[{
      label:fieldLabel,field,read:()=>input.value,valid,
      write:text=>{input.value=text;const EventClass=doc.defaultView?.Event||root.Event;input.dispatchEvent(new EventClass('input',{bubbles:true}));}
     }]});
    });
    input.after(button);
   }
  }
 }
 return {open,close,bindForm,createSession};
});
