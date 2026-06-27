# Start IAM — stop stale servers, build frontend, run one backend on port 8001
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Read port from .env if present
$port = 8001
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*API_PORT\s*=\s*(\d+)\s*$') { $port = [int]$Matches[1] }
    }
}

$baseUrl = "http://127.0.0.1:$port"

& "$root\stop.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not free port $port. Run .\stop.ps1 or close other terminals first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$root\frontend\dist\index.html")) {
    Write-Host "Frontend not built. Running build..." -ForegroundColor Cyan
    Set-Location "$root\frontend"
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "Starting IAM at $baseUrl" -ForegroundColor Green
Write-Host "  Admin: $baseUrl/admin" -ForegroundColor White
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

Set-Location "$root\backend"
python -m uvicorn server:app --host 127.0.0.1 --port $port
