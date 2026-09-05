# Lanzadores nativos

## Qué es Docker (en una frase)

Docker es una **caja** donde el programa y todas sus piezas (Node, Python, ffmpeg, modelos) van juntos. Así no tienes que instalar cada cosa a mano. Si no tienes Docker, el lanzador intenta arrancar en local.

## macOS

```bash
./scripts/build-macos-app.sh
```

Se crea `dist/Video Extraction Studio.app`. Doble clic → arranca y abre el navegador.

## Windows (instalación como “un instalador”)

Abre **PowerShell** (busca “PowerShell” en el menú inicio) y pega **esta línea**:

```powershell
irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 | iex
```

Pulsa Enter. Eso:

1. Descarga el programa en `%USERPROFILE%\VideoExtractionStudio`
2. Instala Docker Desktop si no está (con winget)
3. Arranca el Studio
4. Abre el navegador

La primera vez puede pedir permiso de administrador o reiniciar por WSL2. Si pasa, acepta y vuelve a pegar el mismo comando.

### Si ya tienes la carpeta del proyecto

Doble clic en `desktop/windows/Launch.bat`.

## Linux

```bash
./desktop/launch.sh
```

## Google Drive (carpeta → JSON)

1. Instala **Google Drive para escritorio** (sincroniza carpetas en tu disco).
2. Crea dos carpetas, p. ej. `VX-entrada` y `VX-salida`, dentro de Drive.
3. Arranca el Studio, ve a **Ajustes**, activa vigilancia y pega las rutas **locales** de esas carpetas.
4. Sube un vídeo a `VX-entrada` (desde el móvil o la web de Drive).
5. Cuando termine, el JSON aparece en `VX-salida` (y el vídeo pasa a `processed/`).

El Studio tiene que estar **encendido** en el ordenador que tiene esas carpetas sincronizadas.
