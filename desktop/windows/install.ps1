# Windows one-click installer (ASCII-only for PowerShell 5.1).
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\desktop\windows\install.ps1
# Force rebuild even if the server is already up (used by Update / bootstrap):
#   $env:VX_FORCE_REBUILD = "1"

param(
  [switch]$ForceRebuild
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root
$Url = "http://127.0.0.1:43141"
$DoForce = $ForceRebuild -or ($env:VX_FORCE_REBUILD -eq "1")
$SkipUpdate = ($env:VX_SKIP_UPDATE -eq "1")
$script:VxStep = 0
$script:VxTotalSteps = 5

function Write-Banner([string]$title) {
  Write-Host ""
  Write-Host "========================================"
  Write-Host ("  {0}" -f $title)
  Write-Host "========================================"
}

function Write-Bar([string]$label, [int]$percent) {
  if ($percent -lt 0) { $percent = 0 }
  if ($percent -gt 100) { $percent = 100 }
  $filled = [int]([math]::Round($percent / 5))
  if ($filled -gt 20) { $filled = 20 }
  $bar = ("#" * $filled) + ("-" * (20 - $filled))
  Write-Host ("  [{0}] {1,3}%  {2}" -f $bar, $percent, $label)
}

function Write-Step([string]$msg) {
  $script:VxStep++
  Write-Banner ("Paso {0}/{1} - {2}" -f $script:VxStep, $script:VxTotalSteps, $msg)
}

function Refresh-DockerPath {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $extra = @(
    "$env:ProgramFiles\Docker\Docker\resources\bin",
    "$env:ProgramFiles\Docker\Docker",
    "${env:ProgramFiles(x86)}\Docker\Docker\resources\bin"
  ) | Where-Object { $_ -and (Test-Path $_) }
  $env:Path = (@($machinePath, $userPath) + $extra) -join ";"
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

function Show-DockerPathHelp {
  Write-Host ""
  Write-Host "Docker Desktop parece instalado, pero el comando 'docker' no esta en PATH."
  Write-Host "Haz esto:"
  Write-Host "  1) Abre Docker Desktop y espera a 'Engine running'"
  Write-Host "  2) Cierra esta ventana"
  Write-Host "  3) Abre una nueva ventana de PowerShell / Launch.bat"
  Write-Host "  4) Si sigue fallando, reinicia el PC y vuelve a intentar"
  Write-Host ""
}

function Test-DockerCli {
  Refresh-DockerPath
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
  Write-Banner "Instalar Docker Desktop"
  Write-Bar "buscando winget" 10

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "No hay winget. Instala Docker a mano:"
    Write-Host "  https://www.docker.com/products/docker-desktop/"
    exit 1
  }

  Write-Bar "instalando Docker (puede pedir Admin y tardar)" 40
  winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    Write-Host "No se pudo instalar Docker (codigo $LASTEXITCODE)."
    Write-Host "Instalalo a mano: https://www.docker.com/products/docker-desktop/"
    exit 1
  }

  Refresh-DockerPath

  if (-not (Get-DockerDesktopExe)) {
    Write-Host "Docker instalado. Cierra esta ventana, reinicia si Windows lo pide,"
    Write-Host "abre Docker Desktop una vez y vuelve a lanzar el instalador."
    exit 1
  }

  Write-Bar "Docker Desktop instalado" 100
}

function Start-DockerDesktopAndWait {
  Refresh-DockerPath

  if (Test-DockerEngine) {
    Write-Bar "Docker ya estaba listo" 100
    return
  }

  $exe = Get-DockerDesktopExe
  if (-not $exe) {
    Write-Host "No encuentro Docker Desktop. Abrelo a mano y vuelve a intentar."
    exit 1
  }

  if (-not (Test-DockerCli)) {
    Write-Host "Docker Desktop esta instalado, pero 'docker' no esta en PATH todavia."
    Show-DockerPathHelp
    exit 1
  }

  Write-Banner "Arrancar Docker"
  Write-Bar "abriendo Docker Desktop" 5
  Start-Process $exe | Out-Null

  Write-Host "  Esperando al motor (normal: 1-2 min)..."
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-DockerEngine) {
      Write-Bar "Docker listo" 100
      return
    }
    $pct = [Math]::Min(95, 5 + [int]((($i + 1) / 90.0) * 90))
    if (($i % 5) -eq 4) {
      Write-Bar ("esperando motor... {0}s" -f (($i + 1) * 2)) $pct
    }
    Start-Sleep -Seconds 2
  }

  Write-Host "Docker no arranco a tiempo (el motor no responde)."
  Write-Host "Abre Docker Desktop, espera a 'Engine running' y vuelve a intentar."
  Write-Host "Si Docker pide WSL2:"
  Show-DockerWslHelp
  exit 1
}

Write-Banner "Video Extraction Studio"
Write-Host ("  Carpeta: {0}" -f $Root)
Write-Host "  Esta ventana muestra el progreso. No la cierres."

