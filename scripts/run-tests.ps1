[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipDbSetup,
    [switch]$SkipLint,
    [switch]$SkipTests,
    [switch]$StartDev
)

$ErrorActionPreference = 'Stop'

function Test-CommandExists {
    param(
        [Parameter(Mandatory = $true)][string]$CommandName
    )

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Command '$CommandName' not found. Install $CommandName or add it to PATH."
    }
}

Test-CommandExists -CommandName 'npm'

if (-not $SkipInstall) {
    Write-Host 'Installing workspace dependencies...' -ForegroundColor Cyan
    npm install
    Write-Host 'Dependencies installed.' -ForegroundColor Green
} else {
    Write-Host 'Skipping dependency installation.' -ForegroundColor Yellow
}

if (-not $SkipDbSetup) {
    Write-Host 'Initializing database schema...' -ForegroundColor Cyan
    npm run db:setup
    Write-Host 'Database ready.' -ForegroundColor Green
} else {
    Write-Host 'Skipping database initialization.' -ForegroundColor Yellow
}

if (-not $SkipLint) {
    Write-Host 'Running workspace lint checks...' -ForegroundColor Cyan
    npm run lint
} else {
    Write-Host 'Skipping lint checks.' -ForegroundColor Yellow
}

if (-not $SkipTests) {
    Write-Host 'Running workspace test suites...' -ForegroundColor Cyan
    npm run test
} else {
    Write-Host 'Skipping test suites.' -ForegroundColor Yellow
}

Write-Host 'Test initialization flow completed.' -ForegroundColor Green

if ($StartDev) {
    Write-Host 'Starting development servers (Ctrl+C to stop)...' -ForegroundColor Cyan
    npm run dev
}
