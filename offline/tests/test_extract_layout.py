import importlib.util, tempfile, unittest
from pathlib import Path
import fitz
spec=importlib.util.spec_from_file_location('extract_layout',Path(__file__).parents[1]/'tools/extract_layout.py')
class LayoutExtraction(unittest.TestCase):
 def test_preserves_wording_and_blank_reverse_page(self):
  self.assertTrue(Path(spec.origin).exists(),'source layout extraction must exist')
  m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  with tempfile.TemporaryDirectory() as directory:
   p=Path(directory);doc=fitz.open();front=doc.new_page();front.insert_text((50,70),'Aufgabe: Originaltext.');front.insert_text((50,95),'Bitte auf der Rueckseite fortsetzen.');front.draw_rect(fitz.Rect(50,120,540,700));back=doc.new_page();back.draw_rect(fitz.Rect(50,50,540,800));doc.save(p/'input.pdf')
   layout,assets=m.extract(p/'input.pdf','source-demo','D-test',set())
   self.assertEqual(len(layout['pages']),2);self.assertEqual(len(layout['pages'][1]['blocks']),0)
   self.assertEqual([b['text'] for b in layout['pages'][0]['blocks']],['Aufgabe: Originaltext.','Bitte auf der Rueckseite fortsetzen.'])
   self.assertEqual(len(assets),2);self.assertTrue(all(a['mime']=='image/png' for a in assets));self.assertFalse(layout['warnings'])
 def test_keeps_adjacent_identity_cells_in_separate_positioned_blocks(self):
  m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  with tempfile.TemporaryDirectory() as directory:
   p=Path(directory);doc=fitz.open();page=doc.new_page();page.insert_text((50,70),'Name:');page.insert_text((350,70),'Datum:');doc.save(p/'input.pdf')
   layout,_=m.extract(p/'input.pdf','source-demo','D-test',set());blocks=layout['pages'][0]['blocks']
   self.assertEqual(len(blocks),2);self.assertLess(blocks[0]['x'],blocks[1]['x']);self.assertAlmostEqual(blocks[0]['y'],blocks[1]['y'])
 def test_symbol_bullet_survives_ci_font_change(self):
  m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.assertEqual(m.span_text({'text':'\uf0b7','font':'OpenSymbol'}),'•')
  self.assertEqual(m.span_text({'text':'unverändert','font':'Arial'}),'unverändert')
if __name__=='__main__':unittest.main()
