# Video Extraction Studio

Software web para convertir un vídeo en un JSON denso (metadatos, cortes, habla, texto en pantalla) **sin pasos técnicos sueltos**.

La idea: cualquiera lo instala de un golpe, abre el navegador, sube un vídeo y obtiene el resultado.

## Instalación de un golpe

### Opción A — Docker (recomendada)

Necesitas solo [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine + Compose).

```bash
./install.sh
```

Abre [http://localhost:43141](http://localhost:43141).

Equivale a:

```bash
docker compose up --build
```

### Opción B — Sin Docker (local)

Hace falta Node 20+, Python 3.12, ffmpeg y ffprobe.

```bash
./install.sh
```

Si no detecta Docker, instala dependencias npm/Python y arranca el servidor de desarrollo en el mismo comando.

Producción local:

```bash
./install.sh prod
```

## Qué hace hoy

- Acepta vídeos (`MP4`, `MOV`, `MKV`, `WebM`).
- Pipeline por **módulos** registrados (mismo contrato para todos).
- Diarización con `diarize` (Silero + WeSpeaker): gratis, local, **sin token ni API de pago**.
- **Música y ambiente** local (`librosa`): energía, ritmo/BPM si es claro, brillo del audio por pasajes. No identifica canciones.
- La UI y el JSON solo muestran lo que cada módulo devuelve (`summary`, `items`, `data`).
- Trabajos y JSON guardados en disco (`data/jobs/`); el vídeo temporal se borra al terminar.
- API: `POST/GET /api/jobs`, `GET /api/jobs/:id/result`, `GET /api/modules`, `GET/PUT/POST /api/settings` (webhook).
- Webhook al terminar: POST a tu URL con `job.ready` / `job.error` y el JSON de extracción.

## Qué aún no hace

- Identificación de canción (tipo Shazam): requiere API/catálogo externo.
- Instalador nativo `.exe` / `.dmg` (ahora: Docker o `./install.sh`).
- API key de acceso (el secreto del webhook es opcional).

## Subir varios vídeos (API)

```bash
curl -F "files=@video1.mp4" -F "files=@video2.mp4" -F "files=@video3.mp4" \
  http://localhost:43141/api/jobs
```

Respuesta: lista de trabajos. Se procesan en cola (`VX_MAX_CONCURRENT`, por defecto 1). Cada uno, al terminar, puede disparar el webhook.

Con el servidor en marcha:

```bash
npm run verify
```

Crea un vídeo de prueba (persona + texto + 2 voces), lo procesa y exige que cada módulo responda `ok` con datos.

1. Implementa el contrato `ExtractionModuleDefinition` (`id`, `title`, `stage`, `run`).
2. Regístralo en `src/lib/server/modules/index.ts`.
3. La UI y `GET /api/jobs/:id/result` lo recogen solos — sin tocar pantallas fijas.

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
