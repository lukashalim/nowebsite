# One-time setup: clone google-maps-scraper (Botasaurus) and install Python deps.
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$VendorDir = Join-Path $Root "vendor\google-maps-scraper"
$Python = if ($env:PYTHON_EXE) { $env:PYTHON_EXE } else { "python" }

if (-not (Test-Path (Join-Path $VendorDir "src\gmaps.py"))) {
    Write-Host "Cloning google-maps-scraper into $VendorDir ..."
    New-Item -ItemType Directory -Force -Path (Join-Path $Root "vendor") | Out-Null
    git clone --depth 1 https://github.com/BeautyOfProgramming/google-maps-scraper.git $VendorDir
}

Write-Host "Installing Python requirements ..."
& $Python -m pip install -r (Join-Path $Root "requirements.txt")
Write-Host "Done. Vendor: $VendorDir"
