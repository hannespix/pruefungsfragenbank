#!/bin/bash
# Wrapper-Script das das venv aktiviert und dann app.py startet
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Aktiviere venv und setze Umgebungsvariablen
if [ -f "$SCRIPT_DIR/venv/bin/activate" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
fi

# Setze Umgebungsvariablen explizit
export HORTIEXAM_NO_RELOAD=1
export PATH="$SCRIPT_DIR/venv/bin:$PATH"
export VIRTUAL_ENV="$SCRIPT_DIR/venv"

# Verwende Python aus venv
PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi

exec "$PYTHON_BIN" "$SCRIPT_DIR/app.py"
