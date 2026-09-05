"use client";

export function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#5c5c66]">
      <span
        className={`size-1.5 rounded-full ${ok ? "bg-[#177245]" : "bg-[#c4c4cc]"}`}
        aria-hidden
      />
      {label}
    </span>
  );
}
