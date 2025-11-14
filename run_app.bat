@echo off
REM All-in-one script to install dependencies and run Kiapat MVP on Windows.
REM This assumes Python and Node.js are available on your PATH.

cd /d %~dp0
set "PROJECT_ROOT=%~dp0"
set "SERVER_DIR=%PROJECT_ROOT%server"
set "WEB_DIR=%PROJECT_ROOT%web"
set "VENV_DIR=%SERVER_DIR%\venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

echo [Kiapat] Setting up Python virtual environment...
pushd "%SERVER_DIR%"
if not exist "%VENV_DIR%" (
    python -m venv "%VENV_DIR%"
)
if exist "%VENV_DIR%\Scripts\activate.bat" (
    call "%VENV_DIR%\Scripts\activate.bat"
) else (
    echo [Kiapat][Warning] Could not find virtual environment activation script. >&2
    echo              Continuing with the system Python. >&2
)
echo [Kiapat] Installing backend dependencies...
"%VENV_PY%" -m pip install -r requirements.txt
popd

REM Seed environment variables; adjust as necessary
set SEED_TOKEN=seed-secret
set CORS_ALLOWED_ORIGINS=http://localhost:5173

REM Determine backend port, defaulting to 8000 unless overridden
if not defined KIAPAT_PORT (
    if defined PORT (
        set "KIAPAT_PORT=%PORT%"
    ) else (
        set "KIAPAT_PORT=8000"
    )
)

echo [Kiapat] Starting backend on port %KIAPAT_PORT%...
start "Kiapat API" cmd /k "cd /d \"%SERVER_DIR%\" && \"%VENV_PY%\" -m uvicorn app.main:app --host 0.0.0.0 --port %KIAPAT_PORT%"

echo [Kiapat] Setting up frontend...
pushd "%WEB_DIR%"
if not exist node_modules (
    npm install
)
echo VITE_API_BASE_URL=http://localhost:%KIAPAT_PORT% > .env
popd
echo [Kiapat] Starting frontend...
start "Kiapat Web" cmd /k "cd /d \"%WEB_DIR%\" && npm run dev"

REM Give the dev servers a moment to boot before launching the browser
echo [Kiapat] Waiting for services to boot before opening the browser...
timeout /t 5 > nul
start "Kiapat App" http://localhost:5173/

echo [Kiapat] Backend running on http://localhost:%KIAPAT_PORT% and frontend on http://localhost:5173
echo [Kiapat] A browser window should now be open at the frontend URL.
echo Use seeded credentials: admin/admin123 (admin) or driver/pass123 (driver)
