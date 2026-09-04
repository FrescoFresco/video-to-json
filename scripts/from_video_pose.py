#!/usr/bin/env python3
"""Pose y acciones aproximadas (YOLOv8n-pose, local).

Extrae keypoints de personas y etiqueta posturas/acciones simples
(de pie, sentado, brazos arriba, caminando…) según geometría.
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

from ultralytics import YOLO

MODEL_NAME = os.environ.get("POSE_MODEL", "yolov8n-pose.pt")
MAX_FRAMES = int(os.environ.get("POSE_MAX_FRAMES", "16"))
CONF = float(os.environ.get("YOLO_CONF", os.environ.get("POSE_CONF", "0.35")))

# COCO pose: 0 nose, 5/6 shoulders, 9/10 wrists, 11/12 hips, 15/16 ankles
NOSE, L_SH, R_SH, L_WR, R_WR, L_HIP, R_HIP, L_ANK, R_ANK = 0, 5, 6, 9, 10, 11, 12, 15, 16


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
    """Devuelve (postura principal, pistas de acción)."""
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
        # Sentado: cadera relativamente alta vs tobillos / torso corto respecto piernas
        if ankle and torso > 1:
            leg = abs(ankle[1] - hip[1])
            if leg < torso * 0.85:
                posture = "sentado / agachado"
            else:
                posture = "de pie"
        else:
            posture = "de pie" if torso > 20 else "persona"

    # Brazos arriba: muñecas por encima de hombros
    up = 0
    if l_wr and l_sh and l_wr[1] < l_sh[1] - 12:
        up += 1
    if r_wr and r_sh and r_wr[1] < r_sh[1] - 12:
        up += 1
    if up == 2:
        hints.append("ambos brazos arriba")
    elif up == 1:
        hints.append("un brazo arriba")

    # Gesto cerca de la cara
    if nose and ((l_wr and abs(l_wr[1] - nose[1]) < 35 and abs(l_wr[0] - nose[0]) < 45) or (
        r_wr and abs(r_wr[1] - nose[1]) < 35 and abs(r_wr[0] - nose[0]) < 45
    )):
        hints.append("mano cerca de la cara")

    # Caminando aproximado: tobillos a distinta altura/x
    if l_ank and r_ank:
        if abs(l_ank[0] - r_ank[0]) > 28 and abs(l_ank[1] - r_ank[1]) > 8:
            hints.append("posible caminar / paso")

    return posture, hints


def track_key(label: str, cx: float, cy: float) -> str:
    return f"{label}:{int(cx // 90)}:{int(cy // 90)}"


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
        confs = kps.conf.cpu().numpy() if kps.conf is not None and hasattr(kps.conf, "cpu") else None

        for i in range(len(boxes)):
            xyxy = [round(float(x), 1) for x in boxes.xyxy[i].tolist()]
            conf = float(boxes.conf[i].item()) if boxes.conf is not None else 0.0
            # keypoints row: N×(x,y) + conf
            row_xy = xy[i]
            if confs is not None:
                row = [[float(row_xy[j][0]), float(row_xy[j][1]), float(confs[i][j])] for j in range(len(row_xy))]
            else:
                row = [[float(row_xy[j][0]), float(row_xy[j][1]), 1.0] for j in range(len(row_xy))]

            posture, hints = label_pose(row)
            posture_counts[posture] += 1
            cx = (xyxy[0] + xyxy[2]) / 2
            cy = (xyxy[1] + xyxy[3]) / 2
            key = track_key("person", cx, cy)
            bits = [posture] + hints
            text = " · ".join(bits)
            det = {
                "track_key": key,
                "bbox": xyxy,
                "conf": round(conf, 3),
                "posture": posture,
                "action_hints": hints,
                "keypoints": [[round(a, 1), round(b, 1), round(c, 3)] for a, b, c in row],
                "start_ms": start_ms,
                "end_ms": end_ms,
                "text": text,
            }
            detections.append(det)
            buckets[key].append(det)

    tracks = []
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
            }
        )
    tracks.sort(key=lambda t: (-t["count"], t["id"]))

    items = [
        {
            "start_ms": t["start_ms"],
            "end_ms": t["end_ms"],
            "label": t["dominant_posture"],
            "role": "pose",
            "text": " · ".join(
                [t["dominant_posture"], f"{t['count']} frames"]
                + t["action_hints"][:3]
            ),
        }
        for t in tracks
    ]
    # También filas densas por frame (útiles para recreación)
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

    payload = {
        "engine": "yolov8n-pose",
        "model": MODEL_NAME,
        "frame_count": len(frames),
        "profile": {
            "person_detections": len(detections),
            "tracks": len(tracks),
            "posture_counts": dict(sorted(posture_counts.items(), key=lambda x: (-x[1], x[0]))),
        },
        "tracks": tracks,
        "detections": detections,
        "items": items,
    }
    if not detections:
        payload["error"] = "Sin poses de persona en los fotogramas muestreados"

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
