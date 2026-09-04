"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
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
            De vídeo a JSON. Instala, sube y listo.
          </h1>
          <p className="mt-4 text-[clamp(15px,1.4vw,18px)] text-[#75757d]">
            Cortes, habla, quién habla, texto, objetos/personas, observación visual y un resumen final.
            Todo modular: cada cajita escribe su bloque en el JSON.
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
              <div className="text-[13px] text-[#75757d]">MP4 · MOV · MKV · WebM · varios a la vez</div>
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
          body="Los trabajos viven en memoria del servidor mientras la app está encendida. Más adelante se puede mover a base de datos."
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
                <Metric label="Módulos" value={String(extraction.modules.length)} />
              </div>

              <section className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
                <div className="text-sm font-semibold">Módulos de este vídeo</div>
                <p className="mt-1 text-[12.5px] text-[#75757d]">
                  El resumen lo aporta cada módulo. Si mañana añades otro, aparece aquí igual.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {extraction.modules.map((mod) => (
                    <ModuleSummaryCard key={mod.id} module={mod} />
                  ))}
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                {extraction.modules.map((mod) => (
                  <ModuleItemsList key={`${mod.id}-items`} module={mod} />
                ))}
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

function ModuleSummaryCard({ module }: { module: ExtractionModule }) {
  const tone =
    module.status === "error" ? "text-[#b42318]" :
    module.status === "empty" ? "text-[#75757d]" :
    "text-[#177245]";

  return (
    <div className="rounded-xl border border-[#e7e7eb] bg-[#fbfbfc] p-4">
      <div className="text-sm font-medium">{module.title}</div>
      <div className={`mt-2 text-[12.5px] leading-relaxed ${tone}`}>
        {module.summary}
      </div>
      {module.engine ? (
        <div className="mt-2 text-[11px] text-[#9a9aa3]">{module.engine}</div>
      ) : null}
      {module.error ? (
        <div className="mt-2 text-[12px] leading-relaxed text-[#b42318]">{module.error}</div>
      ) : null}
    </div>
  );
}

function ModuleItemsList({ module }: { module: ExtractionModule }) {
  return (
    <section className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold">{module.title}</div>
        <div className="text-[12px] text-[#75757d]">{module.summary}</div>
      </div>
      {module.items.length === 0 ? (
        <p className="mt-4 text-sm text-[#75757d]">
          {module.error || "Este módulo no devolvió filas para este vídeo."}
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {module.items.map((item, index) => (
            <div
              key={`${module.id}-${index}`}
              className="grid grid-cols-[72px_72px_minmax(0,1fr)] gap-3 text-sm"
            >
              <span className="text-[#75757d]">
                {typeof item.start_ms === "number" ? msToClock(item.start_ms) : "—"}
              </span>
              <span className="font-medium">{item.label || "—"}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsView() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [secretSet, setSecretSet] = useState(false);
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
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "No se pudo cargar ajustes");
        if (cancelled) return;
        setWebhookUrl(data.webhookUrl || "");
        setSecretSet(Boolean(data.webhookSecretSet));
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
        }),
      });
      const data = (await res.json()) as {
        webhookUrl?: string;
        webhookSecretSet?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setWebhookUrl(data.webhookUrl || "");
      setSecretSet(Boolean(data.webhookSecretSet));
      setWebhookSecret("");
      setMessage("Webhook guardado. Se enviará al terminar cada vídeo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
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
    <div className="grid gap-4">
      <div>
        <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Ajustes</h1>
        <p className="text-sm text-[#75757d]">
          Conecta otras apps: cuando un vídeo termine, enviamos el JSON a tu URL.
        </p>
      </div>

      <section className="rounded-2xl border border-[#e7e7eb] bg-white p-5">
        <div className="text-sm font-semibold">Webhook</div>
        <p className="mt-1 text-[12.5px] text-[#75757d]">
          Pon la URL de Make, n8n, Zapier, tu backend, etc. Recibirá un POST con el resultado.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-[#75757d]">Cargando…</p>
        ) : (
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="text-[#75757d]">URL del webhook</span>
              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.ejemplo.com/vx"
                className="h-10 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-[#75757d]">
                Secreto opcional {secretSet ? "(ya hay uno guardado)" : ""}
              </span>
              <input
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={secretSet ? "Dejar vacío para no cambiarlo" : "Bearer token o clave"}
                className="h-10 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
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
            </div>
            {message ? <p className="text-sm text-[#177245]">{message}</p> : null}
            {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
          </div>
        )}
      </section>

      <EmptyCard
        title="Qué recibe la otra app"
        body='Un POST JSON con event ("job.ready" o "job.error"), datos del trabajo y el bloque extraction con todos los módulos. Si subes varios vídeos, cada uno avisa cuando termina.'
      />
      <EmptyCard
        title="Varios vídeos desde fuera"
        body="Tu otra app puede mandar muchos de golpe con POST /api/jobs y el campo files (varios archivos). Se encolan y se procesan sin saturar la máquina."
      />
      <EmptyCard
        title="Módulos"
        body="La interfaz no hardcodea extractores. Cada módulo registrado escribe su bloque y aparece solo si se ejecutó."
      />
    </div>
  );
}
