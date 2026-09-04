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
  ingestUrls: (urls: string[]) => Promise<void>;
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
    }, 1200);
    return () => window.clearInterval(timer);
  }, [videos, refreshJobs]);

  const openVideo = useCallback((id: string) => {
    setActiveVideoId(id);
    setView("video-detail");
  }, []);

  const ingestFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter((file) => isVideoFile(file));
    if (!validFiles.length) return;

    try {
      const fd = new FormData();
      for (const file of validFiles) {
        fd.append("files", file);
      }
      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const data = (await res.json()) as
        | (StoredVideo & { error?: string })
        | { jobs?: StoredVideo[]; rejected?: Array<{ name: string; error: string }>; error?: string };

      if (!res.ok) {
        throw new Error(
          ("error" in data && data.error) || "No se pudieron crear los trabajos"
        );
      }

      const jobs: StoredVideo[] =
        "jobs" in data && Array.isArray(data.jobs) ?
          data.jobs
        : "id" in data && data.id ?
          [data as StoredVideo]
        : [];

      if (!jobs.length) {
        throw new Error("No se creó ningún trabajo");
      }

      setVideos((prev) => {
        const ids = new Set(jobs.map((j) => j.id));
        return [...jobs, ...prev.filter((item) => !ids.has(item.id))];
      });
      setActiveVideoId(jobs[0].id);
      setView(jobs.length === 1 ? "video-detail" : "videos");
      void refreshJobs();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron crear los trabajos";
      const fallbackId = `local_${Date.now()}`;
      setVideos((prev) => [
        {
          id: fallbackId,
          name: validFiles.length === 1 ? validFiles[0].name : `${validFiles.length} vídeos`,
          createdAt: new Date().toISOString(),
          status: "error",
          progress: 100,
          stage: "Error",
          error: message,
          activity: [
            {
              time: clock(),
              title: "Creación del trabajo",
              detail: message,
              status: "error",
            },
          ],
        },
        ...prev,
      ]);
    }
  }, [refreshJobs]);

  const ingestUrls = useCallback(async (urls: string[]) => {
    const cleaned = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
    if (!cleaned.length) return;

    try {
      const res = await fetch("/api/jobs/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          cleaned.length === 1 ? { url: cleaned[0] } : { urls: cleaned }
        ),
      });
      const data = (await res.json()) as
        | (StoredVideo & { error?: string })
        | {
            jobs?: StoredVideo[];
            rejected?: Array<{ url: string; error: string }>;
            error?: string;
          };

      if (!res.ok) {
        throw new Error(
          ("error" in data && data.error) || "No se pudieron crear los trabajos desde los links"
        );
      }

      const jobs: StoredVideo[] =
        "jobs" in data && Array.isArray(data.jobs)
          ? data.jobs
          : "id" in data && data.id
            ? [data as StoredVideo]
            : [];

      if (!jobs.length) {
        throw new Error("No se creó ningún trabajo");
      }

      setVideos((prev) => {
        const ids = new Set(jobs.map((j) => j.id));
        return [...jobs, ...prev.filter((item) => !ids.has(item.id))];
      });
      setActiveVideoId(jobs[0].id);
      setView(jobs.length === 1 ? "video-detail" : "videos");
      void refreshJobs();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudieron usar esos links";
      const fallbackId = `local_${Date.now()}`;
      setVideos((prev) => [
        {
          id: fallbackId,
          name: cleaned.length === 1 ? cleaned[0].slice(0, 48) : `${cleaned.length} links`,
          createdAt: new Date().toISOString(),
          status: "error",
          progress: 100,
          stage: "Error",
          error: message,
          activity: [
            {
              time: clock(),
              title: "Links",
              detail: message,
              status: "error",
            },
          ],
        },
        ...prev,
      ]);
      setActiveVideoId(fallbackId);
      setView("video-detail");
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
      ingestUrls,
      clearAll,
    }),
    [videos, view, activeVideoId, openVideo, ingestFiles, ingestUrls, clearAll]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio outside provider");
  return ctx;
}
