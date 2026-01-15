#!/bin/bash
# Start-Script für HortiExam Desktop-App
# Startet den Server im Hintergrund und öffnet den Browser

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Log-Datei erstellen
LOG_FILE="$SCRIPT_DIR/hortiexam.log"

# Bestimme Python-Binary und setze Umgebungsvariablen
if [ -d "venv" ] && [ -f "venv/bin/python" ]; then
    PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
    VENV_BIN="$SCRIPT_DIR/venv/bin"
    VENV_LIB="$SCRIPT_DIR/venv/lib"
    # Finde die Python-Version im venv
    PYTHON_VERSION=$(basename "$(ls -d $VENV_LIB/python* 2>/dev/null | head -1)" 2>/dev/null || echo "python3.13")
    VENV_SITE_PACKAGES="$VENV_LIB/$PYTHON_VERSION/site-packages"
else
    PYTHON_BIN="python3"
    VENV_BIN=""
    VENV_SITE_PACKAGES=""
fi

# Stoppe alte Instanz falls vorhanden
pkill -f "python.*app.py" 2>/dev/null
sleep 1

# Starte App im Hintergrund mit Logs und korrekter Umgebung
cd "$SCRIPT_DIR"
# Verwende direkt Python aus venv mit Umgebungsvariablen
if [ -n "$VENV_BIN" ]; then
    nohup env \
        PATH="$VENV_BIN:$PATH" \
        VIRTUAL_ENV="$SCRIPT_DIR/venv" \
        HORTIEXAM_NO_RELOAD=1 \
        "$PYTHON_BIN" "$SCRIPT_DIR/app.py" >> "$LOG_FILE" 2>&1 &
else
    nohup env HORTIEXAM_NO_RELOAD=1 "$PYTHON_BIN" "$SCRIPT_DIR/app.py" >> "$LOG_FILE" 2>&1 &
fi
SERVER_PID=$!

# Warte bis Server läuft (max. 10 Sekunden)
MAX_WAIT=10
WAIT_COUNT=0
SERVER_READY=false

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # Prüfe ob Port 5000 offen ist
    if command -v curl &> /dev/null; then
        if curl -s http://127.0.0.1:5000 > /dev/null 2>&1; then
            SERVER_READY=true
            break
        fi
    elif command -v nc &> /dev/null; then
        if nc -z 127.0.0.1 5000 2>/dev/null; then
            SERVER_READY=true
            break
        fi
    else
        # Fallback: Warte einfach 5 Sekunden
        if [ $WAIT_COUNT -ge 5 ]; then
            SERVER_READY=true
            break
        fi
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

# Prüfe ob Server läuft
if [ "$SERVER_READY" = true ] && ps -p $SERVER_PID > /dev/null 2>&1; then
    # Öffne Browser
    sleep 1
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://127.0.0.1:5000" > /dev/null 2>&1 &
    elif command -v firefox &> /dev/null; then
        firefox "http://127.0.0.1:5000" > /dev/null 2>&1 &
    elif command -v chromium &> /dev/null; then
        chromium "http://127.0.0.1:5000" > /dev/null 2>&1 &
    fi
else
    # Server konnte nicht gestartet werden
    if command -v notify-send &> /dev/null; then
        notify-send "HortiExam" "Server konnte nicht gestartet werden. Siehe Log: $LOG_FILE" 2>/dev/null || true
    fi
fi

# Script beendet sich, Server läuft weiter im Hintergrund
exit 0
