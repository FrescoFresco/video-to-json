"use client";

import type { TimelineLayer, TimelineLayerBlock } from "@/lib/timeline-layers";
import { BlockMarker } from "./block-marker";

export function LayerRow({
  layer,
  color,
  durationMs,
  selectedId,
  onSelect,
}: {
  layer: TimelineLayer;
  color: string;
  durationMs: number;
  selectedId: string | null;
  onSelect: (block: TimelineLayerBlock) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[7.5rem_minmax(0,1fr)] border-b border-[#ececf0] last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="flex items-center gap-2 truncate px-2 py-2.5 sm:px-3">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="truncate text-[12px] font-medium text-[#171719]" title={layer.moduleTitle}>
          {layer.moduleTitle}
        </span>
      </div>
      <div className="relative min-h-10 min-w-0 border-l border-[#ececf0] bg-[#fafafb]">
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 opacity-40">
          {[0.25, 0.5, 0.75].map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 w-px bg-[#e7e7eb]"
              style={{ left: `${t * 100}%` }}
            />
          ))}
        </div>
        {layer.blocks.map((block) => (
          <BlockMarker
            key={block.id}
            block={block}
            durationMs={durationMs}
            color={color}
            selected={selectedId === block.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
