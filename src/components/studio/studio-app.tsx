"use client";

import { useMemo, useRef, useState, useEffect, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  FolderOpen,
  Home,
  Lightbulb,
  Link2,
  Plug,
  RotateCcw,
  Search,
  Settings,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { etaLabel } from "@/lib/eta";
import { formatElapsed, formatModuleDuration } from "@/lib/format-time";
import { DEFAULT_COST, estimatePipelineSeconds, type CostConfig } from "@/lib/pipeline-cost";
import { msToClock } from "@/lib/extraction";
import { isLinkListFilename, readLinksFromFile } from "@/lib/ingest-links";
import { useStudio } from "@/lib/store";
import type {
  DeliveryTargetState,
  ExtractionModule,
  JobStatus,
  StoredVideo,
  TimelineEvent,
  ViewName,
} from "@/lib/types";
import { isVideoFile } from "@/lib/video-file";
import { IdeaView } from "@/components/studio/recreation-diagram";
import { ConnectionsView } from "@/components/studio/connections-view";
import { LayeredTimeline } from "@/components/studio/layered-timeline";

/** Config de coste del servidor (Whisper / VLM / max frames) para ETA realista. */
function useCostConfig() {
  const [cost, setCost] = useState<CostConfig>(DEFAULT_COST);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/modules", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { cost?: CostConfig };
        if (!cancelled && data.cost) setCost(data.cost);
      } catch {
        // fallback DEFAULT_COST
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return cost;
}


/**
 * Barra fina compartida.
 * - tone: colores planos (módulos, estados fijos)
 * - heat: degradado suave coral→ámbar→verde (cola de vídeos)
 * Colores alineados con chips En espera / Listos / Errores.
 */
function ThinProgressBar({
  value,
  tone = "active",
  variant = "tone",
  className = "",
}: {
  value: number;
  tone?: "active" | "queued" | "done" | "idle" | "error";
  variant?: "tone" | "heat";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const width =
    tone === "idle" ? 0 : tone === "done" ? 100 : Math.max(pct > 0 ? 8 : 0, pct);

  const solidFill =
    tone === "done"
      ? "bg-[#3d9a6a]"
      : tone === "queued"
        ? "bg-[#e2b340]"
        : tone === "error"
          ? "bg-[#c45c4a]"
          : tone === "idle"
            ? "bg-transparent"
            : "bg-[#3d6f99]";

  return (
    <div
      className={`h-1 overflow-hidden rounded-full bg-[#ececf0] ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${
          variant === "heat" ? "" : solidFill
        }`}
        style={{
          width: `${width}%`,
          ...(variant === "heat" && width > 0
            ? {
                backgroundImage:
                  "linear-gradient(90deg, #c47a6a 0%, #d4a04a 42%, #4a9a72 100%)",
              }
            : {}),
        }}
      />
    </div>
  );
}

function downloadJson(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 400);
}

function safeDownloadName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]+/gi, "_").trim();
  return (base || "video").slice(0, 60);
}

function downloadSelectedExtractions(videos: StoredVideo[]) {
  const withJson = videos.filter((v) => v.extraction);
  if (!withJson.length) return { ok: 0, skipped: videos.length };

  if (withJson.length === 1) {
    const v = withJson[0];
    const partial = v.status !== "ready";
    downloadJson(
      `${safeDownloadName(v.name)}${partial ? "-parcial" : ""}-complete.json`,
      v.extraction
    );
    return { ok: 1, skipped: videos.length - 1 };
  }

  downloadJson(`videos-complete-${withJson.length}.json`, {
    schema_version: "2.0",
    kind: "video_complete_pack",
    exported_at: new Date().toISOString(),
    count: withJson.length,
    items: withJson.map((v) => ({
      id: v.id,
      name: v.name,
      status: v.status,
      extraction: v.extraction,
    })),
  });
  return { ok: withJson.length, skipped: videos.length - withJson.length };
}

