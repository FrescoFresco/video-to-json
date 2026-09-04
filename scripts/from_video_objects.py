#!/usr/bin/env python3
"""Detecta personas y objetos en fotogramas (YOLOv8n, local/gratis)."""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

from ultralytics import YOLO

MODEL_NAME = os.environ.get("YOLO_MODEL", "yolov8n.pt")
MAX_FRAMES = int(os.environ.get("OBJECTS_MAX_FRAMES", "12"))
CONF = float(os.environ.get("YOLO_CONF", "0.35"))

# Clases COCO más útiles para vídeo / personas
PRIORITY = {
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "bus",
    "truck",
    "dog",
    "cat",
    "bird",
    "horse",
    "backpack",
    "handbag",
    "suitcase",
    "bottle",
    "cup",
    "laptop",
    "cell phone",
    "book",
    "tv",
    "remote",
    "keyboard",
    "mouse",
    "clock",
    "vase",
    "scissors",
    "teddy bear",
}


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: from_video_objects.py <frames_manifest.json> <out.json>", file=sys.stderr)
        return 2

    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_path = Path(sys.argv[2])
    frames = (manifest.get("frames") or [])[:MAX_FRAMES]

    if not frames:
        out_path.write_text(
            json.dumps(
                {
                    "engine": "yolov8n",
                    "model": MODEL_NAME,
                    "frame_count": 0,
                    "items": [],
                    "tracks": [],
                    "error": "No hay frames para detectar",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return 0

    model = YOLO(MODEL_NAME)
    detections = []
    # track_key -> list of observations for crude temporal tracking
    buckets: dict[str, list[dict]] = defaultdict(list)

    for frame in frames:
        path = frame.get("path")
        if not path or not Path(path).exists():
            continue
        start_ms = int(frame.get("start_ms") or 0)
        end_ms = int(frame.get("end_ms") or start_ms)
        result = model.predict(source=path, conf=CONF, verbose=False)[0]
        names = result.names or {}
        if result.boxes is None:
            continue
        for box in result.boxes:
            cls_id = int(box.cls.item())
            label = str(names.get(cls_id, cls_id))
            if PRIORITY and label not in PRIORITY:
                # seguimos guardando person siempre; resto solo priority
                if label != "person":
                    continue
            conf = float(box.conf.item())
            xyxy = [round(float(x), 1) for x in box.xyxy[0].tolist()]
            cx = (xyxy[0] + xyxy[2]) / 2
            cy = (xyxy[1] + xyxy[3]) / 2
            # bucket espacial grueso para “mismo objeto” entre frames
            track_key = f"{label}:{int(cx // 80)}:{int(cy // 80)}"
            row = {
                "label": label,
                "conf": round(conf, 3),
                "bbox": xyxy,
                "start_ms": start_ms,
                "end_ms": end_ms,
                "track_key": track_key,
            }
            detections.append(row)
            buckets[track_key].append(row)

    # Resumen por track
    tracks = []
    for key, rows in buckets.items():
        label = rows[0]["label"]
        tracks.append(
            {
                "id": key,
                "label": label,
                "count": len(rows),
                "start_ms": min(r["start_ms"] for r in rows),
                "end_ms": max(r["end_ms"] for r in rows),
                "avg_conf": round(sum(r["conf"] for r in rows) / len(rows), 3),
            }
        )
    tracks.sort(key=lambda t: (-t["count"], t["label"]))

    # Items para UI: una fila por track
    items = [
        {
            "start_ms": t["start_ms"],
            "end_ms": t["end_ms"],
            "text": f"{t['label']} · {t['count']} apariciones · conf {t['avg_conf']}",
            "role": t["label"],
            "label": t["id"],
        }
        for t in tracks
    ]

    # Conteos globales
    counts: dict[str, int] = defaultdict(int)
    for t in tracks:
        counts[t["label"]] += 1

    payload = {
        "engine": "yolov8n",
        "model": MODEL_NAME,
        "frame_count": len(frames),
        "class_counts": dict(sorted(counts.items(), key=lambda x: (-x[1], x[0]))),
        "tracks": tracks,
        "detections": detections,
        "items": items,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
