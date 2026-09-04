# Lanzador nativo Windows: arranca Docker o install local y abre el navegador.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root
$Port = if ($env:PORT) { $env:PORT } else { "43141" }
$Url = "http://127.0.0.1:$Port"

Write-Host "Video Extraction Studio"
Write-Host "Carpeta: $Root"
Write-Host ""

function Test-Server {
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-Server)) {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  $dockerOk = $false
  if ($docker) {
    try {
      docker info 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
    } catch { }
  }

  if ($dockerOk) {
    Write-Host "Arrancando con Docker..."
    docker compose up --build -d
  } else {
    Write-Host "Arrancando en local (sin Docker)..."
    if (-not (Test-Path ".\node_modules")) { npm install }
    if (-not (Test-Path ".\video-py\Scripts\python.exe") -and -not (Test-Path ".\video-py\bin\python")) {
      Write-Host "Primera vez: crea el entorno Python con install (ver README)."
    }
    Start-Process -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory $Root -WindowStyle Minimized
  }

  Write-Host "Esperando $Url ..."
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-Server) { break }
    Start-Sleep -Seconds 2
  }
}

if (Test-Server) {
  Write-Host "Abriendo $Url"
  Start-Process $Url
} else {
  Write-Error "No respondió a tiempo. Revisa Docker o ejecuta npm run dev."
}
