@echo off
REM Update = same as install: download latest from GitHub and restart.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 | iex"
if errorlevel 1 (
  echo.
  echo Si algo fallo, deja esta ventana abierta y lee el mensaje de arriba.
  pause
)
