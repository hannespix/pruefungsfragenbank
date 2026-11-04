/* Coordinator approval records an explicit review; no task content is invented. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.HortiCore;
const P=typeof module!=='undefined'&&module.exports?require('./planning.js'):root.HortiPlanning;
// One task: text, points, source hints and an existing material list are confirmed together.
function reviewTask(t,reviewedBy,reviewedAt){
 if(t.materials?.text.trim())t.materials.status='confirmed';
 t.reviewStatus='approved';t.solutionStatus=t.solution.trim()?'approved':'missing';t.reviewedBy=reviewedBy;t.reviewedAt=reviewedAt;
 t.pointsReview={contentKey:C.pointsReviewKey(t),reviewedBy,reviewedAt};
 const key=C.taskReviewKey(t);t.reviewKey=key;t.sourceReview={contentKey:key,reviewedBy,reviewedAt,flags:C.clone(t.flags)};
 return t;
}
function markReviewed(e,reviewedBy,reviewedAt){
 const next=C.clone(e);
 if(next.pattern)next.pattern.status='confirmed';
 for(const {task:t} of C.examEntries(next,{alternatives:true}))reviewTask(t,reviewedBy,reviewedAt);
 const checklist=P.regulationChecklist(next);
 if(checklist.length){next.regulationReview=Object.fromEntries(checklist.map(c=>[c.id,true]));next.regulationReviewKey=P.regulationReviewKey(next);}
 return next;
}
function inspect(e){
 const issues=[],warnings=[];
 if(e.status==='used')issues.push('Bereits dokumentierte Prüfungen bleiben unverändert.');
 if(!e.title?.trim())issues.push('Prüfungstitel ergänzen.');
 try{if(e.pattern)P.checkPattern(e.pattern);}catch(error){issues.push(error.message);}
 for(const item of C.examEntries(e,{alternatives:true})){
  const t=item.task;try{C.checkTask(t,P.examContext(e));}catch(error){issues.push(item.label+': '+error.message);continue;}
  if(!t.text.trim())issues.push(item.label+': Aufgabenstellung ergänzen.');
  if(item.component==='practical'&&(t.kind===undefined||t.kind==='practical')&&!t.materials?.text.trim())issues.push(item.label+': Materialliste noch festlegen.');
  warnings.push(...C.openTaskFlags(t).map(flag=>item.label+': '+flag));
  if(t.solution.trim()&&t.solutionStatus!=='approved')warnings.push(item.label+': Vorhandener Lösungsentwurf wird mit freigegeben.');
 }
 if(!issues.length){const candidate=markReviewed(e,'Zuständige Stelle','2000-01-01T00:00:00.000Z');delete candidate.releaseReview;try{issues.push(...C.readiness(candidate).issues);}catch(error){issues.push(error.message);}}
 return {ready:issues.length===0,issues:[...new Set(issues)],warnings:[...new Set(warnings)]};
}
function approve(e,{reviewedBy}={}){
 const result=inspect(e);if(!result.ready)throw Error('Freigabe noch nicht möglich:\n'+result.issues.join('\n'));
 const reviewer=typeof reviewedBy==='string'&&reviewedBy.trim()?reviewedBy.trim():'Zuständige Stelle';
 if(e.releaseReview?.contentKey===C.examReviewKey(e)&&C.readiness(e).ready&&e.releaseReview.reviewedBy===reviewer)return C.clone(e);
 const at=C.now(),next=markReviewed(e,reviewer,at);next.updatedAt=at;
 next.releaseReview={version:1,contentKey:C.examReviewKey(next),reviewedBy:reviewer,reviewedAt:at};
 return next;
}
const api={inspect,approve,reviewTask};root.HortiRelease=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
