import type { ReactNode } from "react";

/** Página «La idea»: objetivo del software + diagrama de recreación. */
export function IdeaView() {
  return (
    <div className="vx-idea min-w-0">
      <header className="vx-idea-hero">
        <p className="vx-idea-kicker">La idea</p>
        <h1 className="vx-idea-title">
          Extraer tan bien
          <br />
          que se pueda volver a generar
        </h1>
        <p className="vx-idea-lead">
          Este Studio no genera vídeo. Produce un texto/JSON tan denso que, si se lo inyectas
          a un generador externo de texto→vídeo, ese generador tenga todo lo necesario para
          recrear un clip lo más cercano posible al original.
        </p>
      </header>

      <RecreationDiagram />

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Por qué existe</h2>
        <p className="vx-idea-p">
          Entre el vídeo real y un generador de IA hace falta un puente. Ese puente es la
          extracción: planos, habla, texto en pantalla, escena, audio, personas, cámara… Todo
          lo que haría falta para reconstruir la pieza, no solo etiquetarla.
        </p>
      </section>

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Los tres bloques</h2>
        <ol className="vx-idea-steps">
          <li>
            <strong>Vídeo original</strong>
            El clip real (archivo o link).
          </li>
          <li>
            <strong>Texto de extracción</strong>
            Lo único que produce este Studio: el dossier completo y denso.
          </li>
          <li>
            <strong>Vídeo generado (fuera de aquí)</strong>
            Lo que haría otra herramienta de IA a partir de ese texto. Cuanto más rico el 2,
            más cerca puede quedar el 3 del 1.
          </li>
        </ol>
      </section>

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Qué hace Video Extraction Studio</h2>
        <p className="vx-idea-p">
          Convierte vídeo en texto/JSON reconstruible, en local, con módulos de extracción.
          Guarda el link de origen si viene de una URL, empaqueta todo junto y puede avisar
          por API o webhook. El listón no es “resumir el vídeo”: es densificarlo hasta que
          sirva para recrearlo.
        </p>
      </section>

      <section className="vx-idea-block vx-idea-block--last">
        <h2 className="vx-idea-h2">La cercanía al original</h2>
        <p className="vx-idea-p">
          En el diagrama, entre el vídeo 1 y el 3, ilustramos el objetivo: máximo parecido.
          No es una nota automática; es la promesa del producto. El trabajo de este software
          es hacer el texto del medio tan rico que esa cercanía sea posible.
        </p>
      </section>
    </div>
  );
}

/**
 * Diagrama:
 * - Desktop: triángulo invertido (1 — cercanía — 3 / 2 abajo)
 * - Móvil: flujo vertical 1 → Studio → 2 → Generador externo → 3 → cercanía
 */
