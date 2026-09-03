#!/usr/bin/env python3
"""On-screen text from video frames. RapidOCR (PP-OCR ONNX) on CPU."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def role_for(text: str) -> str:
    compact = re.sub(r"[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]", "", text)
    if 2 <= len(compact) <= 16 and compact.isupper():
        return "logo"
    if len(text) <= 48:
        return "overlay"
    return "caption"


def flatten_box(box) -> list[float]:
    out: list[float] = []
    for pt in box:
        out.extend([round(float(pt[0]), 1), round(float(pt[1]), 1)])
    return out


def main():
    manifest_path = sys.argv[1]
    out_path = sys.argv[2]
    data = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    frames = data.get("frames") or []
    ocr = RapidOCR()
    raw = []
    for frame in frames:
        path = frame["path"]
        if not Path(path).exists():
            continue
        result, _elapsed = ocr(path)
        if not result:
            continue
        for item in result:
            box, text, score = item[0], item[1], float(item[2])
            text = (text or "").strip()
            if not text or score < 0.45:
                continue
            raw.append(
                {
                    "text": text,
                    "norm": norm(text),
                    "conf": round(score, 3),
                    "bbox": flatten_box(box),
                    "start_ms": int(frame["start_ms"]),
                    "end_ms": int(frame["end_ms"]),
                }
            )

    merged: list[dict] = []
    for row in raw:
        prev = merged[-1] if merged else None
        if prev and prev["norm"] == row["norm"] and row["start_ms"] <= prev["end_ms"] + 400:
            prev["end_ms"] = max(prev["end_ms"], row["end_ms"])
            prev["conf"] = max(prev["conf"], row["conf"])
            continue
        merged.append(dict(row))

    items = []
    brands = []
    for row in merged:
        rec = {
            "text": row["text"],
            "start_ms": row["start_ms"],
            "end_ms": row["end_ms"],
            "conf": row["conf"],
            "bbox": row["bbox"],
            "role": role_for(row["text"]),
        }
        items.append(rec)
        if rec["role"] == "logo" and rec["text"] not in brands:
            brands.append(rec["text"])

    Path(out_path).write_text(
        json.dumps(
            {
                "engine": "rapidocr-onnxruntime",
                "backend": "ppocr-onnx",
                "swap_in": "https://github.com/PaddlePaddle/PaddleOCR",
                "frame_count": len(frames),
                "items": [{k: v for k, v in it.items()} for it in items],
                "brands": brands,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
