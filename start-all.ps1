$root = $PSScriptRoot

Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", `
  "cd '$root\ml-service'; python -m uvicorn src.prediction_api:app --port 8000"

# 2. Start Backend Service
Write-Host "Launching Node.js Backend Service on port 5000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir/backend'; npm start"

# 3. Start Frontend Service
Write-Host "Launching Vite Frontend Service on port 5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir/frontend'; npm run dev"

Write-Host "All services launched in separate windows." -ForegroundColor Yellow
