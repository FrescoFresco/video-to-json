# Windows one-click installer (ASCII-only for PowerShell 5.1).
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\desktop\windows\install.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root
$Url = "http://127.0.0.1:43141"

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg"
}

function Show-DockerWslHelp {
  Write-Host ""
  Write-Host "Docker necesita WSL2. Haz esto:"
  Write-Host "  1) Cierra esta ventana"
  Write-Host "  2) Abre PowerShell como Administrador"
  Write-Host "  3) Ejecuta:  wsl --install --no-distribution"
  Write-Host "  4) Reinicia el PC"
  Write-Host "  5) Abre Docker Desktop y espera a 'Engine running'"
  Write-Host "  6) Vuelve a Launch.bat o al comando de instalacion"
  Write-Host ""
}

function Test-DockerCli {
  return [bool](Get-Command docker -ErrorAction SilentlyContinue)
}

function Test-DockerEngine {
  if (-not (Test-DockerCli)) { return $false }
  try {
    docker info 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Test-Server {
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Get-DockerDesktopExe {
  $candidates = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Install-DockerDesktop {
  Write-Step "Docker no esta. Intentando instalarlo..."

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "No hay winget. Instala Docker a mano:"
    Write-Host "  https://www.docker.com/products/docker-desktop/"
    exit 1
  }

  Write-Host "Puede pedir Administrador. Espera unos minutos..."
  winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    Write-Host "No se pudo instalar Docker (codigo $LASTEXITCODE)."
    Write-Host "Instalalo a mano: https://www.docker.com/products/docker-desktop/"
    exit 1
  }

  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"

  if (-not (Get-DockerDesktopExe)) {
    Write-Host "Docker instalado. Cierra esta ventana, reinicia si Windows lo pide,"
    Write-Host "abre Docker Desktop una vez y vuelve a lanzar el instalador."
    exit 1
  }

  Write-Host "Docker Desktop instalado."
}

function Start-DockerDesktopAndWait {
  if (Test-DockerEngine) { return }

  $exe = Get-DockerDesktopExe
  if (-not $exe) {
    Write-Host "No encuentro Docker Desktop. Abrelo a mano y vuelve a intentar."
    exit 1
  }

  Write-Step "Arrancando Docker Desktop..."
  Start-Process $exe | Out-Null

  Write-Host "Esperando al motor de Docker (1-2 min)..."
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-DockerEngine) {
      Write-Host "Docker listo."
      return
    }
    Start-Sleep -Seconds 2
  }

  Write-Host "Docker no arranco a tiempo."
  Show-DockerWslHelp
  exit 1
}

Write-Host "Video Extraction Studio"
Write-Host "Carpeta: $Root"

if (Test-Server) {
  Write-Step "Ya esta en marcha. Abriendo navegador..."
  Start-Process $Url
  exit 0
}

if (-not (Test-DockerCli) -and -not (Get-DockerDesktopExe)) {
  Install-DockerDesktop
}

Start-DockerDesktopAndWait

Write-Step "Construyendo y arrancando el Studio (la primera vez tarda)..."
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "Fallo docker compose."
  Show-DockerWslHelp
  exit 1
}

Write-Step "Esperando $Url ..."
for ($i = 0; $i -lt 120; $i++) {
  if (Test-Server) {
    Write-Host "Listo. Abriendo navegador..."
    Start-Process $Url
    Write-Host "Para parar: docker compose down"
    exit 0
  }
  Start-Sleep -Seconds 2
}

Write-Host "Arranco, pero la web aun no responde. Prueba: $Url"
Start-Process $Url
