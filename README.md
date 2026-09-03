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
- Metadatos y cortes de plano (`ffprobe` / `ffmpeg`).
- Transcripción del habla (`faster-whisper` en CPU).
- Texto en pantalla (RapidOCR en CPU).
- Trabajos en memoria del servidor (se borran al reiniciar).
- El archivo de vídeo se procesa en temporal y se elimina al terminar.

## Qué aún no hace

- Descripción visual del plano.
- Tracking de personas u objetos.
- Análisis de música o ambiente.
- Base de datos persistente.

## Variables útiles

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `WHISPER_MODEL` | `base` | Modelo Whisper (`tiny`, `base`, `small`…) |
| `VIDEO_PYTHON` | `video-py/bin/python` | Interprete Python del pipeline |
| `VIDEO_VENV_DIR` | `video-py` | Carpeta del entorno Python local |
| `PORT` | `43141` | Puerto HTTP |

## Notas

- La primera transcripción descarga el modelo Whisper (en Docker queda en el volumen `vx-models`).
- En CPU el procesado es lento; es intencional en este build sin GPU.
- No inventa resultados: si una capacidad no está cableada, lo dice.
