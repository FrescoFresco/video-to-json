# Windows one-click installer:
#   1) install Docker Desktop if missing (winget)
#   2) start it and wait for the engine
#   3) build/start the Studio
#   4) open the browser
#
# Usage (double-click Launch.bat, or):
#   powershell -ExecutionPolicy Bypass -File .\desktop\windows\install.ps1
#
# IMPORTANT: ASCII-only file so Windows PowerShell 5.1 does not break on encoding.

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root
$Url = "http://127.0.0.1:43141"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg"
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
  Write-Step "Docker no esta instalado. Intentando instalarlo solo..."

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "No hay winget en este Windows."
    Write-Host "Descarga Docker Desktop a mano:"
    Write-Host "  https://www.docker.com/products/docker-desktop/"
    Write-Host "Luego vuelve a hacer doble clic en Launch.bat."
    exit 1
  }

  Write-Host "Esto puede pedir permiso de administrador y tardar varios minutos."
  winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    Write-Host "winget no pudo instalar Docker Desktop (codigo $LASTEXITCODE)."
    Write-Host "Instalalo a mano y vuelve a lanzar: https://www.docker.com/products/docker-desktop/"
    exit 1
  }

  # After winget, PATH in this session may not see docker yet.
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"

  $exe = Get-DockerDesktopExe
  if (-not $exe) {
    Write-Host ""
    Write-Host "Docker se instalo, pero hace falta cerrar esta ventana y, si Windows lo pide, reiniciar."
    Write-Host "Luego abre Docker Desktop una vez (acepta el aviso) y vuelve a Launch.bat."
    exit 1
  }

  Write-Host "Docker Desktop instalado."
}

function Start-DockerDesktopAndWait {
  if (Test-DockerEngine) { return }

  $exe = Get-DockerDesktopExe
  if (-not $exe) {
    Write-Host "No encuentro Docker Desktop.exe. Abrelo a mano y vuelve a Launch.bat."
    exit 1
  }

  Write-Step "Arrancando Docker Desktop..."
  Start-Process $exe | Out-Null

  Write-Host "Esperando a que el motor de Docker este listo (puede tardar 1-2 min)..."
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-DockerEngine) {
      Write-Host "Docker listo."
      return
    }
    Start-Sleep -Seconds 2
  }

  Write-Host ""
  Write-Host "Docker Desktop no respondio a tiempo."
  Write-Host "Si es la primera instalacion: abre Docker Desktop, completa el asistente"
  Write-Host "(WSL2 / reinicio si lo pide) y vuelve a hacer doble clic en Launch.bat."
  exit 1
}

Write-Host "Video Extraction Studio - un solo paso"
Write-Host "Carpeta: $Root"

if (Test-Server) {
  Write-Step "Ya esta en marcha. Abriendo el navegador..."
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
  Write-Host "Fallo docker compose. Revisa el mensaje de arriba."
  exit 1
}

Write-Step "Esperando $Url ..."
for ($i = 0; $i -lt 120; $i++) {
  if (Test-Server) {
    Write-Host "Listo. Abriendo el navegador..."
    Start-Process $Url
    Write-Host ""
    Write-Host "Para parar mas adelante: docker compose down"
    exit 0
  }
  Start-Sleep -Seconds 2
}

Write-Host "Arranco, pero la web aun no responde. Prueba en unos minutos: $Url"
Start-Process $Url

# rev: update-path-main
