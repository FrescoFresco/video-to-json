import type { TimelineEvent } from "@/lib/types";

/** Un bloque o instante en una capa del timeline. */
export type TimelineLayerBlock = {
  id: string;
  moduleId: string;
  moduleTitle: string;
  startMs: number;
  endMs: number;
  /** true si es un instante (sin duración útil). */
  instant: boolean;
  label?: string;
  text: string;
};

/** Una fila = un módulo. */
export type TimelineLayer = {
  moduleId: string;
  moduleTitle: string;
  blocks: TimelineLayerBlock[];
};

export type TimelineLayersModel = {
  durationMs: number;
  layers: TimelineLayer[];
  blockCount: number;
};

const INSTANT_THRESHOLD_MS = 80;

function isInstant(startMs: number, endMs: number) {
  return !Number.isFinite(endMs) || endMs <= startMs || endMs - startMs < INSTANT_THRESHOLD_MS;
}

/**
 * Agrupa eventos de timeline en capas (una por módulo).
 * Reutilizable: UI, export, tests.
 */
export function buildTimelineLayers(
  events: TimelineEvent[],
  durationHintMs?: number
): TimelineLayersModel {
  const byModule = new Map<string, TimelineLayer>();
  let maxEnd = 0;
  let blockCount = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (typeof ev.start_ms !== "number" || !Number.isFinite(ev.start_ms)) continue;

    const startMs = Math.max(0, ev.start_ms);
    const endRaw = typeof ev.end_ms === "number" ? ev.end_ms : startMs;
    const endMs = Math.max(startMs, endRaw);
    const instant = isInstant(startMs, endMs);
    maxEnd = Math.max(maxEnd, endMs, startMs);

    let layer = byModule.get(ev.module_id);
    if (!layer) {
      layer = {
        moduleId: ev.module_id,
        moduleTitle: ev.module_title || ev.module_id,
        blocks: [],
      };
      byModule.set(ev.module_id, layer);
    }

    layer.blocks.push({
      id: `${ev.module_id}-${startMs}-${i}`,
      moduleId: ev.module_id,
      moduleTitle: layer.moduleTitle,
      startMs,
      endMs: instant ? startMs : endMs,
      instant,
      label: ev.label,
      text: ev.text || "",
    });
    blockCount += 1;
  }

  const layers = Array.from(byModule.values()).map((layer) => ({
    ...layer,
    blocks: [...layer.blocks].sort((a, b) => a.startMs - b.startMs),
  }));

  const hint = typeof durationHintMs === "number" && durationHintMs > 0 ? durationHintMs : 0;
  const durationMs = Math.max(hint, maxEnd, 1);

  return { durationMs, layers, blockCount };
}

export function msToRatio(ms: number, durationMs: number) {
  if (durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, ms / durationMs));
}

/** Busca un bloque por id en el modelo de capas. */
export function findBlockById(
  layers: TimelineLayer[],
  blockId: string | null
): TimelineLayerBlock | null {
  if (!blockId) return null;
  for (const layer of layers) {
    const hit = layer.blocks.find((b) => b.id === blockId);
    if (hit) return hit;
  }
  return null;
}
