#!/usr/bin/env bash
# Lanzador nativo (macOS / Linux): un clic → arranca el Studio y abre el navegador.
set -euo pipefail

# Si estamos dentro de .app: .../Contents/MacOS/launch → repo en Resources/app o 4 niveles arriba
HERE="$(cd "$(dirname "$0")" && pwd)"
if [[ -d "$HERE/../Resources/app" ]]; then
  ROOT="$(cd "$HERE/../Resources/app" && pwd)"
elif [[ -d "$HERE/../../.." ]] && [[ -f "$HERE/../../../install.sh" ]]; then
  ROOT="$(cd "$HERE/../../.." && pwd)"
elif [[ -f "$HERE/../install.sh" ]]; then
  ROOT="$(cd "$HERE/.." && pwd)"
else
  ROOT="$(cd "$HERE/../.." && pwd)"
fi

PORT="${PORT:-43141}"
URL="http://127.0.0.1:${PORT}"
cd "$ROOT"

echo "Video Extraction Studio"
echo "Carpeta: $ROOT"
echo

# ¿Ya está corriendo?
if curl -fsS "$URL/" >/dev/null 2>&1; then
  echo "Ya estaba en marcha."
else
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "Arrancando con Docker (caja con todo dentro)…"
    if docker compose version >/dev/null 2>&1; then
      docker compose up --build -d
    else
      docker-compose up --build -d
    fi
  else
    echo "Arrancando en local (sin Docker)…"
    # En segundo plano para poder abrir el navegador
    nohup bash ./install.sh prod >/tmp/vx-studio.log 2>&1 &
  fi

  echo "Esperando a que responda en $URL …"
  for i in $(seq 1 90); do
    if curl -fsS "$URL/" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

if curl -fsS "$URL/" >/dev/null 2>&1; then
  echo "Abriendo $URL"
  if command -v open >/dev/null 2>&1; then
    open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
  fi
else
  echo "No respondió a tiempo. Mira /tmp/vx-studio.log o ejecuta: ./install.sh" >&2
  exit 1
fi
