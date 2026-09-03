"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildVideoExtraction } from "./demo-extraction";
import type { OnScreenText, ProbeResult, StoredVideo, VideoSpeech, ViewName } from "./types";
import { isVideoFile } from "./video-file";

const KEY = "vx-studio-real-v1";
const defaultVideos: StoredVideo[] = [];

type StudioContextValue = {
  videos: StoredVideo[];
  view: ViewName;
  setView: (v: ViewName) => void;
  activeVideoId: string | null;
  openVideo: (id: string) => void;
  ingestFiles: (files: File[]) => Promise<void>;
  clearAll: () => void;
};

const Ctx = createContext<StudioContextValue | null>(null);

function clock() {
  return new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<StoredVideo[]>(defaultVideos);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<ViewName>("home");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate
        setVideos(JSON.parse(raw) as StoredVideo[]);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(videos));
  }, [videos, hydrated]);

  const openVideo = useCallback((id: string) => {
    setActiveVideoId(id);
    setView("video-detail");
  }, []);

  const ingestFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter((file) => isVideoFile(file));
    for (const file of validFiles) {
      const id = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();

      const queued: StoredVideo = {
        id,
        name: file.name,
        createdAt,
        status: "processing",
        progress: 8,
        stage: "Subiendo vídeo",
        activity: [{ time: clock(), title: "Archivo recibido", detail: file.name, status: "ready" }],
      };

      setVideos((prev) => [queued, ...prev]);
      setActiveVideoId(id);
      setView("video-detail");

      try {
        const fd = new FormData();
        fd.append("file", file);

        setVideos((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, progress: 32, stage: "Leyendo metadatos y cortes" } : item
          )
        );

        const res = await fetch("/api/process", { method: "POST", body: fd });
        const data = (await res.json()) as {
          probe?: ProbeResult;
          speech?: VideoSpeech | null;
          speechError?: string | null;
          onScreenText?: OnScreenText | null;
          ocrError?: string | null;
          error?: string;
        };

        if (!res.ok || !data.probe) {
          throw new Error(data.error || "No se pudo procesar el vídeo");
        }

        const probe = data.probe;
        const extraction = buildVideoExtraction({
          filename: file.name,
          processedAt: new Date().toISOString(),
          probe,
          speech: data.speech,
          onScreenText: data.onScreenText,
        });

        setVideos((prev) =>
          prev.map((item) =>
            item.id === id ?
              {
                ...item,
                status: "ready",
                progress: 100,
                stage: "Listo",
                probe,
                speech: data.speech ?? null,
                onScreenText: data.onScreenText ?? null,
                extraction,
                activity: [
                  ...item.activity,
                  {
                    time: clock(),
                    title: "Media Probe",
                    detail: `${probe.width}×${probe.height} · ${Math.round(probe.durationMs / 1000)} s`,
                    status: "ready",
                  },
                  {
                    time: clock(),
                    title: "Habla del vídeo",
                    detail:
                      data.speech && data.speech.segments.length > 0 ?
                        `${data.speech.segments.length} segmentos · ${data.speech.model}`
                      : data.speechError || "Sin habla detectada",
                    status: "ready",
                  },
                  {
                    time: clock(),
                    title: "Texto en pantalla",
                    detail:
                      data.onScreenText && data.onScreenText.items.length > 0 ?
                        `${data.onScreenText.items.length} textos · ${data.onScreenText.engine}`
                      : data.ocrError || "Sin texto detectado",
                    status: "ready",
                  },
                ],
              }
            : item
          )
        );
      } catch (error) {
        setVideos((prev) =>
          prev.map((item) =>
            item.id === id ?
              {
                ...item,
                status: "error",
                progress: 100,
                stage: "Error",
                error: error instanceof Error ? error.message : "No se pudo procesar el vídeo",
                activity: [
                  ...item.activity,
                  {
                    time: clock(),
                    title: "Procesamiento",
                    detail:
                      error instanceof Error ? error.message : "No se pudo procesar el vídeo",
                    status: "error",
                  },
                ],
              }
            : item
          )
        );
      }
    }
  }, []);

  const clearAll = useCallback(() => {
    setVideos([]);
    setActiveVideoId(null);
    setView("home");
    localStorage.removeItem(KEY);
  }, []);

  const value = useMemo<StudioContextValue>(
    () => ({
      videos,
      view,
      setView: (v) => {
        setView(v);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      activeVideoId,
      openVideo,
      ingestFiles,
      clearAll,
    }),
    [videos, view, activeVideoId, openVideo, ingestFiles, clearAll]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio outside provider");
  return ctx;
}
