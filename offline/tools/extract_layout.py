#!/usr/bin/env python3
"""Extract rendered source pages without rewriting text. Output is private data.

Input PDFs must be rendered from the supplied Word originals. Non-text content
is retained in a lossless background; text is separately editable in the client.
Known logo image digests may be replaced by the protected current CI asset.
"""
import argparse, base64, collections, hashlib, json
from pathlib import Path
import fitz

def rounded(value):
 return round(float(value),3)

def span_text(span):
 # LibreOffice encodes the Symbol bullet as a private-use glyph. Preserve its
 # visible meaning when changing to the current CI font.
 return span['text'].replace('\uf0b7','•') if span.get('font') in {'OpenSymbol','Symbol'} else span['text']

def extract(path,source_id,reference,logo_digests):
 doc=fitz.open(path);pages=[];assets=[];warnings=[]
 for page_index,page in enumerate(doc):
  blocks=[]
  for block in page.get_text('dict')['blocks']:
   if block['type']!=0:continue
   groups=[]
   for line in block['lines']:
    if line['dir']!=(1.0,0.0):warnings.append('Gedrehter Text auf Seite '+str(page_index+1))
    spans=[s for s in line['spans'] if s['text']]
    if not spans:continue
    # PDF blocks may combine adjacent table cells, list indents or columns.
    # Keep those separate instead of stacking their text at one coordinate.
    previous=groups[-1][-1] if groups else None
    if previous and abs(line['bbox'][0]-previous['bbox'][0])<1.5 and .6*spans[0]['size']<line['bbox'][1]-previous['bbox'][1]<2*spans[0]['size']:
     groups[-1].append(line)
    else:groups.append([line])
   for group in groups:
    lines=[{'text':''.join(span_text(s) for s in l['spans']),'runs':[{'text':span_text(s),'bold':bool(s['flags']&16),'italic':bool(s['flags']&2)} for s in l['spans']]} for l in group]
    x0=min(l['bbox'][0] for l in group);y0=min(l['bbox'][1] for l in group);x1=max(l['bbox'][2] for l in group);y1=max(l['bbox'][3] for l in group)
    size=max(s['size'] for l in group for s in l['spans']);line_height=(group[-1]['bbox'][1]-group[0]['bbox'][1])/(len(group)-1) if len(group)>1 else y1-y0
    blocks.append({'id':f'p{page_index+1}-b{len(blocks)+1}','x':rounded(x0),'y':rounded(y0),'width':rounded(x1-x0+1),'height':rounded(y1-y0+1),'fontSize':rounded(size),'lineHeight':rounded(line_height),'text':'\n'.join(l['text'] for l in lines),'originalText':'\n'.join(l['text'] for l in lines),'lines':lines})
  logos=[]
  for img in page.get_image_info(hashes=True):
   if img['digest'].hex() in logo_digests:
    r=fitz.Rect(img['bbox']);logos.append({'x':rounded(r.x0),'y':rounded(r.y0),'width':rounded(r.width),'height':rounded(r.height)})
  # Removing PDF text does not flatten it into the background. Retain all image
  # and drawing objects, including blank planning tables on reverse pages.
  page.add_redact_annot(page.rect,fill=False)
  page.apply_redactions(images=0,graphics=0,text=0)
  for logo in logos:
   r=fitz.Rect(logo['x'],logo['y'],logo['x']+logo['width'],logo['y']+logo['height'])
   page.add_redact_annot(r,fill=(1,1,1))
  if logos:page.apply_redactions(images=2,graphics=0,text=1)
  data=page.get_pixmap(dpi=200,alpha=False).tobytes('png');asset_id='asset-'+hashlib.sha256(data).hexdigest()
  assets.append({'id':asset_id,'name':f'{reference}-Seite-{page_index+1}.png','mime':'image/png','data':base64.b64encode(data).decode()})
  pages.append({'width':rounded(page.rect.width),'height':rounded(page.rect.height),'backgroundAssetId':asset_id,'logos':logos,'blocks':blocks})
 return {'version':1,'sourceId':source_id,'reference':reference,'sourcePdfHash':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'pages':pages,'warnings':list(dict.fromkeys(warnings))},assets

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--pdf-dir',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
 files=sorted(args.pdf_dir.glob('*.pdf'));counts=collections.Counter()
 for file in files:
  with fitz.open(file) as doc:
   for page in doc:
    for img in page.get_image_info(hashes=True):
     if img['bbox'][1]<200:counts[img['digest'].hex()]+=1
 # Repeated top-of-page images are reported for explicit review, never guessed.
 (args.out/'image-inventory.json').write_text(json.dumps(counts,indent=2))
 print(json.dumps(counts.most_common(10)))
if __name__=='__main__':main()
