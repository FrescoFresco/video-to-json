# Video Extraction Studio

De **vídeo a texto reconstruible**. No es un editor: importas archivos o URLs y sales con un JSON denso (qué se ve, cuándo, qué se dice, música, texto en pantalla) pensado para que alguien pueda imaginarse el plano.

Los extractores no van metidos a fuego. Un **módulo** es un nombre (y, si quieres, un repo). La app espera **JSON**. El **Composer** mapea esas fuentes a un `final.json`. Mañana enganchas Qwen-VL, MOSS o lo que salga: mismo gesto.

## Qué hay ahora

- UI del prototipo: Home, lotes, Vídeos, Módulos, Composer, Ajustes.
- Catálogo OSS (MOSS, WhisperX, SAM 2, PySceneDetect, Qwen-VL, PANNs, Demucs) como módulos enganchables.
- Añadir módulo por nombre + URL de GitHub.
- Sonda real con **ffprobe / ffmpeg** si subes un vídeo (metadatos y cortes de escena).
- Ejemplo denso (`reel_cafeteria_18s.mp4`) para ver cómo se ve una extracción bien hecha.
- El VLM de describir escenas **no corre en este entorno** (hace falta GPU). El hueco está; el JSON deja `awaiting_vlm_module`.

## Cómo arrancar

```bash
npm install
npm run dev -- --port 43141 --hostname 127.0.0.1
```

Abre `http://127.0.0.1:43141`.

Hace falta `ffmpeg` y `ffprobe` en el PATH para la sonda de archivos.

## Idea de módulos

Contrato único: **entra un vídeo, sale JSON**. La app no sabe si detrás hay SAM o un script tuyo.

| Módulo | Rol |
|---|---|
| Media Probe | duración, tamaño, códecs |
| Scene Cuts | cuándo cambia el plano |
| Visual Reconstruction | describir cada escena (IA / Qwen-VL) |
| MOSS o WhisperX | transcripción + quién habla |
| PANNs | risas, máquina, tráfico |
| Demucs | voz limpia |

## Licencia de esta app

El código de este repo es el estudio. Cada modelo que enganches trae la suya (Apache 2.0, MIT, etc.). No hay APIs de pago.
