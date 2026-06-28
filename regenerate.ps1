<<<<<<< HEAD
# Regenerate IAM — full clean + fresh build + start
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "=== IAM Clean Regeneration ===" -ForegroundColor Cyan

& "$root\stop.ps1"

$remove = @(
    "$root\.pytest_cache",
    "$root\test_reports",
    "$root\frontend\legacy",
    "$root\frontend\dist",
    "$root\backend\__pycache__",
    "$root\backend\tests\__pycache__",
    "$root\backend\test.pdf"
)
foreach ($path in $remove) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "Removed $path" -ForegroundColor DarkGray
    }
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Set-Location "$root\backend"
pip install -r requirements.txt -q

Write-Host "Building frontend..." -ForegroundColor Cyan
Set-Location "$root\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== Ready ===" -ForegroundColor Green
Write-Host "Run:  .\start.ps1" -ForegroundColor White
Write-Host "Open: http://127.0.0.1:8001/admin" -ForegroundColor White
=======
# Regenerate IAM — full clean + fresh build + start
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "=== IAM Clean Regeneration ===" -ForegroundColor Cyan

& "$root\stop.ps1"

$remove = @(
    "$root\.pytest_cache",
    "$root\test_reports",
    "$root\frontend\legacy",
    "$root\frontend\dist",
    "$root\backend\__pycache__",
    "$root\backend\tests\__pycache__",
    "$root\backend\test.pdf"
)
foreach ($path in $remove) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "Removed $path" -ForegroundColor DarkGray
    }
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Set-Location "$root\backend"
pip install -r requirements.txt -q

Write-Host "Building frontend..." -ForegroundColor Cyan
Set-Location "$root\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== Ready ===" -ForegroundColor Green
Write-Host "Run:  .\start.ps1" -ForegroundColor White
Write-Host "Open: http://127.0.0.1:8001/admin" -ForegroundColor White
>>>>>>> 2efb2fb3b6343e2e480f9a79956f4396d0e53fa6
