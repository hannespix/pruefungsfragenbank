# Browser dependencies

- `jszip.min.js`: existing JSZip ZIP support.
- `docx.umd.min.js`: docx 9.6.1, UMD browser build (`dist/index.umd.cjs`), minified with esbuild 0.25.12 using `minify: true`, no changed library logic. MIT license in `docx.LICENSE.txt`. Upstream: https://github.com/dolanmiu/docx and https://docx.js.org/.

The Word renderer uses docx for native paragraphs, styles, headers, tables, images and DrawingML text boxes. Protected fonts and exam content are loaded from the authorized project at runtime; this directory contains neither. Full regular/bold font-family embedding is applied separately in `src/docx-assets.js`.

- `pdf-lib.min.js`: pdf-lib 1.17.1, unmodified `dist/pdf-lib.min.js` browser distribution. MIT license in `pdf-lib.LICENSE.md`. Upstream: https://github.com/Hopding/pdf-lib. Used to copy historical PDF pages, retaining dimensions and rotation.
