/* Local SVG interface icons. No font glyphs, network requests or executable markup. */
(function(root){'use strict';
const paths={trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',undo:'<path d="M3 10h10a7 7 0 1 1-6 10M3 10l5-5M3 10l5 5"/>',
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v2"/>',
 qr:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h2v2h-2zm6 0v3m-6 3h3m3 0v-1"/>',
 file:'<path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8Zm0 0v6h6M8 13h8m-8 4h5"/>',
 checkFile:'<path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8Zm0 0v6h6m-12 8 3 3 5-6"/>',
 library:'<path d="M4 3h5v18H4zM12 3h3v18h-3zm6 1 3-1 3 17-3 1Z" transform="translate(-1)"/><path d="M3 7h5m3 10h3"/>',
 sliders:'<path d="M4 3v7m0 4v7m8-18v12m0 4v2m8-18v2m0 4v12M1 10h6m2 5h6m2-10h6"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
 search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>',
 arrowRight:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 arrowLeft:'<path d="M20 12H4m6-6-6 6 6 6"/>',
 arrowUp:'<path d="M12 20V4m-6 6 6-6 6 6"/>',
 arrowDown:'<path d="M12 4v16m-6-6 6 6 6-6"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
 idea:'<path d="M9 18h6m-5 3h4M9 15a6 6 0 1 1 6 0v3H9Z"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M12 17h.01"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
};
function icon(name){return Object.hasOwn(paths,name)?`<svg class="ui-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`:'';}
const actionIcons={'trash-exam':'trash','confirm-trash-exam':'trash','show-trash':'trash','restore-exam':'undo',backup:'download','export-exam':'download','bank-export':'download',docx:'upload','merge-project':'upload','new-workshop':'plus','new-task':'plus','new-exam':'plus','track-new':'plus',add:'plus','add-asset':'plus','add-criterion':'plus','paper-focus':'check','paper-check':'check','suggest':'idea','preview-candidate':'eye','preview-solution':'eye','invitation':'qr','print-invitation':'file','item-up':'arrowUp','item-down':'arrowDown','item-remove':'close','remove-criterion':'close'};
function label(action,text,id){let name=action==='bank-layout'?(id==='cards'?'grid':'list'):actionIcons[action];if(!name)return text;const clean=text.replace(/^[+↓↑✦✓▦☷✕]\s*/u,'').replace(/\s*[→↗]$/u,'');return icon(name)+`<span>${clean||({'item-up':'Nach oben','item-down':'Nach unten','item-remove':'Entfernen','remove-criterion':'Entfernen'}[action]||'')}</span>`;}
const api={icon,label};root.HortiIcons=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
