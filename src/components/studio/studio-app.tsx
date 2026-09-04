"use client";

import { useMemo, useRef, useState, useEffect, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Download,
  Home,
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
import { msToClock } from "@/lib/extraction";
import { isLinkListFilename, readLinksFromFile } from "@/lib/ingest-links";
import { useStudio } from "@/lib/store";
import type { ExtractionModule, JobStatus, StoredVideo, ViewName } from "@/lib/types";
import { isVideoFile } from "@/lib/video-file";

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
          {nav("settings", <Settings className="size-[17px]" />, "Ajustes")}
        </div>
      </aside>

      <main className="min-w-0 overflow-x-hidden px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:px-[clamp(22px,3vw,42px)] md:py-[clamp(22px,3vw,42px)] md:pb-[clamp(22px,3vw,42px)]">
        <div className="mx-auto w-full min-w-0 max-w-[1080px]">
          {s.view === "home" && <HomeView />}
          {s.view === "videos" && <VideosView />}
          {s.view === "video-detail" && activeVideo && <VideoDetail video={activeVideo} />}
          {s.view === "docs" && <DocsView onOpenSettings={() => s.setView("settings")} />}
          {s.view === "settings" && <SettingsView />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e7eb] bg-[#fbfbfc] px-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 md:hidden">
        <div className="grid grid-cols-4 gap-0.5">
          {(
            [
              ["home", "Inicio", <Home key="h" className="size-[18px]" />],
              ["videos", "Vídeos", <Video key="v" className="size-[18px]" />],
              ["docs", "Docs", <BookOpen key="d" className="size-[18px]" />],
              ["settings", "Ajustes", <Settings key="s" className="size-[18px]" />],
            ] as const
          ).map(([view, label, icon]) => {
            const active =
              s.view === view || (view === "videos" && s.view === "video-detail");
            return (
              <button
                key={view}
                type="button"
                onClick={() => s.setView(view)}
                className={`grid min-h-12 place-items-center gap-0.5 rounded-[9px] px-1 ${
                  active ? "bg-[#f5f5f7] text-[#171719]" : "text-[#75757d]"
                }`}
              >
                {icon}
                <span className="text-[10px] leading-none font-medium">{label}</span>
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
      <div className="mx-auto grid max-w-[720px] gap-10 py-10 md:gap-12 md:py-16">
        <div className="vx-home-fade max-w-[34rem]">
          <p className="vx-home-brand m-0 text-[clamp(34px,9vw,64px)] leading-[0.92] text-[#171719]">
            Video Extraction
            <br />
            Studio
          </p>
          <p className="mt-5 m-0 text-[16px] leading-snug tracking-[-0.02em] text-[#2f363e] sm:text-[17px]">
            Subes un vídeo. Sales con un JSON claro.
          </p>
          <p className="mt-3 m-0 max-w-[28rem] text-[14px] leading-relaxed text-[#6a7380] sm:text-[14.5px]">
            Cortes, cámara, habla, texto, objetos, ambiente, eventos de sonido y un resumen.
            Cada módulo escribe solo lo que encuentra.
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
          className={`vx-home-fade vx-home-fade-delay flex min-h-[148px] flex-col items-start justify-center gap-3 border border-dashed px-4 py-5 transition sm:min-h-[168px] sm:gap-4 sm:px-6 sm:py-7 md:px-8 ${
            drag ? "border-[#171719] bg-white" : "border-[#c9ced6] bg-transparent"
          }`}
        >
          <div className="flex items-start gap-3 text-[#171719] sm:items-center">
            <Upload className="mt-0.5 size-[18px] shrink-0 opacity-70 sm:mt-0" strokeWidth={1.75} />
            <span className="text-[14px] leading-snug font-medium tracking-[-0.015em] sm:text-[15px]">
              {folderBusy
                ? "Encolando…"
                : "Arrastra vídeos, una carpeta o un .txt con links"}
            </span>
          </div>
          <p className="m-0 text-[12.5px] leading-relaxed text-[#6a7380] sm:text-[13px]">
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
                const eta = etaLabel(video, s.videos);
                return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => s.openVideo(video.id)}
                  className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[#e7e7eb] px-3 py-3.5 text-left first:border-t-0 sm:gap-3 sm:px-4 sm:py-4"
                >
                  <StatusDot status={video.status} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{video.name}</div>
                    <div className="mt-1 text-[12px] leading-snug break-words text-[#75757d] sm:text-[12.5px]">
                      {videoMetaParts(video, { eta }).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="shrink-0 text-[12px] text-[#75757d]">{video.progress}%</div>
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
  return (
    <div
      className={`grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-2.5 border-t border-[#e7e7eb] px-3 py-3 first:border-t-0 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-4 sm:py-4 ${
        selected ? "bg-[#f7f7f9]" : "bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Seleccionar ${video.name}`}
        className="mt-1 size-4 shrink-0 accent-[#171719] sm:mt-0"
      />
      <button type="button" onClick={onOpen} className="mt-0.5 shrink-0 sm:mt-0" title="Abrir">
        <StatusDot status={video.status} />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left"
        data-video-open={video.id}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-medium">{video.name}</div>
          <div className="shrink-0 text-right text-[11px] text-[#75757d] sm:hidden">
            <div className="font-medium text-[#171719]">{statusLabel(video.status)}</div>
            <div>{video.progress}%</div>
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
        {(video.status === "processing" || video.status === "queued") && (
          <div className="mt-2 h-1.5 max-w-full overflow-hidden rounded-full bg-[#eef0f3]">
            <div
              className={`h-full rounded-full transition-all ${
                video.status === "queued" ? "bg-[#e2b340]" : "bg-[#3d6f99]"
              }`}
              style={{ width: `${Math.max(6, Math.min(100, video.progress))}%` }}
            />
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="hidden text-right text-[12px] text-[#75757d] sm:block"
      >
        <div className="font-medium text-[#171719]">{statusLabel(video.status)}</div>
        <div className="mt-1">{video.progress}%</div>
      </button>
    </div>
  );
}

function VideosView() {
  const s = useStudio();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [moduleCount, setModuleCount] = useState(10);
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
                  eta={etaLabel(video, s.videos, moduleCount, now)}
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
    now
  );

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
            <div className="mt-3 h-1.5 max-w-full overflow-hidden rounded-full bg-[#eef0f3] sm:max-w-sm">
              <div
                className={`h-full rounded-full ${video.status === "queued" ? "bg-[#e2b340]" : "bg-[#3d6f99]"}`}
                style={{ width: `${Math.max(6, Math.min(100, video.progress))}%` }}
              />
            </div>
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
                        />
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
          )
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
                  <div className="text-[12.5px] text-[#75757d]">{item.detail}</div>
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
}: {
  row: {
    id: string;
    title: string;
    phase: "done" | "running" | "waiting";
    module?: ExtractionModule;
  };
  stageStartedAt?: string;
  nowMs: number;
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

  const detail =
    row.phase === "done"
      ? row.module?.summary || "Listo"
      : row.phase === "running"
        ? "Extrayendo…"
        : "En espera";

  let timeLabel: string | null = null;
  if (row.phase === "done" && row.module?.duration_ms) {
    timeLabel = formatModuleDuration(row.module.duration_ms);
  } else if (row.phase === "running" && stageStartedAt) {
    const started = Date.parse(stageStartedAt);
    if (Number.isFinite(started)) {
      timeLabel = formatElapsed(Math.max(1, (nowMs - started) / 1000));
    }
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[#ececf0] bg-[#fbfbfc] px-2.5 py-2 sm:gap-2.5 sm:px-3">
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

function ModuleItemsList({ module }: { module: ExtractionModule }) {
  const took =
    typeof module.duration_ms === "number"
      ? formatModuleDuration(module.duration_ms)
      : null;

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
        </div>
        <p className="text-[12.5px] text-[#75757d]">{module.summary}</p>
      </div>
      {module.error ? (
        <p className="mt-3 text-sm text-[#b42318]">{module.error}</p>
      ) : null}
      {module.items.length === 0 ? (
        <p className="mt-3 text-sm text-[#75757d]">
          {module.error || "Este módulo no devolvió filas para este vídeo."}
        </p>
      ) : (
        <div className="mt-1 grid min-w-0 gap-0">
          {module.items.map((item, index) => {
            const label = (item.label || "").trim();
            const text = (item.text || "").trim();
            const redundantLabel =
              !label ||
              label === module.id ||
              label === module.title ||
              label === text;
            const line = redundantLabel ? text || label || "—" : `${label} · ${text || "—"}`;
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
                  {typeof item.start_ms === "number" ? `${msToClock(item.start_ms)}${end}` : "—"}
                </span>
                <div className="min-w-0 text-sm leading-snug break-words text-[#171719]">
                  {line}
                </div>
              </div>
            );
          })}
        </div>
      )}
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

function DocsView({ onOpenSettings }: { onOpenSettings: () => void }) {
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
├── source / media
├── run                  ← conteos y tiempos de cada módulo
├── content              ← TODOS los JSON juntos, por id
│   ├── scene_cuts
│   ├── camera_motion
│   ├── speech
│   ├── speakers
│   ├── on_screen_text
│   ├── objects_people
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
        <div className="text-sm font-semibold">Google Drive (carpeta → JSON)</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Con Google Drive para escritorio, el Studio vigila una carpeta local de entrada y
          escribe el JSON en otra de salida. Configúralo en Ajustes y deja el programa
          encendido en ese ordenador.
        </p>
        <ol className="mt-4 grid gap-2 text-sm text-[#171719]">
          <li>1. Sincroniza dos carpetas con Drive Desktop (entrada y salida).</li>
          <li>2. En Ajustes, activa la vigilancia y pega las rutas locales.</li>
          <li>3. Sube un vídeo a la carpeta de entrada; el JSON aparece en la de salida.</li>
        </ol>
        <div className="mt-4">
          <Button className="rounded-xl" onClick={onOpenSettings}>
            Ir a Ajustes
          </Button>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Webhook</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Configura la URL en Ajustes. Sirve para Make, n8n, Zapier o tu backend.
        </p>
        <ol className="mt-4 grid gap-2 text-sm text-[#171719]">
          <li>1. Abre Ajustes y pega tu URL de webhook.</li>
          <li>2. Guarda y pulsa «Probar webhook».</li>
          <li>3. Procesa un vídeo: al terminar recibirás un POST automático.</li>
        </ol>
        <div className="mt-4">
          <Button className="rounded-xl" onClick={onOpenSettings}>
            Ir a Ajustes
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
    "source": { "filename": "clip.mp4", "processed_at": "..." },
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
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [secretSet, setSecretSet] = useState(false);
  const [inboxEnabled, setInboxEnabled] = useState(false);
  const [inboxPath, setInboxPath] = useState("");
  const [outboxPath, setOutboxPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = (await res.json()) as {
          webhookUrl?: string;
          webhookSecretSet?: boolean;
          inboxEnabled?: boolean;
          inboxPath?: string;
          outboxPath?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "No se pudo cargar ajustes");
        if (cancelled) return;
        setWebhookUrl(data.webhookUrl || "");
        setSecretSet(Boolean(data.webhookSecretSet));
        setInboxEnabled(Boolean(data.inboxEnabled));
        setInboxPath(data.inboxPath || "");
        setOutboxPath(data.outboxPath || "");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar ajustes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
          inboxEnabled,
          inboxPath,
          outboxPath,
        }),
      });
      const data = (await res.json()) as {
        webhookUrl?: string;
        webhookSecretSet?: boolean;
        inboxEnabled?: boolean;
        inboxPath?: string;
        outboxPath?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setWebhookUrl(data.webhookUrl || "");
      setSecretSet(Boolean(data.webhookSecretSet));
      setWebhookSecret("");
      setInboxEnabled(Boolean(data.inboxEnabled));
      setInboxPath(data.inboxPath || "");
      setOutboxPath(data.outboxPath || "");
      setMessage("Ajustes guardados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function clearSecret() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearWebhookSecret: true }),
      });
      const data = (await res.json()) as { webhookSecretSet?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo quitar el secreto");
      setSecretSet(Boolean(data.webhookSecretSet));
      setWebhookSecret("");
      setMessage("Secreto del webhook eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el secreto");
    } finally {
      setSaving(false);
    }
  }

  async function testWebhook() {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; status?: number };
      if (!res.ok || !data.ok) throw new Error(data.error || "La prueba falló");
      setMessage(`Prueba OK (HTTP ${data.status ?? 200}). Tu otra app recibió el evento.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La prueba falló");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Ajustes</h1>
        <p className="text-sm leading-relaxed text-[#75757d]">
          Webhook, carpeta automática (Drive Desktop) y conexiones.
        </p>
      </div>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Carpeta automática (Google Drive)</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#75757d]">
          Con Google Drive para escritorio: sincroniza una carpeta local. El programa vigila
          «entrada», procesa cada vídeo nuevo y deja el JSON en «salida».
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-[#75757d]">Cargando…</p>
        ) : (
          <div className="mt-4 grid min-w-0 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inboxEnabled}
                onChange={(e) => setInboxEnabled(e.target.checked)}
                className="size-4 rounded border-[#d7d7dc]"
              />
              <span>Activar vigilancia de carpeta</span>
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm">
              <span className="text-[#75757d]">Carpeta de entrada (vídeos)</span>
              <input
                value={inboxPath}
                onChange={(e) => setInboxPath(e.target.value)}
                placeholder="/Users/tú/Google Drive/VX-entrada"
                className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm">
              <span className="text-[#75757d]">Carpeta de salida (JSON)</span>
              <input
                value={outboxPath}
                onChange={(e) => setOutboxPath(e.target.value)}
                placeholder="/Users/tú/Google Drive/VX-salida"
                className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
              />
            </label>
            <div className="pt-1">
              <Button
                className="w-full rounded-xl sm:w-auto"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Guardando…" : "Guardar carpeta"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white p-4 sm:p-5">
        <div className="text-sm font-semibold">Webhook</div>
        <p className="mt-1 text-[12.5px] text-[#75757d]">
          Pon la URL de Make, n8n, Zapier, tu backend, etc. Recibirá un POST con el resultado.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-[#75757d]">Cargando…</p>
        ) : (
          <div className="mt-4 grid min-w-0 gap-3">
            <label className="grid min-w-0 gap-1.5 text-sm">
              <span className="text-[#75757d]">URL del webhook</span>
              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.ejemplo.com/vx"
                className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm">
              <span className="text-[#75757d]">
                Secreto opcional {secretSet ? "(ya hay uno guardado)" : ""}
              </span>
              <input
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={secretSet ? "Dejar vacío para no cambiarlo" : "Bearer token o clave"}
                className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
              />
            </label>
            <div className="grid grid-cols-1 gap-2 pt-1 sm:flex sm:flex-wrap">
              <Button
                className="w-full rounded-xl sm:w-auto"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                disabled={testing || !webhookUrl.trim()}
                onClick={() => void testWebhook()}
              >
                {testing ? "Probando…" : "Probar webhook"}
              </Button>
              {secretSet ? (
                <Button
                  variant="outline"
                  className="w-full rounded-xl sm:w-auto"
                  disabled={saving}
                  onClick={() => void clearSecret()}
                >
                  Quitar secreto
                </Button>
              ) : null}
            </div>
            {message ? <p className="text-sm text-[#177245]">{message}</p> : null}
            {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
          </div>
        )}
      </section>

      <EmptyCard
        title="Cómo usar Drive"
        body="Instala Google Drive para escritorio, elige una carpeta local de entrada y otra de salida en Ajustes, activa la vigilancia y deja el Studio encendido. Subes el vídeo a Drive → aparece en la carpeta local → sale el JSON en la de salida. Más detalle en Docs."
      />
    </div>
  );
}
