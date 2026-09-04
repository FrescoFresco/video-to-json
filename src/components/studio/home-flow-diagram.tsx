"use client";

/** Diagrama visual: vídeo → cajitas → JSON */
export function HomeFlowDiagram() {
  return (
    <svg
      viewBox="0 0 920 280"
      className="vx-flow h-auto w-full"
      role="img"
      aria-label="Flujo: subes un vídeo, los módulos extraen datos y sale un JSON"
    >
      <defs>
        <linearGradient id="vxFilm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c2430" />
          <stop offset="100%" stopColor="#2d3a4a" />
        </linearGradient>
        <linearGradient id="vxJson" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8f3ef" />
          <stop offset="100%" stopColor="#d3e8df" />
        </linearGradient>
        <marker id="vxArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#8a93a0" />
        </marker>
      </defs>

      {/* Vídeo */}
      <g className="vx-flow-step" style={{ animationDelay: "0ms" }}>
        <rect x="28" y="58" width="168" height="164" rx="18" fill="url(#vxFilm)" />
        <rect x="48" y="86" width="128" height="78" rx="8" fill="#0f141b" opacity="0.55" />
        <polygon points="96,108 96,142 128,125" fill="#f4f7f5" className="vx-flow-play" />
        <rect x="48" y="178" width="52" height="8" rx="4" fill="#7d8b9a" />
        <rect x="48" y="194" width="88" height="6" rx="3" fill="#5d6a78" />
        <text x="112" y="248" textAnchor="middle" fill="#3a4450" fontSize="13" fontWeight="600">
          Vídeo
        </text>
      </g>

      <path
        d="M210 140 H268"
        stroke="#8a93a0"
        strokeWidth="2"
        fill="none"
        markerEnd="url(#vxArrow)"
        className="vx-flow-line"
        style={{ animationDelay: "120ms" }}
      />

      {/* Módulos */}
      <g className="vx-flow-step" style={{ animationDelay: "180ms" }}>
        <rect x="280" y="36" width="360" height="208" rx="20" fill="#ffffff" stroke="#e2e5ea" />
        <text x="460" y="64" textAnchor="middle" fill="#171719" fontSize="14" fontWeight="700">
          Cajitas de extracción
        </text>

        {[
          { y: 84, label: "Cortes", c: "#dce8f5" },
          { y: 114, label: "Habla / quién habla", c: "#ddeee6" },
          { y: 144, label: "Texto en pantalla", c: "#e8ebe7" },
          { y: 174, label: "Objetos + visión IA", c: "#f0e6da" },
          { y: 204, label: "Resumen", c: "#e6ece8" },
        ].map((row, i) => (
          <g key={row.label} className="vx-flow-chip" style={{ animationDelay: `${260 + i * 70}ms` }}>
            <rect x="304" y={row.y} width="312" height="24" rx="8" fill={row.c} />
            <circle cx="322" cy={row.y + 12} r="4" fill="#171719" opacity="0.55" />
            <text x="336" y={row.y + 16} fill="#24303a" fontSize="12" fontWeight="600">
              {row.label}
            </text>
          </g>
        ))}
      </g>

      <path
        d="M654 140 H712"
        stroke="#8a93a0"
        strokeWidth="2"
        fill="none"
        markerEnd="url(#vxArrow)"
        className="vx-flow-line"
        style={{ animationDelay: "520ms" }}
      />

      {/* JSON */}
      <g className="vx-flow-step" style={{ animationDelay: "580ms" }}>
        <rect x="724" y="58" width="168" height="164" rx="18" fill="url(#vxJson)" stroke="#b7d0c4" />
        <text x="808" y="96" textAnchor="middle" fill="#1f4a3a" fontSize="22" fontWeight="800">
          {"{ }"}
        </text>
        <rect x="752" y="118" width="112" height="8" rx="4" fill="#6f9a86" className="vx-flow-bar" />
        <rect x="752" y="136" width="84" height="8" rx="4" fill="#6f9a86" opacity="0.75" className="vx-flow-bar" style={{ animationDelay: "700ms" }} />
        <rect x="752" y="154" width="98" height="8" rx="4" fill="#6f9a86" opacity="0.55" className="vx-flow-bar" style={{ animationDelay: "820ms" }} />
        <rect x="752" y="172" width="70" height="8" rx="4" fill="#6f9a86" opacity="0.4" className="vx-flow-bar" style={{ animationDelay: "940ms" }} />
        <text x="808" y="248" textAnchor="middle" fill="#3a4450" fontSize="13" fontWeight="600">
          JSON
        </text>
      </g>
    </svg>
  );
}
