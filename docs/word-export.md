# Editable Word export

Word exports use native paragraphs, text runs, tables and inline images. They contain no textboxes, floating text shapes, full-page background pictures or rasterized task prose. Fonts from the protected Baden-Württemberg assets remain embedded with their regular and bold faces. Candidate exports continue to exclude solutions and examiner-only assets.

Source page coordinates guide reading order, list indents, response space and page boundaries. Source PDF line wraps become soft wraps where appropriate; explicit edited line breaks remain. Bold and italic runs, wording, page labels and continuation notes are retained. Text keeps its source font size and can wrap or continue onto additional pages. Native Word layout is therefore not pixel-identical to the HTML/PDF original. Each planned source page starts a new section; a new task starts on an odd page, and odd source templates retain an explicit blank reverse. Longer edits can change the physical front/back pagination and should be checked before duplex printing.

Existing source templates do not need a data migration. Their text-free PNG backgrounds are decoded locally. Simple horizontal answer rules and rectangular response/identity frames and full-span grids become native borders and tables with minimum rather than fixed heights. Cropped remaining illustrations become inline images. Complex rectilinear drawings are retained as illustrations, rather than mistaken for response frames. A narrow repair restores a missing frame edge only when exactly the Name/Datum fields and a recorded overlapping logo identify the damaged identity box. Explicit `graphics` and `rules` arrays are also supported when both are present.

Labels that overlap a recovered illustration cannot safely be detached from it. The export reports this case explicitly and asks for a self-contained labelled attachment; it never silently moves the labels or flattens the whole task into an image. Source text is also protected by the existing stale-template and missing-asset checks. PNG decoding accepts non-interlaced 8-bit grayscale/RGB/RGBA images, checks chunk lengths, filters and decompressed length, and caps an image at 12 million pixels and 32 MiB compressed input. Unsupported or corrupt backgrounds fail clearly.

The legacy image path requires the browser's `CompressionStream` and `DecompressionStream` APIs. It does not make network requests or add dependencies. The same path runs in the Node runtime for regression tests. Original task paragraphs and scoring rows can flow across pages without font shrinking or clipping. Unknown drawing shapes remain inline visual material.

## Verification

`node --test offline/tests/docx.test.cjs` checks candidate isolation, solution tables, source wording, bold/italic runs, original font sizes after long edits, shared grid edges, inline drawings, recovered response frames, complex rectilinear figures, bounded PNG failures, browser-global generation and absence of textbox/floating-anchor markup.

Render QA uses the documents skill renderer with the protected fonts available locally. Private source examples and generated exam documents are kept outside the repository; no private questions, drawings or fonts are added to public fixtures.

Private corpus verification covered 245 source documents, 497 pages and 183 distinct PNG backgrounds with no decoding failures or detached-label cases. Representative original fronts/reverses, complex tasks, solutions, ordinary illustrated tasks and a long edit were generated and rendered. The focused DOCX suite contains 25 passing tests.


## Complete coordinator package

`Word & Druck` builds five matching native DOCX/HTML pairs: participant paper,
solutions and scoring, organizational material lists, internal remarks, and a saved time plan.
An index (`00_Paketuebersicht.html`) links every pair and separate attachment.
The selected oral task remains included in the first two documents.

Organizational output uses the saved examination snapshot. Material status
(confirmed, proposal, missing) remains explicit; no new materials are inferred
during export. Missing remarks receive an explicit empty-state sentence.
Examination metadata and the selected specialty's recorded committee accompany
the organizational documents. Remarks and material lists never enter participant
or solution documents. Long text flows in ordinary paragraphs, with no textboxes.
The coordinator must save successfully and pass the existing export permission
check. Group access still has no export action.
