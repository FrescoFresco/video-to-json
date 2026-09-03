"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
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
import { msToClock } from "@/lib/demo-extraction";
import { useStudio } from "@/lib/store";
import type { JobStatus, StoredVideo, ViewName } from "@/lib/types";

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

  const nav = (view: ViewName, icon: ReactNode) => (
    <button
      type="button"
      title={view}
      aria-label={view}
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
          {nav("home", <Home className="size-[17px]" />)}
          {nav("videos", <Video className="size-[17px]" />)}
        </div>
        <div className="mt-auto grid justify-items-center">
          {nav("settings", <Settings className="size-[17px]" />)}
        </div>
      </aside>

      <main className="min-w-0 px-4 py-5 pb-24 md:px-[clamp(22px,3vw,42px)] md:py-[clamp(22px,3vw,42px)]">
        <div className="mx-auto w-full max-w-[1080px]">
          {s.view === "home" && <HomeView />}
          {s.view === "videos" && <VideosView />}
          {s.view === "video-detail" && activeVideo && <VideoDetail video={activeVideo} />}
          {s.view === "settings" && <SettingsView />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e7eb] bg-[#fbfbfc]/94 px-2.5 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-3 gap-1">
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
    <div>
      <div className="grid min-h-[min(68vh,760px)] place-items-center py-5 md:py-12">
        <div className="w-full max-w-[780px] text-center">
          <div className="mb-2.5 text-[13px] text-[#75757d]">Video Extraction Studio</div>
          <h1 className="m-0 text-[clamp(32px,5vw,58px)] leading-none font-semibold tracking-[-0.055em]">
            Sube un vídeo. Mira solo lo que de verdad se ha extraído.
          </h1>
          <p className="mt-4 text-[clamp(15px,1.4vw,18px)] text-[#75757d]">
            Esta base no enseña ejemplos inventados. Hoy saca metadatos, cortes de plano,
            habla del vídeo y texto en pantalla.
          </p>

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
            className={`mt-8 grid min-h-[280px] place-items-center rounded-3xl border border-[#d7d7dc] bg-white p-8 transition ${drag ? "scale-[1.005] border-[#9e9ea5]" : ""}`}
          >
            <div className="grid justify-items-center gap-3">
              <div className="grid size-[54px] place-items-center rounded-[16px] bg-[#f5f5f7]">
                <Upload className="size-[24px]" />
              </div>
              <div className="text-lg font-semibold">Añade uno o varios vídeos</div>
              <div className="text-[13px] text-[#75757d]">MP4 · MOV · MKV · WebM</div>
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
              <Button className="rounded-xl" onClick={() => inputRef.current?.click()}>
                Seleccionar vídeos
              </Button>
              <p className="max-w-[44rem] text-[12.5px] leading-relaxed text-[#75757d]">
                Lo que no existe aún no se inventa: se deja fuera o marcado como no disponible.
                La primera ejecución puede tardar porque Whisper y OCR van por CPU.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <EmptyCard
          title="Sí hace"
          body="Duración, resolución, fps, cortes de plano, transcripción y texto en pantalla."
        />
        <EmptyCard
          title="No hace todavía"
          body="Descripción visual del plano, tracking de objetos y análisis de música."
        />
        <EmptyCard
          title="Cómo se guarda"
          body="El historial de esta versión vive en tu navegador. Luego se puede mover a servidor."
        />
      </div>

      {s.videos.length > 0 && (
        <div className="mt-12">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-[#75757d] uppercase">Recientes</p>
            <Button variant="outline" className="rounded-xl" onClick={s.clearAll}>
              Limpiar historial
            </Button>
          </div>
          <div className="rounded-2xl border border-[#e7e7eb] bg-white">
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
                  <div className="mt-1 text-[12.5px] text-[#75757d]">{video.stage}</div>
                </div>
                <div className="text-[12px] text-[#75757d]">{video.progress}%</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VideosView() {
  const s = useStudio();

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Vídeos</h1>
          <p className="text-sm text-[#75757d]">Solo resultados reales extraídos aquí.</p>
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
          body="Vuelve a Home, sube un MP4 y aquí aparecerá lo que el sistema ha sacado de verdad."
        />
      ) : (
        <div className="rounded-2xl border border-[#e7e7eb] bg-white">
          {s.videos.map((video) => (
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
                  {video.probe ? `${Math.round(video.probe.durationMs / 1000)} s · ${video.probe.width}×${video.probe.height}` : video.stage}
                </div>
              </div>
              <div className="text-[12px] capitalize text-[#75757d]">{video.status}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoDetail({ video }: { video: StoredVideo }) {
  const s = useStudio();
  const extraction = video.extraction;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <IconBtn title="Volver" onClick={() => s.setView("videos")}>
            <ArrowLeft className="size-[18px]" />
          </IconBtn>
          <h1 className="mt-3 text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">{video.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-[12.5px] text-[#75757d]">
            <StatusDot status={video.status} />
            <span>{video.stage}</span>
          </div>
        </div>
        {extraction && (
          <Button className="rounded-xl" onClick={() => downloadJson("video-extraction.json", extraction)}>
            <Download className="mr-2 size-4" />
            Descargar JSON
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
          {!extraction ? (
            <EmptyCard
              title={video.status === "error" ? "No se pudo procesar" : "Procesando"}
              body={video.error || "La extracción todavía no está lista."}
            />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-4">
                <Metric label="Duración" value={extraction.media.duration} />
                <Metric label="Resolución" value={`${extraction.media.width}×${extraction.media.height}`} />
                <Metric label="FPS" value={String(extraction.media.fps)} />
                <Metric label="Cortes" value={String(extraction.scenes.length)} />
              </div>

              <section className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
                <div className="text-sm font-semibold">Qué sí salió de este vídeo</div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <CapabilityCard title="Habla del vídeo" body={`${extraction.transcript.length} segmentos`} />
                  <CapabilityCard title="Texto en pantalla" body={`${extraction.on_screen_text.length} detecciones`} />
                  <CapabilityCard title="Marcas" body={extraction.brands.length ? extraction.brands.join(", ") : "Ninguna"} />
                </div>
              </section>

              <section className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
                <div className="text-sm font-semibold">Escenas detectadas</div>
                <div className="mt-4 grid gap-2">
                  {extraction.scenes.map((scene) => (
                    <div key={scene.id} className="grid grid-cols-[110px_110px_minmax(0,1fr)] gap-3 text-sm">
                      <span className="text-[#75757d]">{scene.id}</span>
                      <span>{scene.start}</span>
                      <span>{scene.end}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <DataList
                  title="Transcripción"
                  empty="No se detectó habla en este vídeo."
                  rows={extraction.transcript.map((item) => ({
                    left: msToClock(item.start_ms),
                    middle: item.speaker,
                    right: item.text,
                  }))}
                />
                <DataList
                  title="Texto en pantalla"
                  empty="No se detectó texto en pantalla."
                  rows={extraction.on_screen_text.map((item) => ({
                    left: msToClock(item.start_ms),
                    middle: item.role || "texto",
                    right: item.text,
                  }))}
                />
              </section>

              <section className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
                <div className="text-sm font-semibold">Todavía no disponible</div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <CapabilityCard title="Descripción visual" body={extraction.capabilities.visual_description.reason} />
                  <CapabilityCard title="Tracking de objetos" body={extraction.capabilities.object_tracking.reason} />
                  <CapabilityCard title="Música" body={extraction.capabilities.music_analysis.reason} />
                </div>
              </section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="json">
          <div className="rounded-2xl bg-[#151517] p-4 text-[12.5px] leading-[1.55] text-[#e9e9ed]">
            <pre className="overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(extraction ?? { error: video.error || "Aún no hay JSON disponible." }, null, 2)}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="rounded-2xl border border-[#e7e7eb] bg-white p-4">
            {video.activity.map((item, index) => (
              <div key={`${item.time}-${index}`} className="grid grid-cols-[60px_24px_minmax(0,1fr)] gap-3 border-t border-[#e7e7eb] py-3 first:border-t-0">
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e7e7eb] bg-white p-4">
      <div className="text-[12px] uppercase tracking-wide text-[#75757d]">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function CapabilityCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#e7e7eb] bg-[#fbfbfc] p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-2 text-[12.5px] leading-relaxed text-[#75757d]">{body}</div>
    </div>
  );
}

function DataList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ left: string; middle: string; right: string }>;
}) {
  return (
    <section className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
      <div className="text-sm font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#75757d]">{empty}</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {rows.map((row, index) => (
            <div key={`${row.left}-${index}`} className="grid grid-cols-[72px_72px_minmax(0,1fr)] gap-3 text-sm">
              <span className="text-[#75757d]">{row.left}</span>
              <span className="font-medium">{row.middle}</span>
              <span>{row.right}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsView() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Ajustes</h1>
        <p className="text-sm text-[#75757d]">Base limpia para seguir construyendo la app web correctamente.</p>
      </div>
      <EmptyCard
        title="Sin resultados inventados"
        body="Si una capacidad no existe aún, no aparece con sample. Solo verás datos reales o un aviso claro de que todavía no está implementada."
      />
      <EmptyCard
        title="Paso siguiente"
        body="Cuando quieras, el siguiente salto es mover el historial a una base de datos real en servidor y dejar de depender del navegador."
      />
    </div>
  );
}
