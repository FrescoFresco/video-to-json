#!/usr/bin/env python3
"""Speech from a video soundtrack + diarización gratis (paquete `diarize`).

Sin tokens ni APIs de pago. Si `diarize` falla, cae al clustering local.
"""
from __future__ import annotations

import json
import sys
import wave

import numpy as np
from faster_whisper import WhisperModel
from sklearn.cluster import AgglomerativeClustering


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


def speech_windows(samples: np.ndarray, sr: int, win=0.9, hop=0.35):
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
        feat = frame_features(chunk, sr)
        out.append((start / sr, (start + win_n) / sr, feat))
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


def diarize_segments(wav_path: str):
    """Usa el paquete `diarize` (Silero VAD + WeSpeaker ONNX). Sin HF token."""
    from diarize import diarize as run_diarize

    result = run_diarize(wav_path)
    segs = []
    for seg in result.segments:
        raw = str(getattr(seg, "speaker", "SPEAKER_00"))
        try:
            idx = int(raw.split("_")[-1])
            spk = f"SPEAKER_{idx + 1:02d}"  # SPEAKER_00 -> SPEAKER_01
        except Exception:
            spk = "SPEAKER_01"
        segs.append(
            {
                "start": float(seg.start),
                "end": float(seg.end),
                "speaker": spk,
            }
        )
    speakers = sorted({s["speaker"] for s in segs}) or ["SPEAKER_01"]
    return segs, speakers, "diarize-wespeaker"


def speaker_at_diarization(t: float, dia_segs: list[dict]) -> str:
    best, best_ov = "SPEAKER_01", -1.0
    for seg in dia_segs:
        ov = min(seg["end"], t + 0.2) - max(seg["start"], t)
        if ov > best_ov:
            best_ov, best = ov, seg["speaker"]
    return best


def collect(model, wav, vad: bool, label_fn):
    segs, info = model.transcribe(wav, vad_filter=vad, word_timestamps=True, beam_size=1)
    rows = []
    for seg in segs:
        text = (seg.text or "").strip()
        if not text:
            continue
        mid = (seg.start + seg.end) / 2
        rows.append(
            {
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "start_ms": int(seg.start * 1000),
                "end_ms": int(seg.end * 1000),
                "speaker": label_fn(mid),
                "text": text,
            }
        )
    return rows, info


def main():
    wav = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"
    out = sys.argv[3]

    diarization_engine = "spectral-pitch-clustering"
    dia_segs = []
    speakers_hint: list[str] = []
    try:
        dia_segs, speakers_hint, diarization_engine = diarize_segments(wav)
    except Exception as exc:  # noqa: BLE001
        print(f"[speech] diarize fallback: {exc}", file=sys.stderr)
        samples, sr = load_wav(wav)
        windows = speech_windows(samples, sr)
        win_speakers, _n = cluster_speakers(windows)

        def label_fn(t: float) -> str:
            return speaker_at_windows(t, windows, win_speakers)

        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        transcript, info = collect(model, wav, True, label_fn)
        if not transcript:
            transcript, info = collect(model, wav, False, label_fn)
        speakers = sorted({t["speaker"] for t in transcript}) or ["SPEAKER_01"]
        open(out, "w", encoding="utf-8").write(
            json.dumps(
                {
                    "engine": "faster-whisper",
                    "model": model_name,
                    "language": getattr(info, "language", None),
                    "speakers": speakers,
                    "speaker_count": len(speakers),
                    "diarization": diarization_engine,
                    "diarization_error": str(exc),
                    "segments": transcript,
                },
                ensure_ascii=False,
            )
        )
        return

    def label_fn(t: float) -> str:
        return speaker_at_diarization(t, dia_segs)

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    transcript, info = collect(model, wav, True, label_fn)
    if not transcript:
        transcript, info = collect(model, wav, False, label_fn)

    speakers = sorted({t["speaker"] for t in transcript}) or speakers_hint or ["SPEAKER_01"]
    open(out, "w", encoding="utf-8").write(
        json.dumps(
            {
                "engine": "faster-whisper",
                "model": model_name,
                "language": getattr(info, "language", None),
                "speakers": speakers,
                "speaker_count": len(speakers),
                "diarization": diarization_engine,
                "diarization_segments": dia_segs,
                "segments": transcript,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
