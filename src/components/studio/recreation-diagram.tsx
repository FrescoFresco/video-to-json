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
        <h2 className="vx-idea-h2">El recorrido</h2>
        <ol className="vx-idea-steps">
          <li>
            <strong>1 · Vídeo original</strong>
            El clip real (archivo o link).
          </li>
          <li>
            <strong>2 · Video Extraction Studio</strong>
            Este software: convierte el vídeo en un texto de extracción denso.
          </li>
          <li>
            <strong>3 · Texto de extracción</strong>
            El dossier JSON. Es lo único que produce el Studio. Puente entre ambos lados.
          </li>
          <li>
            <strong>4 · Generador de vídeo IA (externo)</strong>
            Otra herramienta: lee ese texto y puede regenerar un vídeo.
          </li>
          <li>
            <strong>5 · Vídeo generado</strong>
            El resultado fuera de aquí. Cuanto más rico el texto, más cerca puede quedar del
            original.
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
          Arriba, el original (1) y el generado (5) se miran de frente. La barra del medio no
          es una nota automática: es el objetivo. El trabajo de este software es hacer el
          texto (3) tan rico que esa cercanía sea posible.
        </p>
      </section>
    </div>
  );
}

/**
 * Desktop:
 *   [1 Original]  —— cercanía ——  [5 Generado]
 *   [2 VX Studio]                 [4 Generador IA]
 *              [3 Texto extracción]
 *
 * Móvil: flujo 1→2→3→4→5 + cercanía al final.
 */
