# Lanzadores nativos

## Qué es Docker (en una frase)

Docker es una **caja** donde el programa y todas sus piezas (Node, Python, ffmpeg, modelos) van juntos. Así no tienes que instalar cada cosa a mano. Si no tienes Docker, el lanzador intenta arrancar en local.

## macOS

```bash
./scripts/build-macos-app.sh
```

Se crea `dist/Video Extraction Studio.app`. Doble clic → arranca y abre el navegador.

## Windows (un solo clic)

Doble clic en `desktop/windows/Launch.bat`.

Ese script intenta, solo:

1. Instalar **Docker Desktop** con `winget` si no está.
2. Arrancarlo y esperar al motor.
3. Levantar el Studio (`docker compose up --build -d`).
4. Abrir el navegador en `http://127.0.0.1:43141`.

**Límite realista:** la *primera* vez Windows/Docker a veces pide permiso de administrador, activar WSL2 o un reinicio. Si pasa, completa ese aviso, vuelve a hacer doble clic en `Launch.bat` y ya sigue solo. Las siguientes veces suele ser un clic.

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
