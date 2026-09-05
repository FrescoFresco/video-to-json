#!/usr/bin/env python3
"""Habla del vídeo: Whisper (texto) + diarize (quién habla).

Pipeline:
1. `diarize` (Silero VAD + WeSpeaker) → intervalos por hablante
2. faster-whisper (por defecto large-v3) → texto denso
3. Cada segmento hereda el hablante del intervalo con más solape
4. Se fusionan turnos consecutivos del mismo hablante

Sin clustering casero. Si diarize falla → un solo SPEAKER_01.
"""
from __future__ import annotations

import json
import os
import sys

from faster_whisper import WhisperModel

MERGE_GAP_S = float(os.environ.get("DIARIZE_MERGE_GAP", "0.4"))
DEFAULT_MODEL = os.environ.get("WHISPER_MODEL", "large-v3")


def normalize_speaker(raw: str) -> str:
    """diarize usa SPEAKER_00… → SPEAKER_01…"""
    try:
        idx = int(str(raw).split("_")[-1])
        return f"SPEAKER_{idx + 1:02d}"
    except Exception:
        return "SPEAKER_01"


def merge_turns(segs: list[dict], gap: float = MERGE_GAP_S) -> list[dict]:
    if not segs:
        return []
    out = [dict(segs[0])]
    for seg in segs[1:]:
        prev = out[-1]
        same = seg["speaker"] == prev["speaker"]
        close = seg["start"] - prev["end"] <= gap
        if same and close:
            prev["end"] = max(prev["end"], seg["end"])
            if "text" in prev and "text" in seg:
                prev["text"] = f"{prev['text']} {seg['text']}".strip()
                prev["end_ms"] = int(prev["end"] * 1000)
        else:
            out.append(dict(seg))
    return out


def run_diarization(wav_path: str) -> tuple[list[dict], str]:
    """Devuelve intervalos [{start,end,speaker}] usando el paquete `diarize`."""
    from diarize import diarize as diarize_file

    kwargs = {
        "min_speakers": int(os.environ.get("DIARIZE_MIN_SPEAKERS", "1")),
        "max_speakers": int(os.environ.get("DIARIZE_MAX_SPEAKERS", "8")),
    }
    num = os.environ.get("DIARIZE_NUM_SPEAKERS")
    if num and num.isdigit():
        kwargs["num_speakers"] = int(num)

    result = diarize_file(wav_path, **kwargs)
    segs = [
        {
            "start": float(seg.start),
            "end": float(seg.end),
            "speaker": normalize_speaker(getattr(seg, "speaker", "SPEAKER_00")),
        }
        for seg in result.segments
    ]
    segs.sort(key=lambda s: s["start"])
    return merge_turns(segs), "diarize-wespeaker"


def speaker_for(t: float, dia: list[dict]) -> str:
    """Hablante del intervalo con más solape en torno a t."""
    best, best_ov = "SPEAKER_01", -1.0
    for seg in dia:
        ov = min(seg["end"], t + 0.05) - max(seg["start"], t - 0.05)
        if ov > best_ov:
            best_ov, best = ov, seg["speaker"]
    if best_ov > 0:
        return best
    return min(dia, key=lambda s: abs((s["start"] + s["end"]) / 2 - t))["speaker"]


def resolve_model_name(name: str) -> str:
    """Alias cómodos → ids que entiende faster-whisper."""
    key = (name or DEFAULT_MODEL).strip()
    aliases = {
        "turbo": "large-v3-turbo",
        "large": "large-v3",
        "best": "large-v3",
    }
    return aliases.get(key.lower(), key)


def transcribe(wav_path: str, model_name: str) -> tuple[list[dict], object]:
    beam = int(os.environ.get("WHISPER_BEAM_SIZE", "5"))
    lang = os.environ.get("WHISPER_LANGUAGE") or None
    prompt = os.environ.get("WHISPER_INITIAL_PROMPT") or None
    model_name = resolve_model_name(model_name)
    # int8 en CPU: calidad alta sin reventar RAM
    compute = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
    model = WhisperModel(model_name, device="cpu", compute_type=compute)

    def _run(vad: bool):
        kwargs = {
            "vad_filter": vad,
            "beam_size": max(1, beam),
            "best_of": max(1, beam),
            "condition_on_previous_text": True,
            "language": lang,
            "word_timestamps": True,
            "temperature": [0.0, 0.2, 0.4],
        }
        if prompt:
            kwargs["initial_prompt"] = prompt
        return model.transcribe(wav_path, **kwargs)

    segments, info = _run(True)
    rows = []
    for seg in segments:
        text = (seg.text or "").strip()
        if not text:
            continue
        words = []
        if getattr(seg, "words", None):
            for w in seg.words:
                token = (getattr(w, "word", None) or "").strip()
                if not token:
                    continue
                words.append(
                    {
                        "word": token,
                        "start": round(float(w.start), 3),
                        "end": round(float(w.end), 3),
                        "start_ms": int(float(w.start) * 1000),
                        "end_ms": int(float(w.end) * 1000),
                    }
                )
        rows.append(
            {
                "start": float(seg.start),
                "end": float(seg.end),
                "text": text,
                "words": words or None,
            }
        )
    if not rows:
        segments, info = _run(False)
        for seg in segments:
            text = (seg.text or "").strip()
            if text:
                rows.append(
                    {
                        "start": float(seg.start),
                        "end": float(seg.end),
                        "text": text,
                        "words": None,
                    }
                )
    return rows, info


def attach_speakers(transcript: list[dict], dia: list[dict]) -> list[dict]:
    labeled = []
    for row in transcript:
        mid = (row["start"] + row["end"]) / 2
        spk = speaker_for(mid, dia) if dia else "SPEAKER_01"
        item = {
            "start": round(row["start"], 3),
            "end": round(row["end"], 3),
            "start_ms": int(row["start"] * 1000),
            "end_ms": int(row["end"] * 1000),
            "speaker": spk,
            "text": row["text"],
        }
        if row.get("words"):
            item["words"] = row["words"]
        labeled.append(item)
    return merge_turns(labeled)


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: from_video_speech.py <wav> <whisper_model> <out.json>", file=sys.stderr)
        return 2

    wav, model_name, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    if not model_name:
        model_name = DEFAULT_MODEL
    model_name = resolve_model_name(model_name)

    diarization = "none"
    dia: list[dict] = []
    error = None
    try:
        dia, diarization = run_diarization(wav)
    except Exception as exc:  # noqa: BLE001
        error = str(exc)
        print(f"[speech] diarize unavailable, single speaker: {exc}", file=sys.stderr)

    transcript, info = transcribe(wav, model_name)
    segments = attach_speakers(transcript, dia)
    speakers = sorted({s["speaker"] for s in segments}) or ["SPEAKER_01"]

    payload = {
        "engine": "faster-whisper",
        "model": model_name,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "speakers": speakers,
        "speaker_count": len(speakers),
        "diarization": diarization,
        "diarization_segments": dia,
        "segments": segments,
        "word_timestamps": True,
    }
    if error:
        payload["diarization_error"] = error

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
