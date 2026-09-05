#!/usr/bin/env python3
"""Detecta personas y objetos (YOLOv8n) y describe cada pista con VLM (Moondream).

YOLO localiza; la IA solo describe el crop — no inventa detecciones.
Si el VLM falla, se devuelve igual la detección YOLO.
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

MODEL_NAME = os.environ.get("YOLO_MODEL", "yolov8n.pt")
MAX_FRAMES = int(os.environ.get("OBJECTS_MAX_FRAMES", "12"))
CONF = float(os.environ.get("YOLO_CONF", "0.35"))
# Describir todas las pistas con VLM (0 = solo YOLO)
VLM_ENABLED = os.environ.get("OBJECTS_VLM", "1").strip().lower() not in ("0", "false", "no", "off")
VISION_MODEL = os.environ.get("VISION_MODEL", "vikhyatk/moondream2")
VISION_REVISION = os.environ.get("VISION_MODEL_REVISION", "2025-01-09")

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

DESCRIBE_PROMPT = (
    "In one short sentence, describe this cropped object or person for recreating "
    "the shot: colors, clothing or material, pose or state, and notable details. "
    "Do not invent things that are not visible."
)


def load_vlm():
    import torch
    from transformers import AutoModelForCausalLM

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = AutoModelForCausalLM.from_pretrained(
        VISION_MODEL,
        revision=VISION_REVISION,
        trust_remote_code=True,
        torch_dtype=torch.float32 if device == "cpu" else torch.float16,
        device_map={"": device},
    )
    model.eval()
    return model, device


def describe_crop(model, image: Image.Image) -> str:
    encoded = model.encode_image(image)
    try:
        if hasattr(model, "query"):
            ans = model.query(encoded, DESCRIBE_PROMPT)
            text = (ans.get("answer") if isinstance(ans, dict) else str(ans) or "").strip()
            if text:
                return text
        if hasattr(model, "caption"):
            cap = model.caption(encoded, length="short")
            return (cap.get("caption") if isinstance(cap, dict) else str(cap) or "").strip()
    except Exception:
        return ""
    return ""


def crop_box(image: Image.Image, bbox: list[float], pad: float = 0.08) -> Image.Image | None:
    w, h = image.size
    x1, y1, x2, y2 = bbox
    bw, bh = x2 - x1, y2 - y1
    x1 = max(0, int(x1 - bw * pad))
    y1 = max(0, int(y1 - bh * pad))
    x2 = min(w, int(x2 + bw * pad))
    y2 = min(h, int(y2 + bh * pad))
    if x2 - x1 < 8 or y2 - y1 < 8:
        return None
    crop = image.crop((x1, y1, x2, y2))
    crop.thumbnail((384, 384))
    return crop


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
                    "class_counts": {},
                    "tracks": [],
                    "detections": [],
                    "items": [],
                    "error": "No hay frames para detectar",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return 0

    yolo = YOLO(MODEL_NAME)
    detections: list[dict] = []
    buckets: dict[str, list[dict]] = defaultdict(list)
    best_crop: dict[str, dict] = {}

    for frame in frames:
        path = frame.get("path")
        if not path or not Path(path).exists():
            continue
        start_ms = int(frame.get("start_ms") or 0)
        end_ms = int(frame.get("end_ms") or start_ms)
        result = yolo.predict(source=path, conf=CONF, verbose=False)[0]
        names = result.names or {}
        if result.boxes is None:
            continue
        for box in result.boxes:
            cls_id = int(box.cls.item())
            label = str(names.get(cls_id, cls_id))
            if PRIORITY and label not in PRIORITY and label != "person":
                continue
            conf = float(box.conf.item())
            xyxy = [round(float(x), 1) for x in box.xyxy[0].tolist()]
            cx = (xyxy[0] + xyxy[2]) / 2
            cy = (xyxy[1] + xyxy[3]) / 2
            track_key = f"{label}:{int(cx // 80)}:{int(cy // 80)}"
            row = {
                "label": label,
                "conf": round(conf, 3),
                "bbox": xyxy,
                "start_ms": start_ms,
                "end_ms": end_ms,
                "track_key": track_key,
                "frame_path": path,
            }
            detections.append(row)
            buckets[track_key].append(row)
            prev = best_crop.get(track_key)
            if prev is None or conf > prev["conf"]:
                best_crop[track_key] = row

    tracks: list[dict] = []
    for key, rows in buckets.items():
        tracks.append(
            {
                "id": key,
                "label": rows[0]["label"],
                "count": len(rows),
                "start_ms": min(r["start_ms"] for r in rows),
                "end_ms": max(r["end_ms"] for r in rows),
                "avg_conf": round(sum(r["conf"] for r in rows) / len(rows), 3),
                "description": None,
            }
        )
    tracks.sort(key=lambda t: (-t["count"], t["label"]))

    vlm_error = None
    vlm_used = 0
    if VLM_ENABLED and tracks:
        try:
            vlm, _device = load_vlm()
            # Todas las pistas; personas primero solo por orden de proceso
            candidates = sorted(
                tracks,
                key=lambda t: (
                    0 if t["label"] == "person" else 1,
                    -t["count"],
                    -t["avg_conf"],
                ),
            )
            image_cache: dict[str, Image.Image] = {}
            for track in candidates:
                tip = best_crop.get(track["id"])
                if not tip:
                    continue
                fpath = tip.get("frame_path")
                if not fpath or not Path(fpath).exists():
                    continue
                if fpath not in image_cache:
                    image_cache[fpath] = Image.open(fpath).convert("RGB")
                crop = crop_box(image_cache[fpath], tip["bbox"])
                if crop is None:
                    continue
                desc = describe_crop(vlm, crop)
                if desc:
                    track["description"] = desc
                    vlm_used += 1
        except Exception as exc:  # noqa: BLE001
            vlm_error = str(exc)

    items = []
    for t in tracks:
        if t.get("description"):
            text = f"{t['label']}: {t['description']}"
        else:
            text = f"{t['label']} · {t['count']} apariciones · conf {t['avg_conf']}"
        items.append(
            {
                "start_ms": t["start_ms"],
                "end_ms": t["end_ms"],
                "text": text,
                "role": t["label"],
                "label": t["id"],
                "description": t.get("description"),
            }
        )

    clean_dets = [{k: v for k, v in d.items() if k != "frame_path"} for d in detections]

    counts: dict[str, int] = defaultdict(int)
    for t in tracks:
        counts[t["label"]] += 1

    engine = "yolov8n+moondream2" if vlm_used else "yolov8n"
    payload = {
        "engine": engine,
        "model": MODEL_NAME,
        "vision_model": VISION_MODEL if vlm_used else None,
        "frame_count": len(frames),
        "vlm_described": vlm_used,
        "class_counts": dict(sorted(counts.items(), key=lambda x: (-x[1], x[0]))),
        "tracks": tracks,
        "detections": clean_dets,
        "items": items,
    }
    if vlm_error:
        payload["vlm_error"] = vlm_error

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
