#!/usr/bin/env python3
"""Build a public client: never reads a dataset, archive, password or private file."""
import argparse,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path,default=ROOT/'pages-dist');args=p.parse_args()
html=(ROOT/'offline/src/index.html').read_text().replace("connect-src 'none'",'connect-src https://hortiexam-access.hannes-75b.workers.dev')
html=html.replace('<meta name="color-scheme"','<meta name="referrer" content="no-referrer"><meta name="hortiexam-storage" content="memory"><meta name="color-scheme"')
css=(ROOT/'offline/src/style.css').read_text()+'''\n.login-panel{max-width:560px;margin:8vh auto;padding:32px;background:white;border-radius:18px;box-shadow:0 12px 40px #17251d12}.login-panel h1{margin-top:28px}.login-panel input{width:100%;margin:10px 0 20px}.device-code{font:700 40px monospace;letter-spacing:6px}.qr-code{max-width:320px;margin:20px auto}.qr-code svg{width:100%;height:auto}#login-error{color:#a53526}.top-actions{flex-wrap:wrap}@media(max-width:600px){.login-panel{margin:16px;padding:22px}}'''
replacements={'CSS':css,'SEED':'null','VENDOR':(ROOT/'offline/vendor/jszip.min.js').read_text()+'\n'+(ROOT/'online/vendor/qrcode.js').read_text()}
for name in ['PLANNING','CORE','PRINT','HASH','IMPORT','APP']:replacements[name]=(ROOT/'offline/src'/f'{name.lower()}.js').read_text()
replacements['APP']=(ROOT/'online/client.js').read_text()+'\n'+replacements['APP']
for key,value in replacements.items():html=html.replace('/*'+key+'*/',value)
if args.out.exists():shutil.rmtree(args.out)
args.out.mkdir(parents=True);(args.out/'index.html').write_text(html);(args.out/'.nojekyll').write_text('')
print(f'Built public online client ({len(html.encode()):,} bytes); no embedded dataset')
