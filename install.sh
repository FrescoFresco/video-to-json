#!/usr/bin/env bash
# Instala y arranca Video Extraction Studio de un golpe.
# Preferencia: Docker. Si no hay Docker, instala dependencias locales y levanta el servidor.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PORT="${PORT:-43141}"
HOST="${HOST:-0.0.0.0}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Falta el comando: $1" >&2
    return 1
  fi
}

start_docker() {
  echo "→ Usando Docker (todo empaquetado: Node, ffmpeg, Whisper, OCR, visión)"
  if docker compose version >/dev/null 2>&1; then
    docker compose up --build -d
  else
    docker-compose up --build -d
  fi
  echo
  echo "Listo. Abre http://localhost:${PORT}"
  echo "Parar: docker compose down"
}

start_local() {
  echo "→ Instalación local (sin Docker)"

  need_cmd node
  need_cmd npm
  need_cmd python3
  need_cmd ffmpeg
  need_cmd ffprobe

  if [[ ! -d node_modules ]]; then
    echo "→ npm install"
    npm install
  fi

  if [[ ! -x video-py/bin/python ]]; then
    echo "→ creando entorno Python (Whisper, OCR, visión Moondream)"
    python3 -m venv video-py
    video-py/bin/pip install --upgrade pip
    # Torch CPU fijo (compatible con diarize + visión)
    video-py/bin/pip install torch==2.8.0 torchvision==0.23.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
    video-py/bin/pip install -r requirements-video.txt
  fi

  MODE="${1:-dev}"
  if [[ "$MODE" == "prod" ]]; then
    echo "→ build de producción"
    npm run build
    echo
    echo "Listo. Abre http://localhost:${PORT}"
    exec npm run start
  fi

  echo
  echo "Listo. Abre http://localhost:${PORT}"
  exec npm run dev
}

main() {
  echo "Video Extraction Studio — instalación de un golpe"
  echo

  if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
      start_docker
      exit 0
    fi
    echo "Docker está instalado pero el daemon no responde; paso a instalación local."
  else
    echo "No hay Docker; paso a instalación local."
  fi

  start_local "${1:-dev}"
}

main "$@"
