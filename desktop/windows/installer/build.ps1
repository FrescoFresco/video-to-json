# Build Windows Setup.exe (run on Windows with Go + Inno Setup 6)
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\desktop\windows\installer\build.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$LauncherDir = Join-Path $Root "desktop\windows\launcher"
$InstallerDir = Join-Path $Root "desktop\windows\installer"
$OutDir = Join-Path $Root "dist\windows"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "==> Compilando launcher .exe"
Push-Location $LauncherDir
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "0"
go build -o (Join-Path $InstallerDir "VideoExtractionStudio.exe") .
Pop-Location

$iscc = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) {
  Write-Host "Inno Setup 6 no encontrado. El .exe del launcher esta en:"
  Write-Host "  $InstallerDir\VideoExtractionStudio.exe"
  Write-Host "Instala Inno Setup 6 para generar el Setup.exe completo."
  exit 0
}

Write-Host "==> Generando instalador con Inno Setup"
& $iscc (Join-Path $InstallerDir "setup.iss")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Listo:"
Write-Host "  $OutDir\VideoExtractionStudio-Setup.exe"
