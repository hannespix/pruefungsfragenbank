const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../src/core.js');
test('extracts explicit total time and named phases without treating preparation as total',()=>{
 assert.deepEqual(C.extractTiming('Beschreiben Sie unten in 5 Minuten die notwendigen Materialien.').totalMinutes,null);
 assert.equal(C.extractTiming('Beschreiben Sie unten in 5 Minuten die notwendigen Materialien.').phases[0].minutes,5);
 assert.equal(C.extractTiming('Planungszeit: 10 Minuten\nDurchführungszeit: 45 Minuten\nReflektionszeit: 05 Minuten').totalMinutes,60);
 const t=C.extractTiming('Zeit:90 Minuten (2x45 Minuten)\nPlanungsphase (15 Min.)\nAufgabe Pflanzung (65 Min.)\nEigenreflektion (10 Min.)');assert.equal(t.totalMinutes,90);assert.deepEqual(t.phases.map(p=>p.minutes),[15,65,10]);
});
test('extracts remaining reflection and interview times and keeps missing totals unknown',()=>{
 assert.equal(C.extractTiming('Für die Aufgaben 1 bis 5 haben Sie 40 Minuten Zeit.\nIn den verbleibenden 20 Minuten gehen Sie im Prüfgespräch auf folgende Themen ein:').totalMinutes,60);
 assert.equal(C.extractTiming('Für die Planung haben Sie 15 Minuten Zeit.\nDas Prüfgespräch dauert 45 Minuten').totalMinutes,60);
 assert.equal(C.extractTiming('Sie haben 15 Minuten Zeit für die Planung.').totalMinutes,null);
 assert.equal(C.extractTiming('Nennen Sie die Dauer der Durchwurzelungsphase.').phases.length,0);
 const t=C.extractTiming('(Richtzeit sind 20 Minuten, max. 30 Minuten).');assert.equal(t.totalMinutes,null);assert.equal(t.phases[0].maxMinutes,30);
});
test('formats partial sums as incomplete rather than a complete exam duration',()=>{
 assert.equal(C.durationSummary({minutes:60,unknownMinutes:2}),'Bearbeitungszeit: 60 Minuten bekannt · 2 Aufgaben noch offen');
 assert.equal(C.durationSummary({minutes:0,unknownMinutes:2}),'Bearbeitungszeit noch festzulegen');
});
test('malformed imported timing metadata is rejected before opening the editor',()=>{const d=C.validate(require('../demo.json')),t=C.clone(d.tasks[0]);t.timing={totalMinutes:null};assert.throws(()=>C.checkTask(t),/Zeit/);t.timing={...C.extractTiming('Zeit: 60 Minuten'),phases:[{label:'Planung',minutes:-1}]};assert.throws(()=>C.checkTask(t),/Zeit/);});
test('parenthesized preparation and reflection durations cannot become totals',()=>{assert.equal(C.extractTiming('Planungszeit (10 Minuten)\nDurchführungszeit: 45 Minuten\nReflektionszeit: 5 Minuten').totalMinutes,60);assert.equal(C.extractTiming('Vorbereitung (15 Minuten)').totalMinutes,null);assert.equal(C.extractTiming('Reflexion (5 Minuten)').totalMinutes,null);assert.equal(C.extractTiming('Sie haben 60 Minuten Zeit.').phases.length,0);});

test('persisted timing evidence requires source objects for the details editor',()=>{const t=C.clone(require('../demo.json').tasks[0]);t.timing={totalMinutes:60,method:'explicit',phases:[],evidence:['Zeit: 60 Minuten']};assert.throws(()=>C.checkTask(t),/Zeit/);});
