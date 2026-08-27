




$root = Join-Path $PSScriptRoot "main-project"

Write-Host "Starting Flash Flood Prediction System..." -ForegroundColor Cyan

Write-Host "Starting ML service on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", `
    "cd '$root\ml-service'; python -m uvicorn src.prediction_api:app --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2

Write-Host "Starting backend on port 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", `
    "cd '$root\backend'; npm start"

Start-Sleep -Seconds 2

Write-Host "Starting frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", `
    "cd '$root\frontend'; npm run dev"

Write-Host "All services launched." -ForegroundColor Green