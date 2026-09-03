"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Home,
  Info,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Upload,
  Video,
  X,
  Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { treeFrom } from "@/lib/compose";
import { msToClock } from "@/lib/demo-extraction";
import { useStudio } from "@/lib/store";
import type { JobStatus, StoredVideo, ViewName } from "@/lib/types";
import { isUrlListFile, isVideoFile, isVideoZip } from "@/lib/video-file";

function downloadJson(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 400);
}

function StatusDot({ status }: { status: JobStatus | "unwired" }) {
  const map = {
    ready: "bg-[#edf6f1] text-[#177245]",
    queued: "bg-[#fff6df] text-[#9a6700]",
    processing: "bg-[#fff6df] text-[#9a6700]",
    error: "bg-[#fff0ef] text-[#b42318]",
    unwired: "bg-[#fff6df] text-[#9a6700]",
  } as const;
  const icon =
    status === "ready" ? <Check className="size-3.5" /> :
    status === "error" ? <X className="size-3.5" /> :
    <span className="size-2 rounded-full bg-current animate-pulse" />;
  return (
    <span className={`inline-grid size-[22px] place-items-center rounded-full ${map[status] || map.queued}`} title={status}>
      {icon}
    </span>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  primary,
  plain,
}: {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  primary?: boolean;
  plain?: boolean;
}) {
  return (
    <Button
      type="button"
      size="icon-lg"
      variant={primary ? "default" : plain ? "ghost" : "outline"}
      title={title}
      aria-label={title}
      onClick={onClick}
      className="size-10 rounded-[9px]"
    >
      {children}
    </Button>
  );
}

