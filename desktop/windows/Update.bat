@echo off
REM Update = download latest from GitHub and rebuild (does NOT just open the browser).
REM Prefer running from a fresh PowerShell if this file lives inside the install folder.
cd /d "%TEMP%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 | iex"
if errorlevel 1 (
  echo.
  echo Si algo fallo, deja esta ventana abierta y lee el mensaje de arriba.
  pause
)
