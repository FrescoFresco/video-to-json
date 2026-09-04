"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Download,
  Home,
  RotateCcw,
  Settings,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { msToClock } from "@/lib/extraction";
import { useStudio } from "@/lib/store";
import type { ExtractionModule, JobStatus, StoredVideo, ViewName } from "@/lib/types";

function downloadJson(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 400);
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

      <main className="min-w-0 overflow-x-hidden px-4 py-5 pb-24 md:px-[clamp(22px,3vw,42px)] md:py-[clamp(22px,3vw,42px)]">
        <div className="mx-auto w-full min-w-0 max-w-[1080px]">
          {s.view === "home" && <HomeView />}
          {s.view === "videos" && <VideosView />}
          {s.view === "video-detail" && activeVideo && <VideoDetail video={activeVideo} />}
          {s.view === "docs" && <DocsView onOpenSettings={() => s.setView("settings")} />}
          {s.view === "settings" && <SettingsView />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e7eb] bg-[#fbfbfc]/94 px-2.5 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => s.setView("home")}
            className={`grid min-h-12 place-items-center rounded-[9px] ${s.view === "home" ? "bg-[#f5f5f7] text-[#171719]" : "text-[#75757d]"}`}
          >
            <Home className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => s.setView("videos")}
            className={`grid min-h-12 place-items-center rounded-[9px] ${s.view === "videos" || s.view === "video-detail" ? "bg-[#f5f5f7] text-[#171719]" : "text-[#75757d]"}`}
          >
            <Video className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => s.setView("docs")}
            className={`grid min-h-12 place-items-center rounded-[9px] ${s.view === "docs" ? "bg-[#f5f5f7] text-[#171719]" : "text-[#75757d]"}`}
          >
            <BookOpen className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => s.setView("settings")}
            className={`grid min-h-12 place-items-center rounded-[9px] ${s.view === "settings" ? "bg-[#f5f5f7] text-[#171719]" : "text-[#75757d]"}`}
          >
            <Settings className="size-[18px]" />
          </button>
        </div>
      </nav>
    </div>
  );
}

