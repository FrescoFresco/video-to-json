@echo off
REM Un solo clic: instala Docker si falta, arranca el Studio y abre el navegador.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
  echo.
  echo Si algo falló, deja esta ventana abierta y lee el mensaje de arriba.
  pause
)
