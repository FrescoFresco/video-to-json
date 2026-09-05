# Lanzadores nativos

Instrucciones fáciles (Windows + Mac): **[INSTALL.md](../INSTALL.md)**

## Qué es Docker (en una frase)

Docker es una **caja** donde van el programa y todas sus piezas. Así no instalas Node, Python ni ffmpeg a mano.

## Atajos

| Sistema | Comando / archivo |
|---|---|
| **Windows (instalador)** | [VideoExtractionStudio-Setup.exe](https://github.com/FrescoFresco/video-to-json/releases/latest/download/VideoExtractionStudio-Setup.exe) |
| **Windows (comando)** | `powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 \| iex"` |
| **Mac** | `curl -fsSL https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/macos/bootstrap-from-web.sh \| bash` |
| Ya tienes la carpeta (Windows) | Doble clic `desktop/windows/Launch.bat` · actualizar: `Update.bat` |
| Ya tienes la carpeta (Mac) | `./desktop/macos/install.sh` |
| Linux | `./desktop/launch.sh` |

Abrir el icono / `Launch.bat` **arranca** el Studio. Para **actualizar** usa `Update.bat` o vuelve a pegar el comando.

## Google Drive (carpeta → JSON)

1. Instala **Google Drive para escritorio**.
2. Crea `VX-entrada` y `VX-salida` dentro de Drive.
3. En el Studio → **Conexiones → Carpeta local**: activa vigilancia y pega las rutas locales.
4. Sube un vídeo a entrada; el JSON sale en salida (Studio encendido).
