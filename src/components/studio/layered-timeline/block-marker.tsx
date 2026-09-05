"use client";

import type { TimelineLayerBlock } from "@/lib/timeline-layers";
import { msToRatio } from "@/lib/timeline-layers";

export function BlockMarker({
  block,
  durationMs,
  color,
  selected,
  onSelect,
}: {
  block: TimelineLayerBlock;
  durationMs: number;
  color: string;
  selected: boolean;
  onSelect: (block: TimelineLayerBlock) => void;
}) {
  const left = msToRatio(block.startMs, durationMs) * 100;
  const width = block.instant
    ? 0
    : Math.max(0.6, (msToRatio(block.endMs, durationMs) - msToRatio(block.startMs, durationMs)) * 100);

  if (block.instant) {
    return (
      <button
        type="button"
        title={block.text || block.label || "Instante"}
        aria-label={block.text || block.label || "Instante"}
        aria-pressed={selected}
        onClick={() => onSelect(block)}
        className="absolute top-1/2 z-[1] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171719]"
        style={{
          left: `${left}%`,
          backgroundColor: color,
          boxShadow: selected ? `0 0 0 3px ${color}55` : undefined,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      title={block.text || block.label || "Bloque"}
      aria-label={block.text || block.label || "Bloque"}
      aria-pressed={selected}
      onClick={() => onSelect(block)}
      className="absolute top-1/2 z-[1] h-3.5 -translate-y-1/2 rounded-md border border-white/70 transition-[filter,transform] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171719]"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        minWidth: 6,
        backgroundColor: color,
        filter: selected ? "brightness(1.08)" : undefined,
        boxShadow: selected ? `0 0 0 2px ${color}` : undefined,
      }}
    />
  );
}
