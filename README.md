# Video Extraction Studio

Software web para convertir un vídeo en un JSON denso (metadatos, cortes, habla, texto en pantalla) **sin pasos técnicos sueltos**.

La idea: cualquiera lo instala de un golpe, abre el navegador, sube un vídeo y obtiene el resultado.

## Instalación de un golpe

### Opción A — Lanzador nativo (recomendado si no quieres terminal)

- **Mac:** `./scripts/build-macos-app.sh` → abre `dist/Video Extraction Studio.app`
- **Windows:** doble clic en `desktop/windows/Launch.bat`
- **Linux:** `./desktop/launch.sh`

Detalles: [desktop/README.md](desktop/README.md).

### Opción B — Docker

Docker es una “caja” con el programa y sus dependencias. Necesitas [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
./install.sh
```

Abre [http://localhost:43141](http://localhost:43141).

### Opción C — Sin Docker (local)

Hace falta Node 20+, Python 3.12, ffmpeg y ffprobe.

```bash
./install.sh local          # desarrollo
FORCE_LOCAL=1 ./install.sh  # igual, fuerza local aunque haya Docker
./install.sh prod           # build + start de producción
```

Si no pasas modo (`./install.sh` a secas) y Docker está disponible, usa Docker.
## Google Drive (vídeo in → JSON out)

Con **Google Drive para escritorio** (carpetas locales sincronizadas):

1. Carpeta de entrada + carpeta de salida en Drive.
2. En **Ajustes** del Studio: activa vigilancia y pon las rutas locales.
3. Deja el Studio encendido. Subes un vídeo a la entrada → el JSON aparece en la salida.

También puedes usar webhook (Make/n8n) si prefieres otro destino.
## Qué hace hoy

- Acepta vídeos (`MP4`, `MOV`, `MKV`, `WebM`) por archivo o por **link** (TikTok, Instagram, Facebook, YouTube, X…).
- En la home puedes pegar **varios links** (uno por línea, máx. 20). También `POST /api/jobs/from-url` con `urls: [...]`.
- Pipeline por **módulos** registrados (mismo contrato para todos).
- Diarización con `diarize` (Silero + WeSpeaker): gratis, local, **sin token ni API de pago**.
- **Música y ambiente** local (`librosa`): energía, ritmo/BPM si es claro, brillo del audio por pasajes. No identifica canciones.
- **Movimiento de cámara** local (OpenCV): estática, paneo, zoom, trepidación por tramos.
- **Eventos de audio** local (PANNs / AudioSet): habla, música, aplausos, sirenas, etc. con puntuación.
- La UI y el JSON solo muestran lo que cada módulo devuelve (`summary`, `items`, `data`).
- El JSON unificado `extraction` incluye `schema_version` (ahora `1.0`) para poder evolucionar el formato.
- Trabajos y JSON guardados en disco (`data/jobs/`); el vídeo temporal se borra al terminar.
- API: `POST/GET /api/jobs`, `GET /api/jobs/:id/result`, `GET /api/modules`, `GET/PUT/POST /api/settings` (webhook).
- Webhook al terminar: POST a tu URL con `job.ready` / `job.error` y el JSON de extracción.

## Qué aún no hace

- Identificación de canción (tipo Shazam): requiere API/catálogo externo.
- Instalador firmado tipo App Store / `.dmg` / `.exe` empaquetado con modelos dentro (ahora: lanzadores nativos + Docker o local).
- API key de acceso (el secreto del webhook es opcional).
- Emoción facial / pose tracking (candidatos futuros).
- Lectura directa de Google Drive en la nube sin Drive Desktop (hace falta sincronizar carpetas locales).

## Subir varios vídeos (API)

```bash
curl -F "files=@video1.mp4" -F "files=@video2.mp4" -F "files=@video3.mp4" \
  http://localhost:43141/api/jobs
```

Respuesta: lista de trabajos. Se procesan en cola (`VX_MAX_CONCURRENT`, por defecto 1). Cada uno, al terminar, puede disparar el webhook.

## Importar muchos links

En la **home**: pega varios links (uno por línea) → **Analizar links**.

Por API (máx. 20):

```bash
# Uno
curl -X POST http://localhost:43141/api/jobs/from-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.tiktok.com/@cuenta/video/123"}'

# Varios
curl -X POST http://localhost:43141/api/jobs/from-url \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://www.tiktok.com/@a/video/1","https://www.youtube.com/watch?v=xyz"]}'
```

Solo vídeos públicos (TikTok, Instagram, Facebook, YouTube, X…). Detalle en **Docs** dentro de la app.

Con el servidor en marcha:

```bash
npm run verify
```

Crea un vídeo de prueba (persona + texto + 2 voces), lo procesa y exige que cada módulo responda `ok` con datos.

1. Implementa el contrato `ExtractionModuleDefinition` (`id`, `title`, `stage`, `run`).
2. Regístralo en `src/lib/server/modules/index.ts`.
3. La UI y `GET /api/jobs/:id/result` lo recogen solos — sin tocar pantallas fijas.

## Requisitos del ordenador

Todo corre en local (GPU opcional; este build va en CPU).

**Mínimo usable:** Windows 10/11, macOS 12+ o Linux; **16 GB RAM** (8 GB va justo); CPU reciente o Apple Silicon; **15–25 GB** libres; Docker Desktop o Node + Python + ffmpeg.

**Recomendado:** **32 GB RAM**, SSD con **30+ GB** libres, 6+ núcleos (o M1/M2/M3).

Vídeos cortos: minutos en CPU. Largos o con visión: más tiempo. Un portátil viejo de 8 GB no es buen candidato.

## Variables útiles

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `WHISPER_MODEL` | `base` | Modelo Whisper (`tiny`, `base`, `small`…) |
| `VIDEO_PYTHON` | `video-py/bin/python` | Interprete Python del pipeline |
| `VISION_MAX_FRAMES` | `6` | Máx. fotogramas a observar (CPU) |
| `WEBHOOK_URL` | _(vacío)_ | URL por defecto si no hay config en disco |
| `VX_MAX_CONCURRENT` | `1` | Vídeos procesándose a la vez |
| `PORT` | `43141` | Puerto HTTP |

## Notas

- La primera transcripción descarga el modelo Whisper (en Docker queda en el volumen `vx-models`).
- En CPU el procesado es lento; es intencional en este build sin GPU.
- No inventa resultados: si una capacidad no está cableada, lo dice.
