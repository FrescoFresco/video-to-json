#!/usr/bin/env python3
"""Texto en pantalla: RapidOCR + roles espaciales + contexto VLM (Moondream).

OCR localiza el texto; la geometría del bbox clasifica el rol
(título, subtítulo, watermark, CTA…); Moondream describe el crop
para recreación. Si el VLM falla, quedan OCR + rol geométrico.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from PIL import Image
from rapidocr_onnxruntime import RapidOCR

VLM_ENABLED = os.environ.get("OCR_VLM", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
VISION_MODEL = os.environ.get("VISION_MODEL", "vikhyatk/moondream2")
VISION_REVISION = os.environ.get("VISION_MODEL_REVISION", "2025-01-09")

DESCRIBE_PROMPT = (
    "This crop shows on-screen text from a video. "
    "In one short sentence: what kind of text is it "
    "(title, subtitle, caption, watermark, logo, CTA/button, lower-third, score, other) "
    "and what does it communicate? Be concrete. Do not invent unreadable text."
)

CTA_WORDS = {
    "subscribe",
    "suscríbete",
    "suscribete",
    "follow",
    "sígueme",
    "sigueme",
    "like",
    "compartir",
    "share",
    "buy",
    "comprar",
    "shop",
    "click",
    "haz clic",
    "sign up",
    "registrate",
    "regístrate",
    "download",
    "descargar",
    "watch",
    "ver ahora",
}


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def flatten_box(box) -> list[float]:
    out: list[float] = []
    for pt in box:
        out.extend([round(float(pt[0]), 1), round(float(pt[1]), 1)])
    return out


def box_stats(bbox: list[float], frame_w: int, frame_h: int) -> dict:
    xs = bbox[0::2]
    ys = bbox[1::2]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    return {
        "cx": ((x0 + x1) / 2) / max(frame_w, 1),
        "cy": ((y0 + y1) / 2) / max(frame_h, 1),
        "w_ratio": (x1 - x0) / max(frame_w, 1),
        "h_ratio": (y1 - y0) / max(frame_h, 1),
        "x0": x0,
        "y0": y0,
        "x1": x1,
        "y1": y1,
    }


def classify_role(text: str, stats: dict) -> str:
    """Rol útil para recrear overlays (geometría + tipografía + keywords)."""
    compact = re.sub(r"[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]", "", text)
    lower = text.lower().strip()
    cy = stats["cy"]
    cx = stats["cx"]
    w_ratio = stats["w_ratio"]
    h_ratio = stats["h_ratio"]

    if any(w in lower for w in CTA_WORDS):
        return "cta"

    # Esquinas / bordes → watermark
    near_edge = cx < 0.18 or cx > 0.82 or cy < 0.12 or cy > 0.88
    if near_edge and w_ratio < 0.35 and len(compact) <= 24:
        if compact.isupper() or len(compact) <= 12:
            return "watermark" if cy > 0.75 or cx > 0.7 else "logo"

    # Logo: corto, mayúsculas, no demasiado bajo
    if 2 <= len(compact) <= 16 and compact.isupper() and cy < 0.35 and w_ratio < 0.45:
        return "logo"

    # Lower-third / nombre: franja baja, texto medio
    if 0.62 <= cy <= 0.88 and 0.15 <= w_ratio <= 0.7 and len(text) <= 48:
        return "lower_third"

    # Título: alto, ancho o tipografía grande
    if cy < 0.28 and (w_ratio >= 0.28 or h_ratio >= 0.05) and len(text) <= 80:
        return "title"

    # Subtítulo / caption centrado abajo (tipo subtítulos)
    if cy > 0.78 and 0.2 <= cx <= 0.8 and len(text) <= 100:
        return "subtitle"

    # Marcador / score compacto arriba
    if cy < 0.2 and w_ratio < 0.4 and re.search(r"\d", text) and len(text) <= 24:
        return "score"

    if len(text) <= 48:
        return "overlay"
    return "caption"


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


def crop_text(image: Image.Image, stats: dict, pad: float = 0.12) -> Image.Image | None:
    w, h = image.size
    bw = stats["x1"] - stats["x0"]
    bh = stats["y1"] - stats["y0"]
    x0 = max(0, int(stats["x0"] - bw * pad))
    y0 = max(0, int(stats["y0"] - bh * pad))
    x1 = min(w, int(stats["x1"] + bw * pad))
    y1 = min(h, int(stats["y1"] + bh * pad))
    if x1 - x0 < 8 or y1 - y0 < 8:
        return None
    crop = image.crop((x0, y0, x1, y1))
    crop.thumbnail((384, 384))
    return crop


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: from_video_ocr.py <frames_manifest.json> <out.json>", file=sys.stderr)
        return 2

    manifest_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    frames = data.get("frames") or []
    ocr = RapidOCR()
    raw: list[dict] = []

    for frame in frames:
        path = frame.get("path")
        if not path or not Path(path).exists():
            continue
        try:
            with Image.open(path) as im:
                frame_w, frame_h = im.size
        except Exception:
            frame_w = frame_h = 1
        result, _elapsed = ocr(path)
        if not result:
            continue
        for item in result:
            box, text, score = item[0], item[1], float(item[2])
            text = (text or "").strip()
            if not text or score < 0.42:
                continue
            bbox = flatten_box(box)
            stats = box_stats(bbox, frame_w, frame_h)
            role = classify_role(text, stats)
            raw.append(
                {
                    "text": text,
                    "norm": norm(text),
                    "conf": round(score, 3),
                    "bbox": bbox,
                    "layout": {
                        "cx": round(stats["cx"], 3),
                        "cy": round(stats["cy"], 3),
                        "w_ratio": round(stats["w_ratio"], 3),
                        "h_ratio": round(stats["h_ratio"], 3),
                    },
                    "role": role,
                    "start_ms": int(frame.get("start_ms") or 0),
                    "end_ms": int(frame.get("end_ms") or frame.get("start_ms") or 0),
                    "frame_path": path,
                    "crop_box": [stats["x0"], stats["y0"], stats["x1"], stats["y1"]],
                }
            )

    merged: list[dict] = []
    for row in raw:
        found = None
        for prev in reversed(merged):
            same_text = prev["norm"] == row["norm"]
            same_role = prev["role"] == row["role"]
            close_time = row["start_ms"] <= prev["end_ms"] + 1200
            if same_text and same_role and close_time:
                found = prev
                break
        if found:
            found["end_ms"] = max(found["end_ms"], row["end_ms"])
            found["conf"] = max(found["conf"], row["conf"])
            # conserva el crop con mejor confianza
            if row["conf"] >= found["conf"]:
                found["frame_path"] = row["frame_path"]
                found["crop_box"] = row["crop_box"]
                found["bbox"] = row["bbox"]
                found["layout"] = row["layout"]
            continue
        merged.append(dict(row))

    vlm_error = None
    vlm_used = 0
    if VLM_ENABLED and merged:
        try:
            vlm, _device = load_vlm()
            image_cache: dict[str, Image.Image] = {}
            for row in merged:
                fpath = row.get("frame_path")
                crop_box = row.get("crop_box")
                if not fpath or not crop_box or not Path(fpath).exists():
                    continue
                if fpath not in image_cache:
                    image_cache[fpath] = Image.open(fpath).convert("RGB")
                stats = {
                    "x0": crop_box[0],
                    "y0": crop_box[1],
                    "x1": crop_box[2],
                    "y1": crop_box[3],
                }
                crop = crop_text(image_cache[fpath], stats)
                if crop is None:
                    continue
                desc = describe_crop(vlm, crop)
                if desc:
                    row["description"] = desc
                    vlm_used += 1
        except Exception as exc:  # noqa: BLE001
            vlm_error = str(exc)

    items = []
    brands = []
    role_counts: dict[str, int] = {}
    for row in merged:
        role = row["role"]
        role_counts[role] = role_counts.get(role, 0) + 1
        text_out = row["text"]
        if row.get("description"):
            text_out = f"{row['text']} · {row['description']}"
        rec = {
            "text": text_out,
            "raw_text": row["text"],
            "start_ms": row["start_ms"],
            "end_ms": row["end_ms"],
            "conf": row["conf"],
            "bbox": row["bbox"],
            "layout": row["layout"],
            "role": role,
            "description": row.get("description"),
        }
        items.append(rec)
        if role in ("logo", "watermark") and row["text"] not in brands:
            brands.append(row["text"])

    engine = "rapidocr+moondream2" if vlm_used else "rapidocr-onnxruntime"
    payload = {
        "engine": engine,
        "backend": "ppocr-onnx",
        "repo": "https://github.com/RapidAI/RapidOCR",
        "vision_model": VISION_MODEL if vlm_used else None,
        "frame_count": len(frames),
        "vlm_described": vlm_used,
        "role_counts": dict(sorted(role_counts.items(), key=lambda x: (-x[1], x[0]))),
        "items": items,
        "brands": brands,
    }
    if vlm_error:
        payload["vlm_error"] = vlm_error

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
