import os
import sys
import socket
import re
import json
import io
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, send_file, Response
from werkzeug.utils import secure_filename
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from models import db, Question, Exam, ExamItem, LLMConfig
from sqlalchemy import func, or_, text
import qrcode

# PyInstaller Trick: resource_path() Funktion
def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller erstellt ein temporäres Verzeichnis und speichert den Pfad in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    
    return os.path.join(base_path, relative_path)


# Flask-App initialisieren - Templates/Static-Pfade für Dev und PyInstaller
if getattr(sys, 'frozen', False):
    # PyInstaller-Modus
    template_dir = resource_path('templates')
    static_dir = resource_path('static')
else:
    # Entwicklungsmodus
    template_dir = 'templates'
    static_dir = 'static'

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(
    os.path.dirname(os.path.abspath(__file__)) if not getattr(sys, 'frozen', False) else os.path.dirname(sys.executable),
    'instance',
    'hortiexam.db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(
    os.path.dirname(os.path.abspath(__file__)) if not getattr(sys, 'frozen', False) else os.path.dirname(sys.executable),
    'instance',
    'uploads'
)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Erstelle Upload-Ordner falls nicht vorhanden
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(os.path.dirname(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')), exist_ok=True)

db.init_app(app)

# Erstelle Datenbank beim Start
with app.app_context():
    db.create_all()

    # Kleine, sichere Migrationen (SQLite)
    def _ensure_column(table: str, col: str, ddl: str):
        cols = [r[1] for r in db.session.execute(text(f"PRAGMA table_info({table})")).fetchall()]
        if col not in cols:
            db.session.execute(text(ddl))
            db.session.commit()

    # Question: Neue Spalten für erweiterte Kategorisierung
    _ensure_column('questions', 'category_code', "ALTER TABLE questions ADD COLUMN category_code INTEGER")
    _ensure_column('questions', 'subcategory', "ALTER TABLE questions ADD COLUMN subcategory VARCHAR(100)")
    
    # ExamItem: Snapshot-Spalten für erweiterte Metadaten
    _ensure_column('exam_items', 'snapshot_category', "ALTER TABLE exam_items ADD COLUMN snapshot_category VARCHAR(100)")
    _ensure_column('exam_items', 'snapshot_subcategory', "ALTER TABLE exam_items ADD COLUMN snapshot_subcategory VARCHAR(100)")
    _ensure_column('exam_items', 'snapshot_tags', "ALTER TABLE exam_items ADD COLUMN snapshot_tags VARCHAR(500)")
    _ensure_column('exam_items', 'snapshot_difficulty', "ALTER TABLE exam_items ADD COLUMN snapshot_difficulty INTEGER DEFAULT 3")
    
    # LLMConfig: Standard-Auswahl
    _ensure_column('llm_configs', 'is_default', "ALTER TABLE llm_configs ADD COLUMN is_default INTEGER DEFAULT 0")

    # Falls noch keine Default-Konfiguration gesetzt ist, nimm die erste aktive
    try:
        has_default = LLMConfig.query.filter_by(is_default=True).first() is not None
        if not has_default:
            first_active = LLMConfig.query.filter_by(active=True).order_by(LLMConfig.date_created.desc()).first()
            if first_active:
                first_active.is_default = True
                db.session.commit()
    except Exception:
        db.session.rollback()

BW_FACHRICHTUNGEN = [
    {"name": "Baumschule", "code": None},
    {"name": "Friedhofsgärtnerei", "code": None},
    {"name": "Garten- und Landschaftsbau", "code": None},
    {"name": "Gemüsebau", "code": None},
    {"name": "Obstbau", "code": None},
    {"name": "Staudengärtnerei", "code": None},
    {"name": "Zierpflanzenbau", "code": None},
]

BW_UNTERKATEGORIEN = [
    "Fachrechnen",
    "Betriebliche Zusammenhänge",
    "Pflanzenkenntnisse",
    "Pflanzenproduktion",
    "Bodenkunde",
    "Pflanzenschutz",
    "Technik / Maschinen",
    "Arbeitssicherheit",
    "Umweltschutz / Nachhaltigkeit",
    "Kundenberatung / Kommunikation",
    "Recht / Vorschriften",
]

AI_GENERATED_TOKEN = "[KI-generiert]"

def normalize_llm_answer_to_plaintext(text: str) -> str:
    """Entfernt typische Markdown/LaTeX-Artefakte aus KI-Antworten (für Anzeige + Word-Export)."""
    if not text:
        return ''
    s = (text or '').strip()
    # Code fences entfernen
    if '```' in s:
        # Entferne komplette Fence-Blöcke, falls vorhanden, sonst nur Marker
        s = s.replace('```json', '').replace('```', '')

    # LaTeX-Delimiters entfernen
    s = s.replace('\\(', '').replace('\\)', '').replace('\\[', '').replace('\\]', '')

    # Häufige LaTeX-Kommandos vereinfachen
    s = s.replace('\\times', '×').replace('\\cdot', '·')
    s = re.sub(r'\\text\{([^}]*)\}', r'\1', s)
    s = s.replace('\\,', ' ')

    # Restliche Backslashes vor Kommandos entfernen (\alpha -> alpha)
    s = re.sub(r'\\([A-Za-z]+)', r'\1', s)

    # Markdown: Fett/Kursiv/Inline-Code
    s = re.sub(r'\*\*(.+?)\*\*', r'\1', s)
    s = re.sub(r'(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)', r'\1', s)
    s = s.replace('`', '')

    # Aufräumen
    s = re.sub(r'[ \t]+\n', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()

def extract_exam_date_heuristic(text: str) -> str | None:
    """Versucht ein Prüfungsdatum aus dem Dokumenttext zu erkennen. Rückgabe: YYYY-MM-DD oder None."""
    if not text:
        return None
    # 2026-01-14
    m = re.search(r'\b(20\d{2})-(\d{2})-(\d{2})\b', text)
    if m:
        y, mo, d = m.group(1), m.group(2), m.group(3)
        try:
            datetime(int(y), int(mo), int(d))
            return f"{y}-{mo}-{d}"
        except:
            pass
    # 14.01.2026 oder 14/01/2026
    m = re.search(r'\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b', text)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        try:
            dt = datetime(int(y), int(mo), int(d))
            return dt.strftime('%Y-%m-%d')
        except:
            pass
    return None

def extract_exam_title_heuristic(text: str) -> str | None:
    """Versucht einen Klausur-/Prüfungstitel aus dem Dokumenttext zu erkennen."""
    if not text:
        return None
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return None
    # Suche nach erster Zeile mit Schlüsselwörtern
    keywords = ("prüfung", "klausur", "abschlussprüfung", "zwischenprüfung", "schriftlich", "mündlich")
    for line in lines[:20]:
        if any(k in line.lower() for k in keywords):
            return line[:200]
    # Fallback: erste Zeile als Titel
    return lines[0][:200]

def extract_text_from_pdf(filepath: str) -> str:
    """Extrahiert Text aus einem PDF. Benötigt pdfplumber."""
    try:
        import pdfplumber  # type: ignore
    except Exception:
        raise Exception("PDF-Import benötigt das Paket 'pdfplumber'. Bitte `pip install -r requirements.txt` ausführen.")

    text_parts: list[str] = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            if t.strip():
                text_parts.append(t.strip())
    return "\n\n".join(text_parts).strip()

def extract_text_from_upload(filepath: str) -> str:
    """Extrahiert Text aus .docx oder .pdf anhand der Dateiendung."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".docx":
        return extract_text_from_word(filepath)
    if ext == ".pdf":
        return extract_text_from_pdf(filepath)
    raise Exception(f"Nicht unterstütztes Dateiformat: {ext}")

def preprocess_text_for_llm(text: str) -> str:
    """Reduziert Tokens: entfernt Duplikatzeilen, Seitenzahlen und normalisiert Whitespace."""
    if not text:
        return ""
    lines = [l.strip() for l in text.splitlines()]
    cleaned: list[str] = []
    seen = set()
    for l in lines:
        if not l:
            continue
        # typische Seitenzahlen/Headers/Footers
        if re.fullmatch(r'(seite|page)?\s*\d+\s*(von|/)?\s*\d*', l.lower()):
            continue
        if re.fullmatch(r'\d{1,3}', l):
            continue
        key = l.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(l)
    # Mehrfachspaces
    out = "\n".join(cleaned)
    out = re.sub(r'[ \t]{2,}', ' ', out)
    return out.strip()

def chunk_text(text: str, max_chars: int = 12000) -> list[str]:
    """Teilt Text in Absätze/Blöcke <= max_chars."""
    if not text:
        return []
    parts = re.split(r'\n\s*\n', text)
    chunks: list[str] = []
    buf: list[str] = []
    size = 0
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if size + len(p) + 2 > max_chars and buf:
            chunks.append("\n\n".join(buf))
            buf = [p]
            size = len(p)
        else:
            buf.append(p)
            size += len(p) + 2
    if buf:
        chunks.append("\n\n".join(buf))
    return chunks

def import_from_text_structured(text_content: str, default_category: str) -> list[dict]:
    """Klassischer Import aus Text (Frage:/Lösung:)."""
    questions: list[dict] = []
    current_question: str | None = None
    current_answer: str | None = None

    for raw_line in (text_content or "").splitlines():
        text = raw_line.strip()
        if not text:
            continue

        lower = text.lower()
        if lower.startswith("frage:") or text.startswith("FRAGE:"):
            if current_question:
                questions.append({
                    'content': current_question.strip(),
                    'answer': (current_answer or '').strip(),
                    'category': default_category,
                    'subcategory': '',
                    'tags': '',
                    'difficulty': 3
                })
            current_question = text.split(":", 1)[1].strip() if ":" in text else text.strip()
            current_answer = None
            continue

        if lower.startswith("lösung:") or text.startswith("LÖSUNG:") or lower.startswith("loesung:"):
            if current_question:
                current_answer = text.split(":", 1)[1].strip() if ":" in text else text.strip()
            continue

        # Weiterer Text zur Frage oder Lösung
        if current_question and not current_answer:
            current_question += "<br>" + text
        elif current_answer is not None:
            current_answer += "<br>" + text

    if current_question:
        questions.append({
            'content': current_question.strip(),
            'answer': (current_answer or '').strip(),
            'category': default_category,
            'subcategory': '',
            'tags': '',
            'difficulty': 3
        })

    return questions

def llm_extract_exam_metadata(llm_config, text_content: str) -> dict:
    """Extrahiert Titel + Datum der Klausur per LLM. Gibt dict zurück."""
    prompt = (
        "Extrahiere aus dem folgenden Text die Metadaten einer Klausur/Prüfung.\n"
        "Gib ausschließlich JSON zurück im Format:\n"
        "{\n"
        "  \"exam_title\": \"...\",\n"
        "  \"exam_date\": \"YYYY-MM-DD\" oder null,\n"
        "  \"is_past_exam\": true oder false\n"
        "}\n\n"
        "Wenn kein Datum eindeutig erkennbar ist, setze exam_date auf null.\n"
        "Wenn der Text klar eine Klausur/Prüfung beschreibt, setze is_past_exam auf true.\n\n"
        f"Text:\n{text_content}\n"
    )
    raw = call_llm_text(llm_config, prompt)
    raw = raw.strip()
    if '```json' in raw:
        raw = raw.split('```json')[1].split('```')[0].strip()
    elif '```' in raw:
        raw = raw.split('```')[1].split('```')[0].strip()
    try:
        data = json.loads(raw)
        return {
            "exam_title": (data.get("exam_title") or "").strip(),
            "exam_date": (data.get("exam_date") or None),
            "is_past_exam": bool(data.get("is_past_exam", False)),
        }
    except Exception:
        # Fallback: nichts
        return {"exam_title": "", "exam_date": None, "is_past_exam": False}

def normalize_subcategory(value: str) -> str:
    """Normalisiert Unterkategorienamen (kurz, ohne doppelten Whitespace)."""
    if not value:
        return ""
    v = re.sub(r'\s+', ' ', str(value)).strip()
    v = v.strip('"').strip("'").strip()
    return v[:80]


def get_local_ip():
    """Ermittle die lokale IP-Adresse für LAN-Zugriff"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


@app.route('/api/filters')
def get_filters():
    """Liefert alle verfügbaren Kategorien und Unterkategorien für die Filter"""
    try:
        # Hole alle eindeutigen Kategorien und Subkategorien
        categories = db.session.query(Question.category).distinct().order_by(Question.category).all()
        subcategories = db.session.query(Question.subcategory).distinct().order_by(Question.subcategory).all()

        # Stelle sicher, dass die 7 BW-Fachrichtungen immer auswählbar sind
        bw_names = [fr["name"] for fr in BW_FACHRICHTUNGEN]
        db_names = [c[0] for c in categories if c[0]]
        merged = sorted(set(db_names + bw_names))

        # Stelle sicher, dass Standard-Unterkategorien immer auswählbar sind
        db_sub = [c[0] for c in subcategories if c[0]]
        merged_sub = sorted(set(db_sub + BW_UNTERKATEGORIEN))
        
        return jsonify({
            'categories': merged,
            'subcategories': merged_sub
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/fachrichtungen')
def get_fachrichtungen():
    """Liefert die 7 BW-Gärtnerfachrichtungen (Name + optionale Kennziffer)."""
    return jsonify({"fachrichtungen": BW_FACHRICHTUNGEN})

@app.route('/api/local-ip')
def get_local_ip_api():
    """Liefert die lokale IP-Adresse und die URL für den QR-Code"""
    local_ip = get_local_ip()
    port = 5000
    url = f"http://{local_ip}:{port}"
    return jsonify({
        "ip": local_ip,
        "port": port,
        "url": url
    })

@app.route('/api/qrcode')
def get_qrcode():
    """Generiert einen QR-Code für die LAN-URL"""
    local_ip = get_local_ip()
    port = 5000
    url = f"http://{local_ip}:{port}"
    
    # QR-Code erstellen
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    # QR-Code als Bild generieren
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Bild in Bytes umwandeln
    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    
    return Response(img_io.getvalue(), mimetype='image/png')


@app.route('/')
def index():
    """Hauptseite - Exam Builder"""
    exams = Exam.query.order_by(Exam.date_created.desc()).all()
    return render_template('index.html', exams=exams)


@app.route('/questions')
def questions():
    """API: Liste aller Fragen (filterbar)"""
    try:
        # --- Filter Parameter ---
        category = (request.args.get('category') or '').strip()
        category_code = request.args.get('category_code', type=int)
        subcategory = (request.args.get('subcategory') or '').strip()
        difficulty = request.args.get('difficulty', type=int)

        # Aktiv/Inaktiv
        active = request.args.get('active')
        # legacy
        active_only = request.args.get('active_only')
        if active is None and active_only is not None:
            active = 'true' if (active_only == 'true') else None

        # Tags: comma-separated (ANY)
        tags_any = (request.args.get('tags_any') or '').strip()

        # Volltextsuche über Felder
        qtext = (request.args.get('q') or '').strip()

        # Last used Filter
        used_status = (request.args.get('used_status') or '').strip()  # '', 'ever', 'never'
        used_after = (request.args.get('used_after') or '').strip()    # YYYY-MM-DD
        used_before = (request.args.get('used_before') or '').strip()  # YYYY-MM-DD

        # Last used exam title contains
        exam_q = (request.args.get('exam_q') or '').strip()

        # --- Last used subquery (max exam date) ---
        last_used_subq = (
            db.session.query(
                ExamItem.original_question_id.label('qid'),
                func.max(Exam.date_created).label('last_used_dt')
            )
            .join(Exam, Exam.id == ExamItem.exam_id)
            .group_by(ExamItem.original_question_id)
            .subquery()
        )

        # correlated subquery to get last used exam title (best-effort)
        last_used_title_sq = (
            db.session.query(Exam.title)
            .join(ExamItem, ExamItem.exam_id == Exam.id)
            .filter(ExamItem.original_question_id == Question.id)
            .order_by(Exam.date_created.desc())
            .limit(1)
            .scalar_subquery()
        )

        # Base query with last_used join
        query = (
            db.session.query(Question, last_used_subq.c.last_used_dt)
            .outerjoin(last_used_subq, last_used_subq.c.qid == Question.id)
        )

        # --- Apply filters ---
        if active is not None:
            if active == 'true':
                query = query.filter(Question.active == True)
            elif active == 'false':
                query = query.filter(Question.active == False)

        if category_code:
            query = query.filter(Question.category_code == category_code)
        elif category:
            query = query.filter(Question.category == category)

        if subcategory:
            query = query.filter(Question.subcategory == subcategory)

        if difficulty:
            query = query.filter(Question.difficulty == difficulty)

        if tags_any:
            tags = [t.strip() for t in tags_any.split(',') if t.strip()]
            if tags:
                query = query.filter(or_(*[Question.tags.contains(t) for t in tags]))

        if used_status == 'never':
            query = query.filter(last_used_subq.c.last_used_dt.is_(None))
        elif used_status == 'ever':
            query = query.filter(last_used_subq.c.last_used_dt.is_not(None))

        def _parse_date(s: str) -> datetime | None:
            try:
                return datetime.strptime(s, '%Y-%m-%d')
            except:
                return None

        if used_after:
            dt = _parse_date(used_after)
            if dt:
                query = query.filter(last_used_subq.c.last_used_dt.is_not(None)).filter(last_used_subq.c.last_used_dt >= dt)
        if used_before:
            dt = _parse_date(used_before)
            if dt:
                query = query.filter(last_used_subq.c.last_used_dt.is_not(None)).filter(last_used_subq.c.last_used_dt <= dt)

        if exam_q:
            pattern = f"%{exam_q.lower()}%"
            query = query.filter(func.lower(last_used_title_sq).like(pattern))

        if qtext:
            pattern = f"%{qtext.lower()}%"
            query = query.filter(or_(
                func.lower(Question.content).like(pattern),
                func.lower(Question.answer).like(pattern),
                func.lower(func.coalesce(Question.category, '')).like(pattern),
                func.lower(func.coalesce(Question.subcategory, '')).like(pattern),
                func.lower(func.coalesce(Question.tags, '')).like(pattern),
                func.lower(func.coalesce(last_used_title_sq, '')).like(pattern),
            ))

        rows = query.order_by(Question.date_created.desc()).all()

        result = []
        for q, last_used_dt in rows:
            last_used_date = last_used_dt.strftime('%d.%m.%Y') if last_used_dt else None
            last_used_exam = None
            try:
                last_used_exam = db.session.query(last_used_title_sq).filter(Question.id == q.id).scalar()
            except:
                last_used_exam = None

            result.append({
                'id': q.id,
                'content': q.content or '',
                'answer': q.answer or '',
                'category': q.category or '',
                'category_code': q.category_code,
                'subcategory': q.subcategory or '',
                'tags': [t.strip() for t in q.tags.split(',')] if q.tags and q.tags.strip() else [],
                'difficulty': q.difficulty,
                'active': q.active,
                'last_used_date': last_used_date,
                'last_used_exam': last_used_exam
            })

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/question/<int:question_id>/update', methods=['POST'])
def update_question(question_id):
    """Bestehende Frage bearbeiten"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400
        
        question = Question.query.get_or_404(question_id)
        data = request.json
        
        content = data.get('content', '').strip()
        answer = data.get('answer', '').strip()
        
        if not content:
            return jsonify({'error': 'Frage darf nicht leer sein'}), 400
            
        question.content = content
        question.answer = answer
        question.category = data.get('category', '')
        question.category_code = data.get('category_code')
        question.subcategory = data.get('subcategory', '')
        question.tags = data.get('tags', '')
        question.difficulty = max(1, min(5, int(data.get('difficulty', 3))))
        question.active = data.get('active', True)
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/question/<int:question_id>/delete', methods=['DELETE'])
def delete_question(question_id):
    """Frage löschen"""
    try:
        question = Question.query.get_or_404(question_id)
        db.session.delete(question)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/exam/<int:exam_id>')
def exam_view(exam_id):
    """Ansicht einer Prüfung"""
    exam = Exam.query.get_or_404(exam_id)
    llm_configs = LLMConfig.query.filter_by(active=True).all()
    default_cfg = LLMConfig.query.filter_by(active=True, is_default=True).first() or (llm_configs[0] if llm_configs else None)
    return render_template('exam.html', exam=exam, llm_configs=llm_configs, default_llm_config_id=(default_cfg.id if default_cfg else None))


@app.route('/exam/<int:exam_id>/items')
def exam_items(exam_id):
    """API: Items einer Prüfung"""
    try:
        exam = Exam.query.get_or_404(exam_id)
        items = ExamItem.query.filter_by(exam_id=exam_id).order_by(ExamItem.position).all()
        
        return jsonify([{
            'id': item.id,
            'content': item.snapshot_content or '',
            'answer': item.snapshot_answer or '',
            'category': item.snapshot_category or '',
            'subcategory': item.snapshot_subcategory or '',
            'tags': [t.strip() for t in item.snapshot_tags.split(',')] if item.snapshot_tags and item.snapshot_tags.strip() else [],
            'difficulty': item.snapshot_difficulty or 3,
            'points': item.points,
            'position': item.position,
            'original_question_id': item.original_question_id
        } for item in items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/question/<int:question_id>')
def get_question(question_id):
    """API: Einzelne Originalfrage abrufen (für Sync/Referenz im Exam-Editor)"""
    try:
        q = Question.query.get_or_404(question_id)
        return jsonify({
            'id': q.id,
            'content': q.content or '',
            'answer': q.answer or '',
            'category': q.category or '',
            'subcategory': q.subcategory or '',
            'tags': q.tags or '',
            'difficulty': q.difficulty or 3,
            'active': q.active
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/exam/<int:exam_id>/item/<int:item_id>/update', methods=['POST'])
def exam_item_update(exam_id, item_id):
    """API: Snapshot-Daten eines ExamItems bearbeiten"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400

        item = ExamItem.query.filter_by(id=item_id, exam_id=exam_id).first_or_404()
        data = request.json or {}

        content = (data.get('content') or '').strip()
        if not content:
            return jsonify({'error': 'Frage darf nicht leer sein'}), 400

        item.snapshot_content = content
        item.snapshot_answer = (data.get('answer') or '').strip()
        item.snapshot_category = (data.get('category') or '').strip()
        item.snapshot_subcategory = (data.get('subcategory') or '').strip()
        item.snapshot_tags = (data.get('tags') or '').strip()
        try:
            item.snapshot_difficulty = max(1, min(5, int(data.get('difficulty', 3))))
        except Exception:
            item.snapshot_difficulty = 3
        try:
            item.points = max(1, int(data.get('points', item.points or 1)))
        except Exception:
            item.points = 1

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/exam/<int:exam_id>/item/<int:item_id>/sync_from_original', methods=['POST'])
def exam_item_sync_from_original(exam_id, item_id):
    """API: Snapshot aus Originalfrage aktualisieren (ändert NICHT die Originalfrage)."""
    try:
        item = ExamItem.query.filter_by(id=item_id, exam_id=exam_id).first_or_404()
        if not item.original_question_id:
            return jsonify({'error': 'Keine Originalfrage verknüpft'}), 400

        q = Question.query.get_or_404(item.original_question_id)
        item.snapshot_content = q.content or ''
        item.snapshot_answer = q.answer or ''
        item.snapshot_category = q.category or ''
        item.snapshot_subcategory = q.subcategory or ''
        item.snapshot_tags = q.tags or ''
        item.snapshot_difficulty = q.difficulty or 3

        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/exam/<int:exam_id>/item/<int:item_id>/ai', methods=['POST'])
def exam_item_ai(exam_id, item_id):
    """KI-Helfer für ExamItem: generate_answer / rewrite_question."""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400

        item = ExamItem.query.filter_by(id=item_id, exam_id=exam_id).first_or_404()
        data = request.json or {}
        llm_config_id = data.get('llm_config_id')
        action = (data.get('action') or '').strip()

        if not llm_config_id:
            return jsonify({'error': 'LLM-Konfiguration fehlt'}), 400

        llm_config = LLMConfig.query.get_or_404(int(llm_config_id))

        if action == 'generate_answer':
            prompt = generate_answer_prompt(item.snapshot_content, item.snapshot_category or '', item.snapshot_subcategory or '')
            answer = call_llm_text(llm_config, prompt)
            if answer:
                answer = normalize_llm_answer_to_plaintext(answer)
                answer = f"{AI_GENERATED_TOKEN}\n{answer}"
            return jsonify({'success': True, 'answer': answer})

        if action == 'rewrite_question':
            prompt = generate_rewrite_prompt(item.snapshot_content, item.snapshot_category or '', item.snapshot_subcategory or '')
            content = call_llm_text(llm_config, prompt)
            return jsonify({'success': True, 'content': content})

        return jsonify({'error': 'Unbekannte Aktion'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _try_parse_json_from_llm(text: str):
    """Versucht JSON aus LLM-Output zu parsen (auch aus ```json``` Blöcken)."""
    if not text:
        return None
    raw = (text or '').strip()
    if '```json' in raw:
        raw = raw.split('```json', 1)[1].split('```', 1)[0].strip()
    elif '```' in raw:
        raw = raw.split('```', 1)[1].split('```', 1)[0].strip()
    try:
        return json.loads(raw)
    except Exception:
        return None


@app.route('/llm/proofread', methods=['POST'])
def llm_proofread():
    """
    KI-gestütztes Korrektorat (LanguageTool-ähnlich, aber über LLMConfig).
    Erwartet JSON: { llm_config_id, text, mode: "question"|"answer" }
    Antwort: { corrected_text, notes[] }
    """
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400
        data = request.json or {}
        llm_config_id = data.get('llm_config_id')
        text = (data.get('text') or '').strip()
        mode = (data.get('mode') or 'answer').strip()

        if not llm_config_id:
            return jsonify({'error': 'LLM-Konfiguration fehlt'}), 400
        if not text:
            return jsonify({'corrected_text': '', 'notes': []})

        llm_config = LLMConfig.query.get_or_404(int(llm_config_id))

        purpose = "Prüfungsfrage" if mode == 'question' else "Musterlösung"
        prompt = (
            f"Du bist ein deutscher Korrektor. Prüfe folgenden Text ({purpose}) auf Rechtschreibung, Grammatik, Zeichensetzung und Stil.\n"
            "Wichtig: Inhalte fachlich NICHT verändern, nur sprachlich verbessern. Zahlen/Einheiten nicht ändern.\n"
            "Gib als JSON zurück mit genau diesen Keys:\n"
            "{\n"
            '  "corrected_text": "…",\n'
            '  "notes": ["kurzer Hinweis 1", "kurzer Hinweis 2"]\n'
            "}\n\n"
            f"Text:\n{text}\n"
        )

        out = call_llm_text(llm_config, prompt)
        parsed = _try_parse_json_from_llm(out)
        if isinstance(parsed, dict) and 'corrected_text' in parsed:
            return jsonify({
                'corrected_text': (parsed.get('corrected_text') or '').strip(),
                'notes': parsed.get('notes') if isinstance(parsed.get('notes'), list) else []
            })

        # Fallback: wenn kein JSON zurückkam, nutze Output als korrigierten Text
        return jsonify({'corrected_text': (out or '').strip(), 'notes': []})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/exams')
def list_exams():
    """API: Liste aller Prüfungen (für Dropdown/Öffnen)"""
    try:
        exams = Exam.query.order_by(Exam.date_created.desc()).all()
        return jsonify([{
            'id': e.id,
            'title': e.title,
            'status': e.status,
            'date_created': e.date_created.strftime('%Y-%m-%d')
        } for e in exams])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/exam/<int:exam_id>/rename', methods=['POST'])
def exam_rename(exam_id):
    """API: Titel einer Prüfung ändern"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400
        exam = Exam.query.get_or_404(exam_id)
        title = (request.json.get('title') or '').strip()
        if not title:
            return jsonify({'error': 'Titel darf nicht leer sein'}), 400
        exam.title = title
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/exam/<int:exam_id>/delete', methods=['DELETE'])
def exam_delete(exam_id):
    """API: Prüfung löschen"""
    try:
        exam = Exam.query.get_or_404(exam_id)
        db.session.delete(exam)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/exam/new', methods=['POST'])
def exam_new():
    """Neue Prüfung erstellen"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400
        
        title = request.json.get('title', 'Neue Prüfung')
        if not title or not title.strip():
            title = 'Neue Prüfung'
        
        exam = Exam(title=title.strip(), status='Draft')
        db.session.add(exam)
        db.session.commit()
        return jsonify({'id': exam.id, 'title': exam.title})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/exam/<int:exam_id>/add_question', methods=['POST'])
def exam_add_question(exam_id):
    """Frage zur Prüfung hinzufügen (Snapshot-Pattern!)"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400
        
        exam = Exam.query.get_or_404(exam_id)
        question_id = request.json.get('question_id')
        
        if not question_id:
            return jsonify({'error': 'question_id fehlt'}), 400
        
        question = Question.query.get_or_404(question_id)
        
        # Prüfe ob Frage bereits in Prüfung ist
        existing = ExamItem.query.filter_by(exam_id=exam_id, original_question_id=question_id).first()
        if existing:
            return jsonify({'success': False, 'error': 'Frage ist bereits in dieser Prüfung'}), 400
        
        # Snapshot erstellen: Content und Answer kopieren
        max_position = db.session.query(db.func.max(ExamItem.position)).filter_by(exam_id=exam_id).scalar() or -1
        
        exam_item = ExamItem(
            exam_id=exam_id,
            original_question_id=question_id,
            snapshot_content=question.content or '',  # SNAPSHOT!
            snapshot_answer=question.answer or '',    # SNAPSHOT!
            snapshot_category=question.category or '',
            snapshot_subcategory=question.subcategory or '',
            snapshot_tags=question.tags or '',
            snapshot_difficulty=question.difficulty or 3,
            points=max(1, request.json.get('points', 1)),  # Mindestens 1 Punkt
            position=max_position + 1
        )
        
        db.session.add(exam_item)
        db.session.commit()
        
        return jsonify({'success': True, 'item_id': exam_item.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/exam/<int:exam_id>/remove_item/<int:item_id>', methods=['DELETE'])
def exam_remove_item(exam_id, item_id):
    """Item aus Prüfung entfernen"""
    try:
        item = ExamItem.query.filter_by(id=item_id, exam_id=exam_id).first_or_404()
        db.session.delete(item)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/exam/<int:exam_id>/reorder', methods=['POST'])
def exam_reorder(exam_id):
    """Reihenfolge der Items ändern"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type muss application/json sein'}), 400
        
        item_ids = request.json.get('item_ids', [])
        if not isinstance(item_ids, list):
            return jsonify({'error': 'item_ids muss eine Liste sein'}), 400
        
        for position, item_id in enumerate(item_ids):
            item = ExamItem.query.filter_by(id=item_id, exam_id=exam_id).first()
            if item:
                item.position = position
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/import', methods=['GET', 'POST'])
def import_questions():
    """Dokument (.docx/.pdf) hochladen und Fragen importieren"""
    if request.method == 'GET':
        llm_configs = LLMConfig.query.filter_by(active=True).all()
        default_cfg = LLMConfig.query.filter_by(active=True, is_default=True).first() or (llm_configs[0] if llm_configs else None)
        return render_template('import.html', llm_configs=llm_configs, default_llm_config_id=(default_cfg.id if default_cfg else None))
    
    if 'file' not in request.files:
        flash('Keine Datei ausgewählt', 'error')
        return redirect(url_for('import_questions'))
    
    files = request.files.getlist('file')
    files = [f for f in files if f and f.filename]
    if not files:
        flash('Keine Datei ausgewählt', 'error')
        return redirect(url_for('import_questions'))
    
    use_llm = request.form.get('use_llm') == 'on'
    llm_config_id = request.form.get('llm_config_id', type=int)
    category_default = request.form.get('category', 'Allgemein') or 'Allgemein'

    llm_configs = LLMConfig.query.filter_by(active=True).all()

    imports = []
    any_questions = False

    for f in files:
        if not (f.filename.lower().endswith('.docx') or f.filename.lower().endswith('.pdf')):
            continue

        filename = secure_filename(f.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        try:
            f.save(filepath)
            if not os.path.exists(filepath):
                continue

            text_content = extract_text_from_upload(filepath)

            if use_llm and llm_config_id:
                questions_data = import_from_text_with_llm(text_content, llm_config_id)
            else:
                questions_data = import_from_text_structured(text_content, category_default)

            # Metadaten je Datei
            exam_title = extract_exam_title_heuristic(text_content) or ""
            exam_date = extract_exam_date_heuristic(text_content)
            is_past_exam = False

            if use_llm and llm_config_id:
                llm_config = LLMConfig.query.get_or_404(llm_config_id)
                meta = llm_extract_exam_metadata(llm_config, preprocess_text_for_llm(text_content))
                if meta.get("exam_title"):
                    exam_title = meta["exam_title"]
                if meta.get("exam_date"):
                    exam_date = meta["exam_date"]
                is_past_exam = bool(meta.get("is_past_exam", False))
            else:
                if exam_title and any(k in exam_title.lower() for k in ("prüfung", "klausur", "abschlussprüfung")):
                    is_past_exam = True

            # Quelle ergänzen
            for q in questions_data:
                q['source_file'] = filename

            imports.append({
                "source_file": filename,
                "questions": questions_data,
                "exam_title_prefill": exam_title,
                "exam_date_prefill": exam_date,
                "is_past_exam_prefill": is_past_exam
            })

            if questions_data:
                any_questions = True
        except Exception as e:
            flash(f'Fehler beim Import ({filename}): {str(e)}', 'error')
        finally:
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except:
                pass

    if any_questions:
        # Kategorien/Unterkategorien für Autocomplete im Review bereitstellen
        categories_options = [fr["name"] for fr in BW_FACHRICHTUNGEN]
        sub_from_import = []
        for imp in imports:
            for q in imp.get("questions", []):
                if q.get("subcategory"):
                    sub_from_import.append(q["subcategory"])
        try:
            db_sub = [r[0] for r in db.session.query(Question.subcategory).distinct().all() if r[0]]
        except Exception:
            db_sub = []
        subcategories_options = sorted(set(BW_UNTERKATEGORIEN + db_sub + sub_from_import))

        default_cfg = LLMConfig.query.filter_by(active=True, is_default=True).first() or (llm_configs[0] if llm_configs else None)

        return render_template(
            'import_review.html',
            imports=imports,
            llm_configs=llm_configs,
            llm_config_id=llm_config_id,
            default_llm_config_id=(default_cfg.id if default_cfg else None),
            categories_options=categories_options,
            subcategories_options=subcategories_options
        )
    else:
        flash('Keine Fragen gefunden. Bitte überprüfe das Format der Dateien.', 'error')
    
    return redirect(url_for('import_questions'))


@app.route('/import/save', methods=['POST'])
def save_import():
    """Speichert die überprüften Fragen aus dem Review-Prozess"""
    try:
        data = request.json
        imports = data.get('imports')
        # Backward compatibility: altes Format (single)
        if imports is None:
            imports = [{
                "source_file": "",
                "questions": data.get('questions', []),
                "is_past_exam": data.get('is_past_exam', False),
                "exam_title": data.get('exam_title', ''),
                "exam_date": data.get('exam_date', '')
            }]

        if not imports:
            return jsonify({'success': False, 'error': 'Keine Imports zum Speichern'})

        total_count = 0
        for imp in imports:
            questions = imp.get('questions', [])
            is_past_exam = bool(imp.get('is_past_exam', False))
            exam_title = (imp.get('exam_title') or 'Importierte Prüfung').strip()
            exam_date_str = imp.get('exam_date')

            if not questions:
                continue

            exam = None
            if is_past_exam:
                if not exam_title:
                    return jsonify({'success': False, 'error': 'Prüfungstitel fehlt (bei vergangener Prüfung).'})
                if not exam_date_str:
                    return jsonify({'success': False, 'error': 'Prüfungsdatum fehlt (bei vergangener Prüfung).'})

                exam = Exam(title=exam_title, status='Archived')
                try:
                    exam.date_created = datetime.strptime(exam_date_str, '%Y-%m-%d')
                except:
                    pass
                db.session.add(exam)
                db.session.flush()

            for q_data in questions:
                question = Question(
                    content=q_data.get('content', '').strip(),
                    answer=q_data.get('answer', '').strip(),
                    category=q_data.get('category', ''),
                    category_code=q_data.get('category_code'),
                    subcategory=q_data.get('subcategory', ''),
                    tags=q_data.get('tags', ''),
                    difficulty=q_data.get('difficulty', 3),
                    active=True
                )

                if question.content:
                    db.session.add(question)
                    db.session.flush()
                    total_count += 1

                    if exam:
                        exam_item = ExamItem(
                            exam_id=exam.id,
                            original_question_id=question.id,
                            snapshot_content=question.content,
                            snapshot_answer=question.answer,
                            points=1,
                            position=total_count
                        )
                        db.session.add(exam_item)
        
        db.session.commit()
        flash(f'{total_count} Fragen erfolgreich gespeichert!', 'success')
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})


@app.route('/import/generate_answers', methods=['POST'])
def generate_answers():
    """Generiert fehlende Lösungen per LLM (für Import-Review)."""
    try:
        if not request.is_json:
            return jsonify({'success': False, 'error': 'Content-Type muss application/json sein'}), 400

        data = request.json
        llm_config_id = data.get('llm_config_id')
        items = data.get('questions', [])

        if not llm_config_id:
            return jsonify({'success': False, 'error': 'LLM-Konfiguration fehlt'}), 400
        if not isinstance(items, list) or not items:
            return jsonify({'success': False, 'error': 'Keine Fragen übergeben'}), 400

        llm_config = LLMConfig.query.get_or_404(llm_config_id)

        results = []
        for item in items:
            q = (item.get('content') or '').strip()
            if not q:
                results.append({'answer': ''})
                continue

            prompt = generate_answer_prompt(
                question_html=q,
                category=item.get('category', ''),
                subcategory=item.get('subcategory', '')
            )
            answer = call_llm_text(llm_config, prompt)
            if answer:
                answer = normalize_llm_answer_to_plaintext(answer)
                answer = f"{AI_GENERATED_TOKEN}\n{answer}"
            results.append({'answer': answer})

        return jsonify({'success': True, 'results': results})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def import_from_word(filepath):
    """Legacy: klassischer Import aus docx (nutzt Text-Parser)."""
    current_category = request.form.get('category', 'Allgemein') or 'Allgemein'
    text_content = extract_text_from_word(filepath)
    return import_from_text_structured(text_content, current_category)


def extract_text_from_word(filepath):
    """Extrahiert den gesamten Text aus einem Word-Dokument"""
    doc = Document(filepath)
    text_parts = []
    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text_parts.append(paragraph.text.strip())
    return '\n\n'.join(text_parts)


def import_from_text_with_llm(text_content: str, llm_config_id: int) -> list[dict]:
    """LLM-Import aus bereits extrahiertem Text (PDF oder DOCX)."""
    llm_config = LLMConfig.query.get_or_404(llm_config_id)

    if not (text_content or "").strip():
        raise Exception("Das Dokument enthält keinen Text")

    category = request.form.get('category', 'Allgemein')
    # Unterkategorie-Auswahl: Standard + bereits vorhandene aus DB
    try:
        db_sub = [r[0] for r in db.session.query(Question.subcategory).distinct().all() if r[0]]
    except Exception:
        db_sub = []
    allowed_sub = sorted(set(BW_UNTERKATEGORIEN + db_sub))

    # Vorverarbeitung: wiederholte Zeilen/Leerzeichen reduzieren -> weniger Tokens
    text_content = preprocess_text_for_llm(text_content)
    # Chunking: große Dokumente in kleinere Blöcke teilen -> schneller/robuster, weniger Timeouts
    chunks = chunk_text(text_content, max_chars=12000)

    questions_data: list[dict] = []
    for chunk in chunks:
        questions_data.extend(call_llm_api(llm_config, chunk, category, timeout=240, allowed_subcategories=allowed_sub))

    normalized_questions = []
    for q in questions_data:
        normalized_questions.append({
            'content': q.get('content', '').strip(),
            'answer': q.get('answer', '').strip(),
            'category': q.get('category', category),
            'subcategory': normalize_subcategory(q.get('subcategory', '') or ''),
            'tags': q.get('tags', ''),
            'difficulty': q.get('difficulty', 3)
        })

    # Dedup: gleiche Inhalte zusammenführen (hilft bei Chunk-Overlap)
    seen = set()
    deduped = []
    for q in normalized_questions:
        key = (q.get('content') or '').strip().lower()
        if not key:
            continue
        if key in seen:
            continue
        seen.add(key)
        deduped.append(q)
    return deduped


def call_llm_api(llm_config, text_content, category="Allgemein", timeout: int = 180, allowed_subcategories: list[str] | None = None):
    """Ruft die konfigurierte LLM-API auf und extrahiert Fragen"""
    try:
        headers = {
            'Content-Type': 'application/json'
        }
        
        # API-Key hinzufügen falls vorhanden
        if llm_config.api_key:
            if llm_config.provider == 'openai':
                headers['Authorization'] = f'Bearer {llm_config.api_key}'
            elif llm_config.provider == 'anthropic':
                headers['x-api-key'] = llm_config.api_key
                headers['anthropic-version'] = '2023-06-01'
            else:
                headers['Authorization'] = f'Bearer {llm_config.api_key}'
        
        # Zusätzliche Headers aus JSON parsen
        if llm_config.headers:
            try:
                extra_headers = json.loads(llm_config.headers)
                headers.update(extra_headers)
            except:
                pass
        
        # Prompt erstellen
        if llm_config.prompt_template:
            prompt = llm_config.prompt_template.replace('{text}', text_content).replace('{category}', category)
        else:
            allowed_block = ""
            if allowed_subcategories:
                allowed_block = (
                    "\n\nWähle für \"subcategory\" eine passende Unterkategorie aus dieser Liste:\n"
                + "\n".join([f"- {s}" for s in allowed_subcategories])
                + "\n\nFalls wirklich keine passt, erfinde eine neue, kurze Unterkategorie (max. 3 Wörter).\n"
                )
            prompt = f"""Analysiere folgenden Text und extrahiere alle Prüfungsfragen mit ihren Lösungen.
Ordne jede Frage einer passenden Unterkategorie (Themenbereich) zu.{allowed_block}

Text:
{text_content}

Bitte gib die Fragen und Lösungen im folgenden JSON-Format zurück:
{{
  "questions": [
    {{
      "content": "Die Frage hier",
      "answer": "Die Lösung hier",
      "category": "{category}",
      "subcategory": "Themenbereich",
      "tags": "Tag1, Tag2",
      "difficulty": 3
    }}
  ]
}}

Nur JSON zurückgeben, keine zusätzlichen Erklärungen."""

        # Request-Body je nach Provider
        if llm_config.provider == 'openai':
            body = {
                "model": llm_config.model or "gpt-4",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
        elif llm_config.provider == 'anthropic':
            body = {
                "model": llm_config.model or "claude-3-opus-20240229",
                "max_tokens": 4000,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        else:
            # Custom API - erwartet Standard-Format
            body = {
                "model": llm_config.model,
                "prompt": prompt,
                "temperature": 0.3,
                "max_tokens": 4000
            }
        
        # API-Call
        response = requests.post(
            llm_config.api_url,
            headers=headers,
            json=body,
            timeout=timeout
        )
        response.raise_for_status()
        
        # Response parsen
        data = response.json()
        
        # Response je nach Provider extrahieren
        if llm_config.provider == 'openai':
            content = data['choices'][0]['message']['content']
        elif llm_config.provider == 'anthropic':
            content = data['content'][0]['text']
        else:
            # Custom API - versuche verschiedene Formate
            content = data.get('response') or data.get('text') or data.get('content') or str(data)
        
        # JSON aus Response extrahieren (falls es in Markdown-Code-Blöcken ist)
        content = content.strip()
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()
        
        # JSON parsen mit besserer Fehlerbehandlung
        try:
            result = json.loads(content)
        except json.JSONDecodeError as e:
            # Versuche, JSON-Objekt zu finden falls es in Text eingebettet ist
            import re
            json_match = re.search(r'\{[^{}]*"questions"[^{}]*\[.*?\]', content, re.DOTALL)
            if json_match:
                try:
                    result = json.loads(json_match.group(0))
                except:
                    raise Exception(f"LLM-API Fehler: Konnte JSON nicht parsen. Response: {content[:200]}")
            else:
                raise Exception(f"LLM-API Fehler: Konnte JSON nicht parsen. Response: {content[:200]}")
        
        questions = result.get('questions', [])
        if not isinstance(questions, list):
            raise Exception("LLM-API Fehler: 'questions' ist keine Liste")
        
        return questions
        
    except Exception as e:
        raise Exception(f"LLM-API Fehler: {str(e)}")


def call_llm_text(llm_config, prompt: str) -> str:
    """Ruft die konfigurierte LLM-API auf und gibt reinen Text zurück."""
    try:
        headers = {
            'Content-Type': 'application/json'
        }
        
        # API-Key hinzufügen falls vorhanden
        if llm_config.api_key:
            if llm_config.provider == 'openai':
                headers['Authorization'] = f'Bearer {llm_config.api_key}'
            elif llm_config.provider == 'anthropic':
                headers['x-api-key'] = llm_config.api_key
                headers['anthropic-version'] = '2023-06-01'
            else:
                headers['Authorization'] = f'Bearer {llm_config.api_key}'
        
        # Zusätzliche Headers aus JSON parsen
        if llm_config.headers:
            try:
                extra_headers = json.loads(llm_config.headers)
                headers.update(extra_headers)
            except:
                pass
        
        # Request-Body je nach Provider
        if llm_config.provider == 'openai':
            body = {
                "model": llm_config.model or "gpt-4o",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2
            }
        elif llm_config.provider == 'anthropic':
            body = {
                "model": llm_config.model or "claude-3-5-sonnet-20240620",
                "max_tokens": 1200,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        else:
            # Custom API - erwartet Standard-Format
            body = {
                "model": llm_config.model,
                "prompt": prompt,
                "temperature": 0.2,
                "max_tokens": 1200
            }
        
        response = requests.post(
            llm_config.api_url,
            headers=headers,
            json=body,
            timeout=240
        )
        response.raise_for_status()
        
        data = response.json()
        
        if llm_config.provider == 'openai':
            content = data['choices'][0]['message']['content']
        elif llm_config.provider == 'anthropic':
            content = data['content'][0]['text']
        else:
            content = data.get('response') or data.get('text') or data.get('content') or str(data)
        
        return (content or '').strip()
    except Exception as e:
        raise Exception(f"LLM-API Fehler: {str(e)}")


def generate_answer_prompt(question_html: str, category: str = "", subcategory: str = "") -> str:
    """Prompt für Antwortgenerierung. Output soll nur die fertige Lösung sein."""
    q_text = re.sub(r'<[^>]+>', '', (question_html or '')).strip()
    ctx = []
    if category:
        ctx.append(f"Fachrichtung: {category}")
    if subcategory:
        ctx.append(f"Themenbereich: {subcategory}")
    ctx_block = ("\n".join(ctx) + "\n\n") if ctx else ""
    return (
        f"{ctx_block}"
        "Erstelle eine fachlich korrekte, prüfungstaugliche Musterlösung zur folgenden Prüfungsfrage.\n"
        "Denke intern sorgfältig, gib aber ausschließlich die fertige Lösung aus (ohne Herleitung, ohne Meta-Kommentare).\n"
        "Wenn Annahmen nötig sind, formuliere sie kurz und plausibel.\n\n"
        "WICHTIG: Gib reinen Text aus – KEIN Markdown (keine **, keine Überschriften, keine Codeblöcke) und KEINE LaTeX/Math-Syntax (kein \\( \\), \\[ \\], \\times etc.).\n"
        f"Frage:\n{q_text}\n"
    )


def generate_rewrite_prompt(question_html: str, category: str = "", subcategory: str = "") -> str:
    q_text = re.sub(r'<[^>]+>', '', (question_html or '')).strip()
    ctx = []
    if category:
        ctx.append(f"Fachrichtung: {category}")
    if subcategory:
        ctx.append(f"Themenbereich: {subcategory}")
    ctx_block = ("\n".join(ctx) + "\n\n") if ctx else ""
    return (
        f"{ctx_block}"
        "Formuliere die folgende Prüfungsfrage sprachlich klarer und prüfungstauglich um.\n"
        "Behalte Inhalt und Schwierigkeitsgrad möglichst bei. Gib nur den neuen Fragetext aus.\n\n"
        f"Frage:\n{q_text}\n"
    )


def import_from_word_with_llm(filepath, llm_config_id):
    """Word-Dokument mit LLM analysieren und Fragen extrahieren (Rückgabe als Liste von Dicts)"""
    llm_config = LLMConfig.query.get_or_404(llm_config_id)
    
    # Text aus Word extrahieren
    text_content = extract_text_from_word(filepath)
    
    if not text_content.strip():
        raise Exception("Das Word-Dokument enthält keinen Text")
    
    # LLM aufrufen
    category = request.form.get('category', 'Allgemein')
    questions_data = call_llm_api(llm_config, text_content, category)
    
    # Datenaufbereitung (Normalisierung)
    normalized_questions = []
    for q in questions_data:
        normalized_questions.append({
            'content': q.get('content', '').strip(),
            'answer': q.get('answer', '').strip(),
            'category': q.get('category', category),
            'subcategory': q.get('subcategory', ''),
            'tags': q.get('tags', ''),
            'difficulty': q.get('difficulty', 3)
        })
        
    return normalized_questions


@app.route('/settings', methods=['GET', 'POST'])
def settings():
    """Einstellungsseite für LLM-APIs"""
    if request.method == 'GET':
        try:
            configs = LLMConfig.query.order_by(LLMConfig.date_created.desc()).all()
            return render_template('settings.html', configs=configs)
        except Exception as e:
            flash(f'Fehler beim Laden der Konfigurationen: {str(e)}', 'error')
            return render_template('settings.html', configs=[])
    
    # POST: Neue Konfiguration speichern
    try:
        action = request.form.get('action')
        
        if action == 'create':
            name = request.form.get('name', '').strip()
            api_url = request.form.get('api_url', '').strip()
            
            if not name or not api_url:
                flash('Name und API URL sind erforderlich!', 'error')
                return redirect(url_for('settings'))
            
            config = LLMConfig(
                name=name,
                api_url=api_url,
                api_key=request.form.get('api_key', '').strip(),
                model=request.form.get('model', '').strip(),
                provider=request.form.get('provider', 'custom'),
                headers=request.form.get('headers', '').strip(),
                prompt_template=request.form.get('prompt_template', '').strip(),
                active=request.form.get('active') == 'on',
                is_default=request.form.get('is_default') == 'on'
            )
            if config.is_default:
                config.active = True
            db.session.add(config)
            db.session.commit()
            if config.is_default:
                LLMConfig.query.filter(LLMConfig.id != config.id).update({LLMConfig.is_default: False})
                db.session.commit()
            flash('LLM-Konfiguration erfolgreich erstellt!', 'success')
        
        elif action == 'update':
            config_id = request.form.get('config_id', type=int)
            if not config_id:
                flash('Konfigurations-ID fehlt', 'error')
                return redirect(url_for('settings'))
            
            config = LLMConfig.query.get_or_404(config_id)
            name = request.form.get('name', '').strip()
            api_url = request.form.get('api_url', '').strip()
            
            if not name or not api_url:
                flash('Name und API URL sind erforderlich!', 'error')
                return redirect(url_for('settings'))
            
            config.name = name
            config.api_url = api_url
            config.api_key = request.form.get('api_key', '').strip()
            config.model = request.form.get('model', '').strip()
            config.provider = request.form.get('provider', 'custom')
            config.headers = request.form.get('headers', '').strip()
            config.prompt_template = request.form.get('prompt_template', '').strip()
            config.active = request.form.get('active') == 'on'
            config.is_default = request.form.get('is_default') == 'on'
            if config.is_default:
                config.active = True
            db.session.commit()
            if config.is_default:
                LLMConfig.query.filter(LLMConfig.id != config.id).update({LLMConfig.is_default: False})
                db.session.commit()
            flash('LLM-Konfiguration erfolgreich aktualisiert!', 'success')
        
        elif action == 'delete':
            config_id = request.form.get('config_id', type=int)
            if not config_id:
                flash('Konfigurations-ID fehlt', 'error')
                return redirect(url_for('settings'))
            
            config = LLMConfig.query.get_or_404(config_id)
            was_default = bool(getattr(config, 'is_default', False))
            db.session.delete(config)
            db.session.commit()
            if was_default:
                try:
                    first_active = LLMConfig.query.filter_by(active=True).order_by(LLMConfig.date_created.desc()).first()
                    if first_active:
                        first_active.is_default = True
                        db.session.commit()
                except Exception:
                    db.session.rollback()
            flash('LLM-Konfiguration gelöscht!', 'success')
        
        return redirect(url_for('settings'))
    except Exception as e:
        db.session.rollback()
        flash(f'Fehler: {str(e)}', 'error')
        return redirect(url_for('settings'))


@app.route('/settings/api/<int:config_id>')
def get_api_config(config_id):
    """API: Einzelne Konfiguration abrufen"""
    try:
        config = LLMConfig.query.get_or_404(config_id)
        return jsonify({
            'id': config.id,
            'name': config.name or '',
            'api_url': config.api_url or '',
            'api_key': config.api_key or '',
            'model': config.model or '',
            'provider': config.provider or 'custom',
            'headers': config.headers or '',
            'prompt_template': config.prompt_template or '',
            'active': config.active,
            'is_default': bool(getattr(config, 'is_default', False))
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/settings/test', methods=['POST'])
def test_api_config():
    """API: Verbindung testen"""
    try:
        data = request.json
        
        # Temporäres Config-Objekt erstellen
        config = LLMConfig(
            api_url=data.get('api_url'),
            api_key=data.get('api_key'),
            model=data.get('model'),
            provider=data.get('provider'),
            headers=data.get('headers'),
            prompt_template=data.get('prompt_template')
        )
        
        # Test-Aufruf
        try:
            # Wir nutzen einen sehr einfachen Text
            test_content = "Frage: Was ist 1+1? Lösung: 2"
            questions = call_llm_api(config, test_content, "Test")
            
            return jsonify({
                'success': True, 
                'message': f'Erfolg! {len(questions)} Frage(n) extrahiert.',
                'details': questions
            })
        except Exception as e:
            return jsonify({
                'success': False, 
                'message': f'API-Fehler: {str(e)}'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'System-Fehler: {str(e)}'}), 500



@app.route('/export/<int:exam_id>')
def export_exam(exam_id):
    """Prüfung als Word-Dokument exportieren"""
    exam = Exam.query.get_or_404(exam_id)
    items = ExamItem.query.filter_by(exam_id=exam_id).order_by(ExamItem.position).all()
    
    if not items:
        flash('Die Prüfung enthält keine Fragen. Bitte fügen Sie zuerst Fragen hinzu.', 'error')
        return redirect(url_for('exam_view', exam_id=exam_id))
    
    # Word-Dokument erstellen
    doc = Document()
    
    # Kopfzeile
    header = doc.sections[0].header
    header_para = header.paragraphs[0]
    header_para.text = exam.title
    header_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Titel
    title = doc.add_heading(exam.title, 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Datum
    date_para = doc.add_paragraph(f'Erstellt am: {exam.date_created.strftime("%d.%m.%Y")}')
    date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()  # Leerzeile
    
    # Fragen
    for idx, item in enumerate(items, 1):
        # Frage
        q_heading = doc.add_heading(f'Frage {idx} ({item.points} Punkte)', level=1)
        q_para = doc.add_paragraph()
        # HTML entfernen (einfache Version)
        content = item.snapshot_content
        content = content.replace('<br>', '\n').replace('<br/>', '\n').replace('<br />', '\n')
        content = re.sub(r'<[^>]+>', '', content)  # Entferne alle HTML-Tags
        q_para.add_run(content)
        
        doc.add_paragraph()  # Leerzeile
    
    # Lösungen (neue Seite)
    doc.add_page_break()
    solutions_heading = doc.add_heading('Lösungen', 0)
    solutions_heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()
    
    for idx, item in enumerate(items, 1):
        sol_heading = doc.add_heading(f'Lösung {idx}', level=1)
        sol_para = doc.add_paragraph()
        answer = item.snapshot_answer
        answer = answer.replace('<br>', '\n').replace('<br/>', '\n').replace('<br />', '\n')
        answer = re.sub(r'<[^>]+>', '', answer)  # Entferne alle HTML-Tags
        sol_para.add_run(answer)
        doc.add_paragraph()
    
    # Speichern
    safe_title = re.sub(r'[^\w\s-]', '', exam.title).strip().replace(' ', '_')
    filename = f'exam_{exam_id}_{safe_title}.docx'
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    doc.save(filepath)
    
    return send_file(filepath, as_attachment=True, download_name=filename)


if __name__ == '__main__':
    local_ip = get_local_ip()
    port = 5000
    print(f"\n{'='*60}")
    print(f"HortiExam - Fragenbank für Gartenbau-Prüfungen")
    print(f"{'='*60}")
    print(f"Läuft auf:")
    print(f"  Lokal:    http://127.0.0.1:{port}")
    print(f"  LAN:      http://{local_ip}:{port}")
    print(f"{'='*60}\n")
    
    # Auto-Reload aktiviert für automatische Neustarts bei Dateiänderungen
    # Deaktiviere Reloader wenn HORTIEXAM_NO_RELOAD gesetzt ist (für Desktop-App)
    use_reloader = os.environ.get('HORTIEXAM_NO_RELOAD') != '1'
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=use_reloader)
