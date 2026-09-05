# Shared GitHub update helper (ASCII-only, no BOM).
# Downloads latest main into %USERPROFILE%\VideoExtractionStudio
# Does NOT start Docker by itself.

$ErrorActionPreference = "Stop"

$RepoZip = "https://codeload.github.com/FrescoFresco/video-to-json/zip/refs/heads/main"
$CommitsApi = "https://api.github.com/repos/FrescoFresco/video-to-json/commits/main"
$InstallDir = Join-Path $env:USERPROFILE "VideoExtractionStudio"
$ShaFile = Join-Path $InstallDir "data\.vx-git-sha"

function Get-RemoteGitSha {
  try {
    $headers = @{ "User-Agent" = "VideoExtractionStudio" }
    $json = Invoke-RestMethod -Uri $CommitsApi -Headers $headers -TimeoutSec 12
    if ($json.sha) { return [string]$json.sha }
  } catch {}
  return $null
}

function Get-LocalGitSha {
  if (Test-Path $ShaFile) {
    try { return (Get-Content -Path $ShaFile -Raw -ErrorAction Stop).Trim() } catch {}
  }
  return ""
}

function Save-LocalGitSha([string]$sha) {
  if (-not $sha) { return }
  $dir = Split-Path -Parent $ShaFile
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Set-Content -Path $ShaFile -Value $sha -Encoding ASCII
}

function Test-UpdateAvailable {
  $remote = Get-RemoteGitSha
  if (-not $remote) { return $false }
  $local = Get-LocalGitSha
  if (-not $local) { return $true }
  return ($remote -ne $local)
}

function Write-ProgressLine([string]$label, [int]$percent) {
  if ($percent -lt 0) { $percent = 0 }
  if ($percent -gt 100) { $percent = 100 }
  $filled = [int]([math]::Round($percent / 5))
  if ($filled -gt 20) { $filled = 20 }
  $bar = ("#" * $filled) + ("-" * (20 - $filled))
  Write-Host ("  [{0}] {1,3}%  {2}" -f $bar, $percent, $label)
}

function Update-StudioFiles {
  Write-Host ""
  Write-Host "========================================"
  Write-Host "  Actualizando archivos del Studio"
  Write-Host "========================================"
  Write-ProgressLine "preparando descarga" 5
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $ZipPath = Join-Path $env:TEMP "vx-studio-main.zip"
  $ExtractRoot = Join-Path $env:TEMP "vx-studio-extract"

  Write-ProgressLine "descargando desde GitHub (puede tardar)" 20
  Invoke-WebRequest -Uri $RepoZip -OutFile $ZipPath -UseBasicParsing
  Write-ProgressLine "descarga lista" 55

  if (Test-Path $ExtractRoot) { Remove-Item -Recurse -Force $ExtractRoot }
  Write-ProgressLine "descomprimiendo" 65
  Expand-Archive -Path $ZipPath -DestinationPath $ExtractRoot -Force

  $Unpacked = Get-ChildItem $ExtractRoot -Directory | Select-Object -First 1
  if (-not $Unpacked) { throw "No se pudo descomprimir el proyecto." }

  Write-ProgressLine "copiando archivos" 80
  # Keep local data/ (jobs, config) - only replace files that come from the zip.
  Get-ChildItem $Unpacked.FullName | ForEach-Object {
    if ($_.Name -eq "data") { return }
    $dest = Join-Path $InstallDir $_.Name
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Copy-Item -Recurse -Force $_.FullName $dest
  }

  Remove-Item -Force $ZipPath -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $ExtractRoot -ErrorAction SilentlyContinue

  $sha = Get-RemoteGitSha
  if ($sha) { Save-LocalGitSha $sha }
  Write-ProgressLine "archivos actualizados" 100
  Write-Host "  Listo."
}
