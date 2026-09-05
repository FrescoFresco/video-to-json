"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { StatusDot } from "./status-dot";

/**
 * Popup encima del hub: no altera la altura de las tarjetas.
 * Desktop = modal centrado; móvil = hoja inferior.
 */
export function ConnectionConfigModal({
  open,
  title,
  statusOk,
  statusLabel,
  icon,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  statusOk: boolean;
  statusLabel: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[#171719]/45 backdrop-blur-[2px] transition-opacity"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-config-title"
        className="relative z-[1] flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#e7e7eb] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.18)] sm:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#d7d7dc] sm:hidden" />
        <header className="flex shrink-0 items-start gap-3 border-b border-[#ececf0] px-4 py-3.5 sm:px-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f5f5f7] text-[#171719]">
            {icon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="connection-config-title"
              className="text-sm font-semibold tracking-[-0.02em]"
            >
              {title}
            </h2>
            <div className="mt-1">
              <StatusDot ok={statusOk} label={statusLabel} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[#75757d] hover:bg-[#f5f5f7]"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-[#ececf0] px-4 py-3 sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
