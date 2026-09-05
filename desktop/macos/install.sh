#!/usr/bin/env bash
# Instalación / arranque Mac (Docker + Studio + navegador).
# Uso:
#   ./desktop/macos/install.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
URL="http://127.0.0.1:43141"

step() { echo ""; echo "==> $*"; }

docker_engine_ok() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

open_browser() {
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  fi
}

echo "Video Extraction Studio — Mac"
echo "Carpeta: $ROOT"

if curl -fsS "$URL/" >/dev/null 2>&1; then
  step "Ya está en marcha. Abriendo el navegador…"
  open_browser
  exit 0
fi

# --- Docker ---
if ! command -v docker >/dev/null 2>&1; then
  step "Docker no está. Intentando instalarlo…"
  if command -v brew >/dev/null 2>&1; then
    brew install --cask docker
  else
    echo "No hay Homebrew."
    echo "Instala Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo "O Homebrew: https://brew.sh  — y vuelve a ejecutar este script."
    exit 1
  fi
fi

if ! docker_engine_ok; then
  step "Arrancando Docker Desktop…"
  if [[ -d "/Applications/Docker.app" ]]; then
    open -a Docker
  else
    echo "Abre Docker Desktop a mano y vuelve a ejecutar este script."
    exit 1
  fi
  echo "Esperando al motor de Docker (1–2 min)…"
  for _ in $(seq 1 90); do
    if docker_engine_ok; then
      echo "Docker listo."
      break
    fi
    sleep 2
  done
  if ! docker_engine_ok; then
    echo "Docker no respondió a tiempo."
    echo "Ábrelo, acepta el asistente la primera vez, y vuelve a lanzar este script."
    exit 1
  fi
fi

step "Construyendo y arrancando el Studio (la primera vez tarda)…"
if docker compose version >/dev/null 2>&1; then
  docker compose up --build -d
else
  docker-compose up --build -d
fi

step "Esperando $URL …"
for _ in $(seq 1 120); do
  if curl -fsS "$URL/" >/dev/null 2>&1; then
    echo "Listo. Abriendo el navegador…"
    open_browser
    echo ""
    echo "Para parar: cd \"$ROOT\" && docker compose down"
    exit 0
  fi
  sleep 2
done

echo "Arrancó, pero la web aún no responde. Prueba en unos minutos: $URL"
open_browser
