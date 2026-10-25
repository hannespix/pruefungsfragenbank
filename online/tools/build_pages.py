#!/usr/bin/env python3
"""Build a public client: never reads a dataset, archive, password or private file."""
import argparse,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path,default=ROOT/'pages-dist');args=p.parse_args()
html=(ROOT/'offline/src/index.html').read_text().replace("connect-src 'none'",'connect-src https://hortiexam-access.hannes-75b.workers.dev')
html=html.replace('<meta name="color-scheme"','<meta name="referrer" content="no-referrer"><meta name="hortiexam-storage" content="memory"><meta name="color-scheme"')
css=(ROOT/'offline/src/style.css').read_text()+'''\n.login-panel{max-width:560px;margin:8vh auto;padding:32px;background:white;border-radius:18px;box-shadow:0 12px 40px #17251d12}.login-panel .brand{color:#193b2a;padding:0}.login-panel .brand span{color:#39734b}.login-panel h1{margin-top:28px}.login-panel input{width:100%;margin:10px 0 20px}.device-code{font:700 40px monospace;letter-spacing:6px}.qr-code{max-width:320px;margin:20px auto}.qr-code svg{width:100%;height:auto}#login-error{color:#a53526}.top-actions{flex-wrap:wrap}@media(max-width:600px){.login-panel{margin:16px;padding:22px}}'''
css+='''\n.invitation-url{display:none}@media print{@page{size:A4;margin:18mm}body{background:white!important}body>*{display:none!important}body>dialog.invitation-print[open]{display:block!important;position:static!important;inset:auto!important;max-height:none!important;max-width:none!important;width:auto!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;overflow:visible!important}dialog.invitation-print::backdrop{display:none!important}.invitation-print .modal-head,.invitation-print .modal-body{padding:0!important;overflow:visible!important}.invitation-print .modal-head{border:0!important;margin-bottom:12mm}.invitation-print .modal-foot,.invitation-print button,.invitation-print input{display:none!important}.invitation-print .invitation-url{display:block!important;overflow-wrap:anywhere;font-size:10pt}.invitation-print .qr-code{width:70mm;max-width:none;break-inside:avoid}.invitation-print .eyebrow{font-size:11pt}.invitation-print p{font-size:11pt}}'''
replacements={'CSS':css,'SEED':'null','VENDOR':(ROOT/'offline/vendor/jszip.min.js').read_text()+'\n'+(ROOT/'online/vendor/qrcode.js').read_text()}
for name in ['ICONS','PLANNING','CORE','PRINT','CATALOG','PAPER','HELP','HASH','IMPORT','APP']:replacements[name]=(ROOT/'offline/src'/f'{name.lower()}.js').read_text()
replacements['APP']=(ROOT/'online/client.js').read_text()+'\n'+replacements['APP']
for key,value in replacements.items():html=html.replace('/*'+key+'*/',value)
if args.out.exists():shutil.rmtree(args.out)
args.out.mkdir(parents=True);(args.out/'index.html').write_text(html);(args.out/'.nojekyll').write_text('')
print(f'Built public online client ({len(html.encode()):,} bytes); no embedded dataset')
