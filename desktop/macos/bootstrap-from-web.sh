#!/usr/bin/env bash
# Instalación Mac de un solo comando.
# Pégalo en Terminal:
#
#   curl -fsSL https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/macos/bootstrap-from-web.sh | bash
#
set -euo pipefail

REPO_ZIP="https://github.com/FrescoFresco/video-to-json/archive/refs/heads/main.zip"
INSTALL_DIR="${HOME}/VideoExtractionStudio"
TMP_ZIP="$(mktemp -t vx-studio).zip"
TMP_DIR="$(mktemp -d -t vx-studio)"

echo ""
echo "Video Extraction Studio — instalación automática (Mac)"
echo "Se descargará en: $INSTALL_DIR"
echo ""

echo "Descargando el programa…"
curl -fsSL "$REPO_ZIP" -o "$TMP_ZIP"
unzip -q "$TMP_ZIP" -d "$TMP_DIR"

UNPACKED="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [[ -z "$UNPACKED" || ! -d "$UNPACKED" ]]; then
  echo "No se pudo descomprimir el proyecto." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
# Actualiza contenido sin borrar la carpeta destino entera (por si hay data/)
rsync -a --delete \
  --exclude 'data/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'video-py/' \
  "$UNPACKED"/ "$INSTALL_DIR"/

rm -f "$TMP_ZIP"
rm -rf "$TMP_DIR"

chmod +x "$INSTALL_DIR/desktop/macos/install.sh" \
  "$INSTALL_DIR/desktop/launch.sh" \
  "$INSTALL_DIR/scripts/build-macos-app.sh" \
  "$INSTALL_DIR/install.sh" 2>/dev/null || true

echo "Archivos listos. Arrancando instalación (Docker + Studio)…"
echo ""
exec "$INSTALL_DIR/desktop/macos/install.sh"
