@echo off
setlocal enabledelayedexpansion

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"

set "ROOT=%~dp0"
cd /d "%ROOT%html" || exit /b 1

set "PY=python"
where python >nul 2>nul
if errorlevel 1 set "PY=py -3"

echo Serveur: http://127.0.0.1:%PORT%/loading.html
start "" "http://127.0.0.1:%PORT%/loading.html"

%PY% -m http.server %PORT% --bind 127.0.0.1

pause
