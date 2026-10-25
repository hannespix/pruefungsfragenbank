#!/usr/bin/env python3
"""Build a public launcher from public code and an already encrypted seed only."""
import argparse,json,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--sealed',type=pathlib.Path,default=ROOT/'pages/sealed');p.add_argument('--out',type=pathlib.Path,default=ROOT.parent/'pages-dist');args=p.parse_args()
# Fail closed on contaminated/stale directories rather than publishing extra files.
if args.out.exists():raise SystemExit('Output already exists; use a fresh output directory.')
m=json.loads((args.sealed/'manifest.json').read_text())
expected={'manifest.json',*m['chunks']}
if m.get('version')!=1 or not m['chunks'] or len(m['chunks'])>256 or m['chunks']!=[f'part-{i:03}.bin' for i in range(len(m['chunks']))] or {f.name for f in args.sealed.iterdir()}!=expected:raise SystemExit('Unexpected sealed package files.')
html=(ROOT/'src/index.html').read_text().replace('<head>','<head><meta name="hortiexam-storage" content="memory">',1)
replacements={'CSS':(ROOT/'src/style.css').read_text(),'SEED':'/*PRIVATE_SEED*/','VENDOR':(ROOT/'vendor/jszip.min.js').read_text()}
for name in ['SOURCE-LAYOUT','ICONS','PLANNING','CORE','PRINT','CATALOG','PAPER','HELP','HASH','IMPORT','APP']:replacements[name]=(ROOT/'src'/f'{name.lower()}.js').read_text()
for key,value in replacements.items():html=html.replace('/*'+key+'*/',value)
wrapper=(ROOT/'pages/index.html').read_text()
wrapper=wrapper.replace('/*TEMPLATE*/',json.dumps(html,ensure_ascii=False).replace('<','\\u003c')).replace('/*CRYPTO*/',(ROOT/'pages/crypto.js').read_text()).replace('/*LAUNCHER*/',(ROOT/'pages/launcher.js').read_text())
args.out.mkdir(parents=True)
(args.out/'index.html').write_text(wrapper)
(args.out/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(args.out/'.nojekyll').write_text('')
shutil.copytree(args.sealed,args.out/'sealed')
print('Built public launcher and encrypted payload only.')
