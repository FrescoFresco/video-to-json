# Instalación de un solo comando (Windows).
# Pégalo en PowerShell:
#
#   irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 | iex
#
# O, si ya tienes la carpeta del proyecto:
#   powershell -ExecutionPolicy Bypass -File .\desktop\windows\install.ps1

$ErrorActionPreference = "Stop"

$RepoZip = "https://github.com/FrescoFresco/video-to-json/archive/refs/heads/main.zip"
$InstallDir = Join-Path $env:USERPROFILE "VideoExtractionStudio"

Write-Host ""
Write-Host "Video Extraction Studio — instalación automática"
Write-Host "Se descargará en: $InstallDir"
Write-Host ""

# winget a veces hace falta para Docker; avisamos pronto
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host "Aviso: este PC no tiene winget. Si Docker no está, habrá que instalarlo a mano."
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$ZipPath = Join-Path $env:TEMP "vx-studio-main.zip"
$ExtractRoot = Join-Path $env:TEMP "vx-studio-extract"

Write-Host "Descargando el programa…"
Invoke-WebRequest -Uri $RepoZip -OutFile $ZipPath -UseBasicParsing

if (Test-Path $ExtractRoot) { Remove-Item -Recurse -Force $ExtractRoot }
Expand-Archive -Path $ZipPath -DestinationPath $ExtractRoot -Force

$Unpacked = Get-ChildItem $ExtractRoot -Directory | Select-Object -First 1
if (-not $Unpacked) { throw "No se pudo descomprimir el proyecto." }

# Copia/actualiza en la carpeta fija del usuario
Get-ChildItem $Unpacked.FullName | ForEach-Object {
  $dest = Join-Path $InstallDir $_.Name
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  Copy-Item -Recurse -Force $_.FullName $dest
}

Remove-Item -Force $ZipPath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $ExtractRoot -ErrorAction SilentlyContinue

Write-Host "Archivos listos. Arrancando instalación (Docker + Studio)…"
Write-Host ""

$InstallScript = Join-Path $InstallDir "desktop\windows\install.ps1"
if (-not (Test-Path $InstallScript)) {
  throw "No encuentro $InstallScript. ¿El repo tiene esa ruta?"
}

Set-Location $InstallDir
& $InstallScript
