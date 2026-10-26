/* Validated private assets and font metrics shared by Word layout generation. */
(function(root){'use strict';
const P=root.HortiPrint||(typeof require==='function'?require('./print.js'):null);
const NS='http://schemas.openxmlformats.org/';
const namespaces=`xmlns:w="${NS}wordprocessingml/2006/main" xmlns:r="${NS}officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w10="urn:schemas-microsoft-com:office:word"`;
const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const esc=s=>P.esc(String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,''));
const tw=n=>Math.round(n*20),pt=n=>Math.round(n*1000)/1000;
const bytes=s=>Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0));
const rels=rs=>xml(`<Relationships xmlns="${NS}package/2006/relationships">${rs.map(r=>`<Relationship Id="${r.id}" Type="${NS}officeDocument/2006/relationships/${r.type}" Target="${esc(r.target)}"/>`).join('')}</Relationships>`);
function fontAssets(d){return d.assets.filter(a=>a.design==='bw-2024'&&['sansRegular','sansBold','serifBold'].includes(a.docxFontKey)&&a.mime==='font/ttf');}
function requiredAssetIds(e,d,examiner=true){return [...new Set([...e.items.flatMap(i=>i.task.assetLinks.filter(l=>l.audience==='candidate'||examiner&&l.audience==='examiner').map(l=>l.assetId)),...fontAssets(d).map(a=>a.id)])];}
function requireAsset(d,id){const a=d.assets.find(a=>a.id===id);if(!a?.data)throw Error('Anlage fehlt oder ist nicht geladen: '+(a?.name||id));return a;}
function fontData(a){const b=bytes(a.data),v=new DataView(b.buffer),tag=n=>String.fromCharCode(...b.slice(n,n+4));if(b.length<12||v.getUint32(0)!==0x10000)throw Error('Ungültige Word-Schrift: '+a.name);let permission=null;for(let n=0;n<v.getUint16(4);n++){const o=12+n*16;if(o+16>b.length)throw Error('Ungültige Word-Schrift.');if(tag(o)==='OS/2'){const p=v.getUint32(o+8);if(p+10>b.length)throw Error('Ungültige Word-Schrift.');permission=v.getUint16(p+8);}}if(permission===null||(permission&2)||(permission&512)||((permission&4)&&!(permission&8)))throw Error('Schrift erlaubt keine bearbeitbare Einbettung: '+a.name);return b;}
function imageSize(a){const b=bytes(a.data),v=new DataView(b.buffer);if(a.mime==='image/png'&&b.length>=24)return [v.getUint32(16),v.getUint32(20)];if(a.mime==='image/gif'&&b.length>=10)return [v.getUint16(6,true),v.getUint16(8,true)];if(a.mime==='image/jpeg'){let p=2;while(p+9<b.length){if(b[p++]!==255)continue;const m=b[p++];if(m===0xd9||m===0xda)break;const len=v.getUint16(p);if([0xc0,0xc1,0xc2].includes(m))return [v.getUint16(p+5),v.getUint16(p+3)];if(len<2)break;p+=len;}}throw Error('Bildformat für Word nicht lesbar: '+a.name);}
async function wordImages(e,d,examiner){const out={...d,assets:[...d.assets]};for(const id of requiredAssetIds(e,d,examiner)){const a=requireAsset(d,id);if(a.mime!=='image/webp')continue;if(!root.document)throw Error('WebP-Bilder bitte im Browser exportieren.');const img=new Image();img.src='data:image/webp;base64,'+a.data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);out.assets[out.assets.findIndex(x=>x.id===id)]={...a,mime:'image/png',data:canvas.toDataURL('image/png').split(',')[1]};}return out;}
// Actual CI font metrics, not character-count guesses. Word uses the same full fonts.
function metrics(a){const b=fontData(a),v=new DataView(b.buffer),tables={};for(let n=0;n<v.getUint16(4);n++){const p=12+n*16;tables[String.fromCharCode(...b.slice(p,p+4))]=v.getUint32(p+8);}const units=v.getUint16(tables.head+18),count=v.getUint16(tables.hhea+34),cmap=tables.cmap;let sub=0;for(let n=0;n<v.getUint16(cmap+2);n++){const p=cmap+4+n*8,o=cmap+v.getUint32(p+4);if(v.getUint16(o)===4&&(v.getUint16(p)===3||!sub))sub=o;}if(!sub)throw Error('Word-Schrift enthält keine passende Zeichentabelle.');const segments=v.getUint16(sub+6)/2,end=sub+14,start=end+segments*2+2,delta=start+segments*2,range=delta+segments*2;
 return text=>{let sum=0;for(const c of text){const cp=c.codePointAt(0);let glyph=0;for(let n=0;n<segments;n++){if(cp>v.getUint16(end+n*2)||cp<v.getUint16(start+n*2))continue;const off=v.getUint16(range+n*2),de=v.getInt16(delta+n*2);glyph=off?v.getUint16(range+n*2+off+2*(cp-v.getUint16(start+n*2))):cp;if(glyph)glyph=(glyph+de)&65535;break;}sum+=v.getUint16(tables.hmtx+Math.min(glyph,count-1)*4);}return sum/units;};}
// docx 9.6 embeds only regular faces. Keep one proper family record with
// separate regular/bold relationships and full editable font data.
async function embedFonts(z,fonts){
 const fontRels=[],families=new Map();
 for(const [n,a] of fonts.entries()){
  const buffer=fontData(a),key=`A1B2C3D4-E5F6-4718-92A3-B4C5D6E7F8${String(n).padStart(2,'0')}`,xor=key.replace(/-/g,'').match(/../g).map(x=>parseInt(x,16)).reverse();
  for(let j=0;j<32;j++)buffer[j]^=xor[j%16];
  const path='fonts/ci'+n+'.odttf',id='ciFont'+n;z.file('word/'+path,buffer);fontRels.push({id,type:'font',target:path});
  const name=a.fontFamily;if(!name)throw Error('Name der Word-Schrift fehlt.');if(!families.has(name))families.set(name,[]);
  families.get(name).push(`<w:${a.docxFontKey==='sansRegular'?'embedRegular':'embedBold'} r:id="${id}" w:fontKey="{${key}}" w:subsetted="false"/>`);
 }
 z.file('word/fontTable.xml',xml(`<w:fonts ${namespaces}>${[...families].map(([name,tags])=>`<w:font w:name="${esc(name)}"><w:family w:val="auto"/>${tags.join('')}</w:font>`).join('')}</w:fonts>`));
 if(fontRels.length){z.file('word/_rels/fontTable.xml.rels',rels(fontRels));const types=await z.file('[Content_Types].xml').async('string');if(!types.includes('Extension="odttf"'))z.file('[Content_Types].xml',types.replace('</Types>','<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/></Types>'));const settings=await z.file('word/settings.xml').async('string');z.file('word/settings.xml',settings.replace(/(<w:settings\b[^>]*>)/,'$1<w:embedTrueTypeFonts/><w:doNotEmbedSystemFonts/>'));}
}
const api={fontAssets,requiredAssetIds,requireAsset,fontData,metrics,imageSize,wordImages,bytes,embedFonts};root.HortiDocxAssets=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
