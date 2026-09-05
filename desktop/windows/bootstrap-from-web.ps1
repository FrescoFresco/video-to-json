# Instalacion de un solo comando (Windows).
# Pegalo en PowerShell:
#
#   irm https://cdn.jsdelivr.net/gh/FrescoFresco/video-to-json@main/desktop/windows/bootstrap-from-web.ps1 | iex
#
# O, si ya tienes la carpeta del proyecto:
#   powershell -ExecutionPolicy Bypass -File .\desktop\windows\install.ps1

$ErrorActionPreference = "Stop"

# Evita el bloqueo "ejecucion de scripts deshabilitada" en esta sesion
try {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
} catch {}

# codeload es mas fiable que el zip de github.com para PCs sin sesion
$RepoZip = "https://codeload.github.com/FrescoFresco/video-to-json/zip/refs/heads/main"
$InstallDir = Join-Path $env:USERPROFILE "VideoExtractionStudio"

Write-Host ""
Write-Host "Video Extraction Studio - instalacion automatica"
Write-Host "Se descargara en: $InstallDir"
Write-Host ""

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host "Aviso: este PC no tiene winget. Si Docker no esta, habra que instalarlo a mano."
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$ZipPath = Join-Path $env:TEMP "vx-studio-main.zip"
$ExtractRoot = Join-Path $env:TEMP "vx-studio-extract"

Write-Host "Descargando el programa..."
Invoke-WebRequest -Uri $RepoZip -OutFile $ZipPath -UseBasicParsing

if (Test-Path $ExtractRoot) { Remove-Item -Recurse -Force $ExtractRoot }
Expand-Archive -Path $ZipPath -DestinationPath $ExtractRoot -Force

$Unpacked = Get-ChildItem $ExtractRoot -Directory | Select-Object -First 1
if (-not $Unpacked) { throw "No se pudo descomprimir el proyecto." }

Get-ChildItem $Unpacked.FullName | ForEach-Object {
  $dest = Join-Path $InstallDir $_.Name
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  Copy-Item -Recurse -Force $_.FullName $dest
}

Remove-Item -Force $ZipPath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $ExtractRoot -ErrorAction SilentlyContinue

Write-Host "Archivos listos. Arrancando instalacion (Docker + Studio)..."
Write-Host ""

$InstallScript = Join-Path $InstallDir "desktop\windows\install.ps1"
if (-not (Test-Path $InstallScript)) {
  throw "No encuentro $InstallScript. El repo tiene esa ruta?"
}

Set-Location $InstallDir

# Importante: Bypass - en muchos Windows no se pueden ejecutar .ps1 locales
$psi = Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $InstallScript
) -WorkingDirectory $InstallDir -Wait -PassThru -NoNewWindow

if ($psi.ExitCode -ne 0) {
  exit $psi.ExitCode
}
