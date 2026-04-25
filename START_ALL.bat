@echo off
title SafeRoutes AI v3.0 — Hackathon Launcher
color 0B
cls

echo.
echo  ███████╗ █████╗ ███████╗███████╗    ██████╗  ██████╗ ██╗   ██╗████████╗███████╗███████╗
echo  ██╔════╝██╔══██╗██╔════╝██╔════╝    ██╔══██╗██╔═══██╗██║   ██║╚══██╔══╝██╔════╝██╔════╝
echo  ███████╗███████║█████╗  █████╗      ██████╔╝██║   ██║██║   ██║   ██║   █████╗  ███████╗
echo  ╚════██║██╔══██║██╔══╝  ██╔══╝      ██╔══██╗██║   ██║██║   ██║   ██║   ██╔══╝  ╚════██║
echo  ███████║██║  ██║██║     ███████╗    ██║  ██║╚██████╔╝╚██████╔╝   ██║   ███████╗███████║
echo  ╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝    ╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚══════╝╚══════╝
echo.
echo  AI-Powered Safety Navigation v3.0 — Hackathon Edition
echo  Features: Orchestration . Time-Risk . Trust Scores . Fake Detection . JWT . Rate-limit
echo  ==========================================================================================
echo.

echo  [INFO] No MongoDB needed — backend runs fully in-memory for demo.
echo.

:: ── Step 1: ML Engine ────────────────────────────────────────────────────────
echo  [1/3] Starting ML Engine (FastAPI on port 8000)...
start "SafeRoutes ML Engine" cmd /k "cd /d %~dp0ml-engine && echo [ML] Starting... && python ml_engine.py"
timeout /t 4 /nobreak >nul
echo         ML Engine starting at http://localhost:8000
echo.

:: ── Step 2: Backend ──────────────────────────────────────────────────────────
echo  [2/3] Starting Backend Orchestrator (Express on port 5000)...
start "SafeRoutes Backend" cmd /k "cd /d %~dp0backend && echo [Backend] Starting... && node server.js"
timeout /t 3 /nobreak >nul
echo         Backend Orchestrator at http://localhost:5000/api/health
echo.

:: ── Step 3: Frontend ─────────────────────────────────────────────────────────
echo  [3/3] Starting Frontend (Next.js on port 3000)...
start "SafeRoutes Frontend" cmd /k "cd /d %~dp0frontend && echo [Frontend] Starting... && npm run dev"
timeout /t 6 /nobreak >nul
echo         Frontend at http://localhost:3000
echo.

echo  ========================================================================
echo.
echo   SERVICE STATUS
echo   --------------
echo   Frontend   ->  http://localhost:3000
echo   Backend    ->  http://localhost:5000/api/health
echo   ML Engine  ->  http://localhost:8000/health
echo.
echo   HACKATHON DEMO CHECKLIST:
echo   [x] Intelligent Orchestration (POST /api/routes/orchestrate)
echo   [x] Time-Based Risk (hour slider -> night risk x1.4)
echo   [x] Live Incident Reporting (POST /api/incidents)
echo   [x] Trust Score System (verified vs guest reporters)
echo   [x] Fake Incident Detection (spam clustering = 90% reduction)
echo   [x] JWT Auth + Rate Limiting + Input Validation
echo   [x] Cost = Distance + (Lambda x Risk)
echo   [x] 3 routes: Fastest / Safest / Balanced
echo.
echo  ========================================================================
echo.

timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"

echo  Browser opening... press any key to close this window.
echo.
pause
