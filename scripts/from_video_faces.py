#!/usr/bin/env python3
"""Caras y encuadre (OpenCV FaceDetectorYN / YuNet, local).

Detecta rostros en fotogramas densos y estima escala de plano
(primerísimo / primer plano / medio / general) según el área de la cara.
Heurística ligera de boca; no inventa emociones finas.
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

MAX_FRAMES = int(os.environ.get("FACES_MAX_FRAMES", "16"))
SCORE_TH = float(os.environ.get("FACES_SCORE", "0.6"))
NMS_TH = float(os.environ.get("FACES_NMS", "0.3"))

YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
YUNET_NAME = "face_detection_yunet_2023mar.onnx"


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


def expression_hint(gray: np.ndarray, x: int, y: int, w: int, h: int) -> str | None:
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
        # x, y, w, h, score, ...landmarks
        x, y, fw, fh, score = [float(v) for v in row[:5]]
        if score < SCORE_TH:
            continue
        out.append((int(x), int(y), int(fw), int(fh), float(score)))
    return out


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
            expr = expression_hint(gray, fx, fy, fw, fh)
            bits = [f"cara {i + 1}", scale, f"pos ({cx:.2f},{cy:.2f})", f"conf {score:.2f}"]
            if expr:
                bits.append(expr)
            detections.append(
                {
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
                }
            )

    items = [
        {
            "start_ms": d["start_ms"],
            "end_ms": d["end_ms"],
            "label": d["shot_scale"],
            "role": "face",
            "text": d["text"],
        }
        for d in detections
    ]
    dominant = sorted(scale_counts.items(), key=lambda x: (-x[1], x[0]))
    profile = {
        "face_detections": len(detections),
        "frames_with_faces": len({d["start_ms"] for d in detections}),
        "shot_scale_counts": dict(dominant),
        "dominant_shot": dominant[0][0] if dominant else None,
    }
    payload = {
        "engine": "opencv-yunet",
        "model": YUNET_NAME,
        "frame_count": len(frames),
        "profile": profile,
        "detections": detections,
        "items": items,
    }
    if not detections:
        payload["error"] = "Sin caras detectadas en los fotogramas muestreados"

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
