# Native Word export

The coordinator's existing exam download includes genuine `.docx` candidate and examiner documents alongside the existing print HTML and separate attachments. Text, solutions and scoring tables remain editable. Source page geometry, drawings, planning fields, wording and reverse sides are retained. New BW branding uses protected assets. Legacy tasks without a page template remain supported. Solutions and examiner assets never enter the candidate file.

Generation happens in the signed-in browser with the existing JSZip dependency; no document conversion service receives examination data. Existing authorization, save-before-export and snapshot semantics remain in place. Missing assets and stale source templates block generation. Source text that cannot fit legibly must be reported, not silently clipped. DOCX editing is an exported copy and does not update the question bank.

Verify package structure, confidentiality, pagination and rendered representative original layouts. Rendering in LibreOffice is evidence of interoperability, not a claim of testing every Microsoft Word version. Users must check print preview after editing, and use original PDFs for scale-critical plans.
