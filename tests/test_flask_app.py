"""Regressionstests für die Flask-App (Sicherheits- und Logikfixes aus dem Code-Audit).

Ausführen: python -m unittest discover -s tests
Die Tests nutzen einen temporären Datenordner und berühren instance/ nicht.
"""

import io
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from html_sanitizer import sanitize_html  # noqa: E402


class SanitizerTest(unittest.TestCase):
    def test_plain_text_is_unchanged(self):
        self.assertEqual(sanitize_html('pH < 7 & N > 3'), 'pH < 7 & N > 3')
        self.assertEqual(sanitize_html(None), '')

    def test_strips_scripts_handlers_and_unknown_tags(self):
        dirty = '<p onclick="x()">Hallo <img src=x onerror=alert(1)><script>alert(2)</script><b>fett</b></p>'
        self.assertEqual(sanitize_html(dirty), '<p>Hallo <b>fett</b></p>')

    def test_links_keep_only_safe_href(self):
        self.assertEqual(sanitize_html('<a href="javascript:alert(1)">x</a>'), '<a>x</a>')
        self.assertEqual(sanitize_html('<a href="//evil.example">x</a>'), '<a>x</a>')
        self.assertEqual(
            sanitize_html('<a href="https://example.org/?a=1&b=2" style="x">x</a>'),
            '<a href="https://example.org/?a=1&amp;b=2" rel="noopener noreferrer">x</a>',
        )

    def test_text_inside_html_stays_escaped(self):
        self.assertEqual(sanitize_html('<p>a &lt;b&gt; &amp; c</p>'), '<p>a &lt;b&gt; &amp; c</p>')
        self.assertEqual(sanitize_html('Zeile<br/>Zeile'), 'Zeile<br>Zeile')


try:
    import flask  # noqa: F401
    HAVE_FLASK = True
except ImportError:  # pragma: no cover - Flask ist optional für die Sanitizer-Tests
    HAVE_FLASK = False


@unittest.skipUnless(HAVE_FLASK, 'Flask nicht installiert')
class AppTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ['HORTIEXAM_INSTANCE_DIR'] = cls.tmp.name
        import app as app_module
        cls.app_module = app_module
        cls.app = app_module.app
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        os.environ.pop('HORTIEXAM_INSTANCE_DIR', None)
        cls.tmp.cleanup()

    def setUp(self):
        with self.app.app_context():
            db = self.app_module.db
            db.drop_all()
            db.create_all()

    def _question(self, content='Was ist <b>Photosynthese</b>?', **extra):
        m = self.app_module
        with self.app.app_context():
            q = m.Question(content=content, answer='Lösung', difficulty=3, **extra)
            m.db.session.add(q)
            m.db.session.commit()
            return q.id

    def _exam(self):
        res = self.client.post('/exam/new', json={'title': 'Test'})
        self.assertEqual(res.status_code, 200, res.get_data(as_text=True))
        return res.get_json()['id']

    def test_secret_key_is_not_the_shipped_default(self):
        self.assertNotEqual(self.app.config['SECRET_KEY'], 'your-secret-key-change-in-production')
        self.assertGreaterEqual(len(self.app.config['SECRET_KEY']), 32)

    def test_added_items_get_increasing_positions(self):
        exam_id = self._exam()
        ids = [self._question(f'Frage {i}') for i in range(3)]
        for qid in ids:
            res = self.client.post(f'/exam/{exam_id}/add_question', json={'question_id': qid, 'points': '2'})
            self.assertEqual(res.status_code, 200, res.get_data(as_text=True))
        m = self.app_module
        with self.app.app_context():
            items = m.ExamItem.query.filter_by(exam_id=exam_id).order_by(m.ExamItem.id).all()
            self.assertEqual([i.position for i in items], [0, 1, 2])
            self.assertEqual([i.points for i in items], [2, 2, 2])

    def test_update_keeps_category_code_and_sanitizes(self):
        qid = self._question(category_code=33)
        res = self.client.post(f'/question/{qid}/update', json={
            'content': '<p>Neu<img src=x onerror=alert(1)></p>', 'answer': 'A', 'difficulty': 2,
        })
        self.assertEqual(res.status_code, 200, res.get_data(as_text=True))
        m = self.app_module
        with self.app.app_context():
            q = m.db.session.get(m.Question, qid)
            self.assertEqual(q.category_code, 33)
            self.assertEqual(q.content, '<p>Neu</p>')

    def test_stored_payload_is_sanitized_on_read(self):
        qid = self._question('<img src=x onerror=alert(1)>Alt')
        data = self.client.get(f'/question/{qid}').get_json()
        self.assertEqual(data['content'], 'Alt')

    def test_cross_origin_post_is_rejected(self):
        res = self.client.post('/settings', data={'action': 'create', 'name': 'x', 'api_url': 'http://evil'},
                               headers={'Origin': 'http://evil.example'})
        self.assertEqual(res.status_code, 403)
        res = self.client.post('/exam/new', json={'title': 'ok'}, headers={'Origin': 'http://localhost'})
        self.assertEqual(res.status_code, 200)

    def test_api_key_is_never_sent_back_and_kept_on_blank_update(self):
        m = self.app_module
        with self.app.app_context():
            cfg = m.LLMConfig(name='c', api_url='https://api.example/v1', api_key='sk-SECRET', provider='openai', active=True)
            m.db.session.add(cfg)
            m.db.session.commit()
            cid = cfg.id
        data = self.client.get(f'/settings/api/{cid}').get_json()
        self.assertEqual(data['api_key'], '')
        self.assertTrue(data['has_api_key'])
        res = self.client.post('/settings', data={
            'action': 'update', 'config_id': cid, 'name': 'c2', 'api_url': 'https://api.example/v1', 'api_key': '',
        })
        self.assertEqual(res.status_code, 302)
        with self.app.app_context():
            self.assertEqual(m.db.session.get(m.LLMConfig, cid).api_key, 'sk-SECRET')

    def test_export_handles_newline_title_and_entities(self):
        exam_id = self._exam()
        qid = self._question('<p>N &amp; P</p>')
        self.client.post(f'/exam/{exam_id}/add_question', json={'question_id': qid})
        self.client.post(f'/exam/{exam_id}/rename', json={'title': 'Zeile1\nZeile2'})
        res = self.client.get(f'/export/{exam_id}')
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('\n', res.headers['Content-Disposition'])
        from docx import Document
        text = '\n'.join(p.text for p in Document(io.BytesIO(res.data)).paragraphs)
        self.assertIn('N & P', text)
        self.assertEqual(os.listdir(self.app.config['UPLOAD_FOLDER']), [])


if __name__ == '__main__':
    unittest.main()
