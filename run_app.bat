@echo off
title Kiapat All-in-One Runner

REM --- Paths ---
cd /d %~dp0
set "ROOT=%~dp0"
set "SERVER=%ROOT%server"
set "WEB=%ROOT%web"

echo [Kiapat] Setting up Python virtual environment...
if not exist "%SERVER%\venv" (
    python -m venv "%SERVER%\venv"
)

if exist "%SERVER%\venv\Scripts\activate.bat" (
    call "%SERVER%\venv\Scripts\activate.bat"
) else (
    echo [Kiapat][Warning] venv activate.bat not found.
)

echo [Kiapat] Installing backend dependencies...
pip install -r "%SERVER%\requirements.txt"

REM --- Backend port ---
if not defined KIAPAT_PORT (
    if defined PORT (
        set "KIAPAT_PORT=%PORT%"
    ) else (
        set "KIAPAT_PORT=8000"
    )
)

echo [Kiapat] Starting backend on port %KIAPAT_PORT%...
start "Kiapat API" cmd /k cd /d "%SERVER%" ^&^& uvicorn app.main:app --host 0.0.0.0 --port %KIAPAT_PORT%

echo [Kiapat] Setting up frontend...
if not exist "%WEB%\node_modules" (
    pushd "%WEB%"
    npm install
    popd
)

echo VITE_API_BASE_URL=http://localhost:%KIAPAT_PORT% > "%WEB%\.env"

echo [Kiapat] Starting frontend...
start "Kiapat Web" cmd /k cd /d "%WEB%" ^&^& npm run dev

echo [Kiapat] Waiting...
timeout /t 4 > nul

start "" http://localhost:5173/

echo [Kiapat] Done.
