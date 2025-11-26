param(
    [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

Write-Host "=== Plantelligence :: Local Startup ===" -ForegroundColor Cyan

if (-not (Test-Path "$repoRoot\backend\.env")) {
    Write-Error "Missing backend/.env. Copy backend/.env.example and configure secrets before running."
}

if (-not (Test-Path "$repoRoot\backend\firebase-admin.json")) {
    Write-Error "Missing backend/firebase-admin.json. Place your Firebase service-account JSON there."
}

if (-not $NoInstall) {
    Write-Host "Installing workspace dependencies (npm install)..." -ForegroundColor Yellow
    npm install
}

Write-Host "Launching backend + frontend dev servers (npm run dev)..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop both processes." -ForegroundColor DarkGray

npm run dev
