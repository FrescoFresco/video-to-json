"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { StoredVideo, ViewName } from "./types";
import { isVideoFile } from "./video-file";

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
  const [view, setView] = useState<ViewName>("home");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const refreshJobs = useCallback(async () => {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { jobs: StoredVideo[] };
    setVideos(data.jobs);
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    const hasRunning = videos.some((video) => video.status === "queued" || video.status === "processing");
    if (!hasRunning) return;
    const timer = window.setInterval(() => {
      void refreshJobs();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [videos, refreshJobs]);

  const openVideo = useCallback((id: string) => {
    setActiveVideoId(id);
    setView("video-detail");
  }, []);

  const ingestFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter((file) => isVideoFile(file));
    for (const file of validFiles) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/jobs", { method: "POST", body: fd });
        const data = (await res.json()) as StoredVideo & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "No se pudo crear el trabajo");
        }
        setVideos((prev) => [data, ...prev.filter((item) => item.id !== data.id)]);
        setActiveVideoId(data.id);
        setView("video-detail");
        void refreshJobs();
      } catch (error) {
        const fallbackId = `local_${Date.now()}`;
        setVideos((prev) => [
          {
            id: fallbackId,
            name: file.name,
            createdAt: new Date().toISOString(),
            status: "error",
            progress: 100,
            stage: "Error",
            error: error instanceof Error ? error.message : "No se pudo crear el trabajo",
            activity: [
              {
                time: clock(),
                title: "Creación del trabajo",
                detail: error instanceof Error ? error.message : "No se pudo crear el trabajo",
                status: "error",
              },
            ],
          },
          ...prev,
        ]);
      }
    }
  }, [refreshJobs]);

  const clearAll = useCallback(() => {
    setVideos([]);
    setActiveVideoId(null);
    setView("home");
    void fetch("/api/jobs", { method: "DELETE" });
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
