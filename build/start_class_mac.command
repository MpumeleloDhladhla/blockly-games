#!/bin/bash
# Thinka Start Class
# Double-click this file to host the class race.
#
# First time on a Mac: if double-click says the file cannot be opened,
# right-click "Start Class (Mac).command", choose Open, then Open.
# After that, this script removes the quarantine flag so the next
# double-click works.

cd "$(dirname "$0")" || exit 1

if command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$0" 2>/dev/null || true
fi

pause() {
  echo ""
  echo "Close this window to end the class."
  if [ -t 0 ]; then
    read -r -p "Press Enter to close... " _
  fi
}

missing_python() {
  echo ""
  echo "Thinka needs Python 3 to host the class race."
  echo "Solo games do not need Python. Double-click START HERE - Thinka Games."
  echo ""
  echo "Install Python 3 for free from:"
  echo "    https://www.python.org/downloads/"
  echo "Then double-click Start Class again."
  pause
  exit 1
}

if [ ! -f "server/serve.py" ]; then
  echo ""
  echo "Start Class must stay in the Thinka Coding Games folder,"
  echo "next to the server folder and game-files."
  pause
  exit 1
fi

PY=""
if command -v python3 >/dev/null 2>&1; then
  if python3 -c 'import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
    PY="python3"
  fi
fi
if [ -z "$PY" ] && command -v python >/dev/null 2>&1; then
  if python -c 'import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
    PY="python"
  fi
fi
if [ -z "$PY" ] && command -v py >/dev/null 2>&1; then
  if py -3 -c 'import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)' >/dev/null 2>&1; then
    PY="py -3"
  fi
fi

if [ -z "$PY" ]; then
  missing_python
fi

export PYTHONUNBUFFERED=1
if [ "$PY" = "py -3" ]; then
  py -3 server/serve.py --classroom --port 8088
else
  "$PY" server/serve.py --classroom --port 8088
fi
status=$?
echo ""
if [ "$status" -ne 0 ]; then
  echo "The class server stopped unexpectedly."
fi
pause
exit "$status"
