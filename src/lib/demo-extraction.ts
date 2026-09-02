/** Example of a well-done extraction — the reconstruction target. */

export function denseCafeExtraction(filename = "reel_cafeteria_18s.mp4") {
  return {
    extraction: {
      goal: "video_to_reconstructable_text",
      quality: "dense_time_aligned",
      language: "es",
      vision_model: "demo-fixture",
    },
    source: {
      type: "url",
      platform: "instagram",
      filename,
    },
    media: {
      duration_ms: 18240,
      duration: "00:18.240",
      resolution: { width: 1080, height: 1920 },
      aspect_ratio: "9:16",
      fps: 30,
      video_codec: "h264",
      audio_codec: "aac",
      orientation: "vertical",
    },
    one_line:
      "Una mujer en una cafetería lumínica enseña un café con latte art de corazón, mira a cámara, ríe, y cierra con el logo de una marca.",
    reconstructable_script:
      "Plano vertical 9:16, 18 segundos. Interior de cafetería a contraluz: ventanales a la izquierda, madera clara, plantas. Mujer ~28 años, camisa blanca de lino, vaqueros claros, taza beige con corazón de leche. Luz de mañana, flare suave. Dice «Mira lo que está pasando aquí.», ríe. Fuera de campo un hombre: «¿En serio?». Pop acústico ~96 BPM sin identificar. Corte a macro del latte. Vuelve a ella: «Pruébalo.» Cierre negro, wordmark AURA, «café de especialidad».",
    timeline: [
      {
        id: "seg_01",
        start_ms: 0,
        end_ms: 480,
        dense_caption:
          "Encuadre vertical de una mujer en cafetería luminosa. Luz fuerte a la izquierda. Taza con corazón de leche. Sin logos.",
      },
      {
        id: "seg_02",
        start_ms: 480,
        end_ms: 3210,
        speech: [
          {
            speaker: "S01",
            text: "Mira lo que está pasando aquí.",
            language: "es",
          },
        ],
        dense_caption: "Levanta la mirada a cámara y habla. El encuadre no corta.",
      },
      {
        id: "seg_03",
        start_ms: 3210,
        end_ms: 3800,
        sound_events: [{ label: "laughter", source: "S01" }],
        dense_caption: "Risa corta, dientes visibles, taza apenas se inclina.",
      },
      {
        id: "seg_04",
        start_ms: 7200,
        end_ms: 12100,
        dense_caption:
          "Corte a macro de la taza. Producto hero: cerámica, espuma, corazón simétrico.",
      },
      {
        id: "seg_05",
        start_ms: 15800,
        end_ms: 18240,
        on_screen_text: [
          { text: "AURA", role: "logo" },
          { text: "café de especialidad", role: "tagline" },
        ],
        dense_caption: "Pantalla negra de cierre. Logo AURA centrado.",
      },
    ],
    transcript: [
      { start_ms: 480, end_ms: 3210, speaker: "S01", text: "Mira lo que está pasando aquí." },
      { start_ms: 4120, end_ms: 4980, speaker: "S02", text: "¿En serio?" },
      { start_ms: 13940, end_ms: 14780, speaker: "S01", text: "Pruébalo." },
    ],
    music: {
      identified: false,
      description_for_reconstruction:
        "pop acústico diurno, guitarra + palmas, ~96 BPM, sin letra cantada",
    },
    brand: { name: "AURA", category: "café de especialidad" },
    if_you_regenerate: {
      must_keep: [
        "vertical 9:16",
        "cafetería de mañana",
        "taza con corazón",
        "frase inicial",
        "cierre AURA",
      ],
      will_probably_fail: ["el mismo rostro", "la misma canción bit a bit"],
    },
  };
}

export function structuralExtraction(input: {
  filename: string;
  origin: "file" | "url" | "zip";
  probe?: {
    durationMs: number;
    width: number;
    height: number;
    fps: number;
    videoCodec?: string;
    audioCodec?: string;
    scenes: { startMs: number; endMs: number }[];
  };
}) {
  const durationMs = input.probe?.durationMs ?? 0;
  const scenes =
    input.probe?.scenes?.length ?
      input.probe.scenes
    : durationMs > 0 ?
      [
        { startMs: 0, endMs: Math.round(durationMs * 0.4) },
        { startMs: Math.round(durationMs * 0.4), endMs: durationMs },
      ]
    : [{ startMs: 0, endMs: 0 }];

  const timeline = scenes.map((s, i) => ({
    id: `seg_${String(i + 1).padStart(2, "0")}`,
    start_ms: s.startMs,
    end_ms: s.endMs,
    start: msToClock(s.startMs),
    end: msToClock(s.endMs),
    dense_caption:
      "Hueco para el módulo de visión (Qwen-VL / Moondream). Aquí iría una descripción tan densa como para regenerar el plano.",
    visual_status: "awaiting_vlm_module",
  }));

  const reconstructable_script = [
    input.probe ?
      `Vídeo ${input.probe.width}×${input.probe.height} a ${input.probe.fps} fps, ${msToClock(durationMs)}.`
    : `Fuente ${input.origin}: ${input.filename}. Sin sonda de media (no se pudo leer el archivo).`,
    `${scenes.length} escena(s) detectada(s) por corte.`,
    "Falta el módulo de descripción visual y el de transcripción/diarización para cerrar el texto reconstruible.",
  ].join(" ");

  return {
    extraction: {
      goal: "video_to_reconstructable_text",
      quality: "structural_pending_vlm",
      language: "es",
      vision_model: null,
    },
    source: {
      type: input.origin,
      filename: input.filename,
    },
    media: input.probe ?
      {
        duration_ms: input.probe.durationMs,
        duration: msToClock(input.probe.durationMs),
        resolution: { width: input.probe.width, height: input.probe.height },
        fps: input.probe.fps,
        video_codec: input.probe.videoCodec,
        audio_codec: input.probe.audioCodec,
        orientation:
          input.probe.height > input.probe.width ? "vertical" : "horizontal",
      }
    : null,
    one_line: reconstructable_script,
    reconstructable_script,
    timeline,
    transcript: [],
    music: {
      identified: false,
      description_for_reconstruction: "Módulo de música no enganchado.",
    },
    if_you_regenerate: {
      must_keep: ["duración y formato reales de la sonda"],
      will_probably_fail: ["apariencia, caras, canción, texto en pantalla"],
    },
  };
}

export function msToClock(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${String(m).padStart(2, "0")}:${rem.toFixed(3).padStart(6, "0")}`;
}
