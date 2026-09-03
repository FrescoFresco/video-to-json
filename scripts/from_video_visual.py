#!/usr/bin/env python3
"""Observación visual de fotogramas con Moondream2 (VLM ligero).

Describe qué se ve: escena, personas, objetos y acciones.
Si falla, escribe error claro — no inventa.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from PIL import Image

MODEL_ID = os.environ.get("VISION_MODEL", "vikhyatk/moondream2")
MODEL_REVISION = os.environ.get("VISION_MODEL_REVISION", "2025-01-09")
MAX_FRAMES = int(os.environ.get("VISION_MAX_FRAMES", "6"))

PROMPT = (
    "Describe this video frame in detail. Mention the setting, people, objects, "
    "text if any, actions, mood and anything notable. Be concrete, not vague."
)


def load_model():
    import torch
    from transformers import AutoModelForCausalLM

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        revision=MODEL_REVISION,
        trust_remote_code=True,
        torch_dtype=torch.float32 if device == "cpu" else torch.float16,
        device_map={"": device},
    )
    model.eval()
    return model, device


def observe_image(model, image: Image.Image) -> dict:
    encoded = model.encode_image(image)

    caption = ""
    try:
        cap = model.caption(encoded, length="normal")
        if isinstance(cap, dict):
            caption = (cap.get("caption") or "").strip()
        else:
            caption = str(cap).strip()
    except Exception:
        caption = ""

    detail = ""
    try:
        if hasattr(model, "query"):
            ans = model.query(encoded, PROMPT)
            if isinstance(ans, dict):
                detail = (ans.get("answer") or "").strip()
            else:
                detail = str(ans).strip()
        elif hasattr(model, "answer_question"):
            detail = str(model.answer_question(encoded, PROMPT)).strip()
    except Exception as exc:
        if not caption:
            raise RuntimeError(f"VLM no pudo observar el frame: {exc}") from exc

    text = detail or caption
    if not text:
        raise RuntimeError("VLM devolvió una descripción vacía")

    return {
        "caption": caption or None,
        "observation": detail or caption,
        "text": text,
    }


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: from_video_visual.py <frames_manifest.json> <out.json>", file=sys.stderr)
        return 2

    manifest_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    frames = (data.get("frames") or [])[:MAX_FRAMES]

    if not frames:
        out_path.write_text(
            json.dumps(
                {
                    "engine": "moondream2",
                    "model": MODEL_ID,
                    "frame_count": 0,
                    "items": [],
                    "error": "No hay frames para observar",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return 0

    model, device = load_model()
    items = []
    errors = []

    for frame in frames:
        path = frame.get("path")
        if not path or not Path(path).exists():
            errors.append(f"Frame ausente: {path}")
            continue
        try:
            image = Image.open(path).convert("RGB")
            image.thumbnail((768, 768))
            obs = observe_image(model, image)
            items.append(
                {
                    "start_ms": int(frame.get("start_ms") or 0),
                    "end_ms": int(frame.get("end_ms") or 0),
                    "text": obs["text"],
                    "caption": obs.get("caption"),
                    "observation": obs.get("observation"),
                    "role": "visual_observation",
                }
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{path}: {exc}")

    payload = {
        "engine": "moondream2",
        "model": MODEL_ID,
        "revision": MODEL_REVISION,
        "device": device,
        "frame_count": len(frames),
        "items": items,
    }
    if errors and not items:
        payload["error"] = "; ".join(errors[:3])
    elif errors:
        payload["warnings"] = errors[:5]

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if items else 1


if __name__ == "__main__":
    raise SystemExit(main())
