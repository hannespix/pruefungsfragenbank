const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/../g)||[],x=>parseInt(x,16));
const aad=row=>enc.encode(JSON.stringify(['hortiexam-invitation-v1',row.hash,row.meeting_id,row.specialty,row.expires]));
export class InvitationVaultFailure extends Error {
 constructor(){super('Die gespeicherten Einladungen können derzeit nicht sicher angezeigt werden. Bestehende Zugänge bleiben unverändert.');this.status=503;}
}
export async function invitationVaultKey(env){
 if(typeof env.INVITATION_VAULT_KEY!=='string'||!/^[a-f0-9]{64}$/i.test(env.INVITATION_VAULT_KEY))throw new InvitationVaultFailure();
 try{return await crypto.subtle.importKey('raw',unhex(env.INVITATION_VAULT_KEY),{name:'AES-GCM'},false,['encrypt','decrypt']);}catch{throw new InvitationVaultFailure();}
}
export async function sealInvitation(key,token,row){
 try{const iv=crypto.getRandomValues(new Uint8Array(12)),ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(row),tagLength:128},key,enc.encode(token));return JSON.stringify({v:1,iv:hex(iv),ciphertext:hex(ciphertext)});}catch{throw new InvitationVaultFailure();}
}
export async function unsealInvitation(key,row){
 try{const envelope=JSON.parse(row.envelope);if(envelope?.v!==1||typeof envelope.iv!=='string'||!/^[a-f0-9]{24}$/.test(envelope.iv)||typeof envelope.ciphertext!=='string'||!/^(?:[a-f0-9]{2}){17,2048}$/.test(envelope.ciphertext))throw Error();const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(envelope.iv),additionalData:aad(row),tagLength:128},key,unhex(envelope.ciphertext));return dec.decode(bytes);}catch{throw new InvitationVaultFailure();}
}