export function StudioApp() {
  const s = useStudio();
  const [jsonOpen, setJsonOpen] = useState<{ title: string; obj: unknown; name: string } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState<{ name: string; type: string; sample: unknown } | null>(null);
  const [modName, setModName] = useState("");
  const [modRepo, setModRepo] = useState("");
  const [videoTab, setVideoTab] = useState<"video" | "results" | "activity">("video");
  const [composerTab, setComposerTab] = useState<"sources" | "configuration" | "versions">("sources");
  const [query, setQuery] = useState("");

  const activeVideo = s.videos.find((v) => v.id === s.activeVideoId) ?? s.videos[0];
  const activeBatch = s.batches.find((b) => b.id === s.activeBatchId);

  const nav = (view: ViewName) => (
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
      {view === "home" && <Home className="size-[17px]" />}
      {view === "videos" && <Video className="size-[17px]" />}
      {view === "modules" && <LayoutGrid className="size-[17px]" />}
      {view === "composer" && <SlidersHorizontal className="size-[17px]" />}
      {view === "settings" && <Settings className="size-[17px]" />}
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
          {nav("home")}
          {nav("videos")}
        </div>
        <div className="mx-2 h-px bg-[#e7e7eb]" />
        <div className="grid justify-items-center gap-1">
          {nav("modules")}
          {nav("composer")}
        </div>
        <div className="mt-auto grid justify-items-center">{nav("settings")}</div>
      </aside>

      <main className="min-w-0 px-4 py-5 pb-[calc(92px+env(safe-area-inset-bottom))] md:px-[clamp(22px,3vw,42px)] md:py-[clamp(22px,3vw,42px)] md:pb-[clamp(34px,5vw,70px)]">
        <div className="mx-auto w-full max-w-[1180px]">
          {s.view === "home" && (
            <HomeView
              batch={activeBatch}
              onHelp={() => setHelpOpen(true)}
              onOpenJson={(title, obj, name) => setJsonOpen({ title, obj, name })}
            />
          )}
          {s.view === "videos" && (
            <VideosView query={query} setQuery={setQuery} />
          )}
          {s.view === "video-detail" && activeVideo && (
            <VideoDetail
              video={activeVideo}
              tab={videoTab}
              setTab={setVideoTab}
              onJson={(title, obj, name) => setJsonOpen({ title, obj, name })}
            />
          )}
          {s.view === "modules" && (
            <ModulesView
              onAdd={() => setAddOpen(true)}
              onOpen={(m) => setSourceOpen({ name: m.name, type: m.kind === "repo" ? "Repo" : "Builtin", sample: m.sample })}
            />
          )}
          {s.view === "composer" && (
            <ComposerView
              tab={composerTab}
              setTab={setComposerTab}
              onAi={() => setAiOpen(true)}
              onJson={(title, obj, name) => setJsonOpen({ title, obj, name })}
              onOpenSource={(name, type, sample) => setSourceOpen({ name, type, sample })}
            />
          )}
          {s.view === "settings" && <SettingsView />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e7eb] bg-[#fbfbfc]/94 px-2.5 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-3 gap-1">
          {(["home", "videos"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => s.setView(v)}
              className={`grid min-h-12 place-items-center rounded-[9px] ${s.view === v || (s.view === "video-detail" && v === "videos") ? "bg-[#f5f5f7] text-[#171719]" : "text-[#75757d]"}`}
              aria-label={v}
            >
              {v === "home" ? <Home className="size-[18px]" /> : <Video className="size-[18px]" />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="grid min-h-12 place-items-center rounded-[9px] text-[#75757d]"
            aria-label="Más"
          >
            <MoreHorizontal className="size-[18px]" />
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="rounded-t-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Más</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1">
            {([
              ["modules", "Módulos", LayoutGrid],
              ["composer", "Composer", SlidersHorizontal],
              ["settings", "Ajustes", Settings],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className="flex h-11 items-center gap-2.5 rounded-[9px] px-2.5 text-left text-sm font-medium hover:bg-[#f5f5f7]"
                onClick={() => {
                  setMoreOpen(false);
                  s.setView(id);
                }}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Cómo entra un vídeo</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-[#75757d]">Este estudio solo procesa vídeos.</p>
          <div className="border-t border-[#e7e7eb] py-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Archivos</p>
            <p>MP4, MOV, MKV, WebM. Un ZIP de vídeos, o un TXT/CSV con URLs de vídeos.</p>
          </div>
          <div className="border-t border-[#e7e7eb] py-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">URLs en lote</p>
            <p className="text-[12.5px] text-[#75757d]">Pega varios links de vídeo o un TXT/CSV que los contenga.</p>
            <pre className="mt-3 overflow-auto rounded-xl bg-[#151517] p-4 font-mono text-[12.5px] leading-[1.55] text-[#e9e9ed]">{`https://instagram.com/reel/...
https://tiktok.com/@.../video/...
https://facebook.com/...`}</pre>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!jsonOpen} onOpenChange={(o) => !o && setJsonOpen(null)}>
        <DialogContent className="max-h-[86vh] overflow-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{jsonOpen?.title}</DialogTitle>
          </DialogHeader>
          <pre className="overflow-auto rounded-xl bg-[#151517] p-4 font-mono text-[12.5px] leading-[1.55] whitespace-pre text-[#e9e9ed]">
            {jsonOpen ? JSON.stringify(jsonOpen.obj, null, 2) : ""}
          </pre>
          <div className="flex justify-end gap-2">
            <IconBtn
              title="Copiar"
              onClick={() => navigator.clipboard?.writeText(JSON.stringify(jsonOpen?.obj, null, 2))}
            >
              <Copy className="size-[18px]" />
            </IconBtn>
            <IconBtn
              primary
              title="Descargar"
              onClick={() => jsonOpen && downloadJson(jsonOpen.name, jsonOpen.obj)}
            >
              <Download className="size-[18px]" />
            </IconBtn>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sourceOpen} onOpenChange={(o) => !o && setSourceOpen(null)}>
        <DialogContent className="max-h-[86vh] overflow-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{sourceOpen?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-[#75757d]">{sourceOpen?.type}</p>
          <p className="mt-4 mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Estructura</p>
          <pre className="overflow-auto rounded-xl bg-[#151517] p-4 font-mono text-[12.5px] text-[#e9e9ed]">
            {sourceOpen ? treeFrom(sourceOpen.sample).join("\n") : ""}
          </pre>
          <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Sample</p>
          <pre className="overflow-auto rounded-xl bg-[#151517] p-4 font-mono text-[12.5px] text-[#e9e9ed]">
            {sourceOpen ? JSON.stringify(sourceOpen.sample, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir módulo</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-[#75757d]">
            Un nombre, y si quieres la URL del repo. La app no se casa con SAM ni con nada: espera JSON.
          </p>
          <Input
            placeholder="Nombre del módulo"
            value={modName}
            onChange={(e) => setModName(e.target.value)}
            className="mt-2 h-[42px] rounded-[9px]"
          />
          <Input
            placeholder="https://github.com/… (opcional)"
            value={modRepo}
            onChange={(e) => setModRepo(e.target.value)}
            className="h-[42px] rounded-[9px]"
          />
          <div className="flex justify-end">
            <IconBtn
              primary
              title="Añadir"
              onClick={() => {
                if (!modName.trim()) return;
                s.addModule(modName.trim(), modRepo.trim() || undefined);
                setModName("");
                setModRepo("");
                setAddOpen(false);
              }}
            >
              <Plus className="size-[18px]" />
            </IconBtn>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preparar para IA</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-[#75757d]">
            Todo lo que una IA necesita para generar un output-config.json compatible. No inventar paths.
          </p>
          {["Fuentes", "Esquemas y paths descubiertos", "Samples", "Configuración actual", "Reglas del Composer"].map(
            (label) => (
              <div key={label} className="flex items-center gap-2 border-t border-[#e7e7eb] py-3">
                <Check className="size-4 text-[#177245]" /> {label}
              </div>
            )
          )}
          <div className="flex justify-end">
            <IconBtn
              primary
              title="Descargar contexto"
              onClick={() => {
                downloadJson("composer-context.json", {
                  composer_contract: {
                    purpose: "Generate a valid output-config.json from available JSON sources.",
                    rules: [
                      "Do not invent paths.",
                      "Use only available source structures.",
                      "Return valid JSON.",
                    ],
                  },
                  sources: [
                    ...s.modules.map((m) => ({
                      id: m.id,
                      name: m.name,
                      type: m.kind,
                      repo: m.repoUrl ?? null,
                      sample: m.sample,
                    })),
                    ...s.importedSources.map((i) => ({
                      id: i.id,
                      name: i.name,
                      type: "Imported JSON",
                      sample: i.sample,
                    })),
                  ],
                  current_config: s.config,
                });
                setAiOpen(false);
              }}
            >
              <Download className="size-[18px]" />
            </IconBtn>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function extractUrls(text: string) {
  return [...new Set(text.match(/https?:\/\/[^\s,;"']+/g) || [])];
}

function HomeView({
  batch,
  onHelp,
  onOpenJson,
}: {
  batch: ReturnType<typeof useStudio>["batches"][number] | undefined;
  onHelp: () => void;
  onOpenJson: (t: string, o: unknown, n: string) => void;
}) {
  const s = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const showBatch = Boolean(s.activeBatchId && batch);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (showBatch) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const urls = extractUrls(e.clipboardData?.getData("text/plain") || "");
      if (urls.length) {
        e.preventDefault();
        await s.createBatch(urls.map((url) => ({ name: url, type: "url" as const })));
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [s, showBatch]);

  async function ingestFiles(files: File[]) {
    const items: { name: string; type: "file" | "url" | "zip"; file?: File }[] = [];
    for (const file of files) {
      if (isUrlListFile(file.name)) {
        const urls = extractUrls(await file.text());
        urls.forEach((url) => items.push({ name: url, type: "url" }));
        continue;
      }
      if (isVideoZip(file.name)) {
        items.push({ name: file.name, type: "zip", file });
        continue;
      }
      if (isVideoFile(file)) {
        items.push({ name: file.name, type: "file", file });
      }
    }
    if (items.length) await s.createBatch(items);
  }

  return showBatch && batch ? (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <IconBtn plain title="Atrás" onClick={() => s.setActiveBatchId(null)}>
            <ArrowLeft className="size-[18px]" />
          </IconBtn>
          <h1 className="mt-2.5 text-[clamp(24px,2.4vw,32px)] leading-[1.08] font-semibold tracking-[-0.035em]">
            Lote {batch.number}
          </h1>
          <p className="m-0 text-sm text-[#75757d]">
            {batch.status === "complete" ? "Completo" : "Procesando"}
          </p>
        </div>
        <div className="flex gap-2">
          <IconBtn title="Nuevo lote" onClick={() => s.setActiveBatchId(null)}>
            <Plus className="size-[18px]" />
          </IconBtn>
          {batch.status === "complete" && (
            <IconBtn
              primary
              title="Descargar ZIP"
              onClick={() =>
                downloadJson(`batch_${batch.number}_manifest.json`, {
                  batch_id: batch.id,
                  files: batch.items.map((i) => ({ source: i.name })),
                })
              }
            >
              <Download className="size-[18px]" />
            </IconBtn>
          )}
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-4 text-[13px] text-[#75757d]">
        <span>{batch.items.length} ítems</span>
        <span className="inline-flex items-center gap-1">
          <Check className="size-3.5" /> {batch.items.filter((i) => i.status === "ready").length}
        </span>
      </div>
      {batch.items.map((item) => (
        <div key={item.id} className="border-t border-[#e7e7eb] py-3.5 first:border-t-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{item.name}</div>
              <div className="mt-1 text-[12.5px] text-[#75757d]">
                {item.status === "ready" ? "Listo" : item.stage}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status={item.status} />
              {item.status === "ready" && item.videoId && (
                <>
                  <IconBtn
                    plain
                    title="Ver JSON"
                    onClick={() => {
                      const v = s.videos.find((x) => x.id === item.videoId);
                      if (v) onOpenJson("Final JSON", v.extraction, `${item.name}.json`);
                    }}
                  >
                    <Braces className="size-[18px]" />
                  </IconBtn>
                  <IconBtn
                    plain
                    title="Abrir"
                    onClick={() => item.videoId && s.openVideo(item.videoId)}
                  >
                    <ExternalLink className="size-[18px]" />
                  </IconBtn>
                </>
              )}
            </div>
          </div>
          <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-[#ececef]">
            <div className="h-full bg-[#171719] transition-[width] duration-300" style={{ width: `${item.progress}%` }} />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div>
      <div className="grid min-h-[min(64vh,650px)] place-items-center py-5 md:py-[clamp(18px,4vw,52px)]">
        <div className="w-full max-w-[720px] text-center">
          <div className="mb-2.5 text-[13px] text-[#75757d]">Video Extraction Studio</div>
          <h1 className="m-0 text-[clamp(32px,5vw,58px)] leading-none font-semibold tracking-[-0.055em]">
            Extrae datos estructurados de un vídeo.
          </h1>
          <p className="mt-3.5 mb-7 text-[clamp(15px,1.4vw,18px)] text-[#75757d]">
            Suelta vídeos. Sale un JSON denso: qué se ve, cuándo, qué se dice, quién habla.
          </p>
          <p className="mb-7 text-[13px] text-[#75757d]">
            La primera vez que arrancas Next compila y puede tardar un minuto. Procesar un MP4 es otra cosa: Whisper corre en CPU, sin GPU.
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
              const files = [...e.dataTransfer.files];
              if (files.length) await ingestFiles(files);
              else {
                const urls = extractUrls(e.dataTransfer.getData("text/plain") || "");
                if (urls.length) await s.createBatch(urls.map((url) => ({ name: url, type: "url" as const })));
              }
            }}
            onPaste={async (e) => {
              const urls = extractUrls(e.clipboardData.getData("text/plain") || "");
              if (urls.length) {
                e.preventDefault();
                await s.createBatch(urls.map((url) => ({ name: url, type: "url" as const })));
              }
            }}
            className={`grid min-h-[260px] place-items-center rounded-2xl border border-[#d7d7dc] bg-white p-8 transition ${drag ? "scale-[1.005] border-[#9e9ea5]" : ""}`}
          >
            <div className="grid justify-items-center gap-3">
              <div className="grid size-[46px] place-items-center rounded-[14px] bg-[#f5f5f7]">
                <Upload className="size-[21px]" />
              </div>
              <div className="text-lg font-semibold">Añade vídeos o links</div>
              <div className="text-[13px] text-[#75757d]">MP4 · MOV · WebM · URLs de vídeo</div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="video/*,.mp4,.mov,.mkv,.webm,.m4v,.zip,.txt,.csv"
                className="hidden"
                onChange={async (e) => {
                  const files = [...(e.target.files || [])];
                  e.target.value = "";
                  if (files.length) await ingestFiles(files);
                }}
              />
              <IconBtn primary title="Explorar" onClick={() => inputRef.current?.click()}>
                <Upload className="size-[18px]" />
              </IconBtn>
              <div className="text-[13px] text-[#75757d]">Pega varias URLs con ⌘V / Ctrl+V</div>
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <IconBtn plain title="Ayuda" onClick={onHelp}>
              <Info className="size-[18px]" />
            </IconBtn>
          </div>
        </div>
      </div>
      {s.batches.length > 0 && (
        <div className="mt-12">
          <p className="mb-2.5 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Recientes</p>
          {s.batches.map((b) => (
            <div key={b.id} className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t border-[#e7e7eb] py-3 first:border-t-0">
              <div>
                <div className="truncate text-sm font-medium">Lote {b.number}</div>
                <div className="mt-1 text-[12.5px] text-[#75757d]">
                  {b.items.length} ítems · {b.status === "complete" ? "Completo" : "Procesando"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status={b.status === "complete" ? "ready" : "processing"} />
                <IconBtn plain title="Abrir" onClick={() => s.setActiveBatchId(b.id)}>
                  <ExternalLink className="size-[18px]" />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VideosView({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (q: string) => void;
}) {
  const s = useStudio();
  const list = s.videos.filter(
    (v) => v.name.toLowerCase().includes(query.toLowerCase()) || v.meta.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Vídeos</h1>
          <p className="m-0 text-sm text-[#75757d]">Todo lo que has procesado.</p>
        </div>
        <div className="flex gap-2">
          <IconBtn
            title="Descargar todo"
            onClick={() =>
              downloadJson(
                "all_video_results.json",
                s.videos.filter((v) => v.status === "ready").map((v) => ({ source: v.name, result: v.extraction }))
              )
            }
          >
            <Download className="size-[18px]" />
          </IconBtn>
          <IconBtn primary title="Añadir vídeo" onClick={() => s.setView("home")}>
            <Plus className="size-[18px]" />
          </IconBtn>
        </div>
      </div>
      <Input
        type="search"
        placeholder="Buscar vídeos"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 h-10 max-w-[420px] rounded-[9px]"
      />
      {list.length === 0 && <p className="py-8 text-sm text-[#75757d]">No hay vídeos que coincidan.</p>}
      {list.map((v) => (
        <div key={v.id} className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t border-[#e7e7eb] py-3 first:border-t-0">
          <div>
            <div className="truncate text-sm font-medium">{v.name}</div>
            <div className="mt-1 text-[12.5px] text-[#75757d]">{v.meta}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status={v.status} />
            <IconBtn plain title="Abrir" onClick={() => s.openVideo(v.id)}>
              <ExternalLink className="size-[18px]" />
            </IconBtn>
            {v.status === "ready" ?
              <IconBtn plain title="Descargar" onClick={() => downloadJson(`${v.name}.json`, v.extraction)}>
                <Download className="size-[18px]" />
              </IconBtn>
            : <IconBtn plain title="Reintentar">
                <RotateCcw className="size-[18px]" />
              </IconBtn>}
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoDetail({
  video,
  tab,
  setTab,
  onJson,
}: {
  video: StoredVideo;
  tab: "video" | "results" | "activity";
  setTab: (t: "video" | "results" | "activity") => void;
  onJson: (t: string, o: unknown, n: string) => void;
}) {
  const s = useStudio();
  const media = video.extraction.media as { duration?: string; resolution?: { width: number; height: number }; fps?: number } | undefined;
  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <IconBtn plain title="Volver" onClick={() => s.setView("videos")}>
            <ArrowLeft className="size-[18px]" />
          </IconBtn>
          <h1 className="mt-2.5 text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">{video.name}</h1>
        </div>
        <div className="flex gap-2">
          <IconBtn title="Ver JSON" onClick={() => onJson("Final JSON", video.extraction, "video_final.json")}>
            <Braces className="size-[18px]" />
          </IconBtn>
          <IconBtn primary title="Descargar" onClick={() => downloadJson("video_final.json", video.extraction)}>
            <Download className="size-[18px]" />
          </IconBtn>
        </div>
      </div>
      <div className="mb-7 flex gap-0.5 overflow-auto border-b border-[#e7e7eb]">
        {(["video", "results", "activity"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative px-2.5 py-2.5 text-sm font-medium whitespace-nowrap ${tab === t ? "text-[#171719]" : "text-[#75757d]"}`}
          >
            {t === "video" ? "Vídeo" : t === "results" ? "Resultados" : "Actividad"}
            {tab === t && <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-[#171719]" />}
          </button>
        ))}
      </div>
      {tab === "video" && (
        <div>
          <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-[14px] bg-[#141416] text-white">
            <div className="grid size-[52px] place-items-center rounded-full bg-white pl-0.5 text-[#151515]">
              <svg viewBox="0 0 24 24" className="size-5 fill-current"><path d="M8 5.5v13l10-6.5-10-6.5z" /></svg>
            </div>
          </div>
          <div className="border-t border-[#e7e7eb] py-6 first:border-t-0">
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Fuente</p>
            <div>{video.origin === "url" ? "URL" : "Archivo"}</div>
            <div className="mt-1.5 text-[13px] text-[#75757d]">{video.name}</div>
          </div>
          {media && (
            <div className="border-t border-[#e7e7eb] py-6">
              <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Media</p>
              <div className="flex flex-wrap gap-4 text-[13px] text-[#75757d]">
                {media.duration && <span>{media.duration}</span>}
                {media.resolution && <span>{media.resolution.width} × {media.resolution.height}</span>}
                {media.fps ? <span>{media.fps} fps</span> : null}
              </div>
            </div>
          )}
          <div className="border-t border-[#e7e7eb] py-6">
            <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Guion reconstruible</p>
            <p className="text-sm leading-relaxed">{String(video.extraction.reconstructable_script || video.extraction.one_line || "")}</p>
          </div>
          {Array.isArray(video.extraction.transcript) && video.extraction.transcript.length > 0 && (
            <div className="border-t border-[#e7e7eb] py-6">
              <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Transcripción</p>
              <div className="grid gap-3">
                {(video.extraction.transcript as { start_ms: number; speaker: string; text: string }[]).map((t, i) => (
                  <div key={i} className="grid grid-cols-[72px_48px_minmax(0,1fr)] gap-2 text-sm">
                    <span className="text-[12px] text-[#75757d]">{msToClock(t.start_ms)}</span>
                    <span className="font-medium">{t.speaker}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(video.extraction.on_screen_text) &&
            (video.extraction.on_screen_text as { text: string }[]).length > 0 && (
            <div className="border-t border-[#e7e7eb] py-6">
              <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Texto en pantalla</p>
              <div className="grid gap-3">
                {(video.extraction.on_screen_text as { start_ms: number; text: string; role?: string }[]).map((t, i) => (
                  <div key={i} className="grid grid-cols-[72px_88px_minmax(0,1fr)] gap-2 text-sm">
                    <span className="text-[12px] text-[#75757d]">{msToClock(t.start_ms)}</span>
                    <span className="font-medium">{t.role || "overlay"}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "results" && (
        <div>
          {Object.entries(video.moduleOutputs).map(([id, data]) => {
            const mod = s.modules.find((m) => m.id === id);
            return (
              <div key={id} className="mt-7 first:mt-0">
                <div className="mb-2 text-[13px] font-semibold">{mod?.name ?? id}</div>
                <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e7e7eb]">
                  <div>
                    <div>Salida JSON</div>
                    <div className="text-[12.5px] text-[#75757d]">{mod?.status === "unwired" ? "Repo no ejecutado · sample / hueco" : "Listo"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot status={mod?.status === "unwired" ? "unwired" : "ready"} />
                    <IconBtn plain title="Abrir" onClick={() => onJson(mod?.name ?? id, data, `${id}.json`)}>
                      <ExternalLink className="size-[18px]" />
                    </IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="mt-7">
            <div className="mb-2 text-[13px] font-semibold">Salida final</div>
            <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e7e7eb] py-2">
              <div>
                <div>video_final.json</div>
                <div className="text-[12.5px] text-[#75757d]">Compuesto con la configuración activa</div>
              </div>
              <div className="flex gap-2">
                <IconBtn plain title="Abrir" onClick={() => onJson("Final JSON", video.extraction, "video_final.json")}>
                  <ExternalLink className="size-[18px]" />
                </IconBtn>
                <IconBtn primary title="Descargar" onClick={() => downloadJson("video_final.json", video.extraction)}>
                  <Download className="size-[18px]" />
                </IconBtn>
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === "activity" && (
        <div>
          {video.activity.map((a, i) => (
            <div key={i} className="grid grid-cols-[58px_24px_minmax(0,1fr)] gap-2.5 border-t border-[#e7e7eb] py-3 first:border-t-0">
              <div className="pt-0.5 text-xs text-[#75757d]">{a.time}</div>
              <StatusDot status={a.status} />
              <div>
                <div>{a.title}</div>
                <div className="text-[12.5px] text-[#75757d]">{a.meta}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModulesView({
  onAdd,
  onOpen,
}: {
  onAdd: () => void;
  onOpen: (m: ReturnType<typeof useStudio>["modules"][number]) => void;
}) {
  const s = useStudio();
  return (
    <div>
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Módulos</h1>
          <p className="m-0 text-sm text-[#75757d]">Qué puede extraer el sistema. Cada uno es un repo o un builtin que suelta JSON.</p>
        </div>
        <IconBtn primary title="Añadir módulo" onClick={onAdd}>
          <Plus className="size-[18px]" />
        </IconBtn>
      </div>
      {s.modules.map((m) => (
        <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t border-[#e7e7eb] py-3.5 first:border-t-0">
          <div>
            <div className="text-sm font-medium">{m.name}</div>
            <div className="mt-1 text-[12.5px] text-[#75757d]">
              {m.category}
              {m.repoUrl ? ` · ${m.repoUrl.replace("https://github.com/", "")}` : ""}
              {m.enabled ? "" : " · desactivado"}
            </div>
            <div className="mt-1 max-w-[52rem] text-[12.5px] text-[#75757d]">{m.description}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status={m.status === "unwired" ? "unwired" : m.status} />
            <IconBtn plain title={m.enabled ? "Desactivar" : "Activar"} onClick={() => s.toggleModule(m.id)}>
              {m.enabled ? <Check className="size-[18px]" /> : <Plus className="size-[18px]" />}
            </IconBtn>
            <IconBtn plain title="Abrir estructura" onClick={() => onOpen(m)}>
              <ExternalLink className="size-[18px]" />
            </IconBtn>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComposerView({
  tab,
  setTab,
  onAi,
  onJson,
  onOpenSource,
}: {
  tab: "sources" | "configuration" | "versions";
  setTab: (t: "sources" | "configuration" | "versions") => void;
  onAi: () => void;
  onJson: (t: string, o: unknown, n: string) => void;
  onOpenSource: (name: string, type: string, sample: unknown) => void;
}) {
  const s = useStudio();
  const srcInput = useRef<HTMLInputElement>(null);
  const cfgInput = useRef<HTMLInputElement>(null);
  const enabled = s.modules.filter((m) => m.enabled);

  return (
    <div>
      <div className="mb-4">
        <h1 className="m-0 text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Composer</h1>
        <p className="m-0 text-sm text-[#75757d]">Combina fuentes en el JSON final.</p>
      </div>
      <div className="mb-7 flex gap-0.5 overflow-auto border-b border-[#e7e7eb]">
        {(["sources", "configuration", "versions"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative px-2.5 py-2.5 text-sm font-medium ${tab === t ? "text-[#171719]" : "text-[#75757d]"}`}
          >
            {t === "sources" ? "Fuentes" : t === "configuration" ? "Configuración" : "Versiones"}
            {tab === t && <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-[#171719]" />}
          </button>
        ))}
      </div>
      {tab === "sources" && (
        <div>
          <div className="border-t border-[#e7e7eb] py-4 first:border-t-0">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Salidas de módulos</p>
                <div className="text-[12.5px] text-[#75757d]">JSON que producen los extractores.</div>
              </div>
              <IconBtn title="Importar JSON" onClick={() => srcInput.current?.click()}>
                <Upload className="size-[18px]" />
              </IconBtn>
              <input
                ref={srcInput}
                type="file"
                accept=".json,application/json"
                multiple
                hidden
                onChange={async (e) => {
                  for (const file of [...(e.target.files || [])]) {
                    try {
                      s.importJsonSource(file.name, JSON.parse(await file.text()));
                    } catch {
                      /* skip */
                    }
                  }
                  e.target.value = "";
                }}
              />
            </div>
            {s.modules.map((m) => (
              <div key={m.id} className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e7e7eb]">
                <div>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-[12.5px] text-[#75757d]">{m.kind === "repo" ? "Salida de módulo" : "Builtin"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={m.status === "unwired" ? "unwired" : "ready"} />
                  <IconBtn plain title="Abrir" onClick={() => onOpenSource(m.name, "Module output", m.sample)}>
                    <ExternalLink className="size-[18px]" />
                  </IconBtn>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#e7e7eb] py-4">
            <p className="mb-1 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Importados</p>
            <div className="mb-2 text-[12.5px] text-[#75757d]">JSON externos disponibles para el Composer.</div>
            {s.importedSources.length === 0 && <div className="text-[12.5px] text-[#75757d]">Aún no hay JSON importado.</div>}
            {s.importedSources.map((src) => (
              <div key={src.id} className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e7e7eb]">
                <div>
                  <div className="text-sm font-medium">{src.name}</div>
                  <div className="text-[12.5px] text-[#75757d]">JSON importado</div>
                </div>
                <IconBtn plain title="Abrir" onClick={() => onOpenSource(src.name, "Imported JSON", src.sample)}>
                  <ExternalLink className="size-[18px]" />
                </IconBtn>
              </div>
            ))}
          </div>
          <div className="mt-7 rounded-xl border border-[#e7e7eb] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Usar con IA</div>
                <div className="mt-1 text-[12.5px] text-[#75757d]">
                  Prepara lo que una IA necesita para entender estas fuentes y crear una configuración compatible.
                </div>
              </div>
              <IconBtn primary title="Preparar contexto" onClick={onAi}>
                <Info className="size-[18px]" />
              </IconBtn>
            </div>
          </div>
        </div>
      )}
      {tab === "configuration" && (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Configuración</p>
              <div className="text-lg font-semibold">{s.config.name}</div>
              <div className="text-[12.5px] text-[#75757d]">
                Versión activa {s.config.version} · {enabled.length} fuentes
              </div>
            </div>
            <div className="flex gap-2">
              <IconBtn title="Importar" onClick={() => cfgInput.current?.click()}>
                <Upload className="size-[18px]" />
              </IconBtn>
              <IconBtn title="Exportar" onClick={() => downloadJson("output-config.json", s.config)}>
                <Download className="size-[18px]" />
              </IconBtn>
              <input
                ref={cfgInput}
                type="file"
                accept=".json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    s.setConfig(JSON.parse(await file.text()));
                  } catch {
                    /* skip */
                  }
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div className="mt-6 grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)]">
            <div className="min-h-40 rounded-xl border border-[#e7e7eb] p-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Entradas</p>
              <div className="mt-3 grid gap-2 text-[13px]">
                {enabled.map((m) => (
                  <div key={m.id}>{m.name}</div>
                ))}
              </div>
            </div>
            <div className="flex justify-center text-[#75757d] max-md:rotate-90">
              <ArrowRight className="size-[18px]" />
            </div>
            <div className="grid min-h-40 place-items-center rounded-xl border border-[#e7e7eb] p-4 text-center">
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Salida</p>
                <Braces className="mx-auto mb-2 size-7" />
                <div className="font-semibold">final.json</div>
                <div className="mt-2.5 flex justify-center">
                  <IconBtn plain title="Ver config" onClick={() => onJson("output-config.json", s.config, "output-config.json")}>
                    <Braces className="size-[18px]" />
                  </IconBtn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === "versions" && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-[#75757d] uppercase">Versiones</p>
          {s.versions.map((v) => (
            <div key={v.version} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#e7e7eb]">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {v.version}
                  {v.current && <span className="font-semibold text-[#177245]">Activa</span>}
                </div>
                <div className="text-[12.5px] text-[#75757d]">{v.date}</div>
              </div>
              <div className="flex items-center gap-2">
                <IconBtn plain title="Abrir" onClick={() => onJson(`Output config ${v.version}`, v.config, `output-config-${v.version}.json`)}>
                  <ExternalLink className="size-[18px]" />
                </IconBtn>
                {v.current ?
                  <span title="Activa" className="grid size-10 place-items-center"><span className="size-3 rounded-full bg-[#171719]" /></span>
                : <IconBtn title="Activar" onClick={() => s.useVersion(v.version)}>
                    <span className="size-3 rounded-full border border-[#171719]" />
                  </IconBtn>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView() {
  const s = useStudio();
  return (
    <div>
      <h1 className="m-0 text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">Ajustes</h1>
      <p className="mb-6 text-sm text-[#75757d]">Comportamiento del sistema y del procesado.</p>
      <div className="flex items-start justify-between gap-3 border-t border-[#e7e7eb] py-6">
        <div>
          <div className="font-medium">Procesar al importar</div>
          <div className="text-[12.5px] text-[#75757d]">Empieza en cuanto entra el lote.</div>
        </div>
        <Checkbox
          checked={s.autoProcess}
          onCheckedChange={(v) => s.setAutoProcess(v === true)}
        />
      </div>
      <div className="flex items-start justify-between gap-3 border-t border-[#e7e7eb] py-6">
        <div>
          <div className="font-medium">Procesado en paralelo</div>
          <div className="text-[12.5px] text-[#75757d]">Máximo de vídeos a la vez.</div>
        </div>
        <Select value={String(s.parallelism)} onValueChange={(v) => { if (v) s.setParallelism(Number(v)); }}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-start justify-between gap-3 border-t border-[#e7e7eb] py-6">
        <div>
          <div className="font-medium">Idioma</div>
          <div className="text-[12.5px] text-[#75757d]">Idioma de la interfaz.</div>
        </div>
        <Select value={s.language} onValueChange={(v) => { if (v) s.setLanguage(v); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="de">Deutsch</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border-t border-[#e7e7eb] py-6">
        <div className="font-medium">Almacenamiento</div>
        <div className="text-[12.5px] text-[#75757d]">/outputs · local, sin nube de pago</div>
      </div>
    </div>
  );
}
