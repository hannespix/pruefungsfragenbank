# HortiExam - Fragenbank für Gartenbau-Prüfungen

Ein lokales Web-Tool zur Verwaltung von Prüfungsfragen und Erstellung von Klausuren für den Gartenbau. Das Tool kann als einzelne .exe-Datei auf Windows-PCs ohne Admin-Rechte laufen und ist im lokalen Netzwerk (LAN) für Kollegen erreichbar.

## Features

- ✅ **Fragen-Pool Verwaltung**: Import von Fragen aus Word-Dokumenten
- ✅ **LLM-Integration**: Beliebige Word-Dateien mit KI analysieren (OpenAI, Anthropic, Custom APIs)
- ✅ **Flexible API-Konfiguration**: Unterstützung für beliebige LLM-APIs über Einstellungsseite
- ✅ **Exam Builder**: Visueller Editor zum Zusammenstellen von Prüfungen
- ✅ **Snapshot-Pattern**: Änderungen an Originalfragen beeinflussen bestehende Prüfungen nicht
- ✅ **Word-Export**: Generierung von sauberen Prüfungsdokumenten
- ✅ **LAN-Zugriff**: Erreichbar für alle Kollegen im lokalen Netzwerk
- ✅ **Standalone**: Läuft als einzelne .exe-Datei ohne Installation
- ✅ **Premium Design**: Catppuccin Farbschema mit Glassmorphism-Effekten

## Tech-Stack

- **Python 3.x** mit Flask
- **SQLite** (via SQLAlchemy ORM)
- **Bootstrap 5** (lokal eingebunden, kein CDN)
- **python-docx** für Word-Import/Export
- **PyInstaller** für .exe-Erstellung
- **requests** für LLM-API-Integration

## Installation & Entwicklung

### Voraussetzungen

```bash
pip install -r requirements.txt
```

### Entwicklung starten

**Mit Auto-Reload (empfohlen für Entwicklung):**
```bash
python app.py
```

Oder mit dem Start-Skript:
```bash
./run.sh
```

Die Anwendung läuft dann auf:
- **Lokal**: http://127.0.0.1:5000
- **LAN**: http://[DEINE-IP]:5000

Die lokale IP-Adresse wird beim Start angezeigt.

**Hinweis**: Im Debug-Modus (Standard) lädt die App automatisch neu, wenn Dateien geändert werden. Kein manueller Neustart nötig!

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

### LLMConfig (LLM-API Konfiguration)
- `id`: Eindeutige ID
- `name`: Name der Konfiguration
- `api_url`: API-Endpoint URL
- `api_key`: API-Key (optional)
- `model`: Modell-Name
- `provider`: "openai", "anthropic", oder "custom"
- `headers`: Zusätzliche Headers (JSON)
- `prompt_template`: Custom Prompt Template
- `active`: Aktive Konfiguration

## Word-Import

### Methode 1: Klassischer Import (strukturiertes Format)

Das Word-Dokument sollte folgendes Format haben:

```
Frage: Was ist Photosynthese?
Lösung: Photosynthese ist der Prozess, bei dem Pflanzen...

Frage: Nennen Sie drei wichtige Nährstoffe für Pflanzen.
Lösung: Stickstoff, Phosphor und Kalium sind...
```

Jede Frage beginnt mit "Frage:" und die zugehörige Lösung mit "Lösung:". Mehrzeilige Fragen und Lösungen werden automatisch erkannt.

### Methode 2: LLM-basierter Import (empfohlen für beliebige Dateien)

Mit einer konfigurierten LLM-API können **beliebige Word-Dateien** importiert werden. Das LLM analysiert den Text automatisch und extrahiert Fragen und Lösungen, auch wenn sie nicht in einem speziellen Format vorliegen.

**Vorteile:**
- Funktioniert mit jedem Word-Dokument
- Erkennt Fragen automatisch aus Fließtext
- Kann auch aus Lehrbüchern oder Skripten Fragen generieren

**Konfiguration:**
1. Gehe zu "Einstellungen" → "Neue Konfiguration"
2. Wähle einen Provider (OpenAI, Anthropic, oder Custom)
3. Gib API-URL und API-Key ein
4. Beim Import: Aktiviere "LLM-basierte Analyse"

## Verwendung

1. **LLM-API konfigurieren** (optional, für intelligente Importe):
   - Gehe zu "Einstellungen"
   - Erstelle eine neue LLM-Konfiguration (OpenAI, Anthropic, oder Custom API)
   - Gib API-URL und API-Key ein

2. **Fragen importieren**:
   - Gehe zu "Import" und lade eine Word-Datei hoch
   - Wähle zwischen klassischem Import (strukturiertes Format) oder LLM-basiertem Import (beliebige Dateien)

3. **Prüfung erstellen**: Klicke auf "Neue Prüfung" auf der Hauptseite

4. **Fragen hinzufügen**: Klicke auf "Hinzufügen" bei den gewünschten Fragen

5. **Prüfung exportieren**: Klicke auf "Als Word exportieren"

## Datenbank

Die SQLite-Datenbank wird automatisch im `instance/` Ordner erstellt. Bei der .exe-Version wird sie im gleichen Verzeichnis wie die .exe-Datei erstellt.

## Entwicklung

### Auto-Reload

Die App läuft standardmäßig im Debug-Modus mit Auto-Reload. Änderungen an Python-Dateien, Templates oder CSS werden automatisch erkannt und die App startet neu. Kein manueller Neustart nötig!

### Datei-Änderungen werden automatisch erkannt:
- ✅ Python-Dateien (.py)
- ✅ Templates (.html)
- ✅ CSS-Dateien (.css)
- ✅ JavaScript-Dateien (.js)

## Lizenz

Dieses Projekt ist für den internen Gebrauch entwickelt worden.
