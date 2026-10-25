(function(){'use strict';
const form=document.getElementById('unlock-form'),input=document.getElementById('password'),button=document.getElementById('unlock'),status=document.getElementById('status'),frame=document.getElementById('workshop');
let opened=false,url=null;
async function getFile(path){const response=await fetch(path,{cache:'no-store',credentials:'omit',redirect:'error'});if(!response.ok)throw Error('Datenpaket nicht erreichbar. Bitte später erneut versuchen.');return response;}
form.addEventListener('submit',async event=>{
 event.preventDefault();button.disabled=true;status.textContent='Verschlüsselten Bestand laden …';let password=input.value.trim();input.value='';
 try{
  if(!globalThis.crypto?.subtle||typeof DecompressionStream==='undefined')throw Error('Bitte die HTTPS-Adresse in einem aktuellen Edge, Chrome, Firefox oder Safari öffnen.');
  const manifest=HortiVault.validate(await(await getFile('sealed/manifest.json')).json());
  const parts=[];for(let i=0;i<manifest.chunks.length;i++){status.textContent=`Verschlüsselten Bestand laden … ${i+1}/${manifest.chunks.length}`;parts.push(new Uint8Array(await(await getFile('sealed/'+manifest.chunks[i])).arrayBuffer()));}
  const cipher=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){cipher.set(part,offset);offset+=part.length;}
  status.textContent='Bestand entschlüsseln …';let data;
  try{data=await HortiVault.unlock(manifest,cipher,password);}catch{throw Error('Entschlüsseln fehlgeschlagen. Passwort prüfen; bei erneutem Fehler die Seite neu laden.');}
  password='';
  const template=JSON.parse(document.getElementById('app-template').textContent);
  const html=template.replace('/*PRIVATE_SEED*/',()=>JSON.stringify(data).replace(/</g,'\\u003c'));
  url=URL.createObjectURL(new Blob([html],{type:'text/html'}));frame.src=url;opened=true;document.body.classList.add('open');status.textContent='';
 }catch(error){status.textContent=error.message;}finally{password='';button.disabled=false;}
});
document.getElementById('lock').addEventListener('click',()=>{
 if(!confirm('Sitzung schließen? Nicht exportierte Änderungen gehen verloren. Bitte vorher in der Werkstatt „Projekt sichern“ verwenden.'))return;
 opened=false;frame.src='about:blank';if(url)URL.revokeObjectURL(url);url=null;document.body.classList.remove('open');input.value='';input.focus();
});
window.addEventListener('beforeunload',event=>{if(opened){event.preventDefault();event.returnValue='';}});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
})();