export function RecreationDiagram() {
  return (
    <section aria-label="De vídeo a texto a vídeo generado" className="vx-loop vx-loop--embedded">
      {/* —— Desktop —— */}
      <div className="vx-loop-desk">
        <div className="vx-grid">
          {/* Columna izquierda */}
          <div className="vx-col vx-col--left">
            <Node
              step="1"
              title="Vídeo original"
              copy="El clip que subes o importas"
              illu={<VideoFrameIllustration variant="origin" />}
            />
            <Node
              step="2"
              title="Video Extraction Studio"
              copy="Este software · vídeo → texto"
              illu={<StudioAppIllustration />}
            />
          </div>

          {/* Centro: cercanía (arriba) */}
          <div className="vx-col vx-col--mid">
            <FidelityBridge />
          </div>

          {/* Columna derecha */}
          <div className="vx-col vx-col--right">
            <Node
              step="5"
              title="Vídeo generado"
              copy="Recreado fuera de este Studio"
              badge="Externo"
              illu={<VideoFrameIllustration variant="generated" />}
            />
            <Node
              step="4"
              title="Generador de vídeo IA"
              copy="Herramienta externa · texto → vídeo"
              badge="Externo"
              illu={<AiGeneratorIllustration />}
            />
          </div>
        </div>

        <Node
          step="3"
          title="Texto de extracción"
          copy="JSON denso: planos, habla, pantalla, escena, audio… el puente"
          className="vx-loop-node--text"
          illu={<TextDossierIllustration />}
        />
      </div>

      {/* —— Móvil —— */}
      <div className="vx-loop-mob">
        <Node
          step="1"
          title="Vídeo original"
          copy="El clip que subes o importas"
          layout="row"
          illu={<VideoFrameIllustration variant="origin" size="sm" />}
        />
        <FlowArrow label="entra en" />
        <Node
          step="2"
          title="Video Extraction Studio"
          copy="Este software · vídeo → texto"
          layout="row"
          illu={<StudioAppIllustration size="sm" />}
        />
        <FlowArrow label="produce" />
        <Node
          step="3"
          title="Texto de extracción"
          copy="JSON denso para recrear el clip"
          layout="row"
          illu={<TextDossierIllustration size="sm" />}
        />
        <FlowArrow label="si se inyecta en" sub="fuera de este Studio" />
        <Node
          step="4"
          title="Generador de vídeo IA"
          copy="Herramienta externa · texto → vídeo"
          badge="Externo"
          layout="row"
          illu={<AiGeneratorIllustration size="sm" />}
        />
        <FlowArrow label="puede dar" />
        <Node
          step="5"
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
            Cuanto más rico el texto (3), más cerca puede quedar el 5 del 1
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

function FlowArrow({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="vx-flow-arrow" aria-hidden="true">
      <div className="vx-flow-arrow-line" />
      <div className="vx-flow-arrow-text">
        <span className="vx-loop-rail-tag">{label}</span>
        {sub ? <span className="vx-loop-rail-sub">{sub}</span> : null}
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
        <path
          d="M14 26 H82 V70 Q48 78 14 70 Z"
          fill="currentColor"
          opacity={isGen ? 0.06 : 0.08}
        />
        <circle cx="68" cy="40" r="7" fill="currentColor" opacity={isGen ? 0.12 : 0.2} />
        <circle cx="48" cy="62" r="11" fill="currentColor" opacity={isGen ? 0.16 : 0.32} />
        <path
          d="M28 118 C32 92 64 92 68 118 Z"
          fill="currentColor"
          opacity={isGen ? 0.12 : 0.26}
        />
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

function StudioAppIllustration({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className={`vx-illu-app vx-illu-app--${size}`} aria-hidden="true">
      <svg viewBox="0 0 148 112" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="2"
          y="2"
          width="144"
          height="108"
          rx="12"
          stroke="currentColor"
          strokeWidth="1.5"
          className="vx-illu-stroke"
        />
        <rect x="2" y="2" width="144" height="22" rx="12" fill="currentColor" opacity="0.06" />
        <rect x="2" y="18" width="144" height="6" fill="currentColor" opacity="0.06" />
        <circle cx="16" cy="13" r="3" fill="currentColor" opacity="0.25" />
        <circle cx="26" cy="13" r="3" fill="currentColor" opacity="0.18" />
        <circle cx="36" cy="13" r="3" fill="currentColor" opacity="0.12" />
        <rect x="58" y="10" width="32" height="6" rx="2" fill="currentColor" opacity="0.35" />
        <text
          x="64"
          y="15"
          fill="currentColor"
          opacity="0.7"
          fontSize="7"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="700"
        >
          VX
        </text>
        <rect x="10" y="32" width="18" height="68" rx="4" fill="currentColor" opacity="0.07" />
        <rect x="14" y="38" width="10" height="6" rx="1.5" fill="currentColor" opacity="0.25" />
        <rect x="14" y="50" width="10" height="6" rx="1.5" fill="currentColor" opacity="0.15" />
        <rect x="14" y="62" width="10" height="6" rx="1.5" fill="currentColor" opacity="0.15" />
        <rect x="38" y="34" width="48" height="36" rx="4" fill="currentColor" opacity="0.08" />
        <polygon points="54,46 66,52 54,58" fill="currentColor" opacity="0.4" />
        <rect x="96" y="34" width="42" height="8" rx="2" fill="currentColor" opacity="0.45" />
        <rect x="96" y="48" width="42" height="3.5" rx="1" fill="currentColor" opacity="0.2" />
        <rect x="96" y="56" width="36" height="3.5" rx="1" fill="currentColor" opacity="0.16" />
        <rect x="96" y="64" width="40" height="3.5" rx="1" fill="currentColor" opacity="0.16" />
        <path
          d="M86 52 H96"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="2 2"
          opacity="0.4"
        />
        <rect x="38" y="80" width="100" height="18" rx="4" fill="currentColor" opacity="0.06" />
        <rect x="46" y="86" width="28" height="6" rx="2" fill="currentColor" opacity="0.28" />
        <rect x="80" y="86" width="48" height="6" rx="2" fill="currentColor" opacity="0.14" />
      </svg>
    </div>
  );
}

function AiGeneratorIllustration({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className={`vx-illu-genai vx-illu-genai--${size}`} aria-hidden="true">
      <svg viewBox="0 0 148 112" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="2"
          y="2"
          width="144"
          height="108"
          rx="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          className="vx-illu-stroke"
        />
        <rect x="14" y="14" width="70" height="10" rx="3" fill="currentColor" opacity="0.12" />
        <rect
          x="14"
          y="14"
          width="70"
          height="10"
          rx="3"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.25"
        />
        <rect x="18" y="17" width="40" height="4" rx="1.5" fill="currentColor" opacity="0.28" />
        <rect x="14" y="32" width="70" height="4" rx="1.5" fill="currentColor" opacity="0.16" />
        <rect x="14" y="40" width="58" height="4" rx="1.5" fill="currentColor" opacity="0.14" />
        <rect x="14" y="48" width="64" height="4" rx="1.5" fill="currentColor" opacity="0.14" />
        <circle cx="112" cy="42" r="22" fill="currentColor" opacity="0.07" />
        <path
          d="M112 24 L115 36 L127 39 L115 42 L112 54 L109 42 L97 39 L109 36 Z"
          fill="currentColor"
          opacity="0.45"
        />
        <path
          d="M84 42 H90"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="2 2"
          opacity="0.4"
        />
        <rect
          x="98"
          y="70"
          width="36"
          height="28"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.55"
        />
        <circle cx="116" cy="82" r="5" fill="currentColor" opacity="0.18" />
        <polygon points="114,79 120,82 114,85" fill="currentColor" opacity="0.5" />
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
        <text
          x="16"
          y="42"
          fill="currentColor"
          opacity="0.45"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          00:00 · plano medio
        </text>
        <rect x="16" y="50" width="188" height="4" rx="1.5" fill="currentColor" opacity="0.2" />
        <rect x="16" y="60" width="172" height="4" rx="1.5" fill="currentColor" opacity="0.18" />
        <text
          x="16"
          y="80"
          fill="currentColor"
          opacity="0.45"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
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
