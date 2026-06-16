@echo off
REM WOMS Frontend - local Docker deploy
REM Usage:  deploy.bat                      (default API base)
REM         deploy.bat https://your-api.com (custom API base)

cd /d "%~dp0"

if not "%~1"=="" (
  set "NEXT_PUBLIC_API_BASE=%~1"
) else (
  set "NEXT_PUBLIC_API_BASE=http://localhost:8000"
)

echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker is not running. Open Docker Desktop and try again.
  pause
  exit /b 1
)

echo Building and starting (API base: %NEXT_PUBLIC_API_BASE%)...
docker compose up --build -d
if errorlevel 1 (
  echo Deploy failed. See output above.
  pause
  exit /b 1
)

echo.
echo Up and running:  http://localhost:3000
echo Logs:  docker compose logs -f
echo Stop:  docker compose down
pause
