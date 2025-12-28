#!/bin/bash
# Build-Skript für HortiExam

echo "HortiExam Build-Skript"
echo "======================"
echo ""

# Prüfe ob PyInstaller installiert ist
if ! command -v pyinstaller &> /dev/null; then
    echo "PyInstaller nicht gefunden. Installiere..."
    pip install pyinstaller
fi

# Erstelle Build
echo "Erstelle .exe mit PyInstaller..."
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

echo ""
echo "Build abgeschlossen!"
echo "Die .exe-Datei befindet sich in: dist/HortiExam.exe"
echo ""
echo "Hinweis: Für Windows-Builds sollte dieser Befehl auf einem Windows-System ausgeführt werden."
