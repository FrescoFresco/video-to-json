# Single-command Windows install / update.
# Paste in PowerShell:
#
#   powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 | iex"
#
# ASCII-only. Keep UTF-8 WITHOUT BOM (irm | iex on PS 5.1).

$ErrorActionPreference = "Stop"

try {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
} catch {}

$InstallDir = Join-Path $env:USERPROFILE "VideoExtractionStudio"

Write-Host ""
Write-Host "Video Extraction Studio - instalacion / actualizacion"
Write-Host "Carpeta: $InstallDir"
Write-Host ""

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host "Aviso: este PC no tiene winget. Si Docker no esta, habra que instalarlo a mano."
}

# Prefer helpers from the already-installed copy; else download a tiny inline update.
$Helpers = Join-Path $InstallDir "desktop\windows\update-helpers.ps1"
if (Test-Path $Helpers) {
  . $Helpers
  Update-StudioFiles
} else {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $RepoZip = "https://codeload.github.com/FrescoFresco/video-to-json/zip/refs/heads/main"
  $ZipPath = Join-Path $env:TEMP "vx-studio-main.zip"
  $ExtractRoot = Join-Path $env:TEMP "vx-studio-extract"
  Write-Host "Descargando el programa..."
  Invoke-WebRequest -Uri $RepoZip -OutFile $ZipPath -UseBasicParsing
  if (Test-Path $ExtractRoot) { Remove-Item -Recurse -Force $ExtractRoot }
  Expand-Archive -Path $ZipPath -DestinationPath $ExtractRoot -Force
  $Unpacked = Get-ChildItem $ExtractRoot -Directory | Select-Object -First 1
  if (-not $Unpacked) { throw "No se pudo descomprimir el proyecto." }
  Get-ChildItem $Unpacked.FullName | ForEach-Object {
    if ($_.Name -eq "data") { return }
    $dest = Join-Path $InstallDir $_.Name
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Copy-Item -Recurse -Force $_.FullName $dest
  }
  Remove-Item -Force $ZipPath -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $ExtractRoot -ErrorAction SilentlyContinue
  # Save sha using helpers we just installed
  $Helpers2 = Join-Path $InstallDir "desktop\windows\update-helpers.ps1"
  if (Test-Path $Helpers2) {
    . $Helpers2
    $sha = Get-RemoteGitSha
    if ($sha) { Save-LocalGitSha $sha }
  }
}

Write-Host "Archivos listos. Arrancando (Docker + Studio)..."
Write-Host ""

$InstallScript = Join-Path $InstallDir "desktop\windows\install.ps1"
if (-not (Test-Path $InstallScript)) {
  throw "No encuentro $InstallScript"
}

Set-Location $InstallDir
$env:VX_FORCE_REBUILD = "1"
$env:VX_SKIP_UPDATE = "1"

$psi = Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $InstallScript,
  "-ForceRebuild"
) -WorkingDirectory $InstallDir -Wait -PassThru -NoNewWindow

if ($null -ne $psi.ExitCode -and $psi.ExitCode -ne 0) {
  exit $psi.ExitCode
}
