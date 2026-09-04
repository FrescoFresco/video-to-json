#!/usr/bin/env python3
"""Eventos de audio locales con PANNs (AudioSet tags).

Etiqueta qué tipo de sonido hay (habla, música, aplausos…).
No identifica canciones ni inventa narrativas.
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict

import numpy as np


# Etiquetas AudioSet más útiles / legibles en español
LABEL_ES = {
    "Speech": "habla",
    "Male speech, man speaking": "habla masculina",
    "Female speech, woman speaking": "habla femenina",
    "Conversation": "conversación",
    "Narration, monologue": "narración",
    "Music": "música",
    "Musical instrument": "instrumento",
    "Singing": "canto",
    "Sine wave": "tono puro",
    "Clapping": "aplausos",
    "Cheering": "vítores",
    "Crowd": "multitud",
    "Laughter": "risa",
    "Baby cry, infant cry": "llanto de bebé",
    "Animal": "animal",
    "Dog": "perro",
    "Cat": "gato",
    "Bird": "pájaro",
    "Vehicle": "vehículo",
    "Car": "coche",
    "Bus": "autobús",
    "Train": "tren",
    "Aircraft": "avión",
    "Siren": "sirena",
    "Alarm": "alarma",
    "Telephone": "teléfono",
    "Telephone bell ringing": "timbre de teléfono",
    "Knock": "llamada a la puerta",
    "Door": "puerta",
    "Silence": "silencio",
    "Rain": "lluvia",
    "Wind": "viento",
    "Water": "agua",
    "Explosion": "explosión",
    "Gunshot, gunfire": "disparo",
    "Fireworks": "fuegos artificiales",
    "Typing": "teclado",
    "Computer keyboard": "teclado",
    "Writing": "escritura",
    "Printer": "impresora",
    "Microwave oven": "microondas",
    "Television": "televisión",
    "Radio": "radio",
}


def load_wav_mono(path: str, sr: int = 32000) -> np.ndarray:
    import librosa

    y, _ = librosa.load(path, sr=sr, mono=True)
    return y.astype(np.float32)


def top_labels(clipwise: np.ndarray, labels: list[str], top_k: int = 6, min_score: float = 0.12):
    idx = np.argsort(clipwise)[::-1]
    out = []
    for i in idx[: max(top_k * 3, top_k)]:
        score = float(clipwise[i])
        if score < min_score:
            break
        name = labels[i]
        out.append(
            {
                "label": name,
                "label_es": LABEL_ES.get(name, name),
                "score": round(score, 4),
            }
        )
        if len(out) >= top_k:
            break
    return out


def analyze(wav_path: str) -> dict:
    from panns_inference import AudioTagging, labels

    device = os.environ.get("PANNS_DEVICE", "cpu")
    y = load_wav_mono(wav_path, sr=32000)
    duration_s = float(len(y) / 32000.0) if len(y) else 0.0
    if duration_s < 0.05 or float(np.max(np.abs(y))) < 1e-5:
        return {
            "engine": "panns-cnn14",
            "duration_ms": int(round(duration_s * 1000)),
            "events": [],
            "items": [],
            "profile": {"overall": "Sin audio usable"},
        }

    at = AudioTagging(checkpoint_path=None, device=device)

    # Ventanas de ~4 s con solape 1 s (AudioSet-style clip ~10s, pero 4s responde mejor en clips cortos)
    win = float(os.environ.get("AUDIO_EVENTS_WIN_S", "4.0"))
    hop = float(os.environ.get("AUDIO_EVENTS_HOP_S", "3.0"))
    min_score = float(os.environ.get("AUDIO_EVENTS_MIN_SCORE", "0.15"))
    top_k = int(os.environ.get("AUDIO_EVENTS_TOP_K", "5"))

    events = []
    items = []
    agg: dict[str, float] = defaultdict(float)

    t = 0.0
    while t < duration_s - 0.15:
        t1 = min(duration_s, t + win)
        a = int(round(t * 32000))
        b = int(round(t1 * 32000))
        chunk = y[a:b]
        if chunk.size < 1600:
            break
        # panns espera (batch, samples); rellenar/cortar ~10s mejora estabilidad del modelo
        target = 32000 * 10
        if chunk.size < target:
            pad = np.zeros(target, dtype=np.float32)
            pad[: chunk.size] = chunk
            batch = pad[None, :]
        else:
            batch = chunk[:target][None, :]

        clipwise_output, _embedding = at.inference(batch)
        clipwise = np.asarray(clipwise_output[0]).reshape(-1)
        tops = top_labels(clipwise, list(labels), top_k=top_k, min_score=min_score)
        start_ms = int(round(t * 1000))
        end_ms = int(round(t1 * 1000))
        if tops:
            text = ", ".join(f"{x['label_es']} ({x['score']:.2f})" for x in tops[:3])
            events.append(
                {
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "tags": tops,
                }
            )
            items.append(
                {
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "label": tops[0]["label_es"],
                    "text": text,
                }
            )
            for x in tops:
                agg[x["label_es"]] = max(agg[x["label_es"]], x["score"])
        t += hop

    ranked = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)[:6]
    overall = ", ".join(f"{name} ({score:.2f})" for name, score in ranked) if ranked else "Sin eventos claros"

    return {
        "engine": "panns-cnn14",
        "duration_ms": int(round(duration_s * 1000)),
        "window_s": win,
        "hop_s": hop,
        "events": events,
        "items": items,
        "top_tags": [{"label_es": n, "score": round(s, 4)} for n, s in ranked],
        "profile": {
            "overall": overall,
            "tag_count": len(ranked),
        },
    }


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: from_video_audio_events.py <audio.wav> <out.json>", file=sys.stderr)
        return 2
    wav_path, out_json = sys.argv[1], sys.argv[2]
    try:
        result = analyze(wav_path)
    except Exception as exc:
        result = {
            "engine": "panns-cnn14",
            "error": str(exc),
            "events": [],
            "items": [],
            "profile": {"overall": "Error al detectar eventos de audio"},
        }
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return 0 if "error" not in result else 1


if __name__ == "__main__":
    raise SystemExit(main())
