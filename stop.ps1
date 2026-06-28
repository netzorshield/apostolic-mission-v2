<<<<<<< HEAD
# Stop all IAM backend servers on port 8001
$ErrorActionPreference = "SilentlyContinue"
$port = 8001

Write-Host "Stopping servers on port $port..." -ForegroundColor Yellow

for ($i = 0; $i -lt 6; $i++) {
    $procIds = netstat -ano | Select-String ":$port\s+.*LISTENING" | ForEach-Object {
        ($_.Line -split '\s+')[-1]
    } | Sort-Object -Unique

    if (-not $procIds) {
        Write-Host "Port $port is free." -ForegroundColor Green
        exit 0
    }

    foreach ($procId in $procIds) {
        if ($procId -match '^\d+$') {
            taskkill /F /PID $procId 2>$null | Out-Null
            Write-Host "  Stopped process $procId"
        }
    }
    Start-Sleep -Seconds 1
}

$still = netstat -ano | Select-String ":$port\s+.*LISTENING"
if ($still) {
    Write-Host "Warning: port $port may still be in use. Restart your PC or close other terminals." -ForegroundColor Red
    exit 1
}

Write-Host "Port $port is free." -ForegroundColor Green
=======
# Stop all IAM backend servers on port 8001
$ErrorActionPreference = "SilentlyContinue"
$port = 8001

Write-Host "Stopping servers on port $port..." -ForegroundColor Yellow

for ($i = 0; $i -lt 6; $i++) {
    $procIds = netstat -ano | Select-String ":$port\s+.*LISTENING" | ForEach-Object {
        ($_.Line -split '\s+')[-1]
    } | Sort-Object -Unique

    if (-not $procIds) {
        Write-Host "Port $port is free." -ForegroundColor Green
        exit 0
    }

    foreach ($procId in $procIds) {
        if ($procId -match '^\d+$') {
            taskkill /F /PID $procId 2>$null | Out-Null
            Write-Host "  Stopped process $procId"
        }
    }
    Start-Sleep -Seconds 1
}

$still = netstat -ano | Select-String ":$port\s+.*LISTENING"
if ($still) {
    Write-Host "Warning: port $port may still be in use. Restart your PC or close other terminals." -ForegroundColor Red
    exit 1
}

Write-Host "Port $port is free." -ForegroundColor Green
>>>>>>> 2efb2fb3b6343e2e480f9a79956f4396d0e53fa6