# Auto-update when opening the app (unless we are already inside an update).
if (-not $SkipUpdate) {
  try {
    . (Join-Path $PSScriptRoot "update-helpers.ps1")
    Write-Step "Comprobar actualizaciones"
    Write-Bar "consultando GitHub" 20
    if (Test-UpdateAvailable) {
      Write-Bar "hay version nueva" 40
      Update-StudioFiles
      # Re-run the NEW install.ps1 after files were replaced (avoid running stale script).
      $env:VX_SKIP_UPDATE = "1"
      $env:VX_FORCE_REBUILD = "1"
      $newInstall = Join-Path $env:USERPROFILE "VideoExtractionStudio\desktop\windows\install.ps1"
      $newRoot = Join-Path $env:USERPROFILE "VideoExtractionStudio"
      if (Test-Path $newInstall) {
        Write-Bar "reiniciando con la version nueva" 100
        $p = Start-Process -FilePath "powershell.exe" -ArgumentList @(
          "-NoProfile", "-ExecutionPolicy", "Bypass",
          "-File", $newInstall, "-ForceRebuild"
        ) -WorkingDirectory $newRoot -Wait -PassThru -NoNewWindow
        exit $(if ($null -ne $p.ExitCode) { $p.ExitCode } else { 0 })
      }
      $DoForce = $true
    } else {
      Write-Bar "ya estas al dia" 100
      $remote = Get-RemoteGitSha
      if ($remote -and -not (Get-LocalGitSha)) { Save-LocalGitSha $remote }
    }
  } catch {
    Write-Host "  Aviso: no pude comprobar actualizaciones (sin internet?). Sigo arrancando."
  }
} else {
  $script:VxStep = 1
}

Refresh-DockerPath

if ((-not $DoForce) -and (Test-Server)) {
  Write-Step "Abrir el Studio"
  Write-Bar "ya estaba en marcha" 100
  Start-Process $Url
  Write-Host ""
  Write-Host "  Listo. Navegador abierto."
  exit 0
}

if (-not (Test-DockerCli) -and -not (Get-DockerDesktopExe)) {
  Install-DockerDesktop
}

if (-not (Test-DockerCli) -and (Get-DockerDesktopExe)) {
  Refresh-DockerPath
  if (-not (Test-DockerCli)) {
    Show-DockerPathHelp
    exit 1
  }
}

Start-DockerDesktopAndWait

if ($DoForce) {
  Write-Step "Actualizar / reconstruir el Studio"
  Write-Bar "parando version anterior" 10
  docker compose down 2>$null | Out-Null
  Write-Bar "version anterior parada" 20
} else {
  Write-Step "Construir y arrancar el Studio"
}

Write-Bar "construyendo imagen Docker" 25
Write-Host "  Esto puede tardar varios minutos (sobre todo la 1a vez)."
Write-Host "  Abajo veras logs de Docker en vivo; la barra sube segun avanza."
Write-Host ""

$composeLines = New-Object System.Collections.Generic.List[string]
$script:VxBuildPct = 25
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker compose up --build -d 2>&1 | ForEach-Object {
  $line = "$_"
  [void]$composeLines.Add($line)
  Write-Host $line
  $bump = $false
  if ($line -match "(?i)pulling|downloading|extracting|download complete") {
    $script:VxBuildPct = [Math]::Max($script:VxBuildPct, 35)
    $bump = $true
  }
  if ($line -match "(?i)#\d+\s+(DONE|CACHED)|Step \d+|RUN |COPY |Building|built|naming to|exporting") {
    $script:VxBuildPct = [Math]::Min(65, $script:VxBuildPct + 3)
    $bump = $true
  }
  if ($line -match "(?i)Creating|Created|Starting|Started|Container") {
    $script:VxBuildPct = [Math]::Max($script:VxBuildPct, 68)
    $bump = $true
  }
  if ($bump -and (($composeLines.Count % 4) -eq 0)) {
    Write-Bar "reconstruyendo..." $script:VxBuildPct
  }
}
$composeExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
$composeOut = ($composeLines -join "`n")
if ($composeExit -ne 0) {
  Write-Host "Fallo docker compose (codigo $composeExit)."
  Write-Host "Revisa el mensaje de Docker arriba."
  if ($composeOut -match "public|cache key|checksum|failed to solve|Dockerfile") {
    Write-Host ""
    Write-Host "Parece un error de build (no de WSL)."
    Write-Host "Prueba: cierra esta ventana, ejecuta Update.bat, y vuelve a Launch.bat."
    Write-Host "Si sigue fallando, en la carpeta VideoExtractionStudio ejecuta:"
    Write-Host "  docker compose build --no-cache"
    exit 1
  }
  if ($composeOut -match "WSL|wsl|Hardware assisted virtualization|virtualization") {
    Show-DockerWslHelp
    exit 1
  }
  Write-Host ""
  Write-Host "Si Docker Desktop no tiene el motor en marcha, abrilo y espera a Engine running."
  Write-Host "Solo si Docker pide WSL2:"
  Show-DockerWslHelp
  exit 1
}

Write-Bar "contenedor arrancado" 70

Write-Step "Esperar a que abra la web"
Write-Host ("  Esperando {0} ..." -f $Url)
for ($i = 0; $i -lt 120; $i++) {
  if (Test-Server) {
    Write-Bar "web lista" 100
    Write-Banner "Listo"
    Write-Host "  Abriendo navegador..."
    Start-Process $Url
    Write-Host "  Para parar: docker compose down"
    Write-Host ""
    exit 0
  }
  if (($i % 5) -eq 4) {
    $pct = [int](70 + (($i + 1) * 25 / 120))
    Write-Bar ("esperando web... {0}s" -f (($i + 1) * 2)) $pct
  }
  Start-Sleep -Seconds 2
}

Write-Host "Arranco, pero la web aun no responde. Prueba: $Url"
Start-Process $Url
