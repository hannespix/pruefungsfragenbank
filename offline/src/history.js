/* Undo/redo history for the whole project state. Independent of UI, storage and authorization.
   Snapshots store one JSON string per record; unchanged records share the previous string, so
   long histories stay small. Attachment data is kept once per asset id instead of per snapshot. */
(function(root){'use strict';
const COLLECTIONS=['families','tasks','sources','assets','uses','exams','patterns','workshops','settings'];
const NAMES={families:'Aufgabenfamilie',tasks:'Aufgabe',sources:'Quelle',assets:'Anlage',uses:'Einsatz',exams:'Prüfung',patterns:'Prüfungsmuster',workshops:'Vorbereitungstermin',settings:'Grundeinstellung'};
const WEIGHT={exams:0,tasks:1,workshops:2,settings:3,patterns:4,families:5,sources:6,uses:7,assets:8};

function snapshot(db,previous,assetData){
 const meta={},records={};
 for(const [key,value] of Object.entries(db))if(!COLLECTIONS.includes(key))meta[key]=value;
 for(const kind of COLLECTIONS){
  const map=new Map(),old=previous?.records[kind];
  for(const item of db[kind]||[]){
   let value=item;
   if(kind==='assets'&&typeof item.data==='string'&&item.data){assetData.set(item.id,item.data);value={...item,data:''};}
   const json=JSON.stringify(value),prior=old?.get(item.id);
   map.set(item.id,prior===json?prior:json);
  }
  records[kind]=map;
 }
 const metaJson=JSON.stringify(meta);
 return {meta:previous?.meta===metaJson?previous.meta:metaJson,records};
}
function same(a,b){
 if(a.meta!==b.meta)return false;
 for(const kind of COLLECTIONS){const x=a.records[kind],y=b.records[kind];if(x.size!==y.size)return false;const ya=[...y.keys()];let i=0;for(const [id,json] of x){if(ya[i++]!==id||y.get(id)!==json)return false;}}
 return true;
}
function restore(snap,assetData,current){
 const db=JSON.parse(snap.meta),live=new Map((current?.assets||[]).map(a=>[a.id,a.data]));
 for(const kind of COLLECTIONS)db[kind]=[...snap.records[kind].values()].map(json=>{const value=JSON.parse(json);if(kind==='assets'&&!value.data)value.data=assetData.get(value.id)||live.get(value.id)||'';return value;});
 return db;
}
const title=json=>{try{const v=JSON.parse(json);return v.title||v.name||v.label||'';}catch{return '';}};
const quote=s=>s?' „'+(s.length>48?s.slice(0,47)+'…':s)+'“':'';
function examLabel(beforeJson,afterJson){
 let before,after;try{before=JSON.parse(beforeJson);after=JSON.parse(afterJson);}catch{return null;}
 const ids=e=>[...(e.items||[]).map(i=>i.id),...(e.oralItem?[e.oralItem.id]:[])],b=ids(before),a=ids(after),t=quote(after.title||before.title);
 if(a.length>b.length){const added=(after.items||[]).find(i=>!b.includes(i.id))||after.oralItem;return 'Aufgabe'+quote(added?.task?.title)+' zur Prüfung hinzugefügt';}
 if(a.length<b.length){const removed=(before.items||[]).find(i=>!a.includes(i.id))||before.oralItem;return 'Aufgabe'+quote(removed?.task?.title)+' aus der Prüfung entfernt';}
 if(a.join()!==b.join()&&[...a].sort().join()===[...b].sort().join())return 'Reihenfolge in Prüfung'+t+' geändert';
 if(!before.deletedAt&&after.deletedAt)return 'Prüfung'+t+' in den Papierkorb gelegt';
 if(before.deletedAt&&!after.deletedAt)return 'Prüfung'+t+' wiederhergestellt';
 return 'Prüfung'+t+' bearbeitet';
}
/** Short German description of what changed between two snapshots. */
function describe(before,after){
 const changes=[];
 for(const kind of COLLECTIONS){
  const x=before.records[kind],y=after.records[kind];
  for(const [id,json] of y){if(!x.has(id))changes.push({kind,type:'added',after:json});else if(x.get(id)!==json)changes.push({kind,type:'changed',before:x.get(id),after:json});}
  for(const [id,json] of x)if(!y.has(id))changes.push({kind,type:'removed',before:json});
 }
 if(!changes.length)return before.meta!==after.meta?'Projektangaben geändert':'Änderung';
 changes.sort((a,b)=>WEIGHT[a.kind]-WEIGHT[b.kind]);
 const c=changes[0],name=NAMES[c.kind];let label;
 if(c.kind==='exams'&&c.type==='changed')label=examLabel(c.before,c.after);
 if(!label)label=name+quote(title(c.after||c.before))+({added:' angelegt',removed:' gelöscht',changed:' bearbeitet'})[c.type];
 const rest=changes.filter(x=>x.kind!=='assets'&&x!==c).length;
 return rest?label+' (+'+rest+' weitere)':label;
}

function create({limit=50,now=()=>Date.now()}={}){
 const assetData=new Map();let base=null,past=[],future=[];
 const api={
  /** Start a new history (after loading, opening another project or reloading central data). */
  reset(db){past=[];future=[];base=db?snapshot(db,null,assetData):null;},
  /** Record the current state as one undo step if it differs from the last recorded state. */
  record(db,label){
   if(!db)return false;if(!base){base=snapshot(db,null,assetData);return false;}
   const next=snapshot(db,base,assetData);if(same(base,next))return false;
   past.push({snap:base,label:label||describe(base,next),time:now()});future=[];base=next;
   if(past.length>limit)past.splice(0,past.length-limit);
   return true;
  },
  canUndo:()=>past.length>0,
  canRedo:()=>future.length>0,
  /** Returns the restored project or null. Call record() first so pending edits form their own step. */
  undo(current){const step=past.pop();if(!step)return null;future.push({snap:base,label:step.label,time:step.time});base=step.snap;return restore(base,assetData,current);},
  redo(current){const step=future.pop();if(!step)return null;past.push({snap:base,label:step.label,time:step.time});base=step.snap;return restore(base,assetData,current);},
  /** Jump to entry n of entries(): negative = undo steps, positive = redo steps. */
  go(steps,current){let db=null;for(let i=0;i<Math.abs(steps);i++){const next=steps<0?api.undo(current):api.redo(current);if(!next)break;db=next;}return db;},
  /** Newest first: redo steps (future) above the current state, undo steps below. */
  entries(){return [...future.map((s,i)=>({label:s.label,time:s.time,steps:future.length-i,state:'redo'})),{label:'Aktueller Stand',time:null,steps:0,state:'current'},...past.map((s,i)=>({label:s.label,time:s.time,steps:-(past.length-i),state:'undo'})).reverse()];},
  nextUndoLabel:()=>past.at(-1)?.label||'',
  nextRedoLabel:()=>future.at(-1)?.label||''
 };
 return api;
}
const api={create,describe,snapshot:(db)=>snapshot(db,null,new Map())};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HortiHistory=api;
})(globalThis);
