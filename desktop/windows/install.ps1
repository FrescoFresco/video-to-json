# Bootstrap Windows de un solo clic:
#   1) instala Docker Desktop si falta (winget)
#   2) lo arranca y espera al motor
#   3) construye/levanta el Studio
#   4) abre el navegador
#
# Uso (doble clic en Launch.bat, o desde la raíz):
#   powershell -ExecutionPolicy Bypass -File .\desktop\windows\install.ps1

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
  Write-Step "Docker no está instalado. Intentando instalarlo solo…"

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
    Write-Host "winget no pudo instalar Docker Desktop (código $LASTEXITCODE)."
    Write-Host "Instálalo a mano y vuelve a lanzar: https://www.docker.com/products/docker-desktop/"
    exit 1
  }

  # Tras winget, el PATH de esta sesión a veces no ve aún "docker".
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"

  $exe = Get-DockerDesktopExe
  if (-not $exe) {
    Write-Host ""
    Write-Host "Docker se instaló, pero hace falta cerrar esta ventana y, si Windows lo pide, reiniciar."
    Write-Host "Luego abre Docker Desktop una vez (acepta el aviso) y vuelve a Launch.bat."
    exit 1
  }

  Write-Host "Docker Desktop instalado."
}

function Start-DockerDesktopAndWait {
  if (Test-DockerEngine) { return }

  $exe = Get-DockerDesktopExe
  if (-not $exe) {
    Write-Host "No encuentro Docker Desktop.exe. Ábrelo a mano y vuelve a Launch.bat."
    exit 1
  }

  Write-Step "Arrancando Docker Desktop…"
  Start-Process $exe | Out-Null

  Write-Host "Esperando a que el motor de Docker esté listo (puede tardar 1–2 min)…"
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-DockerEngine) {
      Write-Host "Docker listo."
      return
    }
    Start-Sleep -Seconds 2
  }

  Write-Host ""
  Write-Host "Docker Desktop no respondió a tiempo."
  Write-Host "Si es la primera instalación: abre Docker Desktop, completa el asistente"
  Write-Host "(WSL2 / reinicio si lo pide) y vuelve a hacer doble clic en Launch.bat."
  exit 1
}

Write-Host "Video Extraction Studio — un solo paso"
Write-Host "Carpeta: $Root"

if (Test-Server) {
  Write-Step "Ya está en marcha. Abriendo el navegador…"
  Start-Process $Url
  exit 0
}

if (-not (Test-DockerCli) -and -not (Get-DockerDesktopExe)) {
  Install-DockerDesktop
}

Start-DockerDesktopAndWait

Write-Step "Construyendo y arrancando el Studio (la primera vez tarda)…"
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "Falló docker compose. Revisa el mensaje de arriba."
  exit 1
}

Write-Step "Esperando $Url …"
for ($i = 0; $i -lt 120; $i++) {
  if (Test-Server) {
    Write-Host "Listo. Abriendo el navegador…"
    Start-Process $Url
    Write-Host ""
    Write-Host "Para parar más adelante: docker compose down"
    exit 0
  }
  Start-Sleep -Seconds 2
}

Write-Host "Arrancó, pero la web aún no responde. Prueba en unos minutos: $Url"
Start-Process $Url
