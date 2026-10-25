#!/usr/bin/env node
/* Run locally only. Never put a password in CLI arguments or the repository. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
for(const k of ['--seed','--password-file','--out'])if(!args.includes(k)||!get(k))throw Error('Required: --seed FILE --password-file FILE --out NEW_DIRECTORY');
const password=fs.readFileSync(get('--password-file'),'utf8').trim();
if(password.length<24)throw Error('Use a randomly generated password of at least 24 characters.');
const data=JSON.parse(fs.readFileSync(get('--seed'),'utf8'));
require('../src/core.js').validate(structuredClone(data));
const out=path.resolve(get('--out'));
if(fs.existsSync(out))throw Error('Output directory already exists; choose a new directory.');
const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=crypto.pbkdf2Sync(password,salt,600000,32,'sha256');
const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
cipher.setAAD(Buffer.from('HortiExam encrypted seed v1'));
const payload=Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(JSON.stringify(data)))),cipher.final(),cipher.getAuthTag()]);
key.fill(0);if(payload.length>256*1024*1024)throw Error('Encrypted package exceeds browser limit (256 MiB).');fs.mkdirSync(out,{recursive:true});
const chunks=[];
for(let offset=0;offset<payload.length;offset+=1024*1024){const name=`part-${String(chunks.length).padStart(3,'0')}.bin`;fs.writeFileSync(path.join(out,name),payload.subarray(offset,offset+1024*1024));chunks.push(name);}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:1,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:600000,compression:'gzip',salt:salt.toString('base64'),iv:iv.toString('base64'),chunks},null,2)+'\n');
console.log(`Sealed ${chunks.length} encrypted chunks; no password written to output.`);
