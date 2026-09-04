#!/usr/bin/env python3
"""Pose y acciones (YOLOv8n-pose) + descripción VLM (Moondream) por pista.

YOLO-pose da keypoints y postura geométrica; la IA describe la acción
en el crop de la persona. Si el VLM falla, queda la geometría.
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

MODEL_NAME = os.environ.get("POSE_MODEL", "yolov8n-pose.pt")
MAX_FRAMES = int(os.environ.get("POSE_MAX_FRAMES", "16"))
CONF = float(os.environ.get("YOLO_CONF", os.environ.get("POSE_CONF", "0.35")))
VLM_ENABLED = os.environ.get("POSE_VLM", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
VISION_MODEL = os.environ.get("VISION_MODEL", "vikhyatk/moondream2")
VISION_REVISION = os.environ.get("VISION_MODEL_REVISION", "2025-01-09")

# COCO pose: 0 nose, 5/6 shoulders, 9/10 wrists, 11/12 hips, 15/16 ankles
NOSE, L_SH, R_SH, L_WR, R_WR, L_HIP, R_HIP, L_ANK, R_ANK = 0, 5, 6, 9, 10, 11, 12, 15, 16

DESCRIBE_PROMPT = (
    "In one short sentence, describe what this person is doing and how they stand "
    "or move: posture, gestures, hands, gaze if clear, and interaction with objects. "
    "Be concrete. Do not invent things that are not visible."
)


def kp(row, idx: int):
    if row is None or idx >= len(row):
        return None
    x, y, c = float(row[idx][0]), float(row[idx][1]), float(row[idx][2])
    if c < 0.25:
        return None
    return x, y


def mid(a, b):
    if a is None or b is None:
        return None
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def label_pose(kpts) -> tuple[str, list[str]]:
    """Devuelve (postura principal, pistas de acción geométricas)."""
    nose = kp(kpts, NOSE)
    l_sh, r_sh = kp(kpts, L_SH), kp(kpts, R_SH)
    l_wr, r_wr = kp(kpts, L_WR), kp(kpts, R_WR)
    l_hip, r_hip = kp(kpts, L_HIP), kp(kpts, R_HIP)
    l_ank, r_ank = kp(kpts, L_ANK), kp(kpts, R_ANK)
    shoulder = mid(l_sh, r_sh)
    hip = mid(l_hip, r_hip)
    ankle = mid(l_ank, r_ank)

    hints: list[str] = []
    posture = "persona"

    if shoulder and hip:
        torso = abs(hip[1] - shoulder[1])
        if ankle and torso > 1:
            leg = abs(ankle[1] - hip[1])
            posture = "sentado / agachado" if leg < torso * 0.85 else "de pie"
        else:
            posture = "de pie" if torso > 20 else "persona"

    up = 0
    if l_wr and l_sh and l_wr[1] < l_sh[1] - 12:
        up += 1
    if r_wr and r_sh and r_wr[1] < r_sh[1] - 12:
        up += 1
    if up == 2:
        hints.append("ambos brazos arriba")
    elif up == 1:
        hints.append("un brazo arriba")

    if nose and (
        (l_wr and abs(l_wr[1] - nose[1]) < 35 and abs(l_wr[0] - nose[0]) < 45)
        or (r_wr and abs(r_wr[1] - nose[1]) < 35 and abs(r_wr[0] - nose[0]) < 45)
    ):
        hints.append("mano cerca de la cara")

    if l_ank and r_ank:
        if abs(l_ank[0] - r_ank[0]) > 28 and abs(l_ank[1] - r_ank[1]) > 8:
            hints.append("posible caminar / paso")

    return posture, hints


def track_key(cx: float, cy: float) -> str:
    return f"person:{int(cx // 90)}:{int(cy // 90)}"


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


def crop_box(image: Image.Image, bbox: list[float], pad: float = 0.1) -> Image.Image | None:
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
        print("usage: from_video_pose.py <frames_manifest.json> <out.json>", file=sys.stderr)
        return 2

    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_path = Path(sys.argv[2])
    frames = (manifest.get("frames") or [])[:MAX_FRAMES]

    if not frames:
        out_path.write_text(
            json.dumps(
                {
                    "engine": "yolov8n-pose",
                    "model": MODEL_NAME,
                    "frame_count": 0,
                    "items": [],
                    "error": "No hay frames para pose",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return 0

    model = YOLO(MODEL_NAME)
    detections: list[dict] = []
    buckets: dict[str, list[dict]] = defaultdict(list)
    best_crop: dict[str, dict] = {}
    posture_counts: dict[str, int] = defaultdict(int)

    for frame in frames:
        path = frame.get("path")
        if not path or not Path(path).exists():
            continue
        start_ms = int(frame.get("start_ms") or 0)
        end_ms = int(frame.get("end_ms") or start_ms)
        result = model.predict(source=path, conf=CONF, verbose=False)[0]
        if result.boxes is None or result.keypoints is None:
            continue
        boxes = result.boxes
        kps = result.keypoints
        xy = kps.xy.cpu().numpy() if hasattr(kps.xy, "cpu") else kps.xy
        confs = (
            kps.conf.cpu().numpy()
            if kps.conf is not None and hasattr(kps.conf, "cpu")
            else None
        )

        for i in range(len(boxes)):
            xyxy = [round(float(x), 1) for x in boxes.xyxy[i].tolist()]
            conf = float(boxes.conf[i].item()) if boxes.conf is not None else 0.0
            row_xy = xy[i]
            if confs is not None:
                row = [
                    [float(row_xy[j][0]), float(row_xy[j][1]), float(confs[i][j])]
                    for j in range(len(row_xy))
                ]
            else:
                row = [
                    [float(row_xy[j][0]), float(row_xy[j][1]), 1.0]
                    for j in range(len(row_xy))
                ]

            posture, hints = label_pose(row)
            posture_counts[posture] += 1
            cx = (xyxy[0] + xyxy[2]) / 2
            cy = (xyxy[1] + xyxy[3]) / 2
            key = track_key(cx, cy)
            bits = [posture] + hints
            det = {
                "track_key": key,
                "bbox": xyxy,
                "conf": round(conf, 3),
                "posture": posture,
                "action_hints": hints,
                "keypoints": [
                    [round(a, 1), round(b, 1), round(c, 3)] for a, b, c in row
                ],
                "start_ms": start_ms,
                "end_ms": end_ms,
                "text": " · ".join(bits),
                "frame_path": path,
            }
            detections.append(det)
            buckets[key].append(det)
            prev = best_crop.get(key)
            if prev is None or conf > prev["conf"]:
                best_crop[key] = det

    tracks: list[dict] = []
    for key, rows in buckets.items():
        postures = [r["posture"] for r in rows]
        dominant = max(set(postures), key=postures.count)
        hints = sorted({h for r in rows for h in r["action_hints"]})
        tracks.append(
            {
                "id": key,
                "count": len(rows),
                "start_ms": min(r["start_ms"] for r in rows),
                "end_ms": max(r["end_ms"] for r in rows),
                "dominant_posture": dominant,
                "action_hints": hints,
                "avg_conf": round(sum(r["conf"] for r in rows) / len(rows), 3),
                "description": None,
            }
        )
    tracks.sort(key=lambda t: (-t["count"], t["id"]))

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
                crop = crop_box(image_cache[fpath], tip["bbox"])
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
            text = f"{t['dominant_posture']}: {t['description']}"
        else:
            text = " · ".join(
                [t["dominant_posture"], f"{t['count']} frames"] + t["action_hints"][:3]
            )
        items.append(
            {
                "start_ms": t["start_ms"],
                "end_ms": t["end_ms"],
                "label": t["dominant_posture"],
                "role": "pose",
                "text": text,
                "description": t.get("description"),
            }
        )

    # Filas densas por frame (geometría; útiles para timeline)
    for d in detections:
        items.append(
            {
                "start_ms": d["start_ms"],
                "end_ms": d["end_ms"],
                "label": d["posture"],
                "role": "pose_frame",
                "text": d["text"],
            }
        )

    clean_dets = [{k: v for k, v in d.items() if k != "frame_path"} for d in detections]

    engine = "yolov8n-pose+moondream2" if vlm_used else "yolov8n-pose"
    payload = {
        "engine": engine,
        "model": MODEL_NAME,
        "vision_model": VISION_MODEL if vlm_used else None,
        "frame_count": len(frames),
        "vlm_described": vlm_used,
        "profile": {
            "person_detections": len(detections),
            "tracks": len(tracks),
            "posture_counts": dict(
                sorted(posture_counts.items(), key=lambda x: (-x[1], x[0]))
            ),
        },
        "tracks": tracks,
        "detections": clean_dets,
        "items": items,
    }
    if vlm_error:
        payload["vlm_error"] = vlm_error
    if not detections:
        payload["error"] = "Sin poses de persona en los fotogramas muestreados"

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
