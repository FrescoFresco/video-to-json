# Video Extraction Studio

Base limpia para una app web de extracción de vídeo. Esta versión **no inventa resultados**: solo muestra lo que realmente se ha podido sacar del archivo.

## Qué hace ahora

- Acepta vídeos locales (`video/*`, `.mp4`, `.mov`, `.mkv`, `.webm`).
- Extrae metadatos reales con `ffprobe` / `ffmpeg`.
- Detecta cortes de plano.
- Transcribe el habla del propio vídeo con `faster-whisper` en CPU.
- Lee texto en pantalla con RapidOCR en CPU.
- Crea trabajos de servidor en memoria con endpoints para crear, consultar estado y leer resultado.
- Deja explícitas las capacidades que aún no existen en este build.

## Qué no hace todavía

- Descripción visual del plano.
- Tracking de objetos o personas.
- Análisis de música o ambiente.
- Base de datos o almacenamiento persistente.

## Cómo arrancar

Hace falta Node, `ffmpeg`/`ffprobe` y Python 3.12.

```bash
npm install
python3 -m venv .venv
.venv/bin/pip install -r requirements-video.txt
npm run dev
```

Abre `http://localhost:43141`.

## Notas de rendimiento

- La primera vez que corre `npm run dev`, Next.js compila y puede tardar.
- La primera transcripción descarga el modelo Whisper `base`.
- El procesado real de vídeo es lento porque Whisper y OCR van en CPU, sin GPU.
- Los trabajos viven en memoria del servidor actual; si reinicias el dev server, desaparecen.
