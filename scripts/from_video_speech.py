#!/usr/bin/env python3
"""Habla + diarización reforzada (Whisper + diarize/WeSpeaker).

- Atribución de hablante a nivel de palabra
- Partir turnos cuando cambia el hablante
- Fusionar turnos consecutivos del mismo hablante
- Whisper con beam mayor + VAD más sensible
- Fallback de clustering espectral
"""
from __future__ import annotations

import json
import os
import sys
import wave
from collections import defaultdict

import numpy as np
from faster_whisper import WhisperModel
from sklearn.cluster import AgglomerativeClustering

WORD_OVERLAP_MIN = 0.02
MERGE_GAP_S = float(os.environ.get("DIARIZE_MERGE_GAP", "0.45"))


def load_wav(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        n = w.getnframes()
        ch = w.getnchannels()
        raw = w.readframes(n)
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:
        samples = samples.reshape(-1, ch).mean(axis=1)
    return samples, sr


def frame_features(chunk: np.ndarray, sr: int) -> np.ndarray:
    if len(chunk) < 32:
        return np.zeros(28, dtype=np.float64)
    windowed = chunk * np.hanning(len(chunk))
    spec = np.abs(np.fft.rfft(windowed))
    bands = np.array_split(spec, 24)
    band_feat = np.log1p(np.array([float(b.mean()) for b in bands], dtype=np.float64))
    rms = float(np.sqrt(np.mean(chunk**2)))
    f0 = 0.0
    if rms > 0.01:
        corr = np.correlate(chunk, chunk, mode="full")[len(chunk) - 1 :]
        min_lag = max(1, int(sr / 400))
        max_lag = max(min_lag + 1, int(sr / 70))
        segment = corr[min_lag:max_lag]
        if len(segment):
            lag = int(np.argmax(segment)) + min_lag
            f0 = float(sr / lag) if lag else 0.0
    return np.concatenate([band_feat, np.array([rms, f0 / 400.0], dtype=np.float64)])


def speech_windows(samples: np.ndarray, sr: int, win: float = 0.9, hop: float = 0.35):
    win_n = int(sr * win)
    hop_n = int(sr * hop)
    out = []
    if win_n <= 0:
        return out
    for start in range(0, max(1, len(samples) - win_n), hop_n):
        chunk = samples[start : start + win_n]
        rms = float(np.sqrt(np.mean(chunk**2)))
        if rms < 0.012:
            continue
        out.append((start / sr, (start + win_n) / sr, frame_features(chunk, sr)))
    return out


def cluster_speakers(windows):
    if len(windows) < 2:
        return ["SPEAKER_01"] * len(windows), 1
    X = np.stack([w[2] for w in windows])
    X = X - X.mean(axis=0)
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    X = X / np.clip(norms, 1e-8, None)
    dist = 1 - np.clip(X @ X.T, -1, 1)
    tri = dist[np.triu_indices(len(X), k=1)]
    med = float(np.median(tri)) if len(tri) else 0.0
    if med > 0.28:
        n_clusters = min(4, len(X))
    elif med > 0.16:
        n_clusters = min(3, len(X))
    elif med > 0.10:
        n_clusters = 2
    else:
        n_clusters = 1
    n_clusters = max(1, min(n_clusters, len(X)))
    if n_clusters <= 1:
        return ["SPEAKER_01"] * len(X), 1
    labels = AgglomerativeClustering(
        n_clusters=n_clusters, metric="cosine", linkage="average"
    ).fit_predict(X)
    return [f"SPEAKER_{int(i) + 1:02d}" for i in labels], n_clusters


def speaker_at_windows(t: float, windows, speakers: list[str]) -> str:
    best, best_ov = "SPEAKER_01", -1.0
    for (start, end, _), spk in zip(windows, speakers):
        ov = min(end, t + 0.25) - max(start, t - 0.05)
        if ov > best_ov:
            best_ov, best = ov, spk
    return best


def merge_same_speaker(segs: list[dict], gap: float = 0.45) -> list[dict]:
    if not segs:
        return []
    out = [dict(segs[0])]
    for seg in segs[1:]:
        prev = out[-1]
        if seg["speaker"] == prev["speaker"] and seg["start"] - prev["end"] <= gap:
            prev["end"] = max(prev["end"], seg["end"])
        else:
            out.append(dict(seg))
    return out


def diarize_segments(wav_path: str):
    """Silero VAD + WeSpeaker + clustering (paquete diarize). Sin HF token."""
    from diarize import diarize as run_diarize

    min_spk = int(os.environ.get("DIARIZE_MIN_SPEAKERS", "1"))
    max_spk = int(os.environ.get("DIARIZE_MAX_SPEAKERS", "8"))
    kwargs: dict = {"min_speakers": min_spk, "max_speakers": max_spk}
    num_spk = os.environ.get("DIARIZE_NUM_SPEAKERS")
    if num_spk and num_spk.isdigit():
        kwargs["num_speakers"] = int(num_spk)

    result = run_diarize(wav_path, **kwargs)
    segs = []
    for seg in result.segments:
        raw = str(getattr(seg, "speaker", "SPEAKER_00"))
        try:
            idx = int(raw.split("_")[-1])
            spk = f"SPEAKER_{idx + 1:02d}"
        except Exception:
            spk = "SPEAKER_01"
        segs.append({"start": float(seg.start), "end": float(seg.end), "speaker": spk})
    segs.sort(key=lambda s: s["start"])
    segs = merge_same_speaker(segs, gap=MERGE_GAP_S)
    speakers = sorted({s["speaker"] for s in segs}) or ["SPEAKER_01"]
    return segs, speakers, "diarize-wespeaker-v2"


def speaker_at_time(t: float, dia_segs: list[dict], default: str = "SPEAKER_01") -> str:
    best, best_ov = default, -1.0
    nearest, nearest_dist = default, 1e9
    for seg in dia_segs:
        ov = min(seg["end"], t + 0.05) - max(seg["start"], t - 0.05)
        if ov > best_ov:
            best_ov, best = ov, seg["speaker"]
        mid = (seg["start"] + seg["end"]) / 2
        dist = abs(mid - t)
        if dist < nearest_dist:
            nearest_dist, nearest = dist, seg["speaker"]
    if best_ov >= WORD_OVERLAP_MIN:
        return best
    return nearest


def smooth_labels(times: list[float], labels: list[str], window: float = 0.4) -> list[str]:
    if not labels:
        return labels
    out = []
    for t in times:
        votes: dict[str, int] = defaultdict(int)
        for tj, lab in zip(times, labels):
            if abs(tj - t) <= window:
                votes[lab] += 1
        out.append(max(votes.items(), key=lambda kv: (kv[1], kv[0]))[0])
    return out


def merge_transcript_turns(rows: list[dict], gap: float = 0.55) -> list[dict]:
    if not rows:
        return []
    out = [dict(rows[0])]
    for row in rows[1:]:
        prev = out[-1]
        if row["speaker"] == prev["speaker"] and row["start"] - prev["end"] <= gap:
            prev["end"] = row["end"]
            prev["end_ms"] = row["end_ms"]
            prev["text"] = (prev["text"] + " " + row["text"]).strip()
        else:
            out.append(dict(row))
    return out


def words_to_speaker_segments(words: list[dict], label_fn) -> list[dict]:
    if not words:
        return []
    times = [(w["start"] + w["end"]) / 2 for w in words]
    raw = [label_fn(t) for t in times]
    labels = smooth_labels(times, raw, window=0.4)

    rows: list[dict] = []
    cur_spk = labels[0]
    cur_words = [words[0]["word"]]
    start = words[0]["start"]
    end = words[0]["end"]

    for w, spk in zip(words[1:], labels[1:]):
        if spk == cur_spk and w["start"] - end <= 0.8:
            cur_words.append(w["word"])
            end = w["end"]
        else:
            text = "".join(cur_words).strip()
            if text:
                rows.append(
                    {
                        "start": round(start, 3),
                        "end": round(end, 3),
                        "start_ms": int(start * 1000),
                        "end_ms": int(end * 1000),
                        "speaker": cur_spk,
                        "text": text,
                    }
                )
            cur_spk = spk
            cur_words = [w["word"]]
            start = w["start"]
            end = w["end"]

    text = "".join(cur_words).strip()
    if text:
        rows.append(
            {
                "start": round(start, 3),
                "end": round(end, 3),
                "start_ms": int(start * 1000),
                "end_ms": int(end * 1000),
                "speaker": cur_spk,
                "text": text,
            }
        )
    return merge_transcript_turns(rows)


def collect_words(model, wav: str, vad: bool):
    beam = int(os.environ.get("WHISPER_BEAM_SIZE", "5"))
    lang = os.environ.get("WHISPER_LANGUAGE") or None
    kwargs = dict(
        vad_filter=vad,
        word_timestamps=True,
        beam_size=max(1, beam),
        best_of=max(1, beam),
        condition_on_previous_text=True,
        language=lang,
    )
    if vad:
        kwargs["vad_parameters"] = dict(min_silence_duration_ms=350, speech_pad_ms=200)

    segs, info = model.transcribe(wav, **kwargs)
    words: list[dict] = []
    fallback_rows: list[dict] = []
    for seg in segs:
        text = (seg.text or "").strip()
        seg_words = getattr(seg, "words", None) or []
        if seg_words:
            for w in seg_words:
                token = (getattr(w, "word", None) or "").strip()
                if not token:
                    continue
                # faster-whisper suele incluir el espacio en la palabra
                words.append(
                    {
                        "word": token if token.startswith((" ", "\n")) else f" {token}",
                        "start": float(w.start),
                        "end": float(w.end),
                    }
                )
        elif text:
            fallback_rows.append(
                {
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "start_ms": int(seg.start * 1000),
                    "end_ms": int(seg.end * 1000),
                    "text": text,
                    "mid": (seg.start + seg.end) / 2,
                }
            )
    # limpiar primer espacio sobrante
    if words and words[0]["word"].startswith(" "):
        words[0]["word"] = words[0]["word"].lstrip()
    return words, fallback_rows, info


def assign_fallback_rows(rows: list[dict], label_fn) -> list[dict]:
    out = []
    for row in rows:
        out.append(
            {
                "start": row["start"],
                "end": row["end"],
                "start_ms": row["start_ms"],
                "end_ms": row["end_ms"],
                "speaker": label_fn(row["mid"]),
                "text": row["text"],
            }
        )
    return merge_transcript_turns(out)


def build_speaker_stats(segments: list[dict]) -> list[dict]:
    acc: dict[str, dict] = {}
    for seg in segments:
        spk = seg["speaker"]
        cur = acc.get(spk) or {
            "id": spk,
            "duration_ms": 0,
            "turns": 0,
            "chars": 0,
            "samples": [],
        }
        cur["duration_ms"] += max(0, seg["end_ms"] - seg["start_ms"])
        cur["turns"] += 1
        cur["chars"] += len(seg.get("text") or "")
        if len(cur["samples"]) < 3 and seg.get("text"):
            cur["samples"].append(seg["text"][:160])
        acc[spk] = cur
    ranked = sorted(acc.values(), key=lambda r: (-r["duration_ms"], r["id"]))
    for row in ranked:
        dur_s = max(0.001, row["duration_ms"] / 1000)
        row["chars_per_sec"] = round(row["chars"] / dur_s, 2)
    return ranked


def run_pipeline(wav: str, model_name: str, label_fn, diarization_engine: str, dia_segs, speakers_hint, extra: dict):
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    words, fallback, info = collect_words(model, wav, True)
    if not words and not fallback:
        words, fallback, info = collect_words(model, wav, False)

    if words:
        transcript = words_to_speaker_segments(words, label_fn)
    else:
        transcript = assign_fallback_rows(fallback, label_fn)

    speakers = sorted({t["speaker"] for t in transcript}) or list(speakers_hint) or ["SPEAKER_01"]
    stats = build_speaker_stats(transcript)
    return {
        "engine": "faster-whisper",
        "model": model_name,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "speakers": speakers,
        "speaker_count": len(speakers),
        "diarization": diarization_engine,
        "diarization_segments": dia_segs,
        "speaker_stats": stats,
        "word_count": len(words),
        "segments": transcript,
        **extra,
    }


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: from_video_speech.py <wav> <whisper_model> <out.json>", file=sys.stderr)
        return 2

    wav = sys.argv[1]
    model_name = sys.argv[2] if sys.argv[2] else os.environ.get("WHISPER_MODEL", "small")
    out = sys.argv[3]

    extra: dict = {}
    try:
        dia_segs, speakers_hint, diarization_engine = diarize_segments(wav)

        def label_fn(t: float) -> str:
            return speaker_at_time(t, dia_segs)

        payload = run_pipeline(
            wav, model_name, label_fn, diarization_engine, dia_segs, speakers_hint, extra
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[speech] diarize fallback: {exc}", file=sys.stderr)
        extra["diarization_error"] = str(exc)
        samples, sr = load_wav(wav)
        windows = speech_windows(samples, sr)
        win_speakers, _n = cluster_speakers(windows)

        def label_fn(t: float) -> str:
            return speaker_at_windows(t, windows, win_speakers)

        payload = run_pipeline(
            wav,
            model_name,
            label_fn,
            "spectral-pitch-clustering",
            [],
            sorted(set(win_speakers)) or ["SPEAKER_01"],
            extra,
        )

    open(out, "w", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
