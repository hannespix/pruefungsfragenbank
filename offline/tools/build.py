#!/usr/bin/env python3
"""Build a self-contained file; private seed path must stay outside git."""
import argparse,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--seed',type=pathlib.Path,default=ROOT/'demo.json');p.add_argument('--out',type=pathlib.Path,default=ROOT.parent/'dist/index.html');args=p.parse_args()
data=json.loads(args.seed.read_text());html=(ROOT/'src/index.html').read_text()
replacements={'CSS':(ROOT/'src/style.css').read_text(),'SEED':json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'),'VENDOR':(ROOT/'vendor/jszip.min.js').read_text()+'\n'+(ROOT/'vendor/docx.umd.min.js').read_text()+'\n'+(ROOT/'vendor/pdf-lib.min.js').read_text()}
for name in ['SOURCE-LAYOUT','ICONS','PLANNING','MATERIALS','CORE','TIMING-PLAN','POINTS-PLAN','RELEASE','PRINT','ORGANIZATION','CATALOG','PAPER','DOCX-ASSETS','DOCX','ARCHIVE','HELP','AI','HASH','IMPORT','APP']:replacements[name]=(ROOT/'src'/f'{name.lower()}.js').read_text()
# One pass only: inserted seed text or module code must never be scanned for further placeholders.
html=re.sub(r'/\*([A-Z][A-Z_-]*)\*/',lambda m:replacements.get(m[1],m[0]),html)
args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(html);print(f'Built {args.out} ({args.out.stat().st_size:,} bytes)')
