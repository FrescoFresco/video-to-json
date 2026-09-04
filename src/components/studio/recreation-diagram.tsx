/** Diagrama: vídeo → texto rico → vídeo generado (triángulo invertido). */
export function RecreationDiagram() {
  return (
    <section
      aria-label="De vídeo a texto a vídeo generado"
      className="vx-loop vx-home-fade vx-home-fade-delay-2"
    >
      <header className="vx-loop-head">
        <p className="vx-loop-kicker">La idea</p>
        <h2 className="vx-loop-title">Extraer tan bien que se pueda volver a generar</h2>
        <p className="vx-loop-lead">
          El Studio convierte el vídeo en un texto denso. Ese texto alimenta un generador
          de IA. Cuanto más rico el medio, más cerca queda el resultado del original.
        </p>
      </header>

      <div className="vx-loop-stage">
        {/* Fila superior: original — fidelidad — generado */}
        <div className="vx-loop-top">
          <figure className="vx-loop-node vx-loop-node--origin">
            <VideoFrameIllustration variant="origin" />
            <figcaption>
              <span className="vx-loop-step">1</span>
              <span className="vx-loop-node-title">Vídeo original</span>
              <span className="vx-loop-node-copy">El clip que subes o importas por link</span>
            </figcaption>
          </figure>

          <div className="vx-loop-fidelity" aria-hidden="false">
            <p className="vx-loop-fidelity-label">Cercanía al original</p>
            <div
              className="vx-loop-fidelity-track"
              role="img"
              aria-label="Objetivo: máxima similitud entre el vídeo generado y el original"
            >
              <div className="vx-loop-fidelity-fill" />
            </div>
            <p className="vx-loop-fidelity-hint">Objetivo · máximo parecido</p>
            <svg className="vx-loop-fidelity-bridge" viewBox="0 0 120 12" aria-hidden="true">
              <path
                d="M2 6 H118"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            </svg>
          </div>

          <figure className="vx-loop-node vx-loop-node--gen">
            <VideoFrameIllustration variant="generated" />
            <figcaption>
              <span className="vx-loop-step">3</span>
              <span className="vx-loop-node-title">Vídeo generado</span>
              <span className="vx-loop-node-copy">Recreado por una IA a partir del texto</span>
            </figcaption>
          </figure>
        </div>

        {/* Conectores hacia el texto */}
        <div className="vx-loop-rails" aria-hidden="true">
          <div className="vx-loop-rail vx-loop-rail--left">
            <span className="vx-loop-rail-tag">Video Extraction Studio</span>
            <span className="vx-loop-rail-sub">vídeo → texto</span>
          </div>
          <div className="vx-loop-rail vx-loop-rail--right">
            <span className="vx-loop-rail-tag">Generador IA</span>
            <span className="vx-loop-rail-sub">texto → vídeo</span>
          </div>
        </div>

        {/* Base del triángulo: texto */}
        <figure className="vx-loop-node vx-loop-node--text">
          <TextDossierIllustration />
          <figcaption>
            <span className="vx-loop-step">2</span>
            <span className="vx-loop-node-title">Texto de extracción</span>
            <span className="vx-loop-node-copy">
              JSON rico: planos, habla, pantalla, escena, audio… lo bastante denso para recrear
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function VideoFrameIllustration({ variant }: { variant: "origin" | "generated" }) {
  const isGen = variant === "generated";
  return (
    <div className={`vx-illu-phone ${isGen ? "vx-illu-phone--gen" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 88 148" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="4"
          y="4"
          width="80"
          height="140"
          rx="14"
          stroke="currentColor"
          strokeWidth="1.5"
          className="vx-illu-stroke"
        />
        <rect x="28" y="10" width="32" height="4" rx="2" fill="currentColor" opacity="0.2" />
        <rect
          x="12"
          y="22"
          width="64"
          height="100"
          rx="4"
          fill={isGen ? "url(#vx-gen-fill)" : "url(#vx-origin-fill)"}
        />
        {/* silueta / escena */}
        <circle cx="44" cy="52" r="12" fill="currentColor" opacity={isGen ? 0.18 : 0.28} />
        <path
          d="M22 108 C28 88, 60 88, 66 108 Z"
          fill="currentColor"
          opacity={isGen ? 0.12 : 0.22}
        />
        {isGen ? (
          <>
            <path
              d="M20 70 H68"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.35"
            />
            <path
              d="M24 78 H64"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.25"
            />
          </>
        ) : (
          <polygon points="38,68 54,76 38,84" fill="currentColor" opacity="0.55" />
        )}
        <rect x="36" y="130" width="16" height="4" rx="2" fill="currentColor" opacity="0.25" />
        <defs>
          <linearGradient id="vx-origin-fill" x1="12" y1="22" x2="76" y2="122">
            <stop stopColor="#2a3340" stopOpacity="0.12" />
            <stop offset="1" stopColor="#2a3340" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="vx-gen-fill" x1="12" y1="22" x2="76" y2="122">
            <stop stopColor="#3d6f99" stopOpacity="0.1" />
            <stop offset="1" stopColor="#3d6f99" stopOpacity="0.22" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function TextDossierIllustration() {
  return (
    <div className="vx-illu-dossier" aria-hidden="true">
      <svg viewBox="0 0 200 112" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="1"
          y="1"
          width="198"
          height="110"
          rx="10"
          stroke="currentColor"
          strokeWidth="1.4"
          className="vx-illu-stroke"
        />
        <rect x="14" y="16" width="52" height="8" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="14" y="32" width="172" height="4" rx="1.5" fill="currentColor" opacity="0.2" />
        <rect x="14" y="42" width="158" height="4" rx="1.5" fill="currentColor" opacity="0.2" />
        <rect x="14" y="52" width="166" height="4" rx="1.5" fill="currentColor" opacity="0.2" />
        <rect x="14" y="62" width="120" height="4" rx="1.5" fill="currentColor" opacity="0.2" />
        <rect x="14" y="78" width="40" height="6" rx="2" fill="currentColor" opacity="0.35" />
        <rect x="60" y="78" width="48" height="6" rx="2" fill="currentColor" opacity="0.22" />
        <rect x="114" y="78" width="36" height="6" rx="2" fill="currentColor" opacity="0.22" />
        <rect x="14" y="92" width="172" height="4" rx="1.5" fill="currentColor" opacity="0.14" />
      </svg>
    </div>
  );
}
