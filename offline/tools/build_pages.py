#!/usr/bin/env python3
"""Build a public launcher from public code and an already encrypted seed only."""
import argparse,base64,json,pathlib,re,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--sealed',type=pathlib.Path,default=ROOT/'pages/sealed');p.add_argument('--out',type=pathlib.Path,default=ROOT.parent/'pages-dist');args=p.parse_args()
# Fail closed on contaminated/stale directories rather than publishing extra files.
if args.out.exists():raise SystemExit('Output already exists; use a fresh output directory.')
m=json.loads((args.sealed/'manifest.json').read_text())
expected={'manifest.json',*m['chunks']}
if m.get('version')!=1 or not m['chunks'] or len(m['chunks'])>256 or m['chunks']!=[f'part-{i:03}.bin' for i in range(len(m['chunks']))] or {f.name for f in args.sealed.iterdir()}!=expected:raise SystemExit('Unexpected sealed package files.')
# Same parameters launcher/crypto.js accepts; a renamed plaintext file or symlink must never be published.
def b64len(v):
    try:return len(base64.b64decode(v,validate=True))
    except Exception:return -1
if m.get('cipher')!='AES-256-GCM' or m.get('kdf')!='PBKDF2-SHA256' or m.get('iterations')!=600000 or m.get('compression')!='gzip' or b64len(m.get('salt'))!=16 or b64len(m.get('iv'))!=12:raise SystemExit('Manifest is not a sealed v1 package.')
parts=[args.sealed/n for n in m['chunks']]
if any(f.is_symlink() or not f.is_file() for f in [args.sealed/'manifest.json',*parts]):raise SystemExit('Sealed package must contain regular files only.')
if any(f.stat().st_size!=1024*1024 for f in parts[:-1]) or not 16<parts[-1].stat().st_size<=1024*1024:raise SystemExit('Unexpected chunk sizes for a sealed package.')
html=(ROOT/'src/index.html').read_text().replace('<head>','<head><meta name="hortiexam-storage" content="memory">',1)
replacements={'CSS':(ROOT/'src/style.css').read_text(),'SEED':'/*PRIVATE_SEED*/','VENDOR':(ROOT/'vendor/jszip.min.js').read_text()+'\n'+(ROOT/'vendor/docx.umd.min.js').read_text()+'\n'+(ROOT/'vendor/pdf-lib.min.js').read_text()}
for name in ['SOURCE-LAYOUT','ICONS','PLANNING','MATERIALS','CORE','TIMING-PLAN','POINTS-PLAN','RELEASE','PRINT','ORGANIZATION','CATALOG','PAPER','DOCX-ASSETS','DOCX','ARCHIVE','HELP','AI','HASH','HISTORY','ADVISOR','IMPORT','APP']:replacements[name]=(ROOT/'src'/f'{name.lower()}.js').read_text()
# One pass only: inserted seed text or module code must never be scanned for further placeholders.
html=re.sub(r'/\*([A-Z][A-Z_-]*)\*/',lambda m:replacements.get(m[1],m[0]),html)
wrapper=(ROOT/'pages/index.html').read_text()
wrapper_parts={'TEMPLATE':json.dumps(html,ensure_ascii=False).replace('<','\\u003c'),'CRYPTO':(ROOT/'pages/crypto.js').read_text(),'LAUNCHER':(ROOT/'pages/launcher.js').read_text()}
wrapper=re.sub(r'/\*([A-Z][A-Z_-]*)\*/',lambda m:wrapper_parts.get(m[1],m[0]),wrapper)
args.out.mkdir(parents=True)
(args.out/'index.html').write_text(wrapper)
(args.out/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(args.out/'.nojekyll').write_text('')
(args.out/'sealed').mkdir()
for f in [args.sealed/'manifest.json',*parts]:shutil.copyfile(f,args.out/'sealed'/f.name)
print('Built public launcher and encrypted payload only.')
