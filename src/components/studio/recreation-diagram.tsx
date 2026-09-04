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
          Video Extraction Studio no busca un resumen superficial. Quiere un texto tan rico
          que una IA de vídeo, leyendo solo ese texto, pueda recrear un clip lo más cercano
          posible al original.
        </p>
      </header>

      <RecreationDiagram embedded />

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Por qué existe</h2>
        <p className="vx-idea-p">
          Entre el vídeo que subes y un generador de texto→vídeo hace falta un puente. Ese
          puente es un JSON denso: planos, habla, texto en pantalla, escena, audio, personas,
          cámara… Todo lo que haría falta para reconstruir la pieza, no solo etiquetarla.
        </p>
      </section>

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Los tres bloques</h2>
        <ol className="vx-idea-steps">
          <li>
            <strong>Vídeo original</strong> — el clip real (archivo o link).
          </li>
          <li>
            <strong>Texto de extracción</strong> — lo que produce este Studio: el dossier
            completo.
          </li>
          <li>
            <strong>Vídeo generado</strong> — lo que haría un generador de IA a partir de ese
            texto. El objetivo es que se acerque al 1.
          </li>
        </ol>
      </section>

      <section className="vx-idea-block">
        <h2 className="vx-idea-h2">Qué hace este software (y qué no)</h2>
        <div className="vx-idea-split">
          <div>
            <p className="vx-idea-split-label">Sí</p>
            <p className="vx-idea-p">
              Convertir vídeo en texto/JSON reconstruible, en local, con módulos de extracción.
              Guardar el link de origen, empaquetar todo junto, servir API y webhook.
            </p>
          </div>
          <div>
            <p className="vx-idea-split-label">No (aún)</p>
            <p className="vx-idea-p">
              Generar el vídeo final. Eso lo haría otra herramienta (texto→vídeo). Aquí el
              listón es que el texto sea lo bastante bueno para ese paso.
            </p>
          </div>
        </div>
      </section>

      <section className="vx-idea-block vx-idea-block--last">
        <h2 className="vx-idea-h2">La barra de cercanía</h2>
        <p className="vx-idea-p">
          Entre el vídeo original y el generado ilustramos el objetivo: máxima similitud. No
          es una métrica automática todavía; es la promesa del producto. Cuanto más rico el
          texto del medio, más sentido tiene esa barra.
        </p>
      </section>
    </div>
  );
}

/** Diagrama: vídeo → texto rico → vídeo generado (triángulo invertido). */
export function RecreationDiagram({ embedded = false }: { embedded?: boolean }) {
  return (
    <section
      aria-label="De vídeo a texto a vídeo generado"
      className={`vx-loop ${embedded ? "vx-loop--embedded" : ""}`}
    >
      {!embedded ? (
        <header className="vx-loop-head">
          <p className="vx-loop-kicker">La idea</p>
          <h2 className="vx-loop-title">Extraer tan bien que se pueda volver a generar</h2>
          <p className="vx-loop-lead">
            El Studio convierte el vídeo en un texto denso. Ese texto alimenta un generador
            de IA. Cuanto más rico el medio, más cerca queda el resultado del original.
          </p>
        </header>
      ) : null}

      <div className="vx-loop-stage">
        <div className="vx-loop-top">
          <figure className="vx-loop-node vx-loop-node--origin">
            <VideoFrameIllustration variant="origin" />
            <figcaption>
              <span className="vx-loop-step">1</span>
              <span className="vx-loop-node-title">Vídeo original</span>
              <span className="vx-loop-node-copy">El clip que subes o importas por link</span>
            </figcaption>
          </figure>

          <div className="vx-loop-fidelity">
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
  const originId = isGen ? "vx-gen-fill-b" : "vx-origin-fill-b";
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
        <rect x="12" y="22" width="64" height="100" rx="4" fill={`url(#${originId})`} />
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
          <linearGradient id="vx-origin-fill-b" x1="12" y1="22" x2="76" y2="122">
            <stop stopColor="#2a3340" stopOpacity="0.12" />
            <stop offset="1" stopColor="#2a3340" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="vx-gen-fill-b" x1="12" y1="22" x2="76" y2="122">
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
