Video Extraction Studio - instalador

Que hace este instalador:
- Deja un icono en el escritorio
- Al abrirlo: comprueba si hay version nueva, actualiza si hace falta, y arranca el Studio (usa Docker)

La primera vez puede pedir permisos y tardar varios minutos.
Si Docker no arranca, instala WSL2 (PowerShell como Administrador):

  wsl --install --no-distribution

Reinicia, abre Docker Desktop, y vuelve a abrir la app.
