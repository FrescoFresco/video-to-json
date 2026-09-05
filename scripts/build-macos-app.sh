#!/usr/bin/env bash
# Genera Video Extraction Studio.app en dist/ (para macOS).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/Video Extraction Studio.app"
CONTENTS="$APP/Contents"
MACOS="$CONTENTS/MacOS"
RES="$CONTENTS/Resources"

rm -rf "$APP"
mkdir -p "$MACOS" "$RES"

cp "$ROOT/desktop/macos/Info.plist" "$CONTENTS/Info.plist"
cp "$ROOT/desktop/launch.sh" "$MACOS/launch"
chmod +x "$MACOS/launch"

# Enlaza el código del proyecto dentro de Resources/app (sin copiar node_modules gigantes).
ln -sfn "$ROOT" "$RES/app"

echo "App creada: $APP"
echo "En Mac: ábrela con doble clic (puede pedir permiso en Privacidad)."
echo "Opcional: arrástrala a /Applications."
