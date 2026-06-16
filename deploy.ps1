# WOMS Frontend - local Docker deploy
# Usage:  .\deploy.ps1            (uses default API base)
#         .\deploy.ps1 -ApiBase "https://your-api.com"
param(
  [string]$ApiBase = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "Checking Docker..." -ForegroundColor Cyan
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker is not running. Open Docker Desktop and try again." -ForegroundColor Red
  exit 1
}

$env:NEXT_PUBLIC_API_BASE = $ApiBase
Write-Host "Building and starting (API base: $ApiBase)..." -ForegroundColor Cyan
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed. See output above." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Up and running:  http://localhost:3000" -ForegroundColor Green
Write-Host "Logs:  docker compose logs -f"
Write-Host "Stop:  docker compose down"
