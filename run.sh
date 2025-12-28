#!/bin/bash
# Start-Skript für HortiExam mit Auto-Reload

cd "$(dirname "$0")"

# Aktiviere venv falls vorhanden
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Stoppe alte Instanz falls vorhanden
pkill -f "python.*app.py" 2>/dev/null
sleep 1

# Starte App mit Auto-Reload
echo "Starte HortiExam mit Auto-Reload..."
python app.py