export function RecreationDiagram() {
  return (
    <section aria-label="De vídeo a texto a vídeo generado" className="vx-loop vx-loop--embedded">
      {/* —— Desktop: triángulo —— */}
      <div className="vx-loop-desk" aria-hidden="false">
        <div className="vx-loop-desk-top">
          <Node
            step="1"
            title="Vídeo original"
            copy="El clip que subes o importas por link"
            illu={<VideoFrameIllustration variant="origin" />}
          />
          <FidelityBridge />
          <Node
            step="3"
            title="Vídeo generado"
            copy="Fuera de este Studio · texto → vídeo IA"
            badge="Externo"
            illu={<VideoFrameIllustration variant="generated" />}
          />
        </div>

        <div className="vx-loop-desk-rails" aria-hidden="true">
          <div className="vx-loop-desk-rail vx-loop-desk-rail--left">
            <span className="vx-loop-rail-tag">Video Extraction Studio</span>
            <span className="vx-loop-rail-sub">vídeo → texto</span>
          </div>
          <div className="vx-loop-desk-rail vx-loop-desk-rail--right">
            <span className="vx-loop-rail-tag">Generador IA (externo)</span>
            <span className="vx-loop-rail-sub">texto → vídeo</span>
          </div>
        </div>

        <Node
          step="2"
          title="Texto de extracción"
          copy="JSON denso: planos, habla, pantalla, escena, audio… para recrear"
          className="vx-loop-node--text"
          illu={<TextDossierIllustration />}
        />
      </div>

      {/* —— Móvil: flujo vertical —— */}
      <div className="vx-loop-mob">
        <Node
          step="1"
          title="Vídeo original"
          copy="El clip que subes o importas por link"
          layout="row"
          illu={<VideoFrameIllustration variant="origin" size="sm" />}
        />

        <FlowArrow label="Video Extraction Studio" sub="vídeo → texto" />

        <Node
          step="2"
          title="Texto de extracción"
          copy="JSON denso pensado para recrear el clip"
          layout="row"
          illu={<TextDossierIllustration size="sm" />}
        />

        <FlowArrow label="Generador IA (externo)" sub="texto → vídeo · fuera de este Studio" />

        <Node
          step="3"
          title="Vídeo generado"
          copy="Recreado a partir del texto"
          badge="Externo"
          layout="row"
          illu={<VideoFrameIllustration variant="generated" size="sm" />}
        />

        <div className="vx-loop-mob-compare">
          <p className="vx-loop-mob-compare-title">Cercanía al original</p>
          <div className="vx-loop-mob-compare-frames" aria-hidden="true">
            <VideoFrameIllustration variant="origin" size="xs" />
            <FidelityBridge compact />
            <VideoFrameIllustration variant="generated" size="xs" />
          </div>
          <p className="vx-loop-fidelity-hint">
            Cuanto más rico el texto (2), más cerca puede quedar el 3 del 1
          </p>
        </div>
      </div>
    </section>
  );
}

function Node({
  step,
  title,
  copy,
  illu,
  badge,
  layout = "stack",
  className = "",
}: {
  step: string;
  title: string;
  copy: string;
  illu: ReactNode;
  badge?: string;
  layout?: "stack" | "row";
  className?: string;
}) {
  return (
    <figure
      className={`vx-loop-node ${layout === "row" ? "vx-loop-node--row" : ""} ${className}`}
    >
      {illu}
      <figcaption>
        <span className="vx-loop-step-row">
          <span className="vx-loop-step">{step}</span>
          {badge ? <span className="vx-loop-badge">{badge}</span> : null}
        </span>
        <span className="vx-loop-node-title">{title}</span>
        <span className="vx-loop-node-copy">{copy}</span>
      </figcaption>
    </figure>
  );
}

function FlowArrow({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="vx-flow-arrow" aria-hidden="true">
      <div className="vx-flow-arrow-line" />
      <div className="vx-flow-arrow-text">
        <span className="vx-loop-rail-tag">{label}</span>
        <span className="vx-loop-rail-sub">{sub}</span>
      </div>
      <div className="vx-flow-arrow-line" />
    </div>
  );
}

function FidelityBridge({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`vx-loop-fidelity ${compact ? "vx-loop-fidelity--compact" : ""}`}>
      {!compact ? <p className="vx-loop-fidelity-label">Cercanía al original</p> : null}
      <div
        className="vx-loop-fidelity-track"
        role="img"
        aria-label="Objetivo: máxima similitud entre el vídeo generado y el original"
      >
        <div className="vx-loop-fidelity-fill" />
      </div>
      {!compact ? (
        <p className="vx-loop-fidelity-hint">Cuanto más rico el texto, más cerca</p>
      ) : null}
    </div>
  );
}

