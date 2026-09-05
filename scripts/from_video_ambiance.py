#!/usr/bin/env python3
"""Música y ambiente local a partir del audio del vídeo.

Describe cómo suena (energía, ritmo, brillo, tipo de pasaje).
No identifica canciones ni inventa moods subjetivos.
"""
from __future__ import annotations

import json
import sys
import warnings

import numpy as np

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)


def load_mono(path: str, target_sr: int = 22050) -> tuple[np.ndarray, int]:
    import librosa

    y, sr = librosa.load(path, sr=target_sr, mono=True)
    if y.size == 0:
        return np.zeros(1, dtype=np.float32), target_sr
    return y.astype(np.float32), int(sr)


def brightness_label(centroid_hz: float) -> str:
    if centroid_hz < 1200:
        return "timbre más opaco"
    if centroid_hz < 2800:
        return "timbre medio"
    return "timbre más brillante"


def energy_label(rms: float, ref: float) -> str:
    if ref <= 1e-8:
        return "sin señal"
    ratio = rms / ref
    if ratio < 0.25:
        return "energía baja"
    if ratio < 0.75:
        return "energía media"
    return "energía alta"


def passage_label(
    rms: float,
    ref: float,
    onset_mean: float,
    tempo_bpm: float | None,
    tempo_conf: float,
) -> str:
    if ref <= 1e-8 or rms / max(ref, 1e-8) < 0.12:
        return "silencio / muy quieto"
    rhythmic = tempo_bpm is not None and tempo_conf >= 0.35 and onset_mean >= 0.08
    if rhythmic and rms / ref >= 0.35:
        return "pasaje con ritmo musical"
    if onset_mean >= 0.12 and rms / ref >= 0.4:
        return "pasaje activo / denso"
    if rms / ref >= 0.2:
        return "pasaje con actividad (habla o ruido)"
    return "poca actividad"


def analyze(path: str) -> dict:
    import librosa

    y, sr = load_mono(path)
    duration_s = float(len(y) / sr) if sr else 0.0
    if duration_s < 0.05 or float(np.max(np.abs(y))) < 1e-5:
        return {
            "engine": "librosa",
            "sample_rate": sr,
            "duration_ms": int(round(duration_s * 1000)),
            "tempo_bpm": None,
            "tempo_confidence": 0.0,
            "mean_rms": 0.0,
            "peak_rms": 0.0,
            "mean_centroid_hz": 0.0,
            "segments": [],
            "items": [],
            "profile": {
                "overall": "Sin audio usable",
                "energy": "sin señal",
                "brightness": "timbre medio",
                "rhythm": "sin ritmo claro",
            },
        }

    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=512)[0]
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)

    mean_rms = float(np.mean(rms))
    peak_rms = float(np.max(rms))
    mean_centroid = float(np.mean(centroid)) if len(centroid) else 0.0

    tempo_bpm = None
    tempo_conf = 0.0
    try:
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr, onset_envelope=onset_env)
        tempo_val = float(np.atleast_1d(tempo)[0])
        if 40.0 <= tempo_val <= 220.0 and len(beats) >= 2:
            tempo_bpm = round(tempo_val, 1)
            # Confianza aproximada: densidad de beats + fuerza de onsets
            beat_density = len(beats) / max(duration_s, 0.1)
            onset_mean = float(np.mean(onset_env))
            tempo_conf = float(np.clip(0.25 * beat_density + 2.5 * onset_mean, 0.0, 1.0))
    except Exception:
        tempo_bpm = None
        tempo_conf = 0.0

    # Ventanas ~2.5 s para items legibles
    win_s = 2.5
    hop_s = 2.5
    segments = []
    items = []
    t = 0.0
    while t < duration_s - 0.2:
        t1 = min(duration_s, t + win_s)
        mask = (times >= t) & (times < t1)
        if not np.any(mask):
            t += hop_s
            continue
        seg_rms = float(np.mean(rms[mask]))
        seg_cent = float(np.mean(centroid[mask])) if np.any(mask) else mean_centroid
        seg_onset = float(np.mean(onset_env[mask])) if len(onset_env) == len(rms) else float(np.mean(onset_env))
        label = passage_label(seg_rms, peak_rms, seg_onset, tempo_bpm, tempo_conf)
        e_lab = energy_label(seg_rms, peak_rms)
        b_lab = brightness_label(seg_cent)
        text = f"{label} · {e_lab} · {b_lab}"
        start_ms = int(round(t * 1000))
        end_ms = int(round(t1 * 1000))
        segments.append(
            {
                "start_ms": start_ms,
                "end_ms": end_ms,
                "rms": round(seg_rms, 5),
                "centroid_hz": round(seg_cent, 1),
                "onset_strength": round(seg_onset, 4),
                "label": label,
                "energy": e_lab,
                "brightness": b_lab,
            }
        )
        items.append(
            {
                "start_ms": start_ms,
                "end_ms": end_ms,
                "label": label,
                "text": text,
            }
        )
        t += hop_s

    if tempo_bpm is not None and tempo_conf >= 0.35:
        rhythm = f"ritmo detectable ~{tempo_bpm:g} BPM"
    elif tempo_bpm is not None:
        rhythm = f"posible tempo ~{tempo_bpm:g} BPM (poco claro)"
    else:
        rhythm = "sin ritmo claro"

    overall_bits = [
        energy_label(mean_rms, peak_rms),
        brightness_label(mean_centroid),
        rhythm,
    ]
    # Tipo dominante por conteo de labels de pasaje
    if segments:
        from collections import Counter

        top = Counter(s["label"] for s in segments).most_common(1)[0][0]
        overall = f"Predomina: {top}"
    else:
        overall = "Sin segmentos"

    return {
        "engine": "librosa",
        "sample_rate": sr,
        "duration_ms": int(round(duration_s * 1000)),
        "tempo_bpm": tempo_bpm,
        "tempo_confidence": round(tempo_conf, 3),
        "mean_rms": round(mean_rms, 5),
        "peak_rms": round(peak_rms, 5),
        "mean_centroid_hz": round(mean_centroid, 1),
        "segments": segments,
        "items": items,
        "profile": {
            "overall": overall,
            "energy": energy_label(mean_rms, peak_rms),
            "brightness": brightness_label(mean_centroid),
            "rhythm": rhythm,
            "notes": " · ".join(overall_bits),
        },
    }


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: from_video_ambiance.py <audio.wav> <out.json>", file=sys.stderr)
        return 2
    wav_path, out_json = sys.argv[1], sys.argv[2]
    try:
        result = analyze(wav_path)
    except Exception as exc:
        result = {
            "engine": "librosa",
            "error": str(exc),
            "segments": [],
            "items": [],
            "profile": {"overall": "Error al analizar audio"},
        }
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return 0 if "error" not in result else 1


if __name__ == "__main__":
    raise SystemExit(main())
