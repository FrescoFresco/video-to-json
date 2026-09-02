#!/usr/bin/env python3
"""Local transcription + lightweight speaker clustering. No paid API."""
from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

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


def speech_windows(samples: np.ndarray, sr: int, win=0.8, hop=0.4):
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
        spec = np.abs(np.fft.rfft(chunk * np.hanning(len(chunk))))
        bands = np.array_split(spec, 24)
        feat = np.log1p(np.array([float(b.mean()) for b in bands], dtype=np.float64))
        out.append((start / sr, (start + win_n) / sr, feat, rms))
    return out


def cluster_speakers(windows):
    if len(windows) < 2:
        return ["S01"] * len(windows), 1
    X = np.stack([w[2] for w in windows])
    X = X - X.mean(axis=0)
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    X = X / np.clip(norms, 1e-8, None)
    # 1 vs 2 speakers: if embeddings are similar, stay at 1
    dist = 1 - (X @ X.T)
    tri = dist[np.triu_indices(len(X), k=1)]
    n_clusters = 2 if len(tri) and float(np.median(tri)) > 0.18 else 1
    n_clusters = min(n_clusters, min(3, len(X)))
    if n_clusters <= 1:
        return ["S01"] * len(X), 1
    labels = AgglomerativeClustering(n_clusters=n_clusters, metric="cosine", linkage="average").fit_predict(X)
    speakers = [f"S{int(i) + 1:02d}" for i in labels]
    return speakers, n_clusters


def speaker_at(t: float, windows, speakers: list[str]) -> str:
    best = "S01"
    best_ov = -1.0
    for (start, end, _, _), spk in zip(windows, speakers):
        ov = min(end, t + 0.2) - max(start, t)
        if ov > best_ov:
            best_ov = ov
            best = spk
    return best


def main():
    wav = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base"
    samples, sr = load_wav(wav)
    windows = speech_windows(samples, sr)
    win_speakers, n_speakers = cluster_speakers(windows)

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segs, info = model.transcribe(
        wav,
        vad_filter=True,
        word_timestamps=True,
        beam_size=1,
    )
    transcript = []
    for seg in segs:
        text = (seg.text or "").strip()
        if not text:
            continue
        mid = (seg.start + seg.end) / 2
        speaker = speaker_at(mid, windows, win_speakers) if windows else "S01"
        transcript.append(
            {
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "start_ms": int(seg.start * 1000),
                "end_ms": int(seg.end * 1000),
                "speaker": speaker,
                "text": text,
            }
        )
    if not transcript:
        segs, info = model.transcribe(
            wav,
            vad_filter=False,
            word_timestamps=True,
            beam_size=1,
        )
        for seg in segs:
            text = (seg.text or "").strip()
            if not text:
                continue
            mid = (seg.start + seg.end) / 2
            speaker = speaker_at(mid, windows, win_speakers) if windows else "S01"
            transcript.append(
                {
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "start_ms": int(seg.start * 1000),
                    "end_ms": int(seg.end * 1000),
                    "speaker": speaker,
                    "text": text,
                }
            )

    speakers = sorted({t["speaker"] for t in transcript}) or ["S01"]
    Path(sys.argv[3] if len(sys.argv) > 3 else "audio.json").write_text(
        json.dumps(
            {
                "engine": "faster-whisper",
                "model": model_name,
                "language": getattr(info, "language", None),
                "language_probability": getattr(info, "language_probability", None),
                "speakers": speakers,
                "speaker_count": max(n_speakers, len(speakers)),
                "diarization": "embedding-cluster" if n_speakers > 1 else "single-or-undivided",
                "segments": transcript,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
