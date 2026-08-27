$root = $PSScriptRoot

Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", `
  "cd '$root\ml-service'; python -m uvicorn src.prediction_api:app --port 8000"

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", `
  "cd '$root\backend'; npm start"

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList `
  "-NoExit", `
  "-Command", `
  "cd '$root\frontend'; npm run dev"
