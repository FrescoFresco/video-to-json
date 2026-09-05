"use client";

import { useMemo, useState } from "react";
import {
  findBlockById,
  type TimelineLayer,
  type TimelineLayerBlock,
} from "@/lib/timeline-layers";
import { layerColor } from "./layer-colors";

/** Selección de bloque en el timeline (reutilizable en desktop/móvil). */
export function useBlockSelection(layers: TimelineLayer[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => findBlockById(layers, selectedId),
    [layers, selectedId]
  );

  const selectedColor = useMemo(() => {
    if (!selected) return undefined;
    const idx = layers.findIndex((l) => l.moduleId === selected.moduleId);
    return idx >= 0 ? layerColor(idx) : undefined;
  }, [layers, selected]);

  function selectBlock(block: TimelineLayerBlock) {
    setSelectedId((prev) => (prev === block.id ? null : block.id));
  }

  function clearSelection() {
    setSelectedId(null);
  }

  return {
    selectedId,
    selected,
    selectedColor,
    selectBlock,
    clearSelection,
  };
}
