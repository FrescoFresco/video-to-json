# Lanzador Windows: delega en install.ps1 (instala Docker si hace falta + arranca).
$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "install.ps1")
