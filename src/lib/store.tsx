"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_CONFIG, mergeModules, SUGGESTED_MODULES } from "./catalog";
import { outputsForItem } from "./compose";
import { denseCafeExtraction } from "./demo-extraction";
import type {
  AudioExtract,
  Batch,
  ConfigVersion,
  OutputConfig,
  ProbeResult,
  StoredVideo,
  StudioModule,
  ViewName,
} from "./types";

const KEY = "vx-studio-v1";

type Persist = {
  modules: StudioModule[];
  videos: StoredVideo[];
  batches: Batch[];
  config: OutputConfig;
  versions: ConfigVersion[];
  autoProcess: boolean;
  parallelism: number;
  language: string;
};

const seedVideo: StoredVideo = {
  id: "vid_seed_01",
  name: "reel_cafeteria_18s.mp4",
  origin: "url",
  createdAt: new Date().toISOString(),
  status: "ready",
  meta: "18 s · Ejemplo · URL",
  durationMs: 18240,
  extraction: denseCafeExtraction(),
  moduleOutputs: {
    moss: {
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
    "visual-reconstruction": {
      data: { segments: [{ start: 0, end: 3.2, description: "Cafetería, mujer, taza con corazón." }] },
    },
  },
  activity: [
    { time: "20:30", title: "Download", meta: "4.2 s", status: "ready" },
    { time: "20:31", title: "Scene Cuts", meta: "ffmpeg", status: "ready" },
    { time: "20:31", title: "MOSS Transcribe Diarize", meta: "sin GPU · fixture", status: "ready" },
    {
      time: "20:32",
      title: "Visual Reconstruction",
      meta: "VLM no enganchado · fixture de ejemplo",
      status: "ready",
    },
    { time: "20:34", title: "Compose final JSON", meta: "0.3 s", status: "ready" },
  ],
};

const defaultPersist: Persist = {
  modules: SUGGESTED_MODULES,
  videos: [seedVideo],
  batches: [],
  config: DEFAULT_CONFIG,
  versions: [
    {
      version: "v1",
      date: "Hoy",
      current: true,
      config: DEFAULT_CONFIG,
    },
  ],
  autoProcess: true,
  parallelism: 3,
  language: "es",
};

type StudioContextValue = Persist & {
  view: ViewName;
  setView: (v: ViewName) => void;
  activeVideoId: string | null;
  activeBatchId: string | null;
  setActiveBatchId: (id: string | null) => void;
  openVideo: (id: string) => void;
  addModule: (name: string, repoUrl?: string) => void;
  toggleModule: (id: string) => void;
  importJsonSource: (name: string, sample: unknown) => void;
  setConfig: (c: OutputConfig) => void;
  useVersion: (version: string) => void;
  setAutoProcess: (v: boolean) => void;
  setParallelism: (n: number) => void;
  setLanguage: (l: string) => void;
  createBatch: (items: { name: string; type: "file" | "url" | "zip"; file?: File }[]) => Promise<void>;
  importedSources: { id: string; name: string; sample: unknown }[];
};

const Ctx = createContext<StudioContextValue | null>(null);

function clock() {
  return new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [persist, setPersist] = useState<Persist>(defaultPersist);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<ViewName>("home");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);
  const [importedSources, setImportedSources] = useState<
    { id: string; name: string; sample: unknown }[]
  >([
    {
      id: "competitors",
      name: "competitors.json",
      sample: { competitors: [{ name: "Brand A", videos: [{ title: "Ad 1", views: 250000 }] }] },
    },
  ]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persist>;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate
        setPersist({
          ...defaultPersist,
          ...parsed,
          modules: mergeModules(parsed.modules),
        });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(persist));
  }, [persist, hydrated]);

  const addModule = useCallback((name: string, repoUrl?: string) => {
    const id = `mod_${Date.now()}`;
    setPersist((p) => ({
      ...p,
      modules: [
        ...p.modules,
        {
          id,
          name,
          kind: repoUrl ? "repo" : "builtin",
          category: "Custom",
          repoUrl: repoUrl || undefined,
          description: repoUrl ? "Repo enganchado. La app solo espera JSON." : "Módulo registrado por nombre.",
          enabled: true,
          status: "unwired",
          sample: { data: {} },
        },
      ],
    }));
  }, []);

  const toggleModule = useCallback((id: string) => {
    setPersist((p) => ({
      ...p,
      modules: p.modules.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
    }));
  }, []);

  const importJsonSource = useCallback((name: string, sample: unknown) => {
    setImportedSources((s) => [...s, { id: `imp_${Date.now()}`, name, sample }]);
  }, []);

  const setConfig = useCallback((c: OutputConfig) => {
    setPersist((p) => ({ ...p, config: c }));
  }, []);

  const useVersion = useCallback((version: string) => {
    setPersist((p) => {
      const found = p.versions.find((v) => v.version === version);
      return {
        ...p,
        config: found?.config ?? p.config,
        versions: p.versions.map((v) => ({ ...v, current: v.version === version })),
      };
    });
  }, []);

  const openVideo = useCallback((id: string) => {
    setActiveVideoId(id);
    setView("video-detail");
  }, []);

  const createBatch = useCallback(
    async (items: { name: string; type: "file" | "url" | "zip"; file?: File }[]) => {
      if (!items.length) return;
      const batchId = `batch_${Date.now()}`;
      const number = persist.batches.length + 1;
      const batchItems = items.map((it, i) => ({
        id: `${batchId}_${i}`,
        name: it.name,
        type: it.type,
        progress: 0,
        status: "queued" as const,
        stage: "En cola",
      }));
      const batch: Batch = { id: batchId, number, status: "processing", items: batchItems };
      setPersist((p) => ({ ...p, batches: [batch, ...p.batches] }));
      setActiveBatchId(batchId);
      setView("home");

      for (const [index, spec] of items.entries()) {
        await new Promise((r) => setTimeout(r, 80 * index));
        setPersist((p) => ({
          ...p,
          batches: p.batches.map((b) =>
            b.id !== batchId ? b : {
              ...b,
              items: b.items.map((it, i) =>
                i === index ? { ...it, status: "processing", stage: "Sonda de media", progress: 12 } : it
              ),
            }
          ),
        }));

        let probe: ProbeResult | undefined;
        let audio: AudioExtract | null = null;
        let audioError: string | null = null;
        const file = spec.file;
        const looksMedia = Boolean(
          file &&
            (file.type.startsWith("video") ||
              file.type.startsWith("audio") ||
              /\.(mp4|mov|mkv|webm|avi|mp3|wav|m4a|aac|ogg)$/i.test(spec.name))
        );
        if (looksMedia && file) {
          setPersist((p) => ({
            ...p,
            batches: p.batches.map((b) =>
              b.id !== batchId ? b : {
                ...b,
                items: b.items.map((it, i) =>
                  i === index ? { ...it, stage: "Audio: Whisper + diarización", progress: 40 } : it
                ),
              }
            ),
          }));
          try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/process", { method: "POST", body: fd });
            if (res.ok) {
              const data = (await res.json()) as {
                probe?: ProbeResult;
                audio?: AudioExtract | null;
                audioError?: string | null;
              };
              probe = data.probe;
              audio = data.audio ?? null;
              audioError = data.audioError ?? null;
            }
          } catch {
            probe = undefined;
          }
        }

        setPersist((p) => ({
          ...p,
          batches: p.batches.map((b) =>
            b.id !== batchId ? b : {
              ...b,
              items: b.items.map((it, i) =>
                i === index ? { ...it, stage: "Módulos", progress: 55 } : it
              ),
            }
          ),
        }));

        const useFixture = spec.type === "url" && /instagram|reel|cafe|cafeter/i.test(spec.name);
        const { moduleOutputs, extraction } = outputsForItem({
          name: spec.name,
          origin: spec.type,
          modules: persistRef.current.modules,
          probe,
          audio,
          useFixture,
        });

        const video: StoredVideo = {
          id: `vid_${Date.now()}_${index}`,
          name: spec.name,
          origin: spec.type,
          createdAt: new Date().toISOString(),
          status: "ready",
          meta: probe ?
            `${Math.round((probe.durationMs || 0) / 1000)} s · Ahora · ${spec.type === "url" ? "URL" : "Archivo"}`
          : `Ahora · ${spec.type === "url" ? "URL" : "Archivo"}`,
          durationMs: probe?.durationMs,
          extraction,
          moduleOutputs,
          activity: [
            { time: clock(), title: spec.type === "url" ? "Ingesta URL" : "Archivo", meta: spec.name, status: "ready" },
            {
              time: clock(),
              title: "Media Probe",
              meta: probe ? `${probe.width}×${probe.height}` : "sin archivo binario",
              status: probe ? "ready" : "error",
            },
            { time: clock(), title: "Scene Cuts", meta: probe ? `${probe.scenes.length} cortes` : "n/a", status: "ready" },
            {
              time: clock(),
              title: "Transcribe + Diarize",
              meta: audio ?
                `${audio.segments.length} frases · ${audio.speakers.join(", ") || "S01"} · ${audio.model}`
              : audioError || (looksMedia ? "sin habla / error" : "sin archivo local"),
              status: audio ? "ready" : looksMedia && audioError ? "error" : "ready",
            },
            {
              time: clock(),
              title: "Visual Reconstruction",
              meta: useFixture ? "fixture denso" : "VLM no enganchado",
              status: "ready",
            },
            { time: clock(), title: "Compose final JSON", meta: "ok", status: "ready" },
          ],
        };

        setPersist((p) => ({
          ...p,
          videos: [video, ...p.videos],
          batches: p.batches.map((b) => {
            if (b.id !== batchId) return b;
            const nextItems = b.items.map((it, i) =>
              i === index ?
                { ...it, status: "ready" as const, progress: 100, stage: "Listo", videoId: video.id }
              : it
            );
            const done = nextItems.every((it) => it.status === "ready" || it.status === "error");
            return { ...b, items: nextItems, status: done ? "complete" : b.status };
          }),
        }));
      }
    },
    [persist.batches.length]
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      ...persist,
      view,
      setView: (v) => {
        setView(v);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      activeVideoId,
      activeBatchId,
      setActiveBatchId,
      openVideo,
      addModule,
      toggleModule,
      importJsonSource,
      setConfig,
      useVersion,
      setAutoProcess: (v) => setPersist((p) => ({ ...p, autoProcess: v })),
      setParallelism: (n) => setPersist((p) => ({ ...p, parallelism: n })),
      setLanguage: (l) => setPersist((p) => ({ ...p, language: l })),
      createBatch,
      importedSources,
    }),
    [
      persist,
      view,
      activeVideoId,
      activeBatchId,
      openVideo,
      addModule,
      toggleModule,
      importJsonSource,
      setConfig,
      useVersion,
      createBatch,
      importedSources,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio outside provider");
  return ctx;
}
