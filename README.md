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
- Módulos actuales: cortes, habla, quién habla, texto en pantalla, objetos/personas (YOLO), observación visual (Moondream2), resumen.
- La UI y el JSON solo muestran lo que cada módulo devuelve (`summary`, `items`, `data`).
- Trabajos y JSON guardados en disco (`data/jobs/`); el vídeo temporal se borra al terminar.
- API: `POST/GET /api/jobs`, `GET /api/jobs/:id/result`, `GET /api/modules`.

## Qué aún no hace

- Tracking fino de personas/objetos en el tiempo.
- Análisis de música.
- Webhook al terminar / API key.

## Añadir otro módulo / repo

1. Implementa el contrato `ExtractionModuleDefinition` (`id`, `title`, `stage`, `run`).
2. Regístralo en `src/lib/server/modules/index.ts`.
3. La UI y `GET /api/jobs/:id/result` lo recogen solos — sin tocar pantallas fijas.

## Variables útiles

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `WHISPER_MODEL` | `base` | Modelo Whisper (`tiny`, `base`, `small`…) |
| `VIDEO_PYTHON` | `video-py/bin/python` | Interprete Python del pipeline |
| `VISION_MAX_FRAMES` | `6` | Máx. fotogramas a observar (CPU) |
| `VISION_MODEL` | `vikhyatk/moondream2` | Modelo VLM de observación |
| `PORT` | `43141` | Puerto HTTP |

## Notas

- La primera transcripción descarga el modelo Whisper (en Docker queda en el volumen `vx-models`).
- En CPU el procesado es lento; es intencional en este build sin GPU.
- No inventa resultados: si una capacidad no está cableada, lo dice.
