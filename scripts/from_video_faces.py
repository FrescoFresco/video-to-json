#!/usr/bin/env python3
"""Caras y encuadre (YuNet) + descripción VLM (Moondream) por pista.

YuNet localiza rostros y escala de plano; la IA describe el crop
(expresión, mirada, pelo/barba/gafas). Si el VLM falla, queda la geometría.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

MAX_FRAMES = int(os.environ.get("FACES_MAX_FRAMES", "16"))
SCORE_TH = float(os.environ.get("FACES_SCORE", "0.6"))
NMS_TH = float(os.environ.get("FACES_NMS", "0.3"))
VLM_ENABLED = os.environ.get("FACES_VLM", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
VISION_MODEL = os.environ.get("VISION_MODEL", "vikhyatk/moondream2")
VISION_REVISION = os.environ.get("VISION_MODEL_REVISION", "2025-01-09")

YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
YUNET_NAME = "face_detection_yunet_2023mar.onnx"

DESCRIBE_PROMPT = (
    "In one short sentence, describe this cropped face for recreating the shot: "
    "expression, gaze direction, approximate age range if clear, hair, facial hair, "
    "glasses or makeup if visible. Do not invent what you cannot see."
)


def resolve_yunet_model() -> Path:
    env = os.environ.get("YUNET_MODEL")
    if env and Path(env).exists():
        return Path(env)
    root = Path(__file__).resolve().parents[1]
    candidates = [
        root / YUNET_NAME,
        root / "models" / YUNET_NAME,
        Path.home() / ".cache" / "vx-studio" / YUNET_NAME,
    ]
    for path in candidates:
        if path.exists():
            return path
    dest = candidates[-1]
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Descargando YuNet → {dest}", file=sys.stderr)
    urllib.request.urlretrieve(YUNET_URL, dest)
    return dest


def shot_scale(face_area: float, frame_area: float) -> str:
    ratio = face_area / max(frame_area, 1.0)
    if ratio >= 0.22:
        return "primerísimo plano"
    if ratio >= 0.10:
        return "primer plano"
    if ratio >= 0.04:
        return "plano medio"
    return "plano general"


def mouth_hint(gray: np.ndarray, x: int, y: int, w: int, h: int) -> str | None:
    if h < 40 or w < 40:
        return None
    mouth = gray[y + int(h * 0.62) : y + int(h * 0.88), x + int(w * 0.25) : x + int(w * 0.75)]
    if mouth.size < 20:
        return None
    std = float(np.std(mouth))
    mean = float(np.mean(mouth))
    if std > 28 and mean < 110:
        return "boca abierta / hablando"
    if std < 12:
        return "boca cerrada / neutra"
    return None


def detect_faces(detector: cv2.FaceDetectorYN, img: np.ndarray):
    h, w = img.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(img)
    if faces is None:
        return []
    out = []
    for row in faces:
        x, y, fw, fh, score = [float(v) for v in row[:5]]
        if score < SCORE_TH:
            continue
        out.append((int(x), int(y), int(fw), int(fh), float(score)))
    return out


def track_key(cx_norm: float, cy_norm: float) -> str:
    return f"face:{int(cx_norm * 10)}:{int(cy_norm * 10)}"


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


def crop_face(image: Image.Image, bbox: list[int], pad: float = 0.25) -> Image.Image | None:
    w, h = image.size
    x1, y1, x2, y2 = bbox
    bw, bh = x2 - x1, y2 - y1
    x1 = max(0, int(x1 - bw * pad))
    y1 = max(0, int(y1 - bh * pad))
    x2 = min(w, int(x2 + bw * pad))
    y2 = min(h, int(y2 + bh * pad))
    if x2 - x1 < 12 or y2 - y1 < 12:
        return None
    crop = image.crop((x1, y1, x2, y2))
    crop.thumbnail((384, 384))
    return crop


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: from_video_faces.py <frames_manifest.json> <out.json>", file=sys.stderr)
        return 2

    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_path = Path(sys.argv[2])
    frames = (manifest.get("frames") or [])[:MAX_FRAMES]

    if not frames:
        out_path.write_text(
            json.dumps(
                {
                    "engine": "opencv-yunet",
                    "frame_count": 0,
                    "items": [],
                    "error": "No hay frames para caras",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return 0

    try:
        model_path = resolve_yunet_model()
        detector = cv2.FaceDetectorYN_create(
            str(model_path), "", (320, 320), SCORE_TH, NMS_TH
        )
    except Exception as exc:  # noqa: BLE001
        out_path.write_text(
            json.dumps(
                {
                    "engine": "opencv-yunet",
                    "frame_count": len(frames),
                    "items": [],
                    "error": f"No se pudo cargar YuNet: {exc}",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return 1

    detections: list[dict] = []
    buckets: dict[str, list[dict]] = defaultdict(list)
    best_crop: dict[str, dict] = {}
    scale_counts: dict[str, int] = defaultdict(int)

    for frame in frames:
        path = frame.get("path")
        if not path or not Path(path).exists():
            continue
        start_ms = int(frame.get("start_ms") or 0)
        end_ms = int(frame.get("end_ms") or start_ms)
        img = cv2.imread(path)
        if img is None:
            continue
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = detect_faces(detector, img)
        for i, (fx, fy, fw, fh, score) in enumerate(faces):
            area = float(max(fw, 1) * max(fh, 1))
            scale = shot_scale(area, float(w * h))
            scale_counts[scale] += 1
            cx = round((fx + fw / 2) / w, 3)
            cy = round((fy + fh / 2) / h, 3)
            expr = mouth_hint(gray, fx, fy, fw, fh)
            key = track_key(cx, cy)
            bits = [f"cara {i + 1}", scale, f"pos ({cx:.2f},{cy:.2f})", f"conf {score:.2f}"]
            if expr:
                bits.append(expr)
            det = {
                "track_key": key,
                "face_index": i + 1,
                "bbox": [fx, fy, fx + fw, fy + fh],
                "center_norm": [cx, cy],
                "area_ratio": round(area / max(w * h, 1), 4),
                "shot_scale": scale,
                "score": round(score, 3),
                "expression_hint": expr,
                "start_ms": start_ms,
                "end_ms": end_ms,
                "text": " · ".join(bits),
                "frame_path": path,
            }
            detections.append(det)
            buckets[key].append(det)
            prev = best_crop.get(key)
            if prev is None or score > prev["score"]:
                best_crop[key] = det

    tracks: list[dict] = []
    for key, rows in buckets.items():
        scales = [r["shot_scale"] for r in rows]
        dominant = max(set(scales), key=scales.count)
        mouths = [r["expression_hint"] for r in rows if r.get("expression_hint")]
        tracks.append(
            {
                "id": key,
                "count": len(rows),
                "start_ms": min(r["start_ms"] for r in rows),
                "end_ms": max(r["end_ms"] for r in rows),
                "dominant_shot": dominant,
                "mouth_hints": sorted(set(mouths)),
                "avg_score": round(sum(r["score"] for r in rows) / len(rows), 3),
                "description": None,
            }
        )
    tracks.sort(key=lambda t: (-t["count"], -t["avg_score"], t["id"]))

    vlm_error = None
    vlm_used = 0
    if VLM_ENABLED and tracks:
        try:
            vlm, _device = load_vlm()
            image_cache: dict[str, Image.Image] = {}
            for track in tracks:
                tip = best_crop.get(track["id"])
                if not tip:
                    continue
                fpath = tip.get("frame_path")
                if not fpath or not Path(fpath).exists():
                    continue
                if fpath not in image_cache:
                    image_cache[fpath] = Image.open(fpath).convert("RGB")
                crop = crop_face(image_cache[fpath], tip["bbox"])
                if crop is None:
                    continue
                desc = describe_crop(vlm, crop)
                if desc:
                    track["description"] = desc
                    vlm_used += 1
        except Exception as exc:  # noqa: BLE001
            vlm_error = str(exc)

    items: list[dict] = []
    for t in tracks:
        if t.get("description"):
            text = f"{t['dominant_shot']}: {t['description']}"
        else:
            bits = [t["dominant_shot"], f"{t['count']} frames"] + t["mouth_hints"][:2]
            text = " · ".join(bits)
        items.append(
            {
                "start_ms": t["start_ms"],
                "end_ms": t["end_ms"],
                "label": t["dominant_shot"],
                "role": "face",
                "text": text,
                "description": t.get("description"),
            }
        )

    for d in detections:
        items.append(
            {
                "start_ms": d["start_ms"],
                "end_ms": d["end_ms"],
                "label": d["shot_scale"],
                "role": "face_frame",
                "text": d["text"],
            }
        )

    clean_dets = [{k: v for k, v in d.items() if k != "frame_path"} for d in detections]
    dominant = sorted(scale_counts.items(), key=lambda x: (-x[1], x[0]))
    profile = {
        "face_detections": len(detections),
        "tracks": len(tracks),
        "frames_with_faces": len({d["start_ms"] for d in detections}),
        "shot_scale_counts": dict(dominant),
        "dominant_shot": dominant[0][0] if dominant else None,
    }

    engine = "opencv-yunet+moondream2" if vlm_used else "opencv-yunet"
    payload = {
        "engine": engine,
        "model": YUNET_NAME,
        "vision_model": VISION_MODEL if vlm_used else None,
        "frame_count": len(frames),
        "vlm_described": vlm_used,
        "profile": profile,
        "tracks": tracks,
        "detections": clean_dets,
        "items": items,
    }
    if vlm_error:
        payload["vlm_error"] = vlm_error
    if not detections:
        payload["error"] = "Sin caras detectadas en los fotogramas muestreados"

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
