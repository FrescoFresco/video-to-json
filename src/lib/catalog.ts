import type { StudioModule } from "./types";

/** Suggested open-source video extractors. The app only consumes JSON. */
export const SUGGESTED_MODULES: StudioModule[] = [
  {
    id: "media-probe",
    name: "Media Probe",
    kind: "builtin",
    category: "Video",
    description: "ffprobe local: duración, resolución, fps y códecs del vídeo.",
    enabled: true,
    status: "ready",
    sample: {
      duration_ms: 18240,
      resolution: { width: 1080, height: 1920 },
      fps: 30,
    },
  },
  {
    id: "scene-cuts",
    name: "Scene Cuts",
    kind: "builtin",
    category: "Video",
    repoUrl: "https://github.com/Breakthrough/PySceneDetect",
    description:
      "Cortes de plano del vídeo. Aquí se usa el filtro scene de ffmpeg; PySceneDetect se engancha igual.",
    enabled: true,
    status: "ready",
    sample: { scenes: [{ start: 0, end: 3.2 }] },
  },
  {
    id: "speech-in-video",
    name: "Habla del vídeo",
    kind: "builtin",
    category: "Speech",
    repoUrl: "https://github.com/SYSTRAN/faster-whisper",
    description:
      "Lee lo que se dice en el vídeo (Whisper local, CPU) y agrupa quién habla. Solo acepta vídeos.",
    enabled: true,
    status: "ready",
    sample: {
      segments: [{ start: 0.48, end: 3.21, speaker: "S01", text: "Hola." }],
    },
  },
  {
    id: "visual-reconstruction",
    name: "Visual Reconstruction",
    kind: "builtin",
    category: "Vision",
    repoUrl: "https://github.com/QwenLM/Qwen2.5-VL",
    description:
      "Describe cada plano (encuadre, luz, ropa, objetos). En esta máquina no hay GPU: el Composer deja el hueco. Engancha Qwen2.5-VL 3B o Moondream.",
    enabled: true,
    status: "unwired",
    sample: {
      data: {
        segments: [
          {
            start: 0,
            end: 3.2,
            description: "A person appears centered in a bright room.",
          },
        ],
      },
    },
  },
  {
    id: "moss",
    name: "MOSS Transcribe Diarize",
    kind: "repo",
    category: "Speech",
    repoUrl: "https://github.com/OpenMOSS/MOSS-Transcribe-Diarize",
    description:
      "Repo OSS para transcribir y diarizar el habla del vídeo en GPU. Mientras tanto cubre el módulo local.",
    enabled: false,
    status: "unwired",
    sample: {
      data: {
        segments: [
          {
            start: 0.48,
            end: 3.21,
            speaker: "S01",
            text: "Mira lo que está pasando aquí.",
          },
        ],
      },
    },
  },
  {
    id: "whisperx",
    name: "WhisperX",
    kind: "repo",
    category: "Speech",
    repoUrl: "https://github.com/m-bain/whisperX",
    description: "Transcripción alineada del habla del vídeo. Alternativa OSS a MOSS.",
    enabled: false,
    status: "unwired",
    sample: { segments: [{ start: 0.5, end: 3.1, speaker: "SPEAKER_00", text: "…" }] },
  },
  {
    id: "sam2",
    name: "SAM 2",
    kind: "repo",
    category: "Vision",
    repoUrl: "https://github.com/facebookresearch/sam2",
    description: "Máscaras y tracking en el fotograma. Aporta dónde está cada cosa.",
    enabled: false,
    status: "unwired",
    sample: { data: { tracks: [{ entity_id: "entity_001", start: 0.3, end: 8.7 }] } },
  },
  {
    id: "on-screen-text",
    name: "Texto en pantalla",
    kind: "builtin",
    category: "Vision",
    repoUrl: "https://github.com/PaddlePaddle/PaddleOCR",
    description:
      "Conectado: RapidOCR (PP-OCR en ONNX, CPU) lee logos, stickers y subtítulos quemados. PaddleOCR se puede sustituir con el mismo JSON.",
    enabled: true,
    status: "ready",
    sample: {
      items: [
        { text: "AURA", start_ms: 15800, end_ms: 18240, conf: 0.99, role: "logo" },
        { text: "café de especialidad", start_ms: 15800, end_ms: 18240, conf: 0.97, role: "overlay" },
      ],
    },
  },
  {
    id: "objects-in-video",
    name: "Objetos en el plano",
    kind: "repo",
    category: "Vision",
    repoUrl: "https://github.com/ultralytics/ultralytics",
    description:
      "YOLO11 / YOLO-World: qué hay y dónde, con id en el tiempo. El Composer espera tracks JSON. Engánchalo en GPU o con yolov8n ONNX.",
    enabled: true,
    status: "unwired",
    sample: {
      tracks: [
        {
          entity_id: "cup_01",
          label: "cup",
          start: 0.0,
          end: 12.1,
          bbox: [0.42, 0.55, 0.71, 0.88],
        },
        {
          entity_id: "person_01",
          label: "person",
          start: 0.0,
          end: 15.8,
          bbox: [0.18, 0.12, 0.82, 0.99],
        },
      ],
    },
  },
  {
    id: "moondream",
    name: "Moondream",
    kind: "repo",
    category: "Vision",
    repoUrl: "https://github.com/vikhyat/moondream",
    description:
      "VLM pequeño para captions por escena. Alternativa ligera a Qwen2.5-VL cuando haya GPU.",
    enabled: false,
    status: "unwired",
    sample: {
      segments: [{ start: 0, end: 3.2, description: "Woman in a bright cafe holding a latte." }],
    },
  },
  {
    id: "panns",
    name: "Eventos del plano",
    kind: "repo",
    category: "Video",
    repoUrl: "https://github.com/qiuqiangkong/audioset_tagging_cnn",
    description: "Qué ocurre en el vídeo más allá del habla: risa, máquina, tráfico.",
    enabled: false,
    status: "unwired",
    sample: { events: [{ label: "laughter", start: 3.3, end: 3.8 }] },
  },
];

export const DEFAULT_CONFIG = {
  config_id: "full_extraction",
  version: "v1",
  name: "Reconstrucción densa",
  output: {
    media: "$sources.media-probe",
    scenes: "$sources.scene-cuts.scenes",
    visual: "$sources.visual-reconstruction.data.segments",
    speech: "$sources.speech-in-video.segments",
    on_screen_text: "$sources.on-screen-text.items",
    objects: "$sources.objects-in-video.tracks",
    tracking: "$sources.sam2.data.tracks",
  },
};

export function mergeModules(saved?: StudioModule[]): StudioModule[] {
  const prev = new Map((saved ?? []).map((m) => [m.id, m]));
  const merged = SUGGESTED_MODULES.map((s) => {
    const old = prev.get(s.id);
    if (!old) return s;
    return {
      ...s,
      enabled: s.id === "speech-in-video" || s.id === "on-screen-text" ? true : old.enabled,
      status: s.id === "speech-in-video" || s.id === "on-screen-text" ? "ready" : old.status,
    };
  });
  for (const m of saved ?? []) {
    if (!SUGGESTED_MODULES.some((s) => s.id === m.id)) merged.push(m);
  }
  return merged;
}
