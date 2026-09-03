# Video Extraction Studio

De **vídeo a texto reconstruible**. Solo vídeos. No es un editor y no es un producto de audio: importas un vídeo (archivo o URL) y sales con un JSON denso — qué se ve, cuándo, qué se dice, quién habla, texto en pantalla — pensado para imaginarse el plano.

Un **módulo** es un nombre (y, si quieres, un repo). La app espera **JSON**. El **Composer** mapea esas fuentes a un `final.json`.

## Qué hay ahora

- UI: Home, lotes, Vídeos, Módulos, Composer, Ajustes.
- Solo se aceptan vídeos (`video/*`, `.mp4`, `.mov`, `.mkv`, `.webm`). Un ZIP de vídeos o un TXT/CSV de URLs de vídeo.
- Sonda real con **ffprobe / ffmpeg** (metadatos y cortes de plano).
- Habla **del propio vídeo**: Whisper local (`faster-whisper`, CPU) + agrupación de speakers.
- **Texto en pantalla conectado:** RapidOCR (PP-OCR ONNX, CPU) sobre fotogramas del vídeo.
- Módulos listos para enganchar: Qwen2.5-VL / Moondream (descripción de plano, GPU), YOLO / YOLO-World (objetos).
- Ejemplo denso (`reel_cafeteria_18s.mp4`) para ver el JSON objetivo.

## Cómo arrancar

Hace falta Node, `ffmpeg`/`ffprobe` y Python 3.12.

```bash
npm install
python3 -m venv .venv
.venv/bin/pip install -r requirements-video.txt
# la primera transcripción descarga el modelo Whisper `base`
npm run dev -- --port 43141 --hostname 0.0.0.0
```

## Idea de módulos

Contrato único: **entra un vídeo, sale JSON**.

| Módulo | Rol |
|---|---|
| Media Probe | duración, tamaño, códecs |
| Scene Cuts | cuándo cambia el plano |
| Visual Reconstruction | describir cada escena — Qwen2.5-VL / Moondream (GPU) |
| Habla del vídeo | **conectado** — Whisper local sobre el vídeo |
| Texto en pantalla | **conectado** — RapidOCR / PaddleOCR |
| Objetos en el plano | YOLO11 / YOLO-World (sample hasta enganchar) |
| Eventos del plano | risa, máquina, tráfico |

## Licencia de esta app

El código de este repo es el estudio. Cada modelo que enganches trae la suya. No hay APIs de pago.
