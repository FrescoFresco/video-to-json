import type { StudioModule } from "./types";

/** Suggested open-source repos. The app does not hardcode their internals. */
export const SUGGESTED_MODULES: StudioModule[] = [
  {
    id: "media-probe",
    name: "Media Probe",
    kind: "builtin",
    category: "Media",
    description: "ffprobe local: duración, resolución, fps y códecs.",
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
      "Cortes de plano. Aquí se usa el filtro scene de ffmpeg; el repo PySceneDetect se puede enganchar igual.",
    enabled: true,
    status: "ready",
    sample: { scenes: [{ start: 0, end: 3.2 }] },
  },
  {
    id: "audio-local",
    name: "Transcribe + Diarize",
    kind: "builtin",
    category: "Audio",
    repoUrl: "https://github.com/SYSTRAN/faster-whisper",
    description:
      "Conectado: extrae el audio con ffmpeg, transcribe con Whisper (local, CPU) y agrupa speakers. Sube un vídeo y corre de verdad.",
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
      "Describe cada escena en texto denso. En esta máquina no corre el VLM; el Composer deja el hueco y un guion estructural. Engancha Qwen-VL o Moondream en tu GPU.",
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
    category: "Audio",
    repoUrl: "https://github.com/OpenMOSS/MOSS-Transcribe-Diarize",
    description:
      "Repo OSS de transcripción+diarización en un paso (GPU). Mientras tanto el módulo local Whisper cubre el audio.",
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
    category: "Audio",
    repoUrl: "https://github.com/m-bain/whisperX",
    description: "Whisper local + diarización. Alternativa OSS a MOSS.",
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
    description: "Máscaras y tracking. No es el objetivo: aporta dónde está cada cosa.",
    enabled: false,
    status: "unwired",
    sample: { data: { tracks: [{ entity_id: "entity_001", start: 0.3, end: 8.7 }] } },
  },
  {
    id: "panns",
    name: "PANNs Sound Events",
    kind: "repo",
    category: "Audio",
    repoUrl: "https://github.com/qiuqiangkong/audioset_tagging_cnn",
    description: "Eventos de sonido (risa, máquina, tráfico) sin API de pago.",
    enabled: false,
    status: "unwired",
    sample: { events: [{ label: "laughter", start: 3.3, end: 3.8 }] },
  },
  {
    id: "demucs",
    name: "Demucs",
    kind: "repo",
    category: "Audio",
    repoUrl: "https://github.com/facebookresearch/demucs",
    description: "Separa la voz (voice.wav) antes de transcribir.",
    enabled: false,
    status: "unwired",
    sample: { artifacts: ["voice.wav"] },
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
    audio: "$sources.audio-local.segments",
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
      enabled: s.id === "audio-local" ? true : old.enabled,
      status: s.id === "audio-local" ? "ready" : old.status,
    };
  });
  for (const m of saved ?? []) {
    if (!SUGGESTED_MODULES.some((s) => s.id === m.id)) merged.push(m);
  }
  return merged;
}
