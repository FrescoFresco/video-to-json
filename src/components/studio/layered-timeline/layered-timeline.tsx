"use client";

import { useMemo } from "react";
import type { TimelineEvent } from "@/lib/types";
import { buildTimelineLayers } from "@/lib/timeline-layers";
import { BlockDetailPanel } from "./block-detail-panel";
import { layerColor } from "./layer-colors";
import { LayerRow } from "./layer-row";
import { TimelineRuler } from "./timeline-ruler";
import { useBlockSelection } from "./use-block-selection";

export function LayeredTimeline({
  events,
  durationMs,
  onOpenModule,
}: {
  events: TimelineEvent[];
  /** Duración del vídeo (probe); si falta se infiere de los eventos. */
  durationMs?: number;
  onOpenModule: (moduleId: string) => void;
}) {
  const model = useMemo(
    () => buildTimelineLayers(events, durationMs),
    [events, durationMs]
  );
  const { selectedId, selected, selectedColor, selectBlock, clearSelection } =
    useBlockSelection(model.layers);

  if (!model.layers.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d7d7dc] bg-[#fbfbfc] p-6 text-sm text-[#75757d]">
        Aún no hay eventos con tiempo. Cuando los módulos devuelvan rangos o instantes,
        aparecerán aquí como capas.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-[-0.02em]">Capas en el tiempo</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#75757d]">
          Cada fila es un módulo. Cajas = rangos, puntos = instantes. Pulsa un bloque para ver
          el contenido.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white">
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] border-b border-[#ececf0] sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div className="px-2 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-[#9a9aa3] sm:px-3">
              Capa
            </div>
            <div className="min-w-0 border-l border-[#ececf0] px-2 py-1">
              <TimelineRuler durationMs={model.durationMs} />
            </div>
          </div>
          <div className="max-h-[min(60vh,32rem)] overflow-auto">
            {model.layers.map((layer, index) => (
              <LayerRow
                key={layer.moduleId}
                layer={layer}
                color={layerColor(index)}
                durationMs={model.durationMs}
                selectedId={selectedId}
                onSelect={selectBlock}
              />
            ))}
          </div>
          <div className="border-t border-[#ececf0] px-3 py-2 text-[11.5px] text-[#9a9aa3]">
            {model.layers.length} capas · {model.blockCount} bloques
          </div>
        </div>

        <div className="hidden min-h-[16rem] lg:block">
          <BlockDetailPanel
            block={selected}
            color={selectedColor}
            onClose={clearSelection}
            onOpenModule={onOpenModule}
            variant="side"
          />
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-x-0 bottom-0 z-40 p-0 lg:hidden">
          <div
            className="absolute inset-0 -top-[100vh] bg-black/25"
            onClick={clearSelection}
            aria-hidden
          />
          <div className="relative">
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-[#d7d7dc]" />
            <BlockDetailPanel
              block={selected}
              color={selectedColor}
              onClose={clearSelection}
              onOpenModule={(id) => {
                clearSelection();
                onOpenModule(id);
              }}
              variant="sheet"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
