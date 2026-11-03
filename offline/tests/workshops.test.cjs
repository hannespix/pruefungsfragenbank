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
test('committee rosters round-trip, normalize input and preserve earlier versions when edited',()=>{
 const d=C.empty();d.workshops=[workshop()];
 assert.deepEqual(C.committee(d.workshops[0],'Baumschule'),{specialty:'Baumschule',name:'',participants:[],updatedAt:'',revisions:[]});
 C.saveCommittee(d,'meeting','Baumschule',{name:'  Ausschuss Nord  ',participants:[' Anna Müller ','Ben Kaya','anna müller','']});
 const first=C.clone(d.workshops[0].committees[0]);assert.equal(first.name,'Ausschuss Nord');assert.deepEqual(first.participants,['Anna Müller','Ben Kaya']);assert.ok(Number.isFinite(Date.parse(first.updatedAt)));
 C.saveCommittee(d,'meeting','Baumschule',{name:'Ausschuss Nord',participants:['Anna Müller','Ben Kaya']});assert.deepEqual(d.workshops[0].committees[0],first);
 C.saveCommittee(d,'meeting','Baumschule',{name:'Ausschuss Süd',participants:['Clara Vogt']});
 const copy=C.validate(JSON.parse(JSON.stringify(d))),saved=C.committee(copy.workshops[0],'Baumschule');
 assert.deepEqual(saved.revisions,[{name:'Ausschuss Nord',participants:['Anna Müller','Ben Kaya'],recordedAt:first.updatedAt}]);
 saved.participants.push('Outside edit');assert.deepEqual(d.workshops[0].committees[0].participants,['Clara Vogt']);
 C.saveWorkshop(d,workshop({title:'Neuer Titel'}));assert.deepEqual(d.workshops[0].committees,copy.workshops[0].committees);
});
test('committee history searches people across years, specialties and previous roster versions',()=>{
 const d=C.empty();d.workshops=[workshop(),workshop({id:'previous',examYear:2026,title:'Vorjahr'})];
 C.saveCommittee(d,'previous','Baumschule',{participants:['Anna Müller']});
 C.saveCommittee(d,'meeting','Baumschule',{participants:['Anna Müller']});
 C.saveCommittee(d,'meeting','Baumschule',{name:'Aktueller Ausschuss',participants:['Ben Kaya']});
 C.saveCommittee(d,'meeting','Obstbau',{participants:['Clara Vogt']});
 assert.deepEqual(C.committeeHistory(d,{query:'ANNA'}).map(r=>r.workshopId).sort(),['meeting','previous']);
 const rows=C.committeeHistory(d,{year:2027,specialty:'Baumschule',query:'Anna'});assert.equal(rows.length,1);assert.equal(rows[0].workshopTitle,'Aufgabenerstellung');assert.equal(rows[0].meetingDate,'2026-11-20');assert.deepEqual(rows[0].participants,['Ben Kaya']);assert.equal(rows[0].revisions.length,1);
 assert.equal(C.committeeHistory(d,{year:2026,query:'Clara'}).length,0);
 rows[0].revisions[0].participants.push('Outside edit');assert.equal(C.committeeHistory(d,{query:'Outside'}).length,0);
});
test('invalid committee edits are atomic and cannot remove a specialty with a recorded roster',()=>{
 const d=C.empty();d.workshops=[workshop()];C.saveCommittee(d,'meeting','Baumschule',{participants:['Anna Müller']});const before=C.clone(d);
 for(const [meetingId,specialty,patch] of [['missing','Baumschule',{participants:[]}],['meeting','Gemüsebau',{participants:[]}],['meeting','Baumschule',{participants:'Anna'}],['meeting','Baumschule',{participants:[42]}],['meeting','Baumschule',{participants:['x'.repeat(121)]}],['meeting','Baumschule',{participants:Array.from({length:101},(_,i)=>'Name '+i)}],['meeting','Baumschule',{name:'x'.repeat(161),participants:[]}],['meeting','Baumschule',{participants:['Anna\nMüller']}]] ){
  assert.throws(()=>C.saveCommittee(d,meetingId,specialty,patch));assert.deepEqual(d,before);
 }
 assert.throws(()=>C.saveWorkshop(d,workshop({specialties:['Obstbau']})));assert.deepEqual(d,before);
});
test('committee imports reject malformed, duplicate, foreign and invalid historic rosters',()=>{
 const valid={specialty:'Baumschule',name:'Ausschuss',participants:['Anna Müller'],updatedAt:'2026-11-03T12:00:00.000Z',revisions:[]};
 const invalid=[null,{},[valid,valid],[{...valid,specialty:'Gemüsebau'}],[{...valid,name:42}],[{...valid,participants:['Anna','ANNA']}],[{...valid,participants:['']}],[{...valid,participants:[' Anna']}],[{...valid,updatedAt:'yesterday'}],[{...valid,revisions:[{name:'Alt',participants:['Ben'],recordedAt:'invalid'}]}],[{...valid,revisions:[{name:'Alt',participants:[42],recordedAt:valid.updatedAt}]}],[{...valid,revisions:null}]];
 for(const committees of invalid){const d=C.empty();d.workshops=[workshop({committees})];assert.throws(()=>C.validate(d),JSON.stringify(committees));}
});
test('a preparation roster keeps its original exam year even without linked exams',()=>{
 const d=C.empty();d.workshops=[workshop()];C.saveCommittee(d,'meeting','Baumschule',{participants:['Anna Müller']});
 const before=C.clone(d);assert.throws(()=>C.saveWorkshop(d,workshop({examYear:2028})),/Prüfungsjahr/);assert.deepEqual(d,before);
 C.saveCommittee(d,'meeting','Baumschule',{participants:[]});const cleared=C.clone(d);
 assert.throws(()=>C.saveWorkshop(d,{...d.workshops[0],examYear:2028}),/Prüfungsjahr/);assert.deepEqual(d,cleared);
});
test('workshop updates cannot erase rosters or rewrite their recorded revision history',()=>{
 const d=C.empty();d.workshops=[workshop()];C.saveCommittee(d,'meeting','Baumschule',{participants:['Anna Müller']});C.saveCommittee(d,'meeting','Baumschule',{participants:['Ben Kaya']});const before=C.clone(d),w=d.workshops[0],current=w.committees[0];
 for(const committees of [[],[{...current,revisions:[]}],[{...current,participants:['Clara Vogt']}],[{...current,revisions:[{...current.revisions[0],participants:['Fake History']}]}]]){
  assert.throws(()=>C.saveWorkshop(d,{...w,committees}));assert.deepEqual(d,before);
 }
});
