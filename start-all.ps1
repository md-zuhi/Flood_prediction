$projectRoot = Join-Path $PSScriptRoot "main-project"

$mlPath = Join-Path $projectRoot "ml-service"
$backendPath = Join-Path $projectRoot "backend"
$frontendPath = Join-Path $projectRoot "frontend"

Write-Host ""
Write-Host "Starting Flash Flood Prediction System..." -ForegroundColor Cyan
Write-Host ""

# Validate folders first
if (!(Test-Path $mlPath)) {
    Write-Host "ERROR: ML service not found: $mlPath" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $backendPath)) {
    Write-Host "ERROR: Backend not found: $backendPath" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $frontendPath)) {
    Write-Host "ERROR: Frontend not found: $frontendPath" -ForegroundColor Red
    exit 1
}

Write-Host "Starting ML service on port 8000..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", `
    "Set-Location '$mlPath'; python -m uvicorn src.prediction_api:app --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2

Write-Host "Starting backend on port 5000..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", `
    "Set-Location '$backendPath'; npm start"

Start-Sleep -Seconds 2

Write-Host "Starting frontend..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList `
    "-NoExit", `
    "-Command", `
    "Set-Location '$frontendPath'; npm run dev"

Write-Host ""
Write-Host "All services launched." -ForegroundColor Green