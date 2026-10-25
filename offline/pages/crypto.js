/* Versioned authenticated envelope. No passwords or decrypted state are persisted. */
(function(root){'use strict';
const AAD=new TextEncoder().encode('HortiExam encrypted seed v1');
function bytes(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function validate(m){
  if(!m||m.version!==1||m.cipher!=='AES-256-GCM'||m.kdf!=='PBKDF2-SHA256'||m.iterations!==600000||m.compression!=='gzip'||!Array.isArray(m.chunks)||!m.chunks.length||m.chunks.length>256||m.chunks.some((v,i)=>v!==`part-${String(i).padStart(3,'0')}.bin`)||bytes(m.salt).length!==16||bytes(m.iv).length!==12)throw Error('Ungültiges verschlüsseltes Datenpaket.');
  return m;
}
async function unlock(manifest,cipher,password){
  const m=validate(manifest);
  if(!globalThis.crypto?.subtle||typeof DecompressionStream==='undefined')throw Error('Bitte einen aktuellen Browser über HTTPS verwenden.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(m.salt),iterations:m.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(m.iv),additionalData:AAD,tagLength:128},key,cipher);
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
const api={validate,unlock};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HortiVault=api;
})(globalThis);