function HomeView() {
  const s = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    await s.ingestFiles([...files]);
  }

  return (
    <div className="vx-home-hero -mx-4 px-4 py-2 md:-mx-[clamp(22px,3vw,42px)] md:px-[clamp(22px,3vw,42px)] md:py-4">
      <div className="mx-auto grid max-w-[720px] gap-10 py-10 md:gap-12 md:py-16">
        <div className="vx-home-fade max-w-[34rem]">
          <p className="vx-home-brand m-0 text-[clamp(40px,6.2vw,64px)] leading-[0.92] text-[#171719]">
            Video Extraction
            <br />
            Studio
          </p>
          <p className="mt-5 m-0 text-[17px] leading-snug tracking-[-0.02em] text-[#2f363e]">
            Subes un vídeo. Sales con un JSON claro.
          </p>
          <p className="mt-3 m-0 max-w-[28rem] text-[14.5px] leading-relaxed text-[#6a7380]">
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
            await handleFiles(e.dataTransfer.files);
          }}
          className={`vx-home-fade vx-home-fade-delay flex min-h-[168px] flex-col items-start justify-center gap-4 border border-dashed px-6 py-7 transition md:px-8 ${
            drag ? "border-[#171719] bg-white" : "border-[#c9ced6] bg-transparent"
          }`}
        >
          <div className="flex items-center gap-3 text-[#171719]">
            <Upload className="size-[18px] shrink-0 opacity-70" strokeWidth={1.75} />
            <span className="text-[15px] font-medium tracking-[-0.015em]">
              Arrastra vídeos o elige archivos
            </span>
          </div>
          <p className="m-0 text-[13px] text-[#6a7380]">MP4, MOV, MKV, WebM · varios a la vez</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/*,.mp4,.mov,.mkv,.webm,.m4v"
            hidden
            onChange={async (e) => {
              await handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            className="rounded-lg border-[#d0d4da] bg-white hover:bg-[#f5f5f7]"
            onClick={() => inputRef.current?.click()}
          >
            Seleccionar vídeos
          </Button>
        </div>

        {s.videos.length > 0 && (
          <div className="vx-home-fade vx-home-fade-delay-2">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium tracking-[0.04em] text-[#6a7380] uppercase">
                Recientes
              </p>
              <Button variant="outline" className="rounded-lg" onClick={s.clearAll}>
                Limpiar historial
              </Button>
            </div>
            <div className="border border-[#e7e7eb] bg-white">
              {s.videos.slice(0, 5).map((video) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => s.openVideo(video.id)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e7e7eb] px-4 py-4 text-left first:border-t-0"
                >
                  <StatusDot status={video.status} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{video.name}</div>
                    <div className="mt-1 text-[12.5px] text-[#75757d]">
                      {video.status === "queued" ? "En espera" :
                       video.status === "processing" ? "Procesando" :
                       video.status === "ready" ? "Listo" : "Error"}
                      {video.stage ? ` · ${video.stage}` : ""}
                    </div>
                  </div>
                  <div className="text-[12px] text-[#75757d]">{video.progress}%</div>
                </button>
              ))}
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

function queueRank(status: JobStatus) {
  if (status === "processing") return 0;
  if (status === "queued") return 1;
  if (status === "error") return 2;
  return 3;
}

function QueueSummary({ videos }: { videos: StoredVideo[] }) {
  const waiting = videos.filter((v) => v.status === "queued").length;
  const processing = videos.filter((v) => v.status === "processing").length;
  const ready = videos.filter((v) => v.status === "ready").length;
  const errored = videos.filter((v) => v.status === "error").length;

  const Chip = ({
    label,
    value,
    tone,
  }: {
    label: string;
    value: number;
    tone: string;
  }) => (
    <div className={`rounded-xl px-3 py-2 ${tone}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
      <Chip label="En espera" value={waiting} tone="bg-[#fff6df] text-[#9a6700]" />
      <Chip label="Procesando" value={processing} tone="bg-[#eef3f8] text-[#2f4d6a]" />
      <Chip label="Listos" value={ready} tone="bg-[#edf6f1] text-[#177245]" />
      <Chip label="Errores" value={errored} tone="bg-[#fff0ef] text-[#b42318]" />
    </div>
  );
}

function VideoQueueRow({ video, onOpen }: { video: StoredVideo; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e7e7eb] px-4 py-4 text-left first:border-t-0"
    >
      <StatusDot status={video.status} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{video.name}</div>
        <div className="mt-1 text-[12.5px] text-[#75757d]">
          {statusLabel(video.status)}
          {video.stage ? ` · ${video.stage}` : ""}
          {video.probe ? ` · ${Math.round(video.probe.durationMs / 1000)} s` : ""}
        </div>
        {(video.status === "processing" || video.status === "queued") && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef0f3]">
            <div
              className={`h-full rounded-full transition-all ${
                video.status === "queued" ? "bg-[#e2b340]" : "bg-[#3d6f99]"
              }`}
              style={{ width: `${Math.max(6, Math.min(100, video.progress))}%` }}
            />
          </div>
        )}
      </div>
      <div className="text-right text-[12px] text-[#75757d]">
        <div className="font-medium text-[#171719]">{statusLabel(video.status)}</div>
        <div className="mt-1">{video.progress}%</div>
      </div>
    </button>
  );
}

function VideosView() {
  const s = useStudio();
  const ordered = useMemo(
    () =>
      [...s.videos].sort((a, b) => {
        const rank = queueRank(a.status) - queueRank(b.status);
        if (rank !== 0) return rank;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [s.videos]
  );

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Vídeos</h1>
          <p className="text-sm text-[#75757d]">
            Cola visible: en espera, procesando, listos y errores.
          </p>
        </div>
        {s.videos.length > 0 && (
          <Button variant="outline" className="rounded-xl" onClick={s.clearAll}>
            <RotateCcw className="mr-2 size-4" />
            Limpiar
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
          <QueueSummary videos={s.videos} />
          <div className="rounded-2xl border border-[#e7e7eb] bg-white">
            {ordered.map((video) => (
              <VideoQueueRow
                key={video.id}
                video={video}
                onOpen={() => s.openVideo(video.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VideoDetail({ video }: { video: StoredVideo }) {
  const s = useStudio();
  const extraction = video.extraction;
  const [catalog, setCatalog] = useState<Array<{ id: string; title: string; stage: string }>>([]);

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

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <IconBtn title="Volver" onClick={() => s.setView("videos")}>
            <ArrowLeft className="size-[18px]" />
          </IconBtn>
          <h1 className="mt-3 text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">
            {video.name}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-[12.5px] text-[#75757d]">
            <StatusDot status={video.status} />
            <span>
              {statusLabel(video.status)}
              {video.stage ? ` · ${video.stage}` : ""}
              {liveRows.length > 0 ? ` · ${doneCount}/${liveRows.length} módulos` : ""}
            </span>
          </div>
          {(video.status === "processing" || video.status === "queued") && (
            <div className="mt-3 h-1.5 max-w-sm overflow-hidden rounded-full bg-[#eef0f3]">
              <div
                className={`h-full rounded-full ${video.status === "queued" ? "bg-[#e2b340]" : "bg-[#3d6f99]"}`}
                style={{ width: `${Math.max(6, Math.min(100, video.progress))}%` }}
              />
            </div>
          )}
        </div>
        {extraction && (
          <Button
            className="rounded-xl"
            onClick={() =>
              downloadJson(
                video.status === "ready" ? "video-extraction.json" : "video-extraction-parcial.json",
                extraction
              )
            }
          >
            <Download className="mr-2 size-4" />
            {video.status === "ready" ? "Descargar JSON" : "Descargar JSON parcial"}
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="gap-5">
        <TabsList variant="line" className="border-b border-[#e7e7eb] p-0">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {video.status === "error" && !extraction ? (
            <EmptyCard title="No se pudo procesar" body={video.error || "Error desconocido"} />
          ) : (
            <div className="grid gap-5">
              {extraction?.media ? (
                <div className="grid gap-4 md:grid-cols-4">
                  <Metric label="Duración" value={extraction.media.duration} />
                  <Metric
                    label="Resolución"
                    value={`${extraction.media.width}×${extraction.media.height}`}
                  />
                  <Metric label="FPS" value={String(extraction.media.fps)} />
                  <Metric label="Módulos listos" value={`${doneCount}/${liveRows.length || "—"}`} />
                </div>
              ) : video.probe ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric label="Duración" value={msToClock(video.probe.durationMs)} />
                  <Metric
                    label="Resolución"
                    value={`${video.probe.width}×${video.probe.height}`}
                  />
                  <Metric label="FPS" value={String(video.probe.fps)} />
                </div>
              ) : null}

              <section className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
                <div className="text-sm font-semibold">Módulos de este vídeo</div>
                <p className="mt-1 text-[12.5px] text-[#75757d]">
                  Se van rellenando solos al terminar cada extractor. Si mañana registras otro
                  módulo, aparece aquí igual.
                </p>
                <div className="mt-4 grid gap-2">
                  {liveRows.length === 0 ? (
                    <p className="text-sm text-[#75757d]">
                      {video.status === "queued"
                        ? "En espera de hueco en la cola…"
                        : "Preparando extractores…"}
                    </p>
                  ) : (
                    liveRows.map((row) => (
                      <ModuleLiveRow key={row.id} row={row} />
                    ))
                  )}
                </div>
              </section>

              {(extraction?.modules || []).filter((m) => m.items.length > 0).length > 0 && (
                <section className="grid gap-5 lg:grid-cols-2">
                  {(extraction?.modules || [])
                    .filter((m) => m.items.length > 0)
                    .map((mod) => (
                      <ModuleItemsList key={`${mod.id}-items`} module={mod} />
                    ))}
                </section>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="json">
          <div className="rounded-2xl bg-[#151517] p-4 text-[12.5px] leading-[1.55] text-[#e9e9ed]">
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
        </TabsContent>

        <TabsContent value="activity">
          <div className="rounded-2xl border border-[#e7e7eb] bg-white p-4">
            {video.activity.map((item, index) => (
              <div
                key={`${item.time}-${index}`}
                className="grid grid-cols-[60px_24px_minmax(0,1fr)] gap-3 border-t border-[#e7e7eb] py-3 first:border-t-0"
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModuleLiveRow({
  row,
}: {
  row: {
    id: string;
    title: string;
    phase: "done" | "running" | "waiting";
    module?: ExtractionModule;
  };
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

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#ececf0] bg-[#fbfbfc] px-3 py-3">
      {mark}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{row.title}</div>
        <div
          className={`mt-0.5 text-[12.5px] ${
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
      {row.module?.engine ? (
        <div className="hidden text-[11px] text-[#9a9aa3] sm:block">{row.module.engine}</div>
      ) : null}
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
  return (
    <section className="min-w-0 rounded-2xl border border-[#e7e7eb] bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">{module.title}</div>
        <div className="text-[12px] text-[#75757d]">{module.summary}</div>
      </div>
      {module.items.length === 0 ? (
        <p className="mt-4 text-sm text-[#75757d]">
          {module.error || "Este módulo no devolvió filas para este vídeo."}
        </p>
      ) : (
        <div className="mt-4 grid min-w-0 gap-0">
          {module.items.map((item, index) => {
            const showLabel =
              Boolean(item.label) &&
              item.label !== module.id &&
              item.label !== module.title;
            return (
              <div
                key={`${module.id}-${index}`}
                className="grid min-w-0 gap-1 border-t border-[#e7e7eb] py-3 first:border-t-0 first:pt-0"
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12.5px]">
                  <span className="shrink-0 tabular-nums text-[#75757d]">
                    {typeof item.start_ms === "number" ? msToClock(item.start_ms) : "—"}
                  </span>
                  {showLabel ? (
                    <span className="min-w-0 font-medium break-words text-[#2f363e]">
                      {item.label}
                    </span>
                  ) : null}
                </div>
                <p className="m-0 min-w-0 text-sm leading-relaxed break-words text-[#171719]">
                  {item.text}
                </p>
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
        <div className="text-sm font-semibold">JSON de salida (extraction)</div>
        <p className="mt-2 text-sm leading-relaxed text-[#75757d]">
          Cada vídeo genera un JSON unificado llamado <code className="text-[12.5px]">extraction</code>.
          Dentro lleva <code className="text-[12.5px]">schema_version</code> (ahora{" "}
          <code className="text-[12.5px]">&quot;1.0&quot;</code>): una etiqueta que dice qué
          formato es. Si un día cambiamos la forma del JSON, subimos esa versión (1.1, 2.0…)
          para que tu IA u otra app sepa cuál está leyendo.
        </p>
        <DocsCode>{`extraction
├── schema_version: "1.0"
├── source
│   ├── filename
│   └── processed_at
├── media
│   ├── duration_ms, duration
│   ├── width, height, fps
│   └── orientation
└── modules[]
    ├── scene_cuts
    ├── camera_motion
    ├── speech
    ├── speakers
    ├── on_screen_text
    ├── objects_people
    ├── visual_observation
    ├── music_ambiance
    ├── audio_events
    └── summary`}</DocsCode>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#75757d]">
          No es un archivo que subes a mano: lo crea el programa al terminar. Lo encuentras
          al descargar el resultado, en el webhook, o en la carpeta de salida de Drive.
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
    "schema_version": "1.0",
    "source": { "filename": "clip.mp4", "processed_at": "..." },
    "media": { "duration_ms": 12000, "width": 1080, "height": 1920 },
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
        <div className="text-sm font-semibold">Endpoints útiles</div>
        <div className="mt-3 grid min-w-0 gap-2 text-sm">
          <div className="grid min-w-0 gap-1 border-t border-[#e7e7eb] py-3 first:border-t-0 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <code className="break-words text-[12.5px]">POST /api/jobs</code>
            <span className="text-[#75757d]">Crear uno o varios trabajos</span>
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
              <Button className="rounded-xl" disabled={saving} onClick={() => void save()}>
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
            <div className="flex flex-wrap gap-2 pt-1">
              <Button className="rounded-xl" disabled={saving} onClick={() => void save()}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={testing || !webhookUrl.trim()}
                onClick={() => void testWebhook()}
              >
                {testing ? "Probando…" : "Probar webhook"}
              </Button>
              {secretSet ? (
                <Button
                  variant="outline"
                  className="rounded-xl"
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
