const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js');
const workshop=(patch={})=>({id:'meeting',title:'Aufgabenerstellung',examYear:2027,meetingDate:'2026-11-20',specialties:['Baumschule','Obstbau'],...patch});
const exam=(patch={})=>C.newExam({title:'Zwischenprüfung',examType:'ZP',specialty:'Baumschule',workshopId:'meeting',examYear:2027,...patch});
test('legacy projects open with no meetings and new meeting/exam linkage survives JSON roundtrip',()=>{
 const d=C.empty();delete d.workshops;C.validate(d);assert.deepEqual(d.workshops,[]);
 d.workshops.push(workshop());d.exams.push(exam());const copy=C.validate(JSON.parse(JSON.stringify(d)));
 assert.equal(copy.exams[0].workshopId,'meeting');assert.equal(copy.exams[0].examYear,2027);
});
test('meeting validation rejects invalid years, dates, duplicate and unknown specialties',()=>{
 for(const patch of [{examYear:2027.5},{examYear:'2027'},{meetingDate:'2026-02-30'},{specialties:[]},{specialties:['Baumschule','Baumschule']},{specialties:['Unknown']},{title:''}]){
  const d=C.empty();d.workshops=[workshop(patch)];assert.throws(()=>C.validate(d));
 }
});
test('linked exams cannot point to a missing meeting or a different year/specialty',()=>{
 for(const patch of [{workshopId:'missing'},{examYear:2028},{specialty:'Gemüsebau'},{date:'2028-05-05'}]){
  const d=C.empty();d.workshops=[workshop()];d.exams=[exam(patch)];assert.throws(()=>C.validate(d));
 }
});
test('editing a meeting cannot strand its existing exams and leaves the record unchanged',()=>{
 const d=C.empty();d.workshops=[workshop()];d.exams=[exam()];
 for(const patch of [{examYear:2028},{specialties:['Obstbau']}])assert.throws(()=>C.saveWorkshop(d,workshop(patch)));
 assert.equal(d.workshops[0].examYear,2027);assert.deepEqual(d.workshops[0].specialties,['Baumschule','Obstbau']);
 C.saveWorkshop(d,workshop({title:'Neuer Titel',meetingDate:''}));assert.equal(d.workshops[0].title,'Neuer Titel');
});
test('meeting workspace includes both exam types but excludes other meetings and unassigned legacy exams',()=>{
 const d=C.empty();d.workshops=[workshop(),workshop({id:'other'})];
 d.exams=[exam(),exam({examType:'AP'}),exam({workshopId:'other'}),C.newExam({specialty:'Baumschule'})];
 assert.deepEqual(C.workshopExams(d,'meeting','Baumschule').map(e=>e.examType),['ZP','AP']);
 assert.equal(C.workshopExams(d,'meeting','Obstbau').length,0);
});
test('conflicting imported meetings retain each exam reference without overwriting the local meeting',()=>{
 const d=C.empty();d.workshops=[workshop()];d.exams=[exam()];const incoming=C.clone(d);
 incoming.workshops[0].title='Anderer Termin';incoming.exams[0].title='Anderer Entwurf';
 const merged=C.merge(d,incoming).db;assert.equal(merged.workshops.length,2);assert.equal(merged.exams.length,2);
 assert.equal(merged.exams[0].workshopId,'meeting');assert.notEqual(merged.exams[1].workshopId,'meeting');
 assert.equal(merged.workshops.find(w=>w.id===merged.exams[1].workshopId).title,'Anderer Termin');
 assert.equal(C.merge(merged,incoming).db.exams.length,2);
});
