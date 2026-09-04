import { mkdir, readdir, rename, stat, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { isVideoFilename } from "@/lib/video-file";
import { readAppConfig } from "./app-config";
import { createJobFromLocalPath } from "./job-store";

type WatcherState = {
  started: boolean;
  timer?: ReturnType<typeof setInterval>;
  inFlight: Set<string>;
  seen: Set<string>;
  sizes: Map<string, { size: number; stable: number }>;
};

const globalWatch = globalThis as typeof globalThis & {
  __vxInboxWatcher?: WatcherState;
};

function state(): WatcherState {
  if (!globalWatch.__vxInboxWatcher) {
    globalWatch.__vxInboxWatcher = {
      started: false,
      inFlight: new Set(),
      seen: new Set(),
      sizes: new Map(),
    };
  }
  return globalWatch.__vxInboxWatcher;
}

function seenPath() {
  const root = process.env.VX_DATA_DIR
    ? path.dirname(process.env.VX_DATA_DIR)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
  return path.join(/*turbopackIgnore: true*/ root, "inbox-seen.json");
}

async function loadSeen(seen: Set<string>) {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ seenPath(), "utf8");
    const list = JSON.parse(raw) as string[];
    if (Array.isArray(list)) for (const id of list) seen.add(id);
  } catch {
    // primera vez
  }
}

async function saveSeen(seen: Set<string>) {
  const file = seenPath();
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  const list = [...seen].slice(-500);
  await writeFile(/*turbopackIgnore: true*/ file, JSON.stringify(list, null, 2), "utf8");
}

function safeBase(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "video";
}

async function tick() {
  const config = await readAppConfig();
  if (!config.inboxEnabled || !config.inboxPath) return;

  const inbox = path.resolve(config.inboxPath);
  const outbox = path.resolve(config.outboxPath || path.join(inbox, "outbox"));
  const doneDir = path.join(inbox, "processed");
  const errorDir = path.join(inbox, "errors");

  await mkdir(/*turbopackIgnore: true*/ inbox, { recursive: true });
  await mkdir(/*turbopackIgnore: true*/ outbox, { recursive: true });
  await mkdir(/*turbopackIgnore: true*/ doneDir, { recursive: true });
  await mkdir(/*turbopackIgnore: true*/ errorDir, { recursive: true });

  const s = state();
  let entries: string[] = [];
  try {
    entries = await readdir(/*turbopackIgnore: true*/ inbox);
  } catch {
    return;
  }

  for (const name of entries) {
    if (name.startsWith(".")) continue;
    if (name === "outbox" || name === "processed" || name === "errors") continue;
    if (!isVideoFilename(name)) continue;

    const full = path.join(inbox, name);
    const key = full;

    if (s.seen.has(key) || s.inFlight.has(key)) continue;

    let st;
    try {
      st = await stat(/*turbopackIgnore: true*/ full);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size <= 0) continue;

    // Esperar a que Drive termine de sincronizar (tamaño estable 2 ciclos).
    const prev = s.sizes.get(key);
    if (!prev || prev.size !== st.size) {
      s.sizes.set(key, { size: st.size, stable: 1 });
      continue;
    }
    if (prev.stable < 2) {
      s.sizes.set(key, { size: st.size, stable: prev.stable + 1 });
      continue;
    }

    s.inFlight.add(key);
    s.sizes.delete(key);

    void (async () => {
      try {
        await createJobFromLocalPath(full, {
          displayName: name,
          onReady: async (result) => {
            const outFile = path.join(outbox, `${safeBase(name)}.json`);
            await writeFile(
              /*turbopackIgnore: true*/ outFile,
              JSON.stringify(result, null, 2),
              "utf8"
            );
            const dest = path.join(doneDir, name);
            try {
              await rename(/*turbopackIgnore: true*/ full, /*turbopackIgnore: true*/ dest);
            } catch {
              // si Drive bloquea el move, dejamos el original
            }
          },
          onError: async (message) => {
            const errFile = path.join(outbox, `${safeBase(name)}.error.json`);
            await writeFile(
              /*turbopackIgnore: true*/ errFile,
              JSON.stringify({ error: message, file: name, at: new Date().toISOString() }, null, 2),
              "utf8"
            );
            try {
              await rename(
                /*turbopackIgnore: true*/ full,
                /*turbopackIgnore: true*/ path.join(errorDir, name)
              );
            } catch {
              // ignore
            }
          },
        });
        s.seen.add(key);
        await saveSeen(s.seen);
      } catch (err) {
        console.error("[inbox]", name, err);
      } finally {
        s.inFlight.delete(key);
      }
    })();
  }
}

/** Arranca el vigilante de carpeta (idempotente). */
export function startInboxWatcher() {
  const s = state();
  if (s.started) return;
  s.started = true;
  void loadSeen(s.seen).then(() => {
    void tick();
    const ms = Number(process.env.VX_INBOX_POLL_MS || 5000);
    s.timer = setInterval(() => {
      void tick();
    }, Number.isFinite(ms) && ms >= 2000 ? ms : 5000);
    // Evitar que el timer impida apagar el proceso en algunos entornos.
    if (typeof s.timer.unref === "function") s.timer.unref();
  });
}
