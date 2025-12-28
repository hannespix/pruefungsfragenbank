@echo off
REM Build-Skript für HortiExam (Windows)

echo HortiExam Build-Skript
echo ======================
echo.

REM Prüfe ob PyInstaller installiert ist
where pyinstaller >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo PyInstaller nicht gefunden. Installiere...
    pip install pyinstaller
)

REM Erstelle Build
echo Erstelle .exe mit PyInstaller...
pyinstaller --name="HortiExam" ^
    --onefile ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    --hidden-import=flask ^
    --hidden-import=sqlalchemy ^
    --hidden-import=docx ^
    --hidden-import=werkzeug ^
    --console ^
    app.py

echo.
echo Build abgeschlossen!
echo Die .exe-Datei befindet sich in: dist\HortiExam.exe
echo.
pause
