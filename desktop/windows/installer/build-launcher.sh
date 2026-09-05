#!/usr/bin/env bash
# Cross-compile the Windows launcher from Linux/macOS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/dist/windows"
mkdir -p "$OUT" "$ROOT/desktop/windows/installer"
cd "$ROOT/desktop/windows/launcher"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o "$ROOT/desktop/windows/installer/VideoExtractionStudio.exe" .
cp -f "$ROOT/desktop/windows/installer/VideoExtractionStudio.exe" "$OUT/VideoExtractionStudio.exe"
echo "Launcher: $OUT/VideoExtractionStudio.exe"
echo "Full Setup.exe is built on Windows (CI or build.ps1 + Inno Setup)."
