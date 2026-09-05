Video Extraction Studio - instalador

Que hace este instalador:
- Deja un icono en el escritorio
- Al abrirlo la primera vez: descarga e instala el Studio (usa Docker)
- Las siguientes veces: arranca el Studio (no descarga de nuevo)

Para actualizar a la ultima version:
- Vuelve a ejecutar el comando de instalacion de PowerShell, o
- Usa Update.bat dentro de la carpeta VideoExtractionStudio

La primera vez puede pedir permisos y tardar varios minutos.
Si Docker no arranca, instala WSL2 (PowerShell como Administrador):

  wsl --install --no-distribution

Reinicia, abre Docker Desktop, y vuelve a abrir la app.