function VideoFrameIllustration({
  variant,
  size = "md",
}: {
  variant: "origin" | "generated";
  size?: "xs" | "sm" | "md";
}) {
  const isGen = variant === "generated";
  const uid = `${variant}-${size}`;
  return (
    <div
      className={`vx-illu-phone vx-illu-phone--${size} ${isGen ? "vx-illu-phone--gen" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 96 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="5"
          y="5"
          width="86"
          height="150"
          rx="16"
          stroke="currentColor"
          strokeWidth="1.6"
          className="vx-illu-stroke"
        />
        <rect x="32" y="12" width="32" height="5" rx="2.5" fill="currentColor" opacity="0.18" />
        <rect x="14" y="26" width="68" height="108" rx="5" fill={`url(#screen-${uid})`} />

        {/* cielo / fondo */}
        <path
          d="M14 26 H82 V70 Q48 78 14 70 Z"
          fill="currentColor"
          opacity={isGen ? 0.06 : 0.08}
        />
        {/* sol / luz */}
        <circle cx="68" cy="40" r="7" fill="currentColor" opacity={isGen ? 0.12 : 0.2} />
        {/* figura */}
        <circle cx="48" cy="62" r="11" fill="currentColor" opacity={isGen ? 0.16 : 0.32} />
        <path
          d="M28 118 C32 92 64 92 68 118 Z"
          fill="currentColor"
          opacity={isGen ? 0.12 : 0.26}
        />
        {/* suelo */}
        <rect
          x="14"
          y="118"
          width="68"
          height="16"
          fill="currentColor"
          opacity={isGen ? 0.05 : 0.08}
        />

        {isGen ? (
          <>
            {/* trazo “reconstruido” */}
            <rect
              x="14"
              y="26"
              width="68"
              height="108"
              rx="5"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.35"
            />
            <path
              d="M22 88 H74"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.3"
            />
            <path
              d="M26 96 H70"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.22"
            />
          </>
        ) : (
          <g opacity="0.7">
            <circle cx="48" cy="78" r="11" fill="currentColor" opacity="0.12" />
            <polygon points="44,72 56,78 44,84" fill="currentColor" opacity="0.75" />
          </g>
        )}

        <rect x="40" y="142" width="16" height="4" rx="2" fill="currentColor" opacity="0.22" />
        <defs>
          <linearGradient id={`screen-${uid}`} x1="14" y1="26" x2="82" y2="134">
            <stop stopColor={isGen ? "#3d6f99" : "#2a3340"} stopOpacity="0.07" />
            <stop offset="1" stopColor={isGen ? "#3d6f99" : "#2a3340"} stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function TextDossierIllustration({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className={`vx-illu-dossier vx-illu-dossier--${size}`} aria-hidden="true">
      <svg viewBox="0 0 220 124" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="1.5"
          y="1.5"
          width="217"
          height="121"
          rx="12"
          stroke="currentColor"
          strokeWidth="1.5"
          className="vx-illu-stroke"
        />
        <rect x="16" y="16" width="64" height="9" rx="2.5" fill="currentColor" opacity="0.55" />
        <text x="16" y="42" fill="currentColor" opacity="0.45" fontSize="9" fontFamily="ui-monospace, monospace">
          00:00 · plano medio
        </text>
        <rect x="16" y="50" width="188" height="4" rx="1.5" fill="currentColor" opacity="0.2" />
        <rect x="16" y="60" width="172" height="4" rx="1.5" fill="currentColor" opacity="0.18" />
        <text x="16" y="80" fill="currentColor" opacity="0.45" fontSize="9" fontFamily="ui-monospace, monospace">
          00:04 · habla · S1
        </text>
        <rect x="16" y="88" width="188" height="4" rx="1.5" fill="currentColor" opacity="0.2" />
        <rect x="16" y="98" width="140" height="4" rx="1.5" fill="currentColor" opacity="0.16" />
        <rect x="16" y="110" width="36" height="6" rx="2" fill="currentColor" opacity="0.32" />
        <rect x="58" y="110" width="44" height="6" rx="2" fill="currentColor" opacity="0.2" />
        <rect x="108" y="110" width="40" height="6" rx="2" fill="currentColor" opacity="0.2" />
      </svg>
    </div>
  );
}
