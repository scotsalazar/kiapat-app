@echo off
REM All-in-one script to install dependencies and run Kiapat MVP on Windows.
REM This assumes Python and Node.js are available on your PATH.

cd /d %~dp0
echo [Kiapat] Setting up Python virtual environment...
if not exist server\venv (
    python -m venv server\venv
)
call server\venv\Scripts\activate
echo [Kiapat] Installing backend dependencies...
pip install -r server\requirements.txt

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
start "Kiapat API" cmd /k "cd server && uvicorn app.main:app --host 0.0.0.0 --port %KIAPAT_PORT%"

echo [Kiapat] Setting up frontend...
cd web
if not exist node_modules (
    npm install
)
if not exist .env (
    echo VITE_API_BASE_URL=http://localhost:%KIAPAT_PORT% > .env
)
echo [Kiapat] Starting frontend...
start "Kiapat Web" cmd /k "npm run dev"

echo [Kiapat] Backend running on http://localhost:%KIAPAT_PORT% and frontend on http://localhost:5173
echo Use seeded credentials: admin/admin123 (admin) or driver/pass123 (driver)