function StatusDot({ status }: { status: JobStatus }) {
  const map = {
    ready: "bg-[#edf6f1] text-[#177245]",
    queued: "bg-[#fff6df] text-[#9a6700]",
    processing: "bg-[#fff6df] text-[#9a6700]",
    error: "bg-[#fff0ef] text-[#b42318]",
  } as const;
  const icon =
    status === "ready" ? <Check className="size-3.5" /> :
    status === "error" ? <X className="size-3.5" /> :
    <span className="size-2 rounded-full bg-current animate-pulse" />;

  return (
    <span className={`inline-grid size-[22px] place-items-center rounded-full ${map[status]}`}>
      {icon}
    </span>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  primary,
}: {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  primary?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon-lg"
      variant={primary ? "default" : "outline"}
      title={title}
      aria-label={title}
      onClick={onClick}
      className="size-10 rounded-[9px]"
    >
      {children}
    </Button>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-[#75757d]">{body}</p>
    </div>
  );
}

export function StudioApp() {
  const s = useStudio();
  const activeVideo = useMemo(
    () => s.videos.find((video) => video.id === s.activeVideoId) ?? s.videos[0] ?? null,
    [s.videos, s.activeVideoId]
  );

  const nav = (view: ViewName, icon: ReactNode, label: string) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => s.setView(view)}
      className={`grid size-10 place-items-center rounded-[9px] ${
        s.view === view || (s.view === "video-detail" && view === "videos") ?
          "bg-[#f5f5f7] text-[#171719]"
        : "text-[#75757d] hover:bg-[#f5f5f7] hover:text-[#171719]"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#fbfbfc] text-[#171719] md:grid md:grid-cols-[72px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-20 hidden h-screen flex-col gap-5 border-r border-[#e7e7eb] bg-[#fbfbfc]/92 px-2.5 py-5 backdrop-blur-md md:flex">
        <div className="grid h-10 place-items-center">
          <div className="grid size-[30px] place-items-center rounded-[9px] bg-[#171719] text-[11px] font-bold text-white">
            VX
          </div>
        </div>
        <div className="grid justify-items-center gap-1">
          {nav("home", <Home className="size-[17px]" />, "Inicio")}
          {nav("videos", <Video className="size-[17px]" />, "Vídeos")}
          {nav("docs", <BookOpen className="size-[17px]" />, "Docs")}
          {nav("idea", <Lightbulb className="size-[17px]" />, "La idea")}
          {nav("connections", <Plug className="size-[17px]" />, "Conexiones")}
          {nav("settings", <Settings className="size-[17px]" />, "Ajustes")}
        </div>
      </aside>

      <main className="min-w-0 overflow-x-hidden px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:px-[clamp(22px,3vw,42px)] md:py-[clamp(22px,3vw,42px)] md:pb-[clamp(22px,3vw,42px)]">
        <div className="mx-auto w-full min-w-0 max-w-[1080px]">
          {s.view === "home" && <HomeView />}
          {s.view === "idea" && <IdeaView />}
          {s.view === "videos" && <VideosView />}
          {s.view === "video-detail" && activeVideo && <VideoDetail video={activeVideo} />}
          {s.view === "docs" && (
            <DocsView onOpenConnections={() => s.setView("connections")} />
          )}
          {s.view === "connections" && <ConnectionsView />}
          {s.view === "settings" && <SettingsView />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e7eb] bg-[#fbfbfc] px-1 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 md:hidden">
        <div className="grid grid-cols-6 gap-0.5">
          {(
            [
              ["home", "Inicio", <Home key="h" className="size-[17px]" />],
              ["videos", "Vídeos", <Video key="v" className="size-[17px]" />],
              ["docs", "Docs", <BookOpen key="d" className="size-[17px]" />],
              ["idea", "Idea", <Lightbulb key="i" className="size-[17px]" />],
              ["connections", "Conex.", <Plug key="c" className="size-[17px]" />],
              ["settings", "Más", <Settings key="s" className="size-[17px]" />],
            ] as const
          ).map(([view, label, icon]) => {
            const active =
              s.view === view || (view === "videos" && s.view === "video-detail");
            return (
              <button
                key={view}
                type="button"
                onClick={() => s.setView(view)}
                className={`grid min-h-12 place-items-center gap-0.5 rounded-[9px] px-0.5 ${
                  active ? "bg-[#f5f5f7] text-[#171719]" : "text-[#75757d]"
                }`}
              >
                {icon}
                <span className="text-[9.5px] leading-none font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HomeView() {
  const s = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [link, setLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const homeCost = useCostConfig();
  const [homeNow, setHomeNow] = useState(() => Date.now());

  useEffect(() => {
    const active = s.videos.some(
      (v) => v.status === "queued" || v.status === "processing"
    );
    if (!active) return;
    const timer = window.setInterval(() => setHomeNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [s.videos]);

  async function handleIncoming(files: FileList | File[] | null) {
    if (!files?.length) return;
    const list = [...files];
    const videos = list.filter((file) => isVideoFile(file));
    const linkFiles = list.filter((file) => isLinkListFilename(file.name));

    const urls: string[] = [];
    for (const file of linkFiles) {
      urls.push(...(await readLinksFromFile(file)));
    }

    if (videos.length) await s.ingestFiles(videos);
    if (urls.length) await s.ingestUrls(urls);
  }

  async function handleLinkSubmit(e?: FormEvent) {
    e?.preventDefault();
    const lines = link
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length || linkBusy) return;
    setLinkBusy(true);
    try {
      await s.ingestUrls(lines);
      setLink("");
    } finally {
      setLinkBusy(false);
    }
  }

  return (
    <div className="vx-home-hero -mx-4 px-4 py-2 md:-mx-[clamp(22px,3vw,42px)] md:px-[clamp(22px,3vw,42px)] md:py-4">
      <div className="mx-auto grid max-w-[760px] gap-8 py-10 md:gap-10 md:py-14">
        <div className="vx-home-fade max-w-[34rem]">
          <p className="vx-home-brand m-0 text-[clamp(40px,10vw,72px)] leading-[0.9] text-[#171719]">
            Video Extraction
            <br />
            Studio
          </p>
          <p className="mt-4 m-0 max-w-[24rem] text-[14px] leading-snug tracking-[-0.015em] text-[#6a7380] sm:text-[15px]">
            Extractor de vídeo → JSON denso.
          </p>
        </div>

        <div
          tabIndex={0}
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDrag(false);
            setFolderBusy(true);
            try {
              await handleIncoming(e.dataTransfer.files);
            } finally {
              setFolderBusy(false);
            }
          }}
          className={`vx-home-fade vx-home-fade-delay flex min-h-[240px] flex-col items-start justify-center gap-4 border-2 border-dashed px-6 py-9 transition sm:min-h-[280px] sm:gap-5 sm:px-10 sm:py-11 md:min-h-[320px] md:px-12 md:py-12 ${
            drag ? "border-[#171719] bg-white shadow-[inset_0_0_0_1px_#171719]" : "border-[#9aa3b0] bg-[#eceef2]"
          }`}
        >
          <div className="flex items-start gap-3.5 text-[#171719] sm:items-center">
            <Upload className="mt-0.5 size-6 shrink-0 opacity-85 sm:mt-0" strokeWidth={1.75} />
            <span className="text-[16px] leading-snug font-medium tracking-[-0.015em] sm:text-[17px]">
              {folderBusy
                ? "Encolando…"
                : "Suelta aquí tus vídeos, una carpeta o un .txt con links"}
            </span>
          </div>
          <p className="m-0 text-[13px] leading-relaxed text-[#5a6573] sm:text-[13.5px]">
            MP4, MOV, MKV, WebM · carpeta completa · lista de links (.txt)
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/*,.mp4,.mov,.mkv,.webm,.m4v,.txt,.csv"
            hidden
            onChange={async (e) => {
              setFolderBusy(true);
              try {
                await handleIncoming(e.target.files);
              } finally {
                setFolderBusy(false);
                e.target.value = "";
              }
            }}
          />
          <input
            ref={folderRef}
            type="file"
            multiple
            hidden
            onChange={async (e) => {
              setFolderBusy(true);
              try {
                await handleIncoming(e.target.files);
              } finally {
                setFolderBusy(false);
                e.target.value = "";
              }
            }}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="w-full rounded-lg border-[#d0d4da] bg-white hover:bg-[#f5f5f7] sm:w-auto"
              disabled={folderBusy}
              onClick={() => inputRef.current?.click()}
            >
              Seleccionar archivos
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-lg border-[#d0d4da] bg-white hover:bg-[#f5f5f7] sm:w-auto"
              disabled={folderBusy}
              onClick={() => {
                const el = folderRef.current;
                if (!el) return;
                el.setAttribute("webkitdirectory", "");
                el.setAttribute("directory", "");
                el.click();
              }}
            >
              Seleccionar carpeta
            </Button>
          </div>
        </div>

        <form
          onSubmit={(e) => void handleLinkSubmit(e)}
          className="vx-home-fade vx-home-fade-delay grid gap-3"
        >
          <label className="text-[13px] font-medium text-[#6a7380]" htmlFor="vx-video-url">
            O pega uno o varios links
          </label>
          <textarea
            id="vx-video-url"
            rows={4}
            autoComplete="off"
            placeholder={"https://www.tiktok.com/@cuenta/video/…\nhttps://www.instagram.com/reel/…\nhttps://www.youtube.com/watch?v=…"}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={linkBusy}
            className="min-w-0 w-full resize-y rounded-lg border border-[#d0d4da] bg-white px-3.5 py-2.5 text-sm text-[#171719] outline-none placeholder:text-[#9aa1ab] focus:border-[#171719] disabled:opacity-60"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Button
              type="submit"
              className="w-full rounded-lg sm:w-auto"
              disabled={linkBusy || !link.trim()}
            >
              {linkBusy ? "Encolando…" : "Analizar links"}
            </Button>
            <p className="m-0 text-[12.5px] leading-relaxed text-[#6a7380]">
              Un link por línea. Cuantos quieras: entran en cola y se procesan por lotes.
            </p>
          </div>
        </form>

        {s.videos.length > 0 && (
          <div className="vx-home-fade vx-home-fade-delay-2 min-w-0">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium tracking-[0.04em] text-[#6a7380] uppercase">
                Recientes
              </p>
              <Button
                variant="outline"
                className="w-full rounded-lg sm:w-auto"
                onClick={s.clearAll}
              >
                Limpiar historial
              </Button>
            </div>
            <div className="min-w-0 overflow-hidden border border-[#e7e7eb] bg-white">
              {s.videos.slice(0, 5).map((video) => {
                const eta = etaLabel(video, s.videos, 12, homeNow, homeCost);
                return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => s.openVideo(video.id)}
                  className={`grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[#e7e7eb] px-3 py-3.5 text-left first:border-t-0 sm:gap-3 sm:px-4 sm:py-4 ${videoRowSurface(
                    video.status,
                    false
                  )}`}
                >
                  <StatusDot status={video.status} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{video.name}</div>
                    <div className="mt-1 text-[12px] leading-snug break-words text-[#75757d] sm:text-[12.5px]">
                      {videoMetaParts(video, { eta }).join(" · ") || "—"}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <ThinProgressBar
                        value={video.progress}
                        tone={
                          video.status === "ready"
                            ? "done"
                            : video.status === "error"
                              ? "error"
                              : video.status === "queued"
                                ? "queued"
                                : "active"
                        }
                        variant={video.status === "processing" ? "heat" : "tone"}
                        className="min-w-0 flex-1"
                      />
                      {video.status === "processing" || video.status === "queued" ? (
                        <span className="shrink-0 text-[11px] tabular-nums text-[#9a9aa3]">
                          {Math.round(video.progress)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-[12px] font-medium ${
                      video.status === "ready"
                        ? "text-[#177245]"
                        : video.status === "error"
                          ? "text-[#b42318]"
                          : "text-[#75757d]"
                    }`}
                  >
                    {statusLabel(video.status)}
                  </div>
                </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: JobStatus) {
  if (status === "queued") return "En espera";
  if (status === "processing") return "Procesando";
  if (status === "ready") return "Listo";
  return "Error";
}

/** Stage often mirrors the status label ("Listo", "Error"); skip duplicates. */
function stageHint(video: StoredVideo) {
  const stage = (video.stage || "").trim();
  if (!stage) return null;
  if (stage === statusLabel(video.status)) return null;
  return stage;
}

function videoMetaParts(
  video: StoredVideo,
  opts?: { eta?: string | null; includeStatus?: boolean; includeProbe?: boolean }
) {
  const parts: string[] = [];
  if (opts?.includeStatus !== false) parts.push(statusLabel(video.status));
  const stage = stageHint(video);
  if (stage) parts.push(stage);
  if (opts?.includeProbe !== false && video.probe) {
    parts.push(`${Math.round(video.probe.durationMs / 1000)} s`);
  }
  if (opts?.eta) parts.push(opts.eta);
  return parts;
}

type StatusFilter = "all" | JobStatus;
type SortMode = "newest" | "oldest" | "name-asc" | "name-desc" | "status";

function queueRank(status: JobStatus) {
  if (status === "processing") return 0;
  if (status === "queued") return 1;
  if (status === "error") return 2;
  return 3;
}

function QueueSummary({
  videos,
  active,
  onSelect,
}: {
  videos: StoredVideo[];
  active: StatusFilter;
  onSelect: (filter: StatusFilter) => void;
}) {
  const waiting = videos.filter((v) => v.status === "queued").length;
  const processing = videos.filter((v) => v.status === "processing").length;
  const ready = videos.filter((v) => v.status === "ready").length;
  const errored = videos.filter((v) => v.status === "error").length;

  const Chip = ({
    label,
    value,
    tone,
    filter,
  }: {
    label: string;
    value: number;
    tone: string;
    filter: StatusFilter;
  }) => {
    const selected = active === filter;
    return (
      <button
        type="button"
        onClick={() => onSelect(selected ? "all" : filter)}
        className={`rounded-xl px-3 py-2 text-left transition ${tone} ${
          selected ? "ring-2 ring-[#171719] ring-offset-2 ring-offset-[#fbfbfc]" : "opacity-90 hover:opacity-100"
        }`}
      >
        <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
        <div className="mt-0.5 text-lg font-semibold">{value}</div>
      </button>
    );
  };

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
      <Chip label="En espera" value={waiting} tone="bg-[#fff6df] text-[#9a6700]" filter="queued" />
      <Chip
        label="Procesando"
        value={processing}
        tone="bg-[#eef3f8] text-[#2f4d6a]"
        filter="processing"
      />
      <Chip label="Listos" value={ready} tone="bg-[#edf6f1] text-[#177245]" filter="ready" />
      <Chip label="Errores" value={errored} tone="bg-[#fff0ef] text-[#b42318]" filter="error" />
    </div>
  );
}

function videoRowSurface(status: JobStatus, selected: boolean) {
  if (selected) return "bg-[#f3f3f6]";
  if (status === "ready") return "bg-[#f6faf7]";
  if (status === "error") return "bg-[#fff8f7]";
  return "bg-white";
}

