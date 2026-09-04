# Imagen lista para usar: Node + ffmpeg + Python (Whisper/OCR).
# Arranque: docker compose up --build

FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=43141
ENV HOSTNAME=0.0.0.0
ENV WHISPER_MODEL=base
ENV HF_HOME=/data/hf
ENV XDG_CACHE_HOME=/data/cache
ENV HF_HUB_DISABLE_TELEMETRY=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-venv \
    python3-pip \
    python3-dev \
    pkg-config \
    libvips-dev \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements-video.txt ./
RUN python3 -m venv video-py \
  && video-py/bin/pip install --upgrade pip \
  && video-py/bin/pip install --no-cache-dir torch==2.8.0 torchvision==0.23.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu \
  && video-py/bin/pip install --no-cache-dir -r requirements-video.txt \
  && video-py/bin/pip install --no-cache-dir 'transformers==4.49.0'

ENV VIDEO_VENV_DIR=video-py
ENV VX_DATA_DIR=/data/jobs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY scripts ./scripts

RUN mkdir -p /data/hf /data/cache /data/jobs \
  && chown -R node:node /app /data

USER node
EXPOSE 43141
VOLUME ["/data"]

CMD ["node", "server.js"]
