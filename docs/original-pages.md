# Original pages in new examinations

Each prepared task may carry a `sourceLayout` version 1. It references a source record and a SHA-256 fingerprint of the PDF rendered from that Word original. Pages retain their dimensions, positioned text blocks, line breaks, style runs, logo positions and protected PNG background assets. The latter retain table borders, drawing objects and images; PDF text and explicitly reviewed logo images are removed before rendering the background. Current protected CI fonts and logo replace only those design elements.

The browser DOCX importer still imports text and images. It does not reconstruct Word pagination. Additional originals need an explicit, reviewed layout preparation before they use this renderer. Tasks without a layout continue to use the general layout. Existing exam snapshots are not rewritten when bank tasks acquire layouts.

## Preparing a private batch

1. Render supplied DOC/DOCX originals to PDF with LibreOffice in a private working directory. Verify any font substitutions and pagination against the original documents.
2. Run `offline/tools/extract_layout.py --pdf-dir PRIVATE_PDFS --out PRIVATE_OUTPUT` to inventory repeated header images. Review their crops. Repetition alone is not proof that an image is a logo.
3. Call `extract(pdf_path, source_id, reference, reviewed_logo_digests)` from that module for each source. It returns a layout and image assets. Preserve the returned warnings for review. Symbol-font bullet glyphs are mapped to their visible Unicode equivalent for the new CI font.
4. Associate each task with the appropriate original source version. Set `baselineText` to its unchanged bank text. Link every background with audience `candidate` and role `source-page`. Keep the original source document available to administrators. New image assets remain private; never put a corpus, seed, screenshots, credentials or CI files in the public repository.
5. Compare wording, page counts, tables, drawings and reverse sides. Inspect browser and print output. Retain audit evidence privately. Use `C.validate` for full project validation.
6. Back up current records and versions. Upload assets, save their metadata, then add task layouts in size-limited batches using optimistic versions. Do not overwrite exam snapshots. Verify all changed records after saving.

## Editing and printing

`source-layout.js` is shared by the editor and exported HTML. Direct block edits update the task snapshot and baseline. An outside edit to the task text makes the layout stale and prevents export. Text scales only within the original block bounds; excessively long changes are highlighted and the print button stops. This is a layout check, not a browser security boundary.

Original pages have no added generic cover, invented duration label or extra planning field. Odd page counts receive a blank reverse. First original pages request recto placement, including in mixed exams. Additional candidate attachments follow all candidate pages. Examiner solutions and criteria then follow separately. Files with outstanding readiness checks have an unobtrusive draft watermark on original front pages when printed.

Use A4, 100%, double-sided long-edge binding and no browser header/footer. Check the preview before distribution; print engines and physical printers may differ. Preserve original plan PDFs for scale-sensitive work. CI fonts change character metrics, so the typography is not pixel-identical to the old template. Original headers, including any historic year, are editable and must be checked for the new sitting. Metadata points and times do not silently rewrite literal source wording.

## Verification

- `node --test offline/tests/*.test.cjs`
- `npm test --prefix online`
- `python offline/tests/test_extract_layout.py` (requires PyMuPDF)
- `python online/tools/build_pages.py`
- `npm run build --prefix online`

The source-layout tests use synthetic fixtures only and cover reverse pages, odd counts, edits/staleness, reference validation, import collisions, escaping, mixed exams, additional figures and examiner confidentiality.
