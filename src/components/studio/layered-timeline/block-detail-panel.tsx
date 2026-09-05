"use client";

import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { msToClock } from "@/lib/extraction";
import type { TimelineLayerBlock } from "@/lib/timeline-layers";

export function BlockDetailPanel({
  block,
  color,
  onClose,
  onOpenModule,
  variant = "side",
}: {
  block: TimelineLayerBlock | null;
  color?: string;
  onClose: () => void;
  onOpenModule: (moduleId: string) => void;
  /** side = columna desktop; sheet = hoja móvil */
  variant?: "side" | "sheet";
}) {
  if (!block) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col justify-center rounded-2xl border border-dashed border-[#d7d7dc] bg-[#fbfbfc] p-4 text-sm text-[#75757d]">
        Pulsa una caja o un punto para ver su contenido.
      </div>
    );
  }

  const timeLabel = block.instant
    ? msToClock(block.startMs)
    : `${msToClock(block.startMs)} – ${msToClock(block.endMs)}`;

  const shell =
    variant === "sheet"
      ? "rounded-t-2xl border border-[#e7e7eb] bg-white p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
      : "flex h-full min-h-0 flex-col rounded-2xl border border-[#e7e7eb] bg-white p-4";

  return (
    <div className={shell}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {color ? (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
            ) : null}
            <h3 className="truncate text-sm font-semibold tracking-[-0.02em]">
              {block.moduleTitle}
            </h3>
          </div>
          <p className="mt-1 text-[12.5px] tabular-nums text-[#75757d]">
            {timeLabel}
            {block.instant ? " · instante" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#75757d] hover:bg-[#f5f5f7]"
          aria-label="Cerrar detalle"
        >
          <X className="size-4" />
        </button>
      </div>

      {block.label ? (
        <div className="mt-3 text-[12px] font-medium uppercase tracking-[0.04em] text-[#6a7380]">
          {block.label}
        </div>
      ) : null}

      <p className="mt-2 text-sm leading-relaxed break-words text-[#171719]">
        {block.text || "Sin texto en este bloque."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          className="rounded-xl"
          onClick={() => onOpenModule(block.moduleId)}
        >
          Ir al módulo
          <ExternalLink className="ml-1.5 size-3.5" />
        </Button>
      </div>
    </div>
  );
}
