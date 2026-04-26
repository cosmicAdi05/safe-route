@echo off
echo Starting SafeRoute AI - All Services...

:: Start ML Engine
start "ML Engine - Port 8000" cmd /k "cd /d "%~dp0ml-engine" && python ml_engine.py"

:: Start Backend
start "Backend - Port 5000" cmd /k "cd /d "%~dp0backend" && node server.js"

:: Wait 3 seconds for backend to be ready
timeout /t 3 /nobreak > nul

:: Start Frontend
start "Frontend - Port 3000" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================
echo   All services starting...
echo   Frontend  -> http://localhost:3000
echo   Backend   -> http://localhost:5000
echo   ML Engine -> http://localhost:8000
echo ========================================
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak > nul
start http://localhost:3000
