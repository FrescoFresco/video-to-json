#!/usr/bin/env python3
"""Movimiento de cámara local (OpenCV): estático, paneo, zoom.

Analiza flujo óptico entre fotogramas muestreados. No inventa encuadres narrativos.
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter

import cv2
import numpy as np


def sample_times_ms(duration_ms: int, max_frames: int = 48) -> list[int]:
    if duration_ms <= 0:
        return [0]
    n = max(2, min(max_frames, max(2, duration_ms // 400)))
    if duration_ms < 800:
        return [0, max(0, duration_ms - 1)]
    step = duration_ms / (n - 1)
    return [int(round(i * step)) for i in range(n)]


def read_gray_at(cap: cv2.VideoCapture, t_ms: int, width: int = 320) -> np.ndarray | None:
    cap.set(cv2.CAP_PROP_POS_MSEC, float(max(0, t_ms)))
    ok, frame = cap.read()
    if not ok or frame is None:
        return None
    h, w = frame.shape[:2]
    if w <= 0:
        return None
    scale = width / float(w)
    small = cv2.resize(frame, (width, max(1, int(round(h * scale)))), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)


def classify_flow(flow: np.ndarray) -> tuple[str, dict]:
    """Devuelve etiqueta + métricas a partir del flujo Farneback."""
    fx = flow[..., 0]
    fy = flow[..., 1]
    mag = np.sqrt(fx * fx + fy * fy)
    mean_mag = float(np.mean(mag))
    median_mag = float(np.median(mag))

    h, w = fx.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    dx = xx - cx
    dy = yy - cy
    rad = np.sqrt(dx * dx + dy * dy)
    rad = np.maximum(rad, 1e-3)
    # Componente radial: positiva = alejándose del centro (zoom out aparente / cámara acercándose al sujeto)
    ux, uy = dx / rad, dy / rad
    radial = fx * ux + fy * uy
    mean_radial = float(np.mean(radial))

    mean_fx = float(np.mean(fx))
    mean_fy = float(np.mean(fy))
    trans = math.hypot(mean_fx, mean_fy)

    # Umbrales en px/frame a resolución 320 (empíricos, conservadores)
    if mean_mag < 0.35 and median_mag < 0.28:
        label = "cámara estática"
    elif abs(mean_radial) > 0.22 and abs(mean_radial) > 0.55 * max(trans, 1e-3):
        label = "zoom in" if mean_radial < 0 else "zoom out"
    elif trans >= 0.45:
        # Dirección dominante
        ang = math.degrees(math.atan2(mean_fy, mean_fx))
        if abs(mean_fx) >= abs(mean_fy):
            label = "paneo derecha" if mean_fx > 0 else "paneo izquierda"
        else:
            label = "tilt abajo" if mean_fy > 0 else "tilt arriba"
        # Si el ángulo no es claro, etiqueta genérica
        if abs(abs(ang) - 45) < 12 and abs(mean_fx) > 0.2 and abs(mean_fy) > 0.2:
            label = "paneo / movimiento de cámara"
    elif mean_mag >= 0.55:
        label = "movimiento de cámara / trepidación"
    else:
        label = "cámara casi estática"

    return label, {
        "mean_mag": round(mean_mag, 4),
        "median_mag": round(median_mag, 4),
        "mean_fx": round(mean_fx, 4),
        "mean_fy": round(mean_fy, 4),
        "mean_radial": round(mean_radial, 4),
        "translation": round(trans, 4),
    }


def merge_segments(raw: list[dict]) -> list[dict]:
    if not raw:
        return []
    merged: list[dict] = []
    cur = dict(raw[0])
    for nxt in raw[1:]:
        if nxt["label"] == cur["label"] and nxt["start_ms"] <= cur["end_ms"] + 50:
            cur["end_ms"] = nxt["end_ms"]
            # promediar métricas ligeras
            for k in ("mean_mag", "translation", "mean_radial"):
                if k in cur and k in nxt:
                    cur[k] = round((float(cur[k]) + float(nxt[k])) / 2.0, 4)
        else:
            merged.append(cur)
            cur = dict(nxt)
    merged.append(cur)
    return merged


def analyze(video_path: str, max_frames: int = 48) -> dict:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {
            "engine": "opencv-farneback",
            "error": "No se pudo abrir el vídeo",
            "segments": [],
            "items": [],
            "profile": {"overall": "Error al abrir vídeo"},
        }

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0) or 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_ms = int(round(1000.0 * frame_count / fps)) if frame_count > 0 else 0
    if duration_ms <= 0:
        # fallback: leer hasta el final
        duration_ms = 10000

    times = sample_times_ms(duration_ms, max_frames=max_frames)
    grays: list[tuple[int, np.ndarray]] = []
    for t in times:
        g = read_gray_at(cap, t)
        if g is not None:
            grays.append((t, g))
    cap.release()

    if len(grays) < 2:
        return {
            "engine": "opencv-farneback",
            "duration_ms": duration_ms,
            "fps": fps,
            "frame_samples": len(grays),
            "segments": [],
            "items": [],
            "profile": {"overall": "Pocos fotogramas para analizar cámara"},
        }

    raw_segments: list[dict] = []
    for i in range(len(grays) - 1):
        t0, g0 = grays[i]
        t1, g1 = grays[i + 1]
        flow = cv2.calcOpticalFlowFarneback(
            g0, g1, None, 0.5, 3, 15, 3, 5, 1.2, 0
        )
        label, metrics = classify_flow(flow)
        seg = {
            "start_ms": t0,
            "end_ms": t1,
            "label": label,
            **metrics,
        }
        raw_segments.append(seg)

    segments = merge_segments(raw_segments)
    items = [
        {
            "start_ms": s["start_ms"],
            "end_ms": s["end_ms"],
            "label": s["label"],
            "text": s["label"],
        }
        for s in segments
    ]

    counts = Counter(s["label"] for s in segments)
    top = counts.most_common(3)
    overall = ", ".join(f"{n}× {lab}" for lab, n in top) if top else "Sin datos"
    dominant = top[0][0] if top else "desconocido"

    return {
        "engine": "opencv-farneback",
        "duration_ms": duration_ms,
        "fps": round(fps, 3),
        "frame_samples": len(grays),
        "segments": segments,
        "items": items,
        "profile": {
            "overall": overall,
            "dominant": dominant,
            "unique_motions": len(counts),
        },
    }


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: from_video_camera.py <video> <out.json> [max_frames]", file=sys.stderr)
        return 2
    video_path, out_json = sys.argv[1], sys.argv[2]
    max_frames = int(sys.argv[3]) if len(sys.argv) > 3 else 48
    try:
        result = analyze(video_path, max_frames=max_frames)
    except Exception as exc:
        result = {
            "engine": "opencv-farneback",
            "error": str(exc),
            "segments": [],
            "items": [],
            "profile": {"overall": "Error al analizar cámara"},
        }
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return 0 if "error" not in result else 1


if __name__ == "__main__":
    raise SystemExit(main())
