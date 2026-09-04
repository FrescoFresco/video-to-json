#!/usr/bin/env bash
# Verifica que todos los módulos de extracción responden con un vídeo de prueba.
# Uso:
#   ./scripts/verify-extraction.sh
#   BASE_URL=http://127.0.0.1:43141 ./scripts/verify-extraction.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:43141}"
WORKDIR="${TMPDIR:-/tmp}/vx-smoke-verify"
VIDEO="$WORKDIR/all-modules.mp4"
EXPECT_MODULES=(
  scene_cuts
  camera_motion
  speech
  speakers
  on_screen_text
  objects_people
  visual_observation
  music_ambiance
  audio_events
  summary
)

mkdir -p "$WORKDIR"

need() { command -v "$1" >/dev/null || { echo "Falta $1" >&2; exit 1; }; }
need curl
need python3
need ffmpeg
need ffprobe
need espeak-ng

echo "→ Preparando vídeo de prueba (persona + texto + 2 voces)"
espeak-ng -v es -w "$WORKDIR/a.wav" -s 140 "Hola, soy Ana y estoy presentando el producto."
espeak-ng -v es+f2 -w "$WORKDIR/b.wav" -s 150 "Y yo soy Luis, te cuento cómo funciona."
# Silencio entre voces para ayudar a la diarización
ffmpeg -y -f lavfi -i anullsrc=r=22050:cl=mono -t 1.2 "$WORKDIR/silence.wav" >/dev/null 2>&1
ffmpeg -y -i "$WORKDIR/a.wav" -i "$WORKDIR/silence.wav" -i "$WORKDIR/b.wav" \
  -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1" "$WORKDIR/speech.wav" >/dev/null 2>&1

PERSON="${PERSON_IMG:-/tmp/person.jpg}"
if [[ ! -f "$PERSON" ]]; then
  curl -fsSL -o "$PERSON" "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"
fi

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORKDIR/speech.wav")"
ffmpeg -y -loop 1 -i "$PERSON" -i "$WORKDIR/speech.wav" \
  -vf "scale=640:360,drawtext=text='SMOKE TEST':fontsize=32:fontcolor=white:x=24:y=24:box=1:boxcolor=black@0.5" \
  -c:v libx264 -c:a aac -shortest -t "$DUR" "$VIDEO" >/dev/null 2>&1

echo "→ Comprobando servidor en $BASE_URL"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/" || true)"
if [[ "$code" != "200" ]]; then
  echo "El servidor no responde en $BASE_URL (HTTP $code)." >&2
  echo "Arranca antes: ./install.sh   (o VIDEO_PYTHON=$ROOT/video-py/bin/python npm run dev)" >&2
  exit 1
fi

echo "→ Subiendo vídeo de prueba"
RESP="$(curl -s -F "file=@${VIDEO};type=video/mp4" "$BASE_URL/api/jobs")"
JOB="$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['id'])" "$RESP")"
echo "   job=$JOB"

echo "→ Esperando resultado (visión/CPU puede tardar)"
for i in $(seq 1 180); do
  J="$(curl -s "$BASE_URL/api/jobs/$JOB")"
  STATUS="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('status',''))" "$J")"
  STAGE="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('stage',''))" "$J")"
  echo "   [$i] $STATUS · $STAGE"
  if [[ "$STATUS" == "ready" || "$STATUS" == "error" ]]; then
    break
  fi
  sleep 5
done

if [[ "$STATUS" != "ready" ]]; then
  echo "FAIL: el trabajo no terminó en ready ($STATUS)" >&2
  echo "$J" | python3 -m json.tool | head -80 >&2
  exit 1
fi

RESULT="$(curl -s "$BASE_URL/api/jobs/$JOB/result")"
python3 - "$RESULT" <<'PY'
import json, sys

raw = sys.argv[1]
data = json.loads(raw)
modules = {m["id"]: m for m in (data.get("extraction") or {}).get("modules") or []}
expected = [
  "scene_cuts",
  "camera_motion",
  "speech",
  "speakers",
  "on_screen_text",
  "objects_people",
  "visual_observation",
  "music_ambiance",
  "audio_events",
  "summary",
]

print("\n=== Resultado por módulo ===")
failed = []
for mid in expected:
    m = modules.get(mid)
    if not m:
        print(f"FAIL  {mid}: no aparece en el JSON")
        failed.append(mid)
        continue
    status = m.get("status")
    summary = m.get("summary")
    items = len(m.get("items") or [])
    ok = status == "ok" and items > 0
    # speech/speakers: ok si hay segmentos o interlocutores
    if mid in ("speech", "speakers", "on_screen_text", "objects_people", "visual_observation", "scene_cuts", "music_ambiance", "camera_motion", "audio_events", "summary"):
        if not ok:
            print(f"FAIL  {mid}: status={status} summary={summary!r} items={items} error={m.get('error')}")
            failed.append(mid)
            continue
    mark = "OK  " if ok else "WARN"
    sample = ""
    if m.get("items"):
        sample = " · " + str(m["items"][0].get("text", ""))[:90]
    print(f"{mark}  {mid}: {summary}{sample}")

# Comprobaciones de contenido mínimas
speech = modules.get("speech") or {}
speakers = modules.get("speakers") or {}
ocr = modules.get("on_screen_text") or {}
objs = modules.get("objects_people") or {}

texts = " ".join(i.get("text", "") for i in (ocr.get("items") or [])).upper()
if "SMOKE" not in texts and "TEST" not in texts:
    print("FAIL  on_screen_text: no encontró 'SMOKE TEST'")
    failed.append("on_screen_text-content")

obj_text = " ".join(i.get("text", "") for i in (objs.get("items") or [])).lower()
if "person" not in obj_text:
    print("FAIL  objects_people: no detectó person")
    failed.append("objects_people-content")

spk_count = len((speakers.get("data") or {}).get("speakers") or speakers.get("items") or [])
if spk_count < 1:
    print("FAIL  speakers: sin interlocutores")
    failed.append("speakers-content")
elif spk_count < 2:
    print(f"WARN  speakers: solo {spk_count} interlocutor(es); se esperaban 2 en el vídeo de prueba")

print()
if failed:
    print("RESULTADO: FALLÓ →", ", ".join(failed))
    sys.exit(1)
print("RESULTADO: TODOS LOS MÓDULOS OK")
PY
