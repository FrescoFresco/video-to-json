"use client";

import { msToClock } from "@/lib/extraction";

export function TimelineRuler({
  durationMs,
  ticks = 5,
}: {
  durationMs: number;
  ticks?: number;
}) {
  const marks = Array.from({ length: ticks }, (_, i) => {
    const t = ticks === 1 ? 0 : i / (ticks - 1);
    return { t, ms: Math.round(durationMs * t) };
  });

  return (
    <div className="relative h-6 border-b border-[#e7e7eb]">
      {marks.map((m) => (
        <div
          key={m.ms}
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center first:translate-x-0 last:translate-x-[-100%]"
          style={{ left: `${m.t * 100}%` }}
        >
          <span className="h-2 w-px bg-[#d7d7dc]" />
          <span className="mt-0.5 text-[10px] tabular-nums text-[#9a9aa3]">
            {msToClock(m.ms)}
          </span>
        </div>
      ))}
    </div>
  );
}
