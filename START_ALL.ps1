$root = "C:\Users\bhup7\OneDrive\Desktop\safe route"

Write-Host "Starting SafeRoute AI - All Services..." -ForegroundColor Cyan

# ML Engine
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\ml-engine'; python ml_engine.py" -WindowStyle Normal

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; node server.js" -WindowStyle Normal

# Wait for backend
Start-Sleep -Seconds 3

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Frontend  -> http://localhost:3000" -ForegroundColor Green
Write-Host "  Backend   -> http://localhost:5000" -ForegroundColor Green
Write-Host "  ML Engine -> http://localhost:8000" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# Open browser
Start-Process "http://localhost:3000"
