#!/usr/bin/env python3
"""Brief de recreación con IA (Moondream).

Entrada:
  facts.json          → hechos ya extraídos (habla, objetos, etc.)
  frames_manifest.json → fotogramas clave (opcional)

La IA mira los fotogramas y escribe notas de recreación.
Los hechos de audio/CV se inyectan en el prompt (no se reinventan).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from PIL import Image

MODEL_ID = os.environ.get("VISION_MODEL", "vikhyatk/moondream2")
MODEL_REVISION = os.environ.get("VISION_MODEL_REVISION", "2025-01-09")
MAX_FRAMES = int(os.environ.get("AI_BRIEF_MAX_FRAMES", "4"))

QUERIES = {
    "recreation": (
        "Write a concrete recreation brief for this shot: camera distance and angle, "
        "who/what is in frame, lighting, action, and emotion. Be specific and practical."
    ),
    "continuity": (
        "List what must stay consistent to recreate this scene "
        "(wardrobe, props, lighting direction, camera height)."
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
            return (ans.get("answer") if isinstance(ans, dict) else str(ans) or "").strip()
        if hasattr(model, "answer_question"):
            return str(model.answer_question(encoded, prompt)).strip()
    except Exception:
        return ""
    return ""


def facts_digest(facts: dict) -> str:
    """Resumen corto de hechos medidos (para anclar al VLM, sin inventar)."""
    bits: list[str] = []
    media = facts.get("media") or {}
    if media.get("filename"):
        bits.append(f"clip={media['filename']}")
    speakers = facts.get("speakers") or {}
    dialogue = speakers.get("dialogue") or []
    if dialogue:
        lines = []
        for turn in dialogue[:10]:
            spk = turn.get("speaker") or "?"
            text = (turn.get("text") or "").strip()
            if text:
                lines.append(f"{spk}: {text}")
        if lines:
            bits.append("dialogue: " + " | ".join(lines))
    for key, label in (
        ("objects", "objects"),
        ("faces", "faces"),
        ("pose", "pose"),
        ("camera", "camera"),
        ("visual", "visual"),
        ("audio", "audio"),
        ("on_screen_text", "ocr"),
    ):
        block = facts.get(key) or {}
        summary = block.get("summary")
        if summary:
            bits.append(f"{label}: {summary}")
        texts = block.get("texts") or block.get("observations") or []
        if texts:
            bits.append(f"{label}_detail: " + " / ".join(str(t) for t in texts[:3]))
    return "\n".join(bits)[:1800]


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "usage: from_video_ai_brief.py <facts.json> <out.json> [frames_manifest.json]",
            file=sys.stderr,
        )
        return 2

    facts = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_path = Path(sys.argv[2])
    frames_path = Path(sys.argv[3]) if len(sys.argv) > 3 else None

    digest = facts_digest(facts)
    frames = []
    if frames_path and frames_path.exists():
        frames = (json.loads(frames_path.read_text(encoding="utf-8")).get("frames") or [])[
            :MAX_FRAMES
        ]

    items: list[dict] = []
    if digest:
        items.append(
            {
                "start_ms": 0,
                "end_ms": 0,
                "label": "hechos",
                "role": "ai_brief",
                "text": "Hechos medidos:\n" + digest,
            }
        )

    device = "cpu"
    vlm_error = None
    frame_notes: list[dict] = []

    if frames:
        try:
            model, device = load_model()
            context_prefix = (
                "Measured facts from this video (trust these; do not invent speakers/text):\n"
                f"{digest}\n\n"
                if digest
                else ""
            )
            for frame in frames:
                path = frame.get("path")
                if not path or not Path(path).exists():
                    continue
                image = Image.open(path).convert("RGB")
                image.thumbnail((768, 768))
                encoded = model.encode_image(image)
                answers = {
                    key: ask(model, encoded, context_prefix + prompt) or None
                    for key, prompt in QUERIES.items()
                }
                start_ms = int(frame.get("start_ms") or 0)
                end_ms = int(frame.get("end_ms") or 0)
                note = {
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "answers": answers,
                }
                frame_notes.append(note)
                if answers.get("recreation"):
                    items.append(
                        {
                            "start_ms": start_ms,
                            "end_ms": end_ms,
                            "label": "recrear",
                            "role": "ai_brief",
                            "text": answers["recreation"],
                        }
                    )
                if answers.get("continuity"):
                    items.append(
                        {
                            "start_ms": start_ms,
                            "end_ms": end_ms,
                            "label": "continuidad",
                            "role": "ai_brief",
                            "text": answers["continuity"],
                        }
                    )
        except Exception as exc:  # noqa: BLE001
            vlm_error = str(exc)

    payload = {
        "engine": "moondream2" if frame_notes else "facts-only",
        "model": MODEL_ID if frame_notes else None,
        "device": device,
        "facts_digest": digest or None,
        "frame_notes": frame_notes,
        "items": items,
    }
    if vlm_error:
        payload["error"] = vlm_error

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if items else 1


if __name__ == "__main__":
    raise SystemExit(main())
