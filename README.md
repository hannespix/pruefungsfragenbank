# HortiExam - Prüfungsfragenbank für Gartenbau

Ein lokales Web-Tool zur Verwaltung von Prüfungsfragen und Erstellung von Klausuren für den Gartenbau. Das Tool kann als einzelne .exe-Datei auf Windows-PCs ohne Admin-Rechte laufen und ist im lokalen Netzwerk (LAN) für Kollegen erreichbar.

## Features

- ✅ **Fragen-Pool Verwaltung**: Import von Fragen aus Word-Dokumenten
- ✅ **Exam Builder**: Visueller Editor zum Zusammenstellen von Prüfungen
- ✅ **Snapshot-Pattern**: Änderungen an Originalfragen beeinflussen bestehende Prüfungen nicht
- ✅ **Word-Export**: Generierung von sauberen Prüfungsdokumenten
- ✅ **LAN-Zugriff**: Erreichbar für alle Kollegen im lokalen Netzwerk
- ✅ **Standalone**: Läuft als einzelne .exe-Datei ohne Installation

## Tech-Stack

- **Python 3.x** mit Flask
- **SQLite** (via SQLAlchemy ORM)
- **Bootstrap 5** (lokal eingebunden, kein CDN)
- **python-docx** für Word-Import/Export
- **PyInstaller** für .exe-Erstellung

## Installation & Entwicklung

### Voraussetzungen

```bash
pip install -r requirements.txt
```

### Entwicklung starten

```bash
python app.py
```

Die Anwendung läuft dann auf:
- **Lokal**: http://127.0.0.1:5000
- **LAN**: http://[DEINE-IP]:5000

Die lokale IP-Adresse wird beim Start angezeigt.

## Build für Windows (.exe)

### Auf Windows:

```bash
build.bat
```

### Auf Linux/Mac (für Windows):

```bash
# PyInstaller muss auf einem Windows-System ausgeführt werden
pyinstaller --name="HortiExam" \
    --onefile \
    --add-data "templates;templates" \
    --add-data "static;static" \
    --hidden-import=flask \
    --hidden-import=sqlalchemy \
    --hidden-import=docx \
    --hidden-import=werkzeug \
    --console \
    app.py
```

Die fertige .exe-Datei befindet sich in `dist/HortiExam.exe`.

## Datenmodell

### Question (Fragen-Pool)
- `id`: Eindeutige ID
- `content`: Fragetext (HTML erlaubt)
- `answer`: Lösungshorizont
- `category`: Kategorie (z.B. "GaLaBau", "Zierpflanzen")
- `tags`: Kommagetrennte Tags
- `difficulty`: Schwierigkeit (1-5)
- `active`: Nur aktive Fragen werden vorgeschlagen

### Exam (Prüfung)
- `id`: Eindeutige ID
- `title`: Titel der Prüfung
- `date_created`: Erstellungsdatum
- `status`: "Draft" oder "Final"

### ExamItem (Prüfungsfrage - **Snapshot-Pattern!**)
- `id`: Eindeutige ID
- `exam_id`: Verweis auf Prüfung
- `original_question_id`: Verweis auf Originalfrage (optional)
- `snapshot_content`: **Kopie** des Inhalts zum Zeitpunkt der Erstellung
- `snapshot_answer`: **Kopie** der Lösung
- `points`: Punkte für diese Frage
- `position`: Reihenfolge in der Prüfung

**Wichtig**: Das Snapshot-Pattern stellt sicher, dass Änderungen an Originalfragen bestehende Prüfungen nicht beeinflussen!

## Word-Import Format

Das Word-Dokument sollte folgendes Format haben:

```
Frage: Was ist Photosynthese?
Lösung: Photosynthese ist der Prozess, bei dem Pflanzen...

Frage: Nennen Sie drei wichtige Nährstoffe für Pflanzen.
Lösung: Stickstoff, Phosphor und Kalium sind...
```

Jede Frage beginnt mit "Frage:" und die zugehörige Lösung mit "Lösung:". Mehrzeilige Fragen und Lösungen werden automatisch erkannt.

## Verwendung

1. **Fragen importieren**: Gehe zu "Import" und lade eine Word-Datei hoch
2. **Prüfung erstellen**: Klicke auf "Neue Prüfung" auf der Hauptseite
3. **Fragen hinzufügen**: Klicke auf "Hinzufügen" bei den gewünschten Fragen
4. **Prüfung exportieren**: Klicke auf "Als Word exportieren"

## Datenbank

Die SQLite-Datenbank wird automatisch im `instance/` Ordner erstellt. Bei der .exe-Version wird sie im gleichen Verzeichnis wie die .exe-Datei erstellt.

## Lizenz

Dieses Projekt ist für den internen Gebrauch entwickelt worden.
