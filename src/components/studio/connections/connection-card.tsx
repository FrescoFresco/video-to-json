"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "./status-dot";

/** Tarjeta compacta: nunca se estira; el formulario va en el popup. */
export function ConnectionCard({
  icon,
  title,
  statusOk,
  statusLabel,
  summary,
  actionLabel,
  onOpen,
}: {
  icon: ReactNode;
  title: string;
  statusOk: boolean;
  statusLabel: string;
  summary: string;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <section className="min-w-0 self-start overflow-hidden rounded-2xl border border-[#e7e7eb] bg-white">
      <div className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f5f5f7] text-[#171719]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-sm font-semibold tracking-[-0.02em]">{title}</h2>
            <StatusDot ok={statusOk} label={statusLabel} />
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#75757d]">{summary}</p>
        </div>
        <Button variant="outline" className="shrink-0 rounded-xl" onClick={onOpen}>
          {actionLabel}
        </Button>
      </div>
    </section>
  );
}
