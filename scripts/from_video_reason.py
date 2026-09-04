#!/usr/bin/env python3
"""Razonamiento de recreación: une hechos del dossier + VLM en fotogramas clave.

No inventa cifras nuevas: razona sobre lo ya extraído y describe cómo
reconstruir el clip (planos, diálogo, atmósfera, riesgos).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from PIL import Image

MODEL_ID = os.environ.get("VISION_MODEL", "vikhyatk/moondream2")
MODEL_REVISION = os.environ.get("VISION_MODEL_REVISION", "2025-01-09")
MAX_FRAMES = int(os.environ.get("REASON_MAX_FRAMES", "4"))

REASON_QUERIES = {
    "recreation_brief": (
        "You are helping recreate this video shot-for-shot. Given what you see, "
        "write a concrete recreation brief: camera distance, framing, lighting, "
        "people placement, actions, and mood. Be specific and practical."
    ),
    "continuity": (
        "What should stay consistent across shots to recreate this scene? "
        "Mention wardrobe, clothing, props, lighting direction and camera height."
    ),
    "risks": (
        "What is ambiguous or hard to recreate from this frame alone? "
        "List uncertainties (faces, text, motion blur, off-screen audio)."
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


def synthesize_from_facts(facts: dict) -> dict:
    """Razonamiento estructurado local (sin inventar hechos no presentes)."""
    lines: list[str] = []
    media = facts.get("media") or {}
    if media:
        lines.append(
            f"Clip «{media.get('filename') or 'vídeo'}» · "
            f"{media.get('duration_clock') or '?'} · "
            f"{media.get('width')}×{media.get('height')}."
        )

    speakers = facts.get("speakers") or {}
    dialogue = speakers.get("dialogue") or []
    if dialogue:
        lines.append("Guion hablado (por turnos):")
        for turn in dialogue[:24]:
            spk = turn.get("speaker") or "SPEAKER"
            text = (turn.get("text") or "").strip()
            clock = turn.get("clock") or ""
            if text:
                lines.append(f"- [{clock}] {spk}: {text}")
        if len(dialogue) > 24:
            lines.append(f"- … (+{len(dialogue) - 24} turnos)")

    handoffs = speakers.get("handoffs") or []
    if handoffs:
        lines.append(
            f"Ritmo de diálogo: {len(handoffs)} cambios de interlocutor "
            f"(útil para recrear el vaivén)."
        )

    visual = facts.get("visual") or {}
    if visual.get("observations"):
        lines.append("Observación visual clave:")
        for obs in visual["observations"][:4]:
            lines.append(f"- {obs}")

    faces = facts.get("faces") or {}
    if faces.get("summary"):
        lines.append(f"Caras/encuadre: {faces['summary']}")

    pose = facts.get("pose") or {}
    if pose.get("summary"):
        lines.append(f"Pose/acciones: {pose['summary']}")

    objects = facts.get("objects") or {}
    if objects.get("summary"):
        lines.append(f"Objetos/personas: {objects['summary']}")

    camera = facts.get("camera") or {}
    if camera.get("summary"):
        lines.append(f"Cámara: {camera['summary']}")

    audio = facts.get("audio") or {}
    if audio.get("ambiance"):
        lines.append(f"Ambiente sonoro: {audio['ambiance']}")
    if audio.get("events"):
        lines.append(f"Eventos de audio: {audio['events']}")

    ocr = facts.get("on_screen_text") or {}
    if ocr.get("texts"):
        lines.append("Texto en pantalla a respetar: " + " · ".join(ocr["texts"][:6]))

    gaps = []
    if not dialogue:
        gaps.append("sin habla atribuida")
    if not visual.get("observations"):
        gaps.append("poca observación visual")
    if not faces.get("summary"):
        gaps.append("sin caras detectadas")
    if gaps:
        lines.append("Huecos / incertidumbre: " + ", ".join(gaps) + ".")

    plan = [
        "1. Reponer el diálogo por hablante con los tiempos del dossier.",
        "2. Bloquear planos según caras/encuadre y movimiento de cámara.",
        "3. Reponer props y personas detectados; respetar texto en pantalla.",
        "4. Ajustar atmósfera (música/ambiente/eventos de audio).",
        "5. Revisar huecos listados antes de dar por buena la recreación.",
    ]

    return {
        "brief_text": "\n".join(lines),
        "recreation_plan": plan,
        "gaps": gaps,
        "dialogue_turns": len(dialogue),
        "speaker_changes": len(handoffs),
    }


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "usage: from_video_reason.py <facts.json> <out.json> [frames_manifest.json]",
            file=sys.stderr,
        )
        return 2

    facts_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    frames_path = Path(sys.argv[3]) if len(sys.argv) > 3 else None

    facts = json.loads(facts_path.read_text(encoding="utf-8"))
    local = synthesize_from_facts(facts)

    frame_insights: list[dict] = []
    device = "cpu"
    vlm_error = None

    frames = []
    if frames_path and frames_path.exists():
        frames = (json.loads(frames_path.read_text(encoding="utf-8")).get("frames") or [])[
            :MAX_FRAMES
        ]

    if frames:
        try:
            model, device = load_model()
            for frame in frames:
                path = frame.get("path")
                if not path or not Path(path).exists():
                    continue
                image = Image.open(path).convert("RGB")
                image.thumbnail((768, 768))
                encoded = model.encode_image(image)
                answers = {k: ask(model, encoded, q) or None for k, q in REASON_QUERIES.items()}
                frame_insights.append(
                    {
                        "start_ms": int(frame.get("start_ms") or 0),
                        "end_ms": int(frame.get("end_ms") or 0),
                        "answers": answers,
        "text": answers.get("recreation_brief")
                        or answers.get("continuity")
                        or "",
                    }
                )
        except Exception as exc:  # noqa: BLE001
            vlm_error = str(exc)

    items = []
    if local["brief_text"]:
        items.append(
            {
                "start_ms": 0,
                "end_ms": 0,
                "label": "dossier",
                "role": "reasoning",
                "text": local["brief_text"],
            }
        )
    for step in local["recreation_plan"]:
        items.append(
            {
                "start_ms": 0,
                "end_ms": 0,
                "label": "plan",
                "role": "reasoning",
                "text": step,
            }
        )
    for insight in frame_insights:
        if insight.get("text"):
            items.append(
                {
                    "start_ms": insight["start_ms"],
                    "end_ms": insight["end_ms"],
                    "label": "vlm",
                    "role": "reasoning",
                    "text": insight["text"],
                }
            )
        risks = (insight.get("answers") or {}).get("risks")
        if risks:
            items.append(
                {
                    "start_ms": insight["start_ms"],
                    "end_ms": insight["end_ms"],
                    "label": "riesgos",
                    "role": "reasoning",
                    "text": risks,
                }
            )

    payload = {
        "engine": "reason+moondream2" if frame_insights else "reason-local",
        "model": MODEL_ID if frame_insights else "compose",
        "device": device,
        "local": local,
        "frame_insights": frame_insights,
        "items": items,
    }
    if vlm_error:
        payload["vlm_error"] = vlm_error

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if items else 1


if __name__ == "__main__":
    raise SystemExit(main())
