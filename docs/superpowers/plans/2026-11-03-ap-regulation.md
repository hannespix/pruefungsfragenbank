# Practical AP regulation implementation plan

> **For agentic workers:** Use the existing native implementation workflow with independent domain and UI work, then whole-branch review.

**Goal:** Make the five-task practical Gärtner AP structure, specialty area minima and source explanations visible and usable during exam and task creation.

**Architecture:** Keep Excel category titles for navigation and add a separate statutory area map in `planning.js`. New AP planning uses statutory minima rather than treating every archived category as mandatory. Existing documents and private database records remain unchanged. Shared validation runs in the browser and Worker.

**Tech stack:** Existing vanilla JavaScript, Node tests, GitHub Pages and Cloudflare Worker/D1; no new dependencies.

## Design and constraints

- Source: supplied GärtnAusbV, 6 March 1996, §§3(2),9–15(2),(6); checked against official current online text on 3 November 2026. Applies to Gärtner AP only, never automatically to ZP or FW_AP.
- Five distinct complex tasks, maximum 300 minutes including conversations. Area minima 3+1, except Friedhof 2+2; fifth flexible. GaLa is one overall work of five tasks.
- Categories listed with “insbesondere” are examples, not five compulsory categories. Preserve exact Excel labels/provenance; map 65 exact examples directly and require contextual assignment for 18 extra workbook categories. Correct Baumschule lifting/selection to area2 and Zier harvest to area1 without changing Excel provenance.
- Multiple tags never inflate the task count. A document with several separately assessed complex tasks can declare named `practicalUnits`, each assigned once to area1 or area2 with a reason. Default is one task; ambiguous/unknown assignments remain open.
- Drafts remain editable/exportable as drafts. Structural readiness requires five tasks, both quotas, known total duration at most300, and valid context. Qualitative declarations for conversations, cross-cutting content, preparation and equal weighting remain explicit human checks; GaLa additionally overall work.
- Do not modify original wording/source layout or production records. Do not claim automatic legal/factual certification. Public repository contains only code, public law excerpts and synthetic tests.

## Interfaces

`HortiPlanning.regulationProfile(context)` returns null outside supported AP or `{id,section,url,pages,totalTasks:5,maxMinutes:300,overallWork,areas:[{id:'area1'|'area2',label,min}],quotes:{count,areas,conversation,weighting,examples},crossCutting}`.

`regulationCategory(context,id)` returns `{areaId:null|'area1'|'area2',reference,explicit:boolean}`. `regulationTask(task)` returns `{units:[{title,areaId,reason,explicit}],issues:[]}` using optional `task.practicalUnits:[{title,areaId,reason}]`; otherwise one unit derived only from unambiguous current category mapping. Never count a multi-category document as multiple tasks without explicit units.

`regulationCoverage(exam)` returns null outside AP or `{profile,total,areas:[...profile.areas,{actual,missing}],minutes,unknownMinutes,units:[...],issues,complete}`. `regulationChecklist(context)` returns `{id,label,explanation,reference}` entries for `conversation,crossCutting,preparation,equalWeighting` plus `overallWork` for GaLa. Optional `exam.regulationReview` maps these IDs to booleans.

`regulationPattern(type,specialty)` returns statutory AP pattern (`ruleSet:'gaertner-ap-1996-v1'`, categoryCatalog unchanged, slots:[], confirmed). `pattern` returns this for new AP rather than inferred legacy counts. `coverage` applies the statutory check to AP without mutating old patterns. `propose` fills minima and fifth slot, preserves family rotation, never overfills five, and excludes ambiguous candidates.

## Tasks

- [x] Domain: add rule profiles/category mapping, explicit units validation, count/minute checks, statutory patterns and quota-aware rotation. Hook task/exam metadata into Core validation and human checks into readiness. Test all seven specialties, Friedhof boundaries, GaLa grouped units, ambiguous extras, multi-tag non-double-count, 300/301/unknown time, legacy immutability, and ZP/FW isolation.
- [x] Editor: always-visible compact five-task/area/time status; group category buttons by legal area with explanations and clickable law excerpts. Stand prüfen includes human checklist. New task dialog shows area assignment near the top; contextual/multi-unit definitions in details. Add visible admin blank-task and existing-task-as-template workflows, preserving references/assets and resetting approvals on new variants. Keep group rights.
- [x] Help/exports: explain why category examples are flexible and fifth task is free; record statutory structure and equal weighting in examiner guidance without rewriting participant originals. Render a synthetic example; verify exports remain native editable Word.
- [ ] Review/publish: full tests/builds, independent audit/review, desktop/mobile inspection, PR+merge, compatible Worker first and frontend deployment second. Verify deployed bytes and private project still loads; no data migration.

## Review focus

1. A five-tag source is one task unless its complex tasks are explicitly named and assigned.
2. A category not expressly listed is contextual, not forbidden and not silently legal-mapped from Excel.
3. Old confirmed patterns cannot bypass current structural checks or be silently rewritten.
4. 3+2 and4+1 pass ordinary minima; Friedhof2+3 and3+2 pass; total still exactly5.
5. Adding/editing tasks after human confirmation must reset affected confirmations; no group export/bank write privilege expansion.
