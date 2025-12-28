import os
import sys
import socket
import re
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, send_file
from werkzeug.utils import secure_filename
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from models import db, Question, Exam, ExamItem

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


@app.route('/')
def index():
    """Hauptseite - Exam Builder"""
    exams = Exam.query.order_by(Exam.date_created.desc()).all()
    return render_template('index.html', exams=exams)


@app.route('/questions')
def questions():
    """API: Liste aller Fragen (filterbar)"""
    category = request.args.get('category', '')
    tag = request.args.get('tag', '')
    difficulty = request.args.get('difficulty', type=int)
    active_only = request.args.get('active_only', 'true') == 'true'
    
    query = Question.query
    
    if active_only:
        query = query.filter(Question.active == True)
    if category:
        query = query.filter(Question.category == category)
    if tag:
        query = query.filter(Question.tags.contains(tag))
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    
    questions = query.order_by(Question.date_created.desc()).all()
    
    return jsonify([{
        'id': q.id,
        'content': q.content,
        'answer': q.answer,
        'category': q.category,
        'tags': q.tags.split(',') if q.tags else [],
        'difficulty': q.difficulty,
        'active': q.active
    } for q in questions])


@app.route('/exam/<int:exam_id>')
def exam_view(exam_id):
    """Ansicht einer Prüfung"""
    exam = Exam.query.get_or_404(exam_id)
    return render_template('exam.html', exam=exam)


@app.route('/exam/<int:exam_id>/items')
def exam_items(exam_id):
    """API: Items einer Prüfung"""
    exam = Exam.query.get_or_404(exam_id)
    items = ExamItem.query.filter_by(exam_id=exam_id).order_by(ExamItem.position).all()
    
    return jsonify([{
        'id': item.id,
        'content': item.snapshot_content,
        'answer': item.snapshot_answer,
        'points': item.points,
        'position': item.position,
        'original_question_id': item.original_question_id
    } for item in items])


@app.route('/exam/new', methods=['POST'])
def exam_new():
    """Neue Prüfung erstellen"""
    title = request.json.get('title', 'Neue Prüfung')
    exam = Exam(title=title, status='Draft')
    db.session.add(exam)
    db.session.commit()
    return jsonify({'id': exam.id, 'title': exam.title})


@app.route('/exam/<int:exam_id>/add_question', methods=['POST'])
def exam_add_question(exam_id):
    """Frage zur Prüfung hinzufügen (Snapshot-Pattern!)"""
    exam = Exam.query.get_or_404(exam_id)
    question_id = request.json.get('question_id')
    
    question = Question.query.get_or_404(question_id)
    
    # Snapshot erstellen: Content und Answer kopieren
    max_position = db.session.query(db.func.max(ExamItem.position)).filter_by(exam_id=exam_id).scalar() or -1
    
    exam_item = ExamItem(
        exam_id=exam_id,
        original_question_id=question_id,
        snapshot_content=question.content,  # SNAPSHOT!
        snapshot_answer=question.answer,    # SNAPSHOT!
        points=request.json.get('points', 1),
        position=max_position + 1
    )
    
    db.session.add(exam_item)
    db.session.commit()
    
    return jsonify({'success': True, 'item_id': exam_item.id})


@app.route('/exam/<int:exam_id>/remove_item/<int:item_id>', methods=['DELETE'])
def exam_remove_item(exam_id, item_id):
    """Item aus Prüfung entfernen"""
    item = ExamItem.query.filter_by(id=item_id, exam_id=exam_id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/exam/<int:exam_id>/reorder', methods=['POST'])
def exam_reorder(exam_id):
    """Reihenfolge der Items ändern"""
    item_ids = request.json.get('item_ids', [])
    for position, item_id in enumerate(item_ids):
        item = ExamItem.query.filter_by(id=item_id, exam_id=exam_id).first()
        if item:
            item.position = position
    db.session.commit()
    return jsonify({'success': True})


@app.route('/import', methods=['GET', 'POST'])
def import_questions():
    """Word-Dokument hochladen und Fragen importieren"""
    if request.method == 'GET':
        return render_template('import.html')
    
    if 'file' not in request.files:
        flash('Keine Datei ausgewählt', 'error')
        return redirect(url_for('import_questions'))
    
    file = request.files['file']
    if file.filename == '':
        flash('Keine Datei ausgewählt', 'error')
        return redirect(url_for('import_questions'))
    
    if file and file.filename.endswith('.docx'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            count = import_from_word(filepath)
            flash(f'{count} Fragen erfolgreich importiert!', 'success')
        except Exception as e:
            flash(f'Fehler beim Import: {str(e)}', 'error')
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    
    return redirect(url_for('import_questions'))


def import_from_word(filepath):
    """Word-Dokument einlesen und Fragen extrahieren"""
    doc = Document(filepath)
    count = 0
    current_question = None
    current_answer = None
    current_category = request.form.get('category', 'Allgemein')
    
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        
        # Ignoriere leere Zeilen
        if not text:
            continue
        
        # Frage erkennen (verschiedene Formate)
        if text.lower().startswith('frage:') or text.startswith('FRAGE:'):
            # Vorherige Frage speichern
            if current_question and current_answer:
                question = Question(
                    content=current_question.strip(),
                    answer=current_answer.strip(),
                    category=current_category,
                    active=True
                )
                db.session.add(question)
                count += 1
            
            # Neue Frage beginnen
            current_question = text.replace('Frage:', '').replace('FRAGE:', '').replace('frage:', '').strip()
            current_answer = None
        
        # Lösung erkennen (verschiedene Formate)
        elif text.lower().startswith('lösung:') or text.startswith('LÖSUNG:') or text.lower().startswith('loesung:'):
            if current_question:
                current_answer = text.replace('Lösung:', '').replace('LÖSUNG:', '').replace('lösung:', '').replace('Loesung:', '').strip()
            else:
                # Lösung ohne vorherige Frage - überspringen
                continue
        
        # Weiterer Text zur Frage oder Lösung
        elif current_question and not current_answer:
            # Weiterer Text zur Frage
            if current_question:
                current_question += '<br>' + text
        elif current_answer:
            # Weiterer Text zur Lösung
            current_answer += '<br>' + text
    
    # Letzte Frage speichern
    if current_question and current_answer:
        question = Question(
            content=current_question.strip(),
            answer=current_answer.strip(),
            category=current_category,
            active=True
        )
        db.session.add(question)
        count += 1
    
    db.session.commit()
    return count


@app.route('/export/<int:exam_id>')
def export_exam(exam_id):
    """Prüfung als Word-Dokument exportieren"""
    exam = Exam.query.get_or_404(exam_id)
    items = ExamItem.query.filter_by(exam_id=exam_id).order_by(ExamItem.position).all()
    
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
    filename = f'exam_{exam_id}_{exam.title.replace(" ", "_")}.docx'
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    doc.save(filepath)
    
    return send_file(filepath, as_attachment=True, download_name=filename)


if __name__ == '__main__':
    local_ip = get_local_ip()
    port = 5000
    print(f"\n{'='*60}")
    print(f"HortiExam läuft auf:")
    print(f"  Lokal:    http://127.0.0.1:{port}")
    print(f"  LAN:      http://{local_ip}:{port}")
    print(f"{'='*60}\n")
    
    app.run(host='0.0.0.0', port=port, debug=False)
