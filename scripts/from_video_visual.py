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
MAX_FRAMES = int(os.environ.get("VISION_MAX_FRAMES", "8"))

PROMPT = (
    "Describe this video frame in detail. Mention the setting, people, objects, "
    "text if any, actions, mood and anything notable. Be concrete, not vague."
)

# Preguntas extra para densificar el dossier de recreación (misma carga del modelo).
RECREATION_QUERIES = {
    "setting": (
        "Where is this scene? Describe the place, background, indoor/outdoor, "
        "furniture, architecture and lighting. Be specific."
    ),
    "people_actions": (
        "What are the people doing? Describe body posture, gestures, gaze direction, "
        "interactions and movement. If nobody, say so."
    ),
    "faces_emotion": (
        "Describe visible faces: expression, emotion, gaze, age range if clear, "
        "and how close the face is in the frame. If no face, say so."
    ),
    "camera_angle": (
        "Describe the camera: angle (eye-level, high, low), distance "
        "(close-up, medium, wide), movement feel, and composition."
    ),
    "mood": (
        "What is the mood and cinematic feel? Lighting quality, color tone, "
        "energy level, and anything useful to recreate the shot."
    ),
    "recreate": (
        "In 3 short bullet-like sentences, say how to recreate this exact shot: "
        "who/what to place, how to frame, and what action or emotion to hit."
    ),
}


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


def ask(model, encoded, prompt: str) -> str:
    try:
        if hasattr(model, "query"):
            ans = model.query(encoded, prompt)
            if isinstance(ans, dict):
                return (ans.get("answer") or "").strip()
            return str(ans).strip()
        if hasattr(model, "answer_question"):
            return str(model.answer_question(encoded, prompt)).strip()
    except Exception:
        return ""
    return ""


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

    detail = ask(model, encoded, PROMPT)
    if not detail and not caption:
        raise RuntimeError("VLM no pudo observar el frame")

    recreation = {key: ask(model, encoded, q) or None for key, q in RECREATION_QUERIES.items()}

    text = detail or caption
    # Empaqueta pistas de recreación en el texto principal si aportan algo nuevo
    extras = []
    for key, label in (
        ("setting", "Lugar"),
        ("people_actions", "Acciones"),
        ("faces_emotion", "Caras/emoción"),
        ("camera_angle", "Cámara"),
        ("mood", "Ambiente"),
        ("recreate", "Recrear"),
    ):
        val = recreation.get(key)
        if val and val.lower() not in text.lower():
            extras.append(f"{label}: {val}")
    if extras:
        text = text + "\n" + "\n".join(extras)

    return {
        "caption": caption or None,
        "observation": detail or caption,
        "recreation": recreation,
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
                    "recreation": obs.get("recreation"),
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
