@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo Backend dependencies are missing. Run: cd backend ^&^& npm ci
  pause
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo Frontend build is missing. Run: cd frontend ^&^& npm ci ^&^& npm run build
  pause
  exit /b 1
)

cd /d "%~dp0backend"
echo Opening the application at http://localhost:5000
node src\server.js
pause
