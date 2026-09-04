# Instalación / arranque desde terminal (Windows + Docker)
# Uso (desde la raíz del proyecto):
#   powershell -ExecutionPolicy Bypass -File .\desktop\windows\install.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root
$Url = "http://127.0.0.1:43141"

Write-Host "Video Extraction Studio — instalación desde terminal"
Write-Host "Carpeta: $Root"
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "No hay Docker. Intentando instalar Docker Desktop con winget..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
    Write-Host ""
    Write-Host "Instala / abre Docker Desktop, espera a que arranque, y vuelve a ejecutar este script."
    exit 1
  }
  Write-Host "Instala Docker Desktop a mano: https://www.docker.com/products/docker-desktop/"
  exit 1
}

try {
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Docker no responde" }
} catch {
  Write-Host "Docker está instalado pero no está en marcha."
  Write-Host "Abre Docker Desktop, espera a que esté listo, y vuelve a ejecutar este script."
  exit 1
}

Write-Host "Construyendo y arrancando (primera vez puede tardar bastante)..."
docker compose up --build -d

Write-Host "Esperando a $Url ..."
for ($i = 0; $i -lt 90; $i++) {
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
    Write-Host "Listo. Abriendo el navegador..."
    Start-Process $Url
    Write-Host "Para parar: docker compose down"
    exit 0
  } catch {
    Start-Sleep -Seconds 2
  }
}

Write-Host "Arrancó Docker pero la web aún no responde. Prueba en unos minutos: $Url"
Start-Process $Url
