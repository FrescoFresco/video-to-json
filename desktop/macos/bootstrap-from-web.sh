#!/usr/bin/env bash
# Instalación Mac de un solo comando.
# Pégalo en Terminal:
#
#   curl -fsSL https://cdn.jsdelivr.net/gh/FrescoFresco/video-to-json@main/desktop/macos/bootstrap-from-web.sh | bash
#
set -euo pipefail

REPO_ZIP="https://codeload.github.com/FrescoFresco/video-to-json/zip/refs/heads/main"
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

# Conserva data/ si ya existía una instalación previa
PRESERVE=""
if [[ -d "$INSTALL_DIR/data" ]]; then
  PRESERVE="$(mktemp -d -t vx-data)"
  cp -R "$INSTALL_DIR/data/." "$PRESERVE/" 2>/dev/null || true
fi

rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -R "$UNPACKED"/. "$INSTALL_DIR/"

if [[ -n "$PRESERVE" && -d "$PRESERVE" ]]; then
  mkdir -p "$INSTALL_DIR/data"
  cp -R "$PRESERVE"/. "$INSTALL_DIR/data/" 2>/dev/null || true
  rm -rf "$PRESERVE"
fi

rm -f "$TMP_ZIP"
rm -rf "$TMP_DIR"

chmod +x \
  "$INSTALL_DIR/desktop/macos/install.sh" \
  "$INSTALL_DIR/desktop/macos/bootstrap-from-web.sh" \
  "$INSTALL_DIR/desktop/launch.sh" \
  "$INSTALL_DIR/scripts/build-macos-app.sh" \
  "$INSTALL_DIR/install.sh" 2>/dev/null || true

echo "Archivos listos. Arrancando instalación (Docker + Studio)…"
echo ""
exec "$INSTALL_DIR/desktop/macos/install.sh"
