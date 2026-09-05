import type { ReactNode } from "react";

/** Página «La idea»: qué es este software (extractor de vídeo → JSON). */
export function IdeaView() {
  return (
    <div className="vx-idea min-w-0">
      <header className="vx-idea-hero">
        <p className="vx-idea-kicker">La idea</p>
        <h1 className="vx-idea-title">
          Un extractor de vídeo.
          <br />
          Nada más.
        </h1>
        <p className="vx-idea-lead">
          Entras un clip. Sale un JSON denso: cortes, cámara, habla, caras, texto en pantalla,
          objetos, pose, audio… Empaquetado, ordenado y listo para usarlo donde haga falta.
          Este Studio no genera vídeo.
        </p>
      </header>

      <ExtractionDiagram />

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Por qué existe</h2>
        <p className="vx-idea-p">
          Un vídeo es opaco: imagen, sonido y tiempo mezclados. Hace falta un puente hacia datos
          estructurados —no un resumen vago— para buscar, automatizar, analizar o alimentar otras
          herramientas. Ese puente es la extracción.
        </p>
      </section>

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Cómo funciona</h2>
        <ol className="vx-idea-steps">
          <li>
            <strong>1 · Vídeo de entrada</strong>
            Archivo, carpeta o link.
          </li>
          <li>
            <strong>2 · Pipeline de módulos</strong>
            Cada extractor hace un trabajo concreto (habla, caras, OCR, objetos…).
          </li>
          <li>
            <strong>3 · JSON denso</strong>
            Un solo pack con todo junto: <code className="text-[12.5px]">content</code>,{" "}
            <code className="text-[12.5px]">timeline</code> y metadatos de la corrida.
          </li>
          <li>
            <strong>4 · Tú decides el uso</strong>
            Archivo, API, webhook, búsqueda, automatización… o lo que venga después.
          </li>
        </ol>
      </section>

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Qué hace Video Extraction Studio</h2>
        <p className="vx-idea-p">
          Convierte vídeo en JSON estructurado, en local, con módulos registrados bajo el mismo
          contrato. Guarda el origen si llegó por URL, borra el vídeo temporal al terminar y puede
          avisar por webhook. El listón no es “etiquetar un poco”: es densificar el clip hasta
          que el JSON sea útil de verdad.
        </p>
      </section>

      <section className="vx-idea-block vx-idea-block--last">
        <h2 className="vx-idea-h2">Qué no es</h2>
        <p className="vx-idea-p">
          No es un editor ni un generador de vídeo. Su trabajo termina cuando el JSON está listo.
          Lo que hagas después con ese dossier —archivo, automatización, otra IA— queda fuera.
        </p>
      </section>
    </div>
  );
}

/** Flujo real del producto: vídeo → módulos → JSON. */
export function ExtractionDiagram() {
  return (
    <section aria-label="De vídeo a JSON denso" className="vx-loop vx-loop--embedded">
      <div className="vx-loop-desk">
        <div className="vx-grid vx-grid--extract">
          <div className="vx-col vx-col--left">
            <Node
              step="1"
              title="Vídeo de entrada"
              copy="Archivo, carpeta o link"
              illu={<VideoFrameIllustration variant="origin" />}
            />
          </div>

          <div className="vx-col vx-col--mid">
            <Node
              step="2"
              title="Video Extraction Studio"
              copy="Pipeline modular · vídeo → datos"
              illu={<StudioAppIllustration />}
            />
          </div>

          <div className="vx-col vx-col--right">
            <Node
              step="3"
              title="JSON denso"
              copy="Cortes, habla, caras, texto, objetos, audio…"
              illu={<TextDossierIllustration />}
            />
          </div>
        </div>
      </div>

      <div className="vx-loop-mob">
        <Node
          step="1"
          title="Vídeo de entrada"
          copy="Archivo, carpeta o link"
          layout="row"
          illu={<VideoFrameIllustration variant="origin" size="sm" />}
        />
        <Node
          step="2"
          title="Video Extraction Studio"
          copy="Pipeline modular · vídeo → datos"
          layout="row"
          illu={<StudioAppIllustration size="sm" />}
        />
        <Node
          step="3"
          title="JSON denso"
          copy="Todo el dossier en un solo pack"
          layout="row"
          illu={<TextDossierIllustration size="sm" />}
        />
      </div>
    </section>
  );
}

/** @deprecated Usar ExtractionDiagram. */
export const RecreationDiagram = ExtractionDiagram;

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
        <g opacity="0.7">
          <circle cx="48" cy="78" r="11" fill="currentColor" opacity="0.12" />
          <polygon points="44,72 56,78 44,84" fill="currentColor" opacity="0.75" />
        </g>
        <rect x="40" y="142" width="16" height="4" rx="2" fill="currentColor" opacity="0.22" />
        <defs>
          <linearGradient id={`screen-${uid}`} x1="14" y1="26" x2="82" y2="134">
            <stop stopColor="#2a3340" stopOpacity="0.07" />
            <stop offset="1" stopColor="#2a3340" stopOpacity="0.2" />
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
