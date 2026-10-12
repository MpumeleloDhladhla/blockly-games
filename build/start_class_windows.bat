@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PYTHONUNBUFFERED=1"

if not exist "server\serve.py" (
  echo.
  echo Start Class must stay in the Thinka Coding Games folder,
  echo next to the server folder and game-files.
  echo.
  echo Close this window to end the class.
  pause
  exit /b 1
)

set "PY="
where python3 >nul 2>&1
if not errorlevel 1 (
  python3 -c "import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)" >nul 2>&1
  if not errorlevel 1 set "PY=python3"
)
if not defined PY (
  where python >nul 2>&1
  if not errorlevel 1 (
    python -c "import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)" >nul 2>&1
    if not errorlevel 1 set "PY=python"
  )
)
if not defined PY (
  where py >nul 2>&1
  if not errorlevel 1 (
    py -3 -c "import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)" >nul 2>&1
    if not errorlevel 1 set "PY=py -3"
  )
)

if not defined PY goto missing

if "%PY%"=="py -3" (
  py -3 "%~dp0server\serve.py" --classroom --port 8088
) else (
  %PY% "%~dp0server\serve.py" --classroom --port 8088
)
set "STATUS=%ERRORLEVEL%"
echo.
if not "%STATUS%"=="0" echo The class server stopped unexpectedly.
echo Close this window to end the class.
pause
exit /b %STATUS%

:missing
echo.
echo Thinka needs Python 3 to host the class race.
echo Solo games do not need Python. Double-click START HERE - Thinka Games.
echo.
echo Install Python 3 for free from:
echo     https://www.python.org/downloads/
echo Tick "Add python.exe to PATH" in the installer.
echo Then double-click Start Class again.
echo.
echo Close this window to end the class.
pause
exit /b 1
