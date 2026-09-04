/** Cola simple para no saturar CPU con muchos vídeos a la vez. */

type Waiter = () => void;

const globalQueue = globalThis as typeof globalThis & {
  __vxProcessQueue?: {
    running: number;
    waiters: Waiter[];
  };
};

function getQueue() {
  if (!globalQueue.__vxProcessQueue) {
    globalQueue.__vxProcessQueue = { running: 0, waiters: [] };
  }
  return globalQueue.__vxProcessQueue;
}

function maxConcurrent() {
  const n = Number(process.env.VX_MAX_CONCURRENT || 1);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export async function withProcessSlot<T>(options: {
  onWaiting?: () => void;
  onStarted?: () => void;
  run: () => Promise<T>;
}): Promise<T> {
  const q = getQueue();
  const limit = maxConcurrent();

  if (q.running >= limit) {
    options.onWaiting?.();
    await new Promise<void>((resolve) => {
      q.waiters.push(resolve);
    });
  }

  q.running += 1;
  options.onStarted?.();
  try {
    return await options.run();
  } finally {
    q.running -= 1;
    const next = q.waiters.shift();
    if (next) next();
  }
}
