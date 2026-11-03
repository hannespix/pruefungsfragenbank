#!/bin/bash
# Start-Skript für HortiExam (Debugger + Auto-Reload nur mit HORTIEXAM_DEBUG=1)

cd "$(dirname "$0")"

# Aktiviere venv falls vorhanden
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Stoppe alte Instanz falls vorhanden
pkill -f "python.*app.py" 2>/dev/null
sleep 1

# Starte App (für Auto-Reload: HORTIEXAM_DEBUG=1 ./run.sh)
echo "Starte HortiExam..."
python app.py