function VideoQueueRow({
  video,
  eta,
  selected,
  onToggle,
  onOpen,
}: {
  video: StoredVideo;
  eta: string | null;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const inFlight = video.status === "processing" || video.status === "queued";
  const barTone =
    video.status === "ready"
      ? "done"
      : video.status === "error"
        ? "error"
        : video.status === "queued"
          ? "queued"
          : "active";
  /** Heat solo en marcha: en Listo el verde sólido encaja mejor con el tinte del bloque. */
  const useHeat = video.status === "processing";

  return (
    <div
      className={`grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-start gap-2.5 border-t border-[#e7e7eb] px-3 py-3 first:border-t-0 sm:items-center sm:gap-3 sm:px-4 sm:py-3.5 ${videoRowSurface(
        video.status,
        selected
      )}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Seleccionar ${video.name}`}
        className="mt-1 size-4 shrink-0 accent-[#171719] sm:mt-0"
      />
      <button type="button" onClick={onOpen} className="mt-0.5 shrink-0 sm:mt-0" title="Abrir detalle">
        <StatusDot status={video.status} />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left"
        data-video-open={video.id}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-medium text-[#171719]">{video.name}</div>
          <div className="shrink-0 text-right text-[11px] font-medium text-[#5c5c66] sm:hidden">
            {statusLabel(video.status)}
          </div>
        </div>
        <div className="mt-1 text-[12px] leading-snug break-words text-[#75757d] sm:text-[12.5px]">
          <span className="sm:hidden">
            {videoMetaParts(video, { eta, includeStatus: false }).join(" · ") || "—"}
          </span>
          <span className="hidden sm:inline">
            {videoMetaParts(video, { eta }).join(" · ")}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <ThinProgressBar
            value={video.progress}
            tone={barTone}
            variant={useHeat ? "heat" : "tone"}
            className="min-w-0 flex-1"
          />
          {inFlight ? (
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-[#9a9aa3]">
              {Math.round(video.progress)}%
            </span>
          ) : null}
          <span
            className="grid size-7 shrink-0 place-items-center rounded-full border border-[#e0e0e6] bg-white/80 text-[#171719] sm:hidden"
            title="Ver detalle"
            aria-hidden
          >
            <ChevronRight className="size-3.5" strokeWidth={2.25} />
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={onOpen}
        title="Ver detalle"
        aria-label={`Abrir detalle de ${video.name}`}
        className="mt-0.5 hidden shrink-0 items-center gap-2.5 text-right text-[12px] text-[#75757d] sm:mt-0 sm:flex"
      >
        <span
          className={`font-medium ${
            video.status === "ready"
              ? "text-[#177245]"
              : video.status === "error"
                ? "text-[#b42318]"
                : "text-[#171719]"
          }`}
        >
          {statusLabel(video.status)}
        </span>
        <span className="grid size-8 place-items-center rounded-full border border-[#e0e0e6] bg-white/90 text-[#171719] transition-colors hover:border-[#c8c8d0] hover:bg-white">
          <ChevronRight className="size-4" strokeWidth={2.25} />
        </span>
      </button>
    </div>
  );
}

function VideosView() {
  const s = useStudio();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [moduleCount, setModuleCount] = useState(12);
  const costCfg = useCostConfig();
  const [now, setNow] = useState(() => Date.now());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/modules", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { modules?: unknown[] };
        if (!cancelled && data.modules?.length) setModuleCount(data.modules.length);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const active = s.videos.some(
      (v) => v.status === "queued" || v.status === "processing"
    );
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [s.videos]);

  // Quita de la selección ids que ya no existen
  useEffect(() => {
    const alive = new Set(s.videos.map((v) => v.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (alive.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [s.videos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...s.videos];

    if (statusFilter !== "all") {
      list = list.filter((video) => video.status === statusFilter);
    }
    if (q) {
      list = list.filter((video) => {
        const hay = `${video.name} ${video.stage || ""} ${video.error || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sortMode === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortMode === "name-asc") return a.name.localeCompare(b.name, "es");
      if (sortMode === "name-desc") return b.name.localeCompare(a.name, "es");
      if (sortMode === "status") {
        const rank = queueRank(a.status) - queueRank(b.status);
        if (rank !== 0) return rank;
        return b.createdAt.localeCompare(a.createdAt);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });

    return list;
  }, [s.videos, query, statusFilter, sortMode]);

  const filteredIds = useMemo(() => filtered.map((v) => v.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const selectedVideos = useMemo(
    () => s.videos.filter((v) => selectedIds.has(v.id)),
    [s.videos, selectedIds]
  );
  const selectedWithJson = selectedVideos.filter((v) => v.extraction).length;

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkMsg(null);
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
    setBulkMsg(null);
  }

  function selectReadyOnly() {
    setSelectedIds(new Set(filtered.filter((v) => v.status === "ready").map((v) => v.id)));
    setBulkMsg(null);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkMsg(null);
  }

  function handleDownloadSelected() {
    const result = downloadSelectedExtractions(selectedVideos);
    if (result.ok === 0) {
      setBulkMsg("Ninguno de los seleccionados tiene JSON aún.");
      return;
    }
    setBulkMsg(
      result.skipped > 0
        ? `Descargados ${result.ok}. ${result.skipped} sin JSON se omitieron.`
        : result.ok === 1
          ? "JSON descargado."
          : `Pack con ${result.ok} extracciones descargado.`
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6 sm:items-end">
        <div className="min-w-0">
          <h1 className="text-[clamp(22px,5vw,32px)] font-semibold tracking-[-0.035em]">Vídeos</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-[#75757d] sm:text-sm">
            Selecciona varios y descarga su JSON. Busca y filtra como quieras.
          </p>
        </div>
        {s.videos.length > 0 && (
          <Button
            variant="outline"
            className="shrink-0 rounded-xl px-3 sm:px-4"
            onClick={s.clearAll}
          >
            <RotateCcw className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">Limpiar</span>
          </Button>
        )}
      </div>

      {s.videos.length === 0 ? (
        <EmptyCard
          title="Aún no hay vídeos"
          body="Vuelve a Home, sube uno o varios MP4 y aquí verás la cola en tiempo real."
        />
      ) : (
        <>
          <QueueSummary
            videos={s.videos}
            active={statusFilter}
            onSelect={setStatusFilter}
          />

          <div className="mb-3 grid min-w-0 gap-2">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a9aa3]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre…"
                className="w-full rounded-xl border border-[#e7e7eb] bg-white py-2.5 pr-3 pl-10 text-sm outline-none placeholder:text-[#9a9aa3] focus:border-[#171719]"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="min-w-0 rounded-xl border border-[#e7e7eb] bg-white px-2.5 py-2.5 text-sm outline-none focus:border-[#171719] sm:px-3"
                aria-label="Filtrar por estado"
              >
                <option value="all">Todos</option>
                <option value="queued">En espera</option>
                <option value="processing">Procesando</option>
                <option value="ready">Listos</option>
                <option value="error">Errores</option>
              </select>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="min-w-0 rounded-xl border border-[#e7e7eb] bg-white px-2.5 py-2.5 text-sm outline-none focus:border-[#171719] sm:px-3"
                aria-label="Ordenar"
              >
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="name-asc">Nombre A→Z</option>
                <option value="name-desc">Nombre Z→A</option>
                <option value="status">Activos primero</option>
              </select>
            </div>
          </div>

          <div className="mb-3 grid min-w-0 gap-2 rounded-xl border border-[#e7e7eb] bg-white p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#171719]">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  disabled={filtered.length === 0}
                  className="size-4 accent-[#171719]"
                />
                Seleccionar todos
              </label>
              <span className="text-[12px] text-[#75757d] sm:text-[12.5px]">
                {selectedIds.size === 0
                  ? "Ninguno seleccionado"
                  : `${selectedIds.size} seleccionado${selectedIds.size === 1 ? "" : "s"}`}
                {selectedIds.size > 0 ? ` · ${selectedWithJson} con JSON` : ""}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                className="col-span-2 rounded-lg sm:col-span-1"
                disabled={selectedWithJson === 0}
                onClick={handleDownloadSelected}
              >
                <Download className="mr-1.5 size-3.5 shrink-0" />
                <span className="truncate">Descargar JSON completo</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={selectReadyOnly}
              >
                Solo listos
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                disabled={selectedIds.size === 0}
                onClick={clearSelection}
              >
                Quitar
              </Button>
            </div>
          </div>
          {bulkMsg ? (
            <p className="mb-2 text-[12.5px] text-[#75757d]">{bulkMsg}</p>
          ) : null}

          <p className="mb-2 text-[12.5px] text-[#75757d]">
            {filtered.length === s.videos.length
              ? `${filtered.length} vídeos`
              : `${filtered.length} de ${s.videos.length}`}
            {statusFilter !== "all" || query ? " · " : ""}
            {(statusFilter !== "all" || query) && (
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                Quitar filtros
              </button>
            )}
          </p>

          {filtered.length === 0 ? (
            <EmptyCard
              title="Nada coincide"
              body="Prueba otro texto, otro filtro o quita los filtros."
            />
          ) : (
            <div className="rounded-2xl border border-[#e7e7eb] bg-white">
              {filtered.map((video) => (
                <VideoQueueRow
                  key={video.id}
                  video={video}
                  eta={etaLabel(video, s.videos, moduleCount, now, costCfg)}
                  selected={selectedIds.has(video.id)}
                  onToggle={() => toggleOne(video.id)}
                  onOpen={() => s.openVideo(video.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VideoDetail({ video }: { video: StoredVideo }) {
  const s = useStudio();
  const extraction = video.extraction;
  const [catalog, setCatalog] = useState<Array<{ id: string; title: string; stage: string }>>([]);
  const [detailTab, setDetailTab] = useState("estado");
  const costCfg = useCostConfig();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/modules", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          modules?: Array<{ id: string; title: string; stage: string }>;
        };
        if (!cancelled && data.modules) setCatalog(data.modules);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Al abrir otro vídeo, vuelve a Estado
  useEffect(() => {
    setDetailTab("estado");
  }, [video.id]);

  const doneById = useMemo(() => {
    const map = new Map<string, ExtractionModule>();
    for (const mod of extraction?.modules || []) map.set(mod.id, mod);
    return map;
  }, [extraction]);

  const liveRows = useMemo(() => {
    const ids = new Set<string>();
    const rows: Array<{
      id: string;
      title: string;
      stage: string;
      phase: "done" | "running" | "waiting";
      module?: ExtractionModule;
    }> = [];

    for (const entry of catalog) {
      ids.add(entry.id);
      const done = doneById.get(entry.id);
      let phase: "done" | "running" | "waiting" = "waiting";
      if (done) phase = "done";
      else if (
        (video.status === "processing" || video.status === "queued") &&
        video.stage === entry.stage
      ) {
        phase = "running";
      }
      rows.push({
        id: entry.id,
        title: entry.title,
        stage: entry.stage,
        phase,
        module: done,
      });
    }

    // Módulos nuevos no listados en catálogo (por si el registry cambia mid-flight)
    for (const mod of extraction?.modules || []) {
      if (ids.has(mod.id)) continue;
      rows.push({
        id: mod.id,
        title: mod.title,
        stage: mod.title,
        phase: "done",
        module: mod,
      });
    }

    return rows;
  }, [catalog, doneById, extraction, video.status, video.stage]);

  const doneCount = liveRows.filter((r) => r.phase === "done").length;
  const activeModuleRow = liveRows.find((r) => r.id === detailTab);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (video.status !== "queued" && video.status !== "processing") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [video.status]);

  const eta = etaLabel(
    video,
    s.videos,
    Math.max(catalog.length, liveRows.length, 10),
    now,
    costCfg
  );

  const durationSec = Math.max(
    5,
    (video.probe?.durationMs ?? video.extraction?.media?.duration_ms ?? 45_000) / 1000
  );
  const moduleEstimateSec = estimatePipelineSeconds(durationSec, costCfg).byId;

  const tabBtn = (id: string, label: string, hint?: string) => {
    const active = detailTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setDetailTab(id)}
        className={`shrink-0 border-b-2 px-2.5 py-2 text-[13px] transition-colors sm:px-3 sm:py-2.5 sm:text-sm ${
          active
            ? "border-[#171719] font-semibold text-[#171719]"
            : "border-transparent font-medium text-[#75757d] hover:text-[#171719]"
        }`}
      >
        <span className="inline-flex max-w-[9.5rem] items-baseline gap-1 truncate sm:max-w-none">
          <span className="truncate">{label}</span>
          {hint ? (
            <span className={`shrink-0 text-[10px] sm:text-[11px] ${active ? "text-[#171719]" : "text-[#9a9aa3]"}`}>
              {hint}
            </span>
          ) : null}
        </span>
      </button>
    );
  };

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <IconBtn title="Volver" onClick={() => s.setView("videos")}>
            <ArrowLeft className="size-[18px]" />
          </IconBtn>
          <h1 className="mt-3 break-words text-[clamp(20px,5vw,32px)] font-semibold tracking-[-0.035em]">
            {video.name}
          </h1>
          {video.sourceUrl ? (
            <a
              href={video.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block max-w-full truncate text-[12.5px] text-[#3d6f99] underline-offset-2 hover:underline"
              title={video.sourceUrl}
            >
              {video.sourceUrl}
            </a>
          ) : null}
          <div className="mt-2 flex items-start gap-2 text-[12px] text-[#75757d] sm:text-[12.5px]">
            <StatusDot status={video.status} />
            <span className="min-w-0 leading-snug break-words">
              {[
                ...videoMetaParts(video, { eta, includeProbe: false }),
                liveRows.length > 0 ? `${doneCount}/${liveRows.length} módulos` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          {(video.status === "processing" || video.status === "queued") && (
            <ThinProgressBar
              value={video.progress}
              tone={video.status === "queued" ? "queued" : "active"}
              variant={video.status === "processing" ? "heat" : "tone"}
              className="mt-3 max-w-full sm:max-w-sm"
            />
          )}
          {eta && (video.status === "processing" || video.status === "queued") ? (
            <p className="mt-2 text-[12px] leading-relaxed text-[#6a7380] sm:text-[12.5px]">
              Tiempo estimado (orientativo en CPU). Se ajusta según el progreso real.
            </p>
          ) : null}
        </div>
        {extraction && (
          <Button
            className="w-full rounded-xl sm:w-auto"
            onClick={() =>
              downloadJson(
                video.status === "ready"
                  ? `${safeDownloadName(video.name)}-complete.json`
                  : `${safeDownloadName(video.name)}-parcial-complete.json`,
                extraction
              )
            }
          >
            <Download className="mr-2 size-4" />
            {video.status === "ready" ? "Descargar JSON completo" : "Descargar JSON parcial"}
          </Button>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Resultados del vídeo"
        className="vx-tab-scroll sticky top-0 z-10 -mx-4 flex gap-0 overflow-x-auto overscroll-x-contain border-b border-[#e7e7eb] bg-[#fbfbfc]/95 px-4 backdrop-blur-sm md:mx-0 md:px-0"
      >
        {tabBtn("estado", "Estado")}
        {tabBtn(
          "timeline",
          "Capas",
          extraction?.timeline?.length ? String(extraction.timeline.length) : undefined
        )}
        {liveRows.map((row) =>
          tabBtn(
            row.id,
            row.title,
            row.phase === "done"
              ? row.module?.duration_ms
                ? formatModuleDuration(row.module.duration_ms)
                : "✓"
              : row.phase === "running"
                ? "…"
                : undefined
          )
        )}
        {tabBtn("json", "JSON completo")}
        {tabBtn("activity", "Actividad")}
      </div>

      <div className="mt-5 min-w-0" role="tabpanel">
        {detailTab === "estado" ? (
          video.status === "error" && !extraction ? (
            <EmptyCard title="No se pudo procesar" body={video.error || "Error desconocido"} />
          ) : (
            <div className="grid gap-4">
              {extraction?.media ? (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <Metric label="Duración" value={extraction.media.duration} />
                  <Metric
                    label="Resolución"
                    value={`${extraction.media.width}×${extraction.media.height}`}
                  />
                  <Metric label="FPS" value={String(extraction.media.fps)} />
                  <Metric label="Módulos listos" value={`${doneCount}/${liveRows.length || "—"}`} />
                </div>
              ) : video.probe ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Duración" value={msToClock(video.probe.durationMs)} />
                  <Metric
                    label="Resolución"
                    value={`${video.probe.width}×${video.probe.height}`}
                  />
                  <Metric label="FPS" value={String(video.probe.fps)} />
                </div>
              ) : null}

              <DeliveriesPanel video={video} />

              <section className="rounded-xl border border-[#e7e7eb] bg-white p-4">
                <div className="text-sm font-semibold">Progreso de módulos</div>
                <p className="mt-1 text-[12.5px] text-[#75757d]">
                  Pulsa la pestaña de cada módulo arriba para ver su resultado. A la derecha
                  ves cuánto tarda (o lleva) cada uno.
                  {(() => {
                    const totalMs = liveRows.reduce(
                      (sum, row) => sum + (row.module?.duration_ms || 0),
                      0
                    );
                    return totalMs > 0
                      ? ` Suma de módulos listos: ${formatModuleDuration(totalMs)}.`
                      : "";
                  })()}
                </p>
                <div className="mt-3 grid gap-1.5">
                  {liveRows.length === 0 ? (
                    <p className="text-sm text-[#75757d]">
                      {video.status === "queued"
                        ? "En espera de hueco en la cola…"
                        : "Preparando extractores…"}
                    </p>
                  ) : (
                    liveRows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="w-full text-left"
                        onClick={() => setDetailTab(row.id)}
                      >
                        <ModuleLiveRow
                          row={row}
                          stageStartedAt={video.stageStartedAt}
                          nowMs={now}
                          estimatedSec={moduleEstimateSec[row.id] ?? 60}
                        />
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
          )
        ) : null}

        {detailTab === "timeline" ? (
          <div className="grid gap-8">
            <LayeredTimeline
              events={extraction?.timeline || []}
              durationMs={
                extraction?.media?.duration_ms ?? video.probe?.durationMs ?? undefined
              }
              onOpenModule={(id) => setDetailTab(id)}
            />
            <details className="min-w-0 rounded-2xl border border-[#e7e7eb] bg-white p-4 open:pb-2">
              <summary className="cursor-pointer text-sm font-medium text-[#171719]">
                Lista temporal (todos los eventos)
              </summary>
              <div className="mt-3 border-t border-[#ececf0] pt-3">
                <TimelinePanel
                  events={extraction?.timeline || []}
                  onOpenModule={(id) => setDetailTab(id)}
                />
              </div>
            </details>
          </div>
        ) : null}

        {activeModuleRow ? (
          activeModuleRow.module ? (
            <ModuleItemsList module={activeModuleRow.module} />
          ) : (
            <EmptyCard
              title={activeModuleRow.title}
              body={
                activeModuleRow.phase === "running"
                  ? "Extrayendo este módulo…"
                  : video.status === "queued"
                    ? "En espera de empezar el vídeo."
                    : "Este módulo aún no ha terminado."
              }
            />
          )
        ) : null}

        {detailTab === "json" ? (
          <div className="grid gap-3">
            <p className="m-0 text-[12.5px] leading-relaxed text-[#75757d]">
              Pack <code className="text-[12px]">video_complete</code> (schema 2.0):{" "}
              <code className="text-[12px]">content</code> tiene todos los módulos juntos;{" "}
              <code className="text-[12px]">timeline</code> ordena todo por tiempo.
            </p>
            <div className="rounded-xl bg-[#151517] p-4 text-[12.5px] leading-[1.55] text-[#e9e9ed]">
              <pre className="overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(
                  extraction ?? {
                    status: video.status,
                    stage: video.stage,
                    note: video.error || "Aún no hay JSON. Los módulos irán apareciendo aquí.",
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        ) : null}

        {detailTab === "activity" ? (
          <div className="rounded-xl border border-[#e7e7eb] bg-white p-4">
            {video.activity.map((item, index) => (
              <div
                key={`${item.time}-${index}`}
                className="grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)] gap-2 border-t border-[#e7e7eb] py-2.5 first:border-t-0 sm:grid-cols-[60px_24px_minmax(0,1fr)] sm:gap-3"
              >
                <div className="text-xs text-[#75757d]">{item.time}</div>
                <StatusDot status={item.status} />
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <ActivityDetail detail={item.detail} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModuleLiveRow({
  row,
  stageStartedAt,
  nowMs,
  estimatedSec,
}: {
  row: {
    id: string;
    title: string;
    phase: "done" | "running" | "waiting";
    module?: ExtractionModule;
  };
  stageStartedAt?: string;
  nowMs: number;
  estimatedSec: number;
}) {
  const mark =
    row.phase === "done" ? (
      <span className="grid size-[22px] place-items-center rounded-full bg-[#edf6f1] text-[#177245]">
        <Check className="size-3.5" />
      </span>
    ) : row.phase === "running" ? (
      <span className="grid size-[22px] place-items-center rounded-full bg-[#fff6df] text-[#9a6700]">
        <span className="size-2 animate-pulse rounded-full bg-current" />
      </span>
    ) : (
      <span className="grid size-[22px] place-items-center rounded-full bg-[#f0f0f2] text-[#9a9aa3]">
        <span className="size-1.5 rounded-full bg-current" />
      </span>
    );

  let elapsedSec = 0;
  if (row.phase === "running" && stageStartedAt) {
    const started = Date.parse(stageStartedAt);
    if (Number.isFinite(started)) {
      elapsedSec = Math.max(0, (nowMs - started) / 1000);
    }
  }

  const est = Math.max(8, estimatedSec || 60);
  let barValue = 0;
  let tone: "active" | "queued" | "done" | "idle" = "idle";
  let remainingHint: string | null = null;

  if (row.phase === "done") {
    barValue = 100;
    tone = "done";
  } else if (row.phase === "running") {
    barValue = Math.min(92, Math.max(4, (elapsedSec / est) * 100));
    tone = "active";
    const left = Math.max(5, Math.round(est - elapsedSec));
    remainingHint = `≈ quedan ${formatElapsed(left)}`;
  } else {
    barValue = 0;
    tone = "idle";
  }

  const detail =
    row.phase === "done"
      ? row.module?.summary || "Listo"
      : row.phase === "running"
        ? remainingHint || "Extrayendo…"
        : "En espera";

  let timeLabel: string | null = null;
  if (row.phase === "done" && row.module?.duration_ms) {
    timeLabel = formatModuleDuration(row.module.duration_ms);
  } else if (row.phase === "running") {
    timeLabel = formatElapsed(Math.max(1, elapsedSec || 1));
  }

  return (
    <div className="rounded-lg border border-[#ececf0] bg-[#fbfbfc] px-2.5 py-2 sm:px-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-2.5">
        {mark}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium leading-tight sm:text-sm">{row.title}</div>
          <div
            className={`mt-0.5 text-[11px] leading-snug break-words sm:text-[12px] ${
              row.phase === "done"
                ? row.module?.status === "error"
                  ? "text-[#b42318]"
                  : "text-[#177245]"
                : row.phase === "running"
                  ? "text-[#9a6700]"
                  : "text-[#9a9aa3]"
            }`}
          >
            {detail}
            {row.module?.error ? ` · ${row.module.error}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-[#9a9aa3]">
          {timeLabel ? <div className="tabular-nums text-[#75757d]">{timeLabel}</div> : null}
          {row.module?.engine ? (
            <div className="mt-0.5 hidden max-w-[7rem] truncate sm:block sm:max-w-[9rem]">
              {row.module.engine}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 pl-[30px]">
        <ThinProgressBar value={barValue} tone={tone} className="min-w-0 flex-1" />
        <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-[#9a9aa3]">
          {row.phase === "waiting" ? "0%" : `${Math.round(barValue)}%`}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e7e7eb] bg-white p-4">
      <div className="text-[12px] uppercase tracking-wide text-[#75757d]">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}


function deliveryTone(status: DeliveryTargetState["status"]) {
  if (status === "ok") return "border-[#cfe8d8] bg-[#edf6f1] text-[#177245]";
  if (status === "error") return "border-[#f0d0cc] bg-[#fff0ef] text-[#b42318]";
  if (status === "uploading" || status === "pending")
    return "border-[#f0e2b8] bg-[#fff8e8] text-[#9a6700]";
  return "border-[#e7e7eb] bg-[#f7f7f9] text-[#75757d]";
}

function deliveryStatusLabel(status: DeliveryTargetState["status"]) {
  switch (status) {
    case "ok":
      return "Listo";
    case "error":
      return "Error";
    case "uploading":
      return "Subiendo…";
    case "pending":
      return "En cola…";
    default:
      return "No usado";
  }
}

function DeliveriesPanel({ video }: { video: StoredVideo }) {
  const deliveries = video.deliveries;
  const uploading =
    Boolean(video.stage?.includes("Drive")) ||
    Boolean(video.stage?.includes("webhook")) ||
    Boolean(video.stage?.includes("Enviando")) ||
    Boolean(video.stage?.includes("Subiendo"));
  const rows = [deliveries?.drive, deliveries?.webhook].filter(
    Boolean
  ) as DeliveryTargetState[];

  if (!rows.length && !uploading) return null;

  return (
    <section className="rounded-xl border border-[#e7e7eb] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Destinos del JSON</div>
          <p className="mt-1 text-[12.5px] text-[#75757d]">
            {uploading && video.status === "processing"
              ? "La extracción terminó; ahora se envía el JSON."
              : "Dónde se ha guardado o enviado el resultado."}
          </p>
        </div>
        {uploading && video.status === "processing" ? (
          <span className="text-[12px] font-medium text-[#9a6700]">{video.stage}</span>
        ) : null}
      </div>

      {uploading && video.status === "processing" ? (
        <div className="mt-3">
          <ThinProgressBar value={video.progress} tone="active" className="max-w-full" />
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5 ${deliveryTone(row.status)}`}
          >
            <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/70">
              {row.label.includes("Drive") ? (
                <Cloud className="size-4" />
              ) : (
                <Link2 className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{row.label}</span>
                <span className="text-[11.5px] font-medium uppercase tracking-[0.03em]">
                  {deliveryStatusLabel(row.status)}
                </span>
              </div>
              {row.detail ? (
                <p className="mt-0.5 break-words text-[12.5px] opacity-90">{row.detail}</p>
              ) : null}
              {row.url ? (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium underline-offset-2 hover:underline"
                >
                  Abrir destino
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
            {row.status === "uploading" || row.status === "pending" ? (
              <span className="mt-2 size-2 shrink-0 animate-pulse rounded-full bg-current" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityDetail({ detail }: { detail: string }) {
  const match = detail.match(/https?:\/\/[^\s]+/);
  if (!match) {
    return <div className="text-[12.5px] text-[#75757d]">{detail}</div>;
  }
  const url = match[0];
  const before = detail.slice(0, match.index);
  const after = detail.slice((match.index || 0) + url.length);
  return (
    <div className="text-[12.5px] text-[#75757d]">
      {before}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all font-medium text-[#171719] underline-offset-2 hover:underline"
      >
        {url}
      </a>
      {after}
    </div>
  );
}


function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function chip(text: string, key: string) {
  return (
    <span
      key={key}
      className="inline-flex items-center rounded-md border border-[#e4e4e8] bg-[#f7f7f9] px-2 py-0.5 text-[11px] text-[#5a6370]"
    >
      {text}
    </span>
  );
}

function MetaChips({ module }: { module: ExtractionModule }) {
  const data = asRecord(module.data);
  const chips: string[] = [];
  if (module.engine) chips.push(module.engine);
  if (data) {
    if (typeof data.model === "string") chips.push(data.model);
    if (typeof data.vision_model === "string") chips.push(data.vision_model);
    if (typeof data.language === "string") {
      const p = data.language_probability;
      chips.push(
        typeof p === "number"
          ? `idioma ${data.language} (${Math.round(p * 100)}%)`
          : `idioma ${data.language}`
      );
    }
    if (typeof data.speaker_count === "number") chips.push(`${data.speaker_count} hablantes`);
    if (typeof data.faces_linked === "number") chips.push(`${data.faces_linked} caras enlazadas`);
    const bpm = data.tempo_bpm ?? data.tempo_bpm;
    if (typeof bpm === "number") chips.push(`~${Math.round(bpm)} BPM`);
    const vlm = data.vlm_described ?? data.vlm_described;
    if (typeof vlm === "number") chips.push(`VLM ${vlm}`);
    const frames = data.frame_count ?? data.frame_count;
    if (typeof frames === "number") chips.push(`${frames} frames`);
    const profile = asRecord(data.profile);
    if (profile) {
      for (const key of ["overall", "overall", "energy", "rhythm", "dominant", "dominant_shot"] as const) {
        const v = profile[key];
        if (typeof v === "string" && v.trim()) {
          chips.push(v.trim());
          break;
        }
      }
    }
  }
  if (!chips.length) return null;
  return <div className="mt-2 flex flex-wrap gap-1.5">{chips.map((c, i) => chip(c, `${i}`))}</div>;
}

function TimelinePanel({
  events,
  onOpenModule,
}: {
  events: TimelineEvent[];
  onOpenModule: (moduleId: string) => void;
}) {
  if (!events.length) {
    return (
      <EmptyCard
        title="Timeline aún vacía"
        body="Cuando los módulos empiecen a devolver filas, aparecerán aquí ordenadas por tiempo."
      />
    );
  }

  return (
    <section className="min-w-0 w-full">
      <div className="border-b border-[#e7e7eb] pb-3">
        <h2 className="text-base font-semibold tracking-[-0.02em]">Timeline</h2>
        <p className="mt-1 text-[12.5px] text-[#75757d]">
          {events.length} eventos de todos los módulos, en orden temporal. Pulsa el módulo para
          abrir su pestaña.
        </p>
      </div>
      <div className="mt-1 grid min-w-0 gap-0">
        {events.map((ev, index) => {
          const end =
            typeof ev.end_ms === "number" && ev.end_ms !== ev.start_ms
              ? ` → ${msToClock(ev.end_ms)}`
              : "";
          const label = (ev.label || "").trim();
          const text = (ev.text || "").trim();
          const line =
            label && label !== text ? (
              <>
                <span className="font-medium text-[#171719]">{label}</span>
                {text ? <span className="text-[#5a6370]"> · {text}</span> : null}
              </>
            ) : (
              <span className="text-[#171719]">{text || label || "—"}</span>
            );

          return (
            <div
              key={`${ev.module_id}-${ev.start_ms ?? "x"}-${index}`}
              className="grid min-w-0 grid-cols-1 gap-y-1 border-b border-[#ececf0] py-2.5 last:border-b-0 sm:grid-cols-[7.5rem_7.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-3"
            >
              <span className="tabular-nums text-[12.5px] text-[#75757d]">
                {typeof ev.start_ms === "number" ? `${msToClock(ev.start_ms)}${end}` : "—"}
              </span>
              <button
                type="button"
                onClick={() => onOpenModule(ev.module_id)}
                className="truncate text-left text-[12px] font-medium text-[#3d6f99] underline-offset-2 hover:underline"
                title={`Abrir ${ev.module_title}`}
              >
                {ev.module_title}
              </button>
              <div className="min-w-0 text-sm leading-snug break-words">{line}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ModuleRichExtras({ module }: { module: ExtractionModule }) {
  const data = asRecord(module.data);
  if (!data) return null;

  if (module.id === "speech") {
    const segs = asArray(data.segments);
    const withWords = segs.filter((s) => asArray(asRecord(s)?.words).length > 0);
    if (!withWords.length) return null;
    return (
      <div className="mt-4 grid gap-3">
        <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">
          Palabras con tiempo
        </div>
        {withWords.slice(0, 8).map((raw, i) => {
          const seg = asRecord(raw) || {};
          const words = asArray(seg.words);
          return (
            <div key={i} className="rounded-xl border border-[#ececf0] bg-[#fafafb] p-3">
              <div className="text-[12px] text-[#75757d]">
                {typeof seg.speaker === "string" ? seg.speaker : "habla"}
                {typeof seg.start_ms === "number" ? ` · ${msToClock(seg.start_ms)}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
                {words.map((wRaw, wi) => {
                  const w = asRecord(wRaw) || {};
                  const word = String(w.word ?? "");
                  const start = typeof w.start_ms === "number" ? msToClock(w.start_ms) : "";
                  return (
                    <span
                      key={wi}
                      className="rounded bg-white px-1.5 py-0.5 text-[12.5px] text-[#171719] ring-1 ring-[#e7e7eb]"
                      title={start}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (module.id === "speakers") {
    const dialogue = asArray(data.dialogue);
    const speakers = asArray(data.speakers);
    return (
      <div className="mt-4 grid gap-4">
        {speakers.length ? (
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">
              Interlocutores
            </div>
            <div className="mt-2 grid gap-2">
              {speakers.map((raw, i) => {
                const sp = asRecord(raw) || {};
                const face = typeof sp.face_description === "string" ? sp.face_description : "";
                const scoreRaw =
                  typeof sp.face_match_score === "number"
                    ? sp.face_match_score
                    : typeof sp.face_match_score === "number"
                      ? sp.face_match_score
                      : null;
                const score =
                  typeof scoreRaw === "number" ? `match ${Math.round(scoreRaw * 100)}%` : "";
                return (
                  <div key={i} className="rounded-xl border border-[#ececf0] bg-[#fafafb] px-3 py-2.5">
                    <div className="text-sm font-medium text-[#171719]">
                      {String(sp.id ?? `S${i + 1}`)}
                      {typeof sp.turns === "number" ? (
                        <span className="ml-2 text-[12px] font-normal text-[#75757d]">
                          {sp.turns} turnos
                          {typeof sp.duration_ms === "number"
                            ? ` · ${formatModuleDuration(sp.duration_ms)}`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                    {face ? (
                      <p className="mt-1 text-[12.5px] leading-snug text-[#5a6370]">
                        Cara: {face}
                        {score ? ` · ${score}` : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {dialogue.length ? (
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">
              Diálogo
            </div>
            <div className="mt-2 grid gap-0">
              {dialogue.map((raw, i) => {
                const d = asRecord(raw) || {};
                return (
                  <div
                    key={i}
                    className="grid gap-0.5 border-b border-[#ececf0] py-2.5 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3"
                  >
                    <div className="text-[12px] text-[#75757d]">
                      <div className="font-medium text-[#171719]">{String(d.speaker ?? "—")}</div>
                      <div className="tabular-nums">
                        {typeof d.start_ms === "number" ? msToClock(d.start_ms) : "—"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 text-sm leading-snug text-[#171719]">{String(d.text ?? "")}</p>
                      {typeof d.face_description === "string" && d.face_description ? (
                        <p className="mt-1 m-0 text-[12px] text-[#6a7380]">{d.face_description}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (
    module.id === "faces_framing" ||
    module.id === "faces_framing" ||
    module.id === "objects_people" ||
    module.id === "objects_people" ||
    module.id === "pose_actions" ||
    module.id === "pose_actions"
  ) {
    const tracks = asArray(data.tracks);
    if (!tracks.length) return null;
    const title =
      module.id.includes("face")
        ? "Tracks de caras"
        : module.id.includes("pose")
          ? "Tracks de pose"
          : "Tracks detectados";
    return (
      <div className="mt-4">
        <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">{title}</div>
        <div className="mt-2 grid gap-2">
          {tracks.slice(0, 12).map((raw, i) => {
            const t = asRecord(raw) || {};
            const desc = typeof t.description === "string" ? t.description : "";
            const head =
              typeof t.dominant_shot === "string"
                ? t.dominant_shot
                : typeof t.dominant_posture === "string"
                  ? t.dominant_posture
                  : typeof t.label === "string"
                    ? t.label
                    : typeof t.id === "string" || typeof t.id === "number"
                      ? String(t.id)
                      : `track ${i + 1}`;
            const count = typeof t.count === "number" ? `${t.count} hits` : "";
            const conf =
              typeof t.avg_conf === "number"
                ? `conf ${Math.round(t.avg_conf * 100)}%`
                : typeof t.avg_score === "number"
                  ? `score ${Math.round(t.avg_score * 100)}%`
                  : "";
            return (
              <div key={i} className="rounded-xl border border-[#ececf0] bg-[#fafafb] px-3 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-[#171719]">{head}</span>
                  {count ? <span className="text-[12px] text-[#75757d]">{count}</span> : null}
                  {conf ? <span className="text-[12px] text-[#75757d]">{conf}</span> : null}
                  {typeof t.start_ms === "number" ? (
                    <span className="text-[12px] tabular-nums text-[#75757d]">
                      {msToClock(t.start_ms)}
                      {typeof t.end_ms === "number" ? ` → ${msToClock(t.end_ms)}` : ""}
                    </span>
                  ) : null}
                </div>
                {desc ? <p className="mt-1 m-0 text-[12.5px] leading-snug text-[#5a6370]">{desc}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (module.id === "on_screen_text" || module.id === "on_screen_text") {
    const items = asArray(data.items);
    const roleCounts = asRecord(data.role_counts);
    const brands = asArray(data.brands).filter((b) => typeof b === "string") as string[];
    if (!items.length && !roleCounts && !brands.length) return null;
    return (
      <div className="mt-4 grid gap-3">
        {(roleCounts || brands.length) && (
          <div className="flex flex-wrap gap-1.5">
            {brands.slice(0, 8).map((b, i) => chip(`marca ${b}`, `b${i}`))}
            {roleCounts
              ? Object.entries(roleCounts)
                  .slice(0, 8)
                  .map(([role, n]) => chip(`${role} ×${n}`, role))
              : null}
          </div>
        )}
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">
            Lecturas con rol
          </div>
          <div className="mt-2 grid gap-0">
            {items.slice(0, 40).map((raw, i) => {
              const it = asRecord(raw) || {};
              const role = typeof it.role === "string" ? it.role : "texto";
              const confRaw = typeof it.conf === "number" ? it.conf : typeof it.conf === "number" ? it.conf : null;
              const conf = typeof confRaw === "number" ? Math.round(confRaw * 100) : null;
              const rawText =
                typeof it.raw_text === "string"
                  ? it.raw_text
                  : typeof it.raw_text === "string"
                    ? it.raw_text
                    : String(it.text ?? "");
              const desc = typeof it.description === "string" ? it.description : "";
              return (
                <div
                  key={i}
                  className="grid gap-0.5 border-b border-[#ececf0] py-2.5 last:border-b-0 sm:grid-cols-[7rem_5.5rem_minmax(0,1fr)] sm:gap-x-3"
                >
                  <span className="tabular-nums text-[12.5px] text-[#75757d]">
                    {typeof it.start_ms === "number" ? msToClock(it.start_ms) : "—"}
                  </span>
                  <span className="text-[12px] font-medium uppercase tracking-[0.03em] text-[#5a6370]">
                    {role}
                    {conf != null ? ` · ${conf}%` : ""}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-[#171719]">{rawText || "—"}</div>
                    {desc && desc !== rawText ? (
                      <div className="mt-0.5 text-[12px] text-[#6a7380]">{desc}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (module.id === "music_ambiance") {
    const profile = asRecord(data.profile);
    const segments = asArray(data.segments);
    return (
      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-1.5">
          {typeof (data.tempo_bpm ?? data.tempo_bpm) === "number"
            ? chip(`~${Math.round(Number(data.tempo_bpm ?? data.tempo_bpm))} BPM`, "bpm")
            : null}
          {typeof (data.mean_rms ?? data.mean_rms) === "number"
            ? chip(`RMS ${Number(data.mean_rms ?? data.mean_rms).toFixed(2)}`, "rms")
            : null}
          {typeof (data.mean_centroid_hz ?? data.mean_centroid_hz) === "number"
            ? chip(
                `centroide ${Math.round(Number(data.mean_centroid_hz ?? data.mean_centroid_hz))} Hz`,
                "c"
              )
            : null}
          {profile && typeof (profile.overall ?? profile.overall) === "string"
            ? chip(String(profile.overall ?? profile.overall), "o")
            : null}
        </div>
        {segments.length ? (
          <div className="grid gap-0">
            {segments.slice(0, 24).map((raw, i) => {
              const s = asRecord(raw) || {};
              return (
                <div
                  key={i}
                  className="grid gap-0.5 border-b border-[#ececf0] py-2 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3"
                >
                  <span className="tabular-nums text-[12.5px] text-[#75757d]">
                    {typeof s.start_ms === "number" ? msToClock(s.start_ms) : "—"}
                  </span>
                  <span className="text-sm text-[#171719]">
                    {String(s.label ?? "pasaje")}
                    {typeof s.energy === "string" ? ` · ${s.energy}` : ""}
                    {typeof s.brightness === "string" ? ` · ${s.brightness}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (module.id === "audio_events") {
    const top = asArray(data.top_tags);
    const events = asArray(data.events);
    return (
      <div className="mt-4 grid gap-3">
        {top.length ? (
          <div className="flex flex-wrap gap-1.5">
            {top.slice(0, 10).map((raw, i) => {
              const t = asRecord(raw) || {};
              const label = String(t.label_es ?? t.label_es ?? t.label ?? "tag");
              const score =
                typeof t.score === "number" ? ` ${Math.round(t.score * 100)}%` : "";
              return chip(`${label}${score}`, `t${i}`);
            })}
          </div>
        ) : null}
        {events.length ? (
          <div className="grid gap-0">
            {events.slice(0, 30).map((raw, i) => {
              const e = asRecord(raw) || {};
              const tags = asArray(e.tags)
                .map((tr) => {
                  const t = asRecord(tr) || {};
                  const name = String(t.label_es ?? t.label ?? "");
                  const score =
                    typeof t.score === "number" ? ` ${Math.round(t.score * 100)}%` : "";
                  return name ? `${name}${score}` : "";
                })
                .filter(Boolean)
                .slice(0, 4)
                .join(" · ");
              return (
                <div
                  key={i}
                  className="grid gap-0.5 border-b border-[#ececf0] py-2 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3"
                >
                  <span className="tabular-nums text-[12.5px] text-[#75757d]">
                    {typeof e.start_ms === "number" ? msToClock(e.start_ms) : "—"}
                  </span>
                  <span className="text-sm text-[#171719]">{tags || "evento"}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (module.id === "visual_observation") {
    const items = asArray(data.items);
    if (!items.length) return null;
    return (
      <div className="mt-4 grid gap-3">
        <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">
          Observaciones
        </div>
        {items.slice(0, 12).map((raw, i) => {
          const it = asRecord(raw) || {};
          const recreation = asRecord(it.recreation) || asRecord(it.recreation);
          return (
            <div key={i} className="rounded-xl border border-[#ececf0] bg-[#fafafb] p-3">
              <div className="text-[12px] tabular-nums text-[#75757d]">
                {typeof it.start_ms === "number" ? msToClock(it.start_ms) : "—"}
              </div>
              <p className="mt-1 m-0 text-sm leading-snug text-[#171719]">
                {String(it.observation ?? it.caption ?? it.text ?? "")}
              </p>
              {recreation ? (
                <div className="mt-2 grid gap-1 text-[12px] text-[#5a6370]">
                  {Object.entries(recreation)
                    .filter(([, v]) => typeof v === "string" && v.trim())
                    .slice(0, 6)
                    .map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium text-[#171719]">{k}: </span>
                        {String(v)}
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (module.id === "summary") {
    const based = asArray(data.based_on ?? data.based_on);
    if (!based.length) return null;
    return (
      <div className="mt-4">
        <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">
          Basado en
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {based.map((raw, i) => {
            const b = asRecord(raw) || {};
            return chip(`${String(b.id ?? "?")} · ${String(b.status ?? "")}`, `b${i}`);
          })}
        </div>
      </div>
    );
  }

  return null;
}

function ModuleItemsList({ module }: { module: ExtractionModule }) {
  const took =
    typeof module.duration_ms === "number"
      ? formatModuleDuration(module.duration_ms)
      : null;
  const data = asRecord(module.data);
  // OCR ya tiene vista rica; evita duplicar la lista plana si hay items en data
  const hideFlatItems =
    (module.id === "on_screen_text" || module.id === "on_screen_text") &&
    asArray(data?.items).length > 0;

  return (
    <section className="min-w-0 w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e7e7eb] pb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight tracking-[-0.02em]">
            {module.title}
          </h2>
          {took ? (
            <p className="mt-1 text-[12.5px] text-[#75757d]">
              Este módulo tardó <span className="font-medium text-[#171719]">{took}</span>
            </p>
          ) : null}
          <MetaChips module={module} />
        </div>
        <p className="text-[12.5px] text-[#75757d]">{module.summary}</p>
      </div>
      {module.error ? (
        <p className="mt-3 text-sm text-[#b42318]">{module.error}</p>
      ) : null}

      <ModuleRichExtras module={module} />

      {!hideFlatItems ? (
        module.items.length === 0 ? (
          !asRecord(module.data) ? (
            <p className="mt-3 text-sm text-[#75757d]">
              {module.error || "Este módulo no devolvió filas para este vídeo."}
            </p>
          ) : null
        ) : (
          <div className="mt-4">
            <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">
              Filas
            </div>
            <div className="mt-1 grid min-w-0 gap-0">
              {module.items.map((item, index) => {
                const label = (item.label || "").trim();
                const text = (item.text || "").trim();
                const redundantLabel =
                  !label ||
                  label === module.id ||
                  label === module.title ||
                  label === text;
                const line = redundantLabel
                  ? text || label || "—"
                  : `${label} · ${text || "—"}`;
                const end =
                  typeof item.end_ms === "number" && item.end_ms !== item.start_ms
                    ? ` → ${msToClock(item.end_ms)}`
                    : "";

                return (
                  <div
                    key={`${module.id}-${index}`}
                    className="grid min-w-0 grid-cols-1 items-baseline gap-y-0.5 border-b border-[#ececf0] py-2.5 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4"
                  >
                    <span className="shrink-0 tabular-nums text-[12.5px] text-[#75757d]">
                      {typeof item.start_ms === "number"
                        ? `${msToClock(item.start_ms)}${end}`
                        : "—"}
                    </span>
                    <div className="min-w-0 text-sm leading-snug break-words text-[#171719]">
                      {line}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}

function DocsCode({ children }: { children: string }) {
  return (
    <div className="mt-3 min-w-0 max-w-full overflow-x-auto rounded-xl bg-[#151517]">
      <pre className="m-0 min-w-0 p-3 text-[12px] leading-[1.55] text-[#e9e9ed] whitespace-pre-wrap break-words sm:p-4 sm:text-[12.5px] sm:whitespace-pre sm:break-normal">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function DocsView({ onOpenConnections }: { onOpenConnections: () => void }) {
  return (
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <div className="min-w-0">
        <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Docs</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#75757d]">
          Cómo conectar este programa con otras apps: meter vídeos y recibir el JSON.
        </p>
      </div>

      <section className="min-w-0 rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Requisitos del ordenador</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Todo corre en local (sin GPU obligatoria). En CPU funciona, pero puede ir lento.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="min-w-0 rounded-xl bg-[#f5f5f7] p-4">
            <div className="text-sm font-medium">Mínimo usable</div>
            <ul className="mt-2 grid gap-1.5 text-[12.5px] leading-relaxed text-[#75757d]">
              <li>Windows 10/11, macOS 12+ o Linux reciente</li>
              <li>16 GB de RAM (con 8 GB va justo)</li>
              <li>CPU de los últimos ~6–8 años, o Apple Silicon (M1/M2/M3…)</li>
              <li>15–25 GB libres en disco (modelos de IA)</li>
              <li>Docker Desktop, o Node + Python + ffmpeg</li>
            </ul>
          </div>
          <div className="min-w-0 rounded-xl bg-[#f5f5f7] p-4">
            <div className="text-sm font-medium">Recomendado</div>
            <ul className="mt-2 grid gap-1.5 text-[12.5px] leading-relaxed text-[#75757d]">
              <li>32 GB de RAM</li>
              <li>SSD con 30+ GB libres</li>
              <li>M1/M2/M3 o Intel/AMD de 6+ núcleos</li>
              <li>GPU opcional (este build está pensado en CPU)</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-[#75757d]">
          Vídeos cortos (30–60 s): minutos en CPU. Vídeos largos o con visión: pueden tardar
          bastante. Un portátil viejo de 8 GB no es buen candidato.
        </p>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">JSON de salida completo (schema 2.0)</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Cada vídeo genera un único JSON denso (<code className="text-[12.5px]">kind: video_complete</code>).
          Dentro van <strong className="font-medium">todos los módulos juntos</strong> en{" "}
          <code className="text-[12.5px]">content</code>, una{" "}
          <code className="text-[12.5px]">timeline</code> ordenada y el resumen de la corrida en{" "}
          <code className="text-[12.5px]">run</code>. La versión es{" "}
          <code className="text-[12.5px]">&quot;2.0&quot;</code>.
        </p>
        <DocsCode>{`extraction  (schema_version: "2.0", kind: "video_complete")
├── source
│   ├── filename
│   ├── processed_at
│   ├── input            ← "upload" | "url" | "folder"
│   └── url?             ← link original si vino de TikTok/YouTube/…
├── media
├── run                  ← conteos y tiempos de cada módulo
├── content              ← TODOS los JSON juntos, por id
│   ├── scene_cuts
│   ├── camera_motion
│   ├── speech
│   ├── speakers
│   ├── on_screen_text
│   ├── objects_people
│   ├── faces_framing
│   ├── pose_actions
│   ├── visual_observation
│   ├── music_ambiance
│   ├── audio_events
│   └── summary
│         └── cada uno: { status, items, data, … }
├── timeline[]           ← todas las filas ordenadas por tiempo
└── modules[]            ← misma info en lista (UI / compat)`}</DocsCode>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#75757d]">
          Descárgalo como <code className="text-[12.5px]">*-complete.json</code>, o recíbelo en el
          webhook / carpeta de salida de Drive.
        </p>
      </section>

      <section className="min-w-0 rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Las dos direcciones</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="min-w-0 rounded-xl bg-[#f5f5f7] p-4">
            <div className="text-sm font-medium">1. Meter vídeos (API)</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#75757d]">
              Otra app (o tú con curl) envía uno o muchos vídeos a este programa.
            </p>
          </div>
          <div className="min-w-0 rounded-xl bg-[#f5f5f7] p-4">
            <div className="text-sm font-medium">2. Avisar al terminar (webhook)</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#75757d]">
              Cuando un vídeo acaba, este programa hace POST a tu URL con el JSON.
            </p>
          </div>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Google Drive (JSON en la nube)</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          En Conexiones pegas el ID de una carpeta de Drive y la clave de una cuenta de servicio:
          cada JSON se sube solo a la nube. También puedes usar carpetas locales con Drive
          Desktop si lo prefieres.
        </p>
        <ol className="mt-4 grid gap-2 text-sm text-[#171719]">
          <li>1. Conexiones → Google Drive: ID de carpeta + JSON de cuenta de servicio.</li>
          <li>2. Comparte la carpeta con el email de esa cuenta (permiso editor).</li>
          <li>3. Activa, guarda y pulsa «Probar Drive». Cada extracción se copia ahí.</li>
        </ol>
        <div className="mt-4">
          <Button className="rounded-xl" onClick={onOpenConnections}>
            Ir a Conexiones
          </Button>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Webhook</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Configura la URL en Conexiones. Sirve para Make, n8n, Zapier o tu backend.
        </p>
        <ol className="mt-4 grid gap-2 text-sm text-[#171719]">
          <li>1. Abre Conexiones y pega tu URL de webhook.</li>
          <li>2. Guarda y pulsa «Probar webhook».</li>
          <li>3. Procesa un vídeo: al terminar recibirás un POST automático.</li>
        </ol>
        <div className="mt-4">
          <Button className="rounded-xl" onClick={onOpenConnections}>
            Ir a Conexiones
          </Button>
        </div>
        <p className="mt-4 text-[12.5px] text-[#75757d]">Ejemplo de lo que recibe la otra app:</p>
        <DocsCode>{`{
  "event": "job.ready",
  "sent_at": "2026-09-04T00:00:00.000Z",
  "job": { "id": "job_123", "name": "clip.mp4", "status": "ready" },
  "extraction": {
    "schema_version": "2.0",
    "kind": "video_complete",
    "source": { "filename": "clip.mp4", "processed_at": "...", "input": "url", "url": "https://www.tiktok.com/@cuenta/video/123" },
    "media": { "duration_ms": 12000, "width": 1080, "height": 1920 },
    "run": { "module_count": 10, "ok": 9, "empty": 1, "error": 0 },
    "content": {
      "speech": { "status": "ok", "data": { "...": "payload Whisper" }, "items": [ ... ] },
      "on_screen_text": { "status": "ok", "data": { "...": "OCR" }, "items": [ ... ] },
      "summary": { "status": "ok", "data": { "text": "..." } }
    },
    "timeline": [ { "module_id": "speech", "start_ms": 0, "text": "..." } ],
    "modules": [ { "id": "speech", "status": "ok", "items": [ ... ] } ]
  }
}`}</DocsCode>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Subir un vídeo desde fuera</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          La otra app manda el archivo a la API. Luego puede consultar el estado o esperar el webhook.
        </p>
        <DocsCode>{`curl -F "file=@clip.mp4" \\
  http://localhost:43141/api/jobs

# Estado
curl http://localhost:43141/api/jobs/JOB_ID

# Resultado
curl http://localhost:43141/api/jobs/JOB_ID/result`}</DocsCode>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Varios vídeos de golpe</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Puedes mandar muchos archivos en la misma petición. Se encolan y, si hay webhook,
          cada uno avisa cuando termina.
        </p>
        <DocsCode>{`curl -F "files=@video1.mp4" \\
  -F "files=@video2.mp4" \\
  -F "files=@video3.mp4" \\
  http://localhost:43141/api/jobs`}</DocsCode>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Importar muchos de golpe</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Tres formas cómodas. Todo acaba en la misma cola de Vídeos.
        </p>
        <ol className="mt-4 grid gap-2 text-sm text-[#171719]">
          <li>
            1. <strong className="font-medium">Carpeta de vídeos:</strong> en la home,
            «Seleccionar carpeta» (o arrastra la carpeta). Encola todos los MP4/MOV/etc.
          </li>
          <li>
            2. <strong className="font-medium">Pegar links:</strong> uno por línea en el
            cuadro de texto → «Analizar links».
          </li>
          <li>
            3. <strong className="font-medium">Archivo .txt:</strong> un link por línea;
            súbelo o arrástralo como un archivo más.
          </li>
        </ol>
        <p className="mt-4 text-[12.5px] leading-relaxed text-[#75757d]">
          Redes: TikTok, Instagram, Facebook, YouTube, X… Solo públicos. No hay tope de
          cantidad: aunque pegues cientos, entran en cola y se van procesando de poco en
          poco.
        </p>
        <p className="mt-4 text-[12.5px] text-[#75757d]">API — un link:</p>
        <DocsCode>{`curl -X POST http://localhost:43141/api/jobs/from-url \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://www.tiktok.com/@cuenta/video/123"}'`}</DocsCode>
        <p className="mt-4 text-[12.5px] text-[#75757d]">API — muchos links:</p>
        <DocsCode>{`curl -X POST http://localhost:43141/api/jobs/from-url \\
  -H "Content-Type: application/json" \\
  -d '{
    "urls": [
      "https://www.tiktok.com/@a/video/1",
      "https://www.instagram.com/reel/ABC/",
      "https://www.youtube.com/watch?v=xyz"
    ]
  }'`}</DocsCode>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Endpoints útiles</div>
        <div className="mt-3 grid min-w-0 gap-2 text-sm">
          <div className="grid min-w-0 gap-1 border-t border-[#e7e7eb] py-3 first:border-t-0 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <code className="break-words text-[12.5px]">POST /api/jobs</code>
            <span className="text-[#75757d]">Crear uno o varios trabajos (archivos)</span>
          </div>
          <div className="grid min-w-0 gap-1 border-t border-[#e7e7eb] py-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <code className="break-words text-[12.5px]">POST /api/jobs/from-url</code>
            <span className="text-[#75757d]">Crear trabajos desde uno o varios links</span>
          </div>
          <div className="grid min-w-0 gap-1 border-t border-[#e7e7eb] py-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <code className="break-words text-[12.5px]">GET /api/jobs/:id</code>
            <span className="text-[#75757d]">Estado del trabajo</span>
          </div>
          <div className="grid min-w-0 gap-1 border-t border-[#e7e7eb] py-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <code className="break-words text-[12.5px]">GET /api/jobs/:id/result</code>
            <span className="text-[#75757d]">JSON completo</span>
          </div>
          <div className="grid min-w-0 gap-1 border-t border-[#e7e7eb] py-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <code className="break-words text-[12.5px]">GET /api/modules</code>
            <span className="text-[#75757d]">Cajitas registradas</span>
          </div>
          <div className="grid min-w-0 gap-1 border-t border-[#e7e7eb] py-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <code className="break-words text-[12.5px]">PUT /api/settings</code>
            <span className="text-[#75757d]">Guardar URL del webhook</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsView() {
  const s = useStudio();
  return (
    <div className="grid min-w-0 gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Ajustes</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#75757d]">
          Preferencias generales del Studio.
        </p>
      </div>
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Conexiones</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Drive, webhook y carpeta local están en la pestaña Conexiones, para tener todos los
          enchufes juntos.
        </p>
        <div className="mt-4">
          <Button className="rounded-xl" onClick={() => s.setView("connections")}>
            Abrir Conexiones
          </Button>
        </div>
      </section>
      <EmptyCard
        title="Más opciones"
        body="Cuando haya preferencias de interfaz o rendimiento, aparecerán aquí. Lo de guardar y enviar JSON vive en Conexiones."
      />
    </div>
  );
}
