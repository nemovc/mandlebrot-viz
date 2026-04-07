import { AnimatorCachePool } from "$lib/rendering/worker/pools/animatorCachePool";
import { AnimatorRecolorPool } from "$lib/rendering/worker/pools/animatorRecolorPool";
import { interpolateAll } from "$lib/utils/animator/interpolation";
import { getPrecisionMode, scaleForZoom } from "$lib/utils/precision";
import { buildCdf, baseAlgorithm } from "$lib/utils/colorPalettes";
import type { ColorConfig } from "$lib/utils/colorPalettes";
import type { AnimationProject } from "$lib/stores/animationState.svelte";
import { animationState } from "$lib/stores/animationState.svelte";

const MAX_LOW_RES = 512;
let _seq = 0;

function computeLowRes(w: number, h: number): [number, number] {
  if (w <= MAX_LOW_RES && h <= MAX_LOW_RES) return [w, h];
  const scale = Math.min(MAX_LOW_RES / w, MAX_LOW_RES / h);
  return [Math.round(w * scale), Math.round(h * scale)];
}

function createFrameCache() {
  const frames = new Map<number, ImageBitmap>();
  let cachedCount = $state(0);
  let buildTotal = $state(0);
  let isBuilding = $state(false);
  let abortCtrl: AbortController | null = null;

  const ranges = $derived.by(() => {
    cachedCount;
    const arr: { start: number; end: number }[] = [];
    let rangeStart = -1;
    for (let f = 0; f < buildTotal; f++) {
      if (frameCache.has(f)) {
        if (rangeStart === -1) rangeStart = f;
      } else if (rangeStart !== -1) {
        arr.push({ start: rangeStart, end: f - 1 });
        rangeStart = -1;
      }
    }
    if (rangeStart !== -1) arr.push({ start: rangeStart, end: buildTotal - 1 });
    return arr;
  });

  const isReady = $derived.by(() => {
    cachedCount;
    return Array.from(
      { length: animationState.project.fps },
      (_, k) =>
        (animationState.currentFrame + k) % animationState.project.totalFrames,
    ).every((f) => frameCache.has(f));
  });

  function cancelBuild() {
    if (abortCtrl) {
      abortCtrl.abort();
      abortCtrl = null;
    }
    isBuilding = false;
  }

  function invalidate() {
    cancelBuild();
    for (const bm of frames.values()) bm.close();
    frames.clear();
    cachedCount = 0;
    buildTotal = 0;
  }

  async function startFrom(
    startFrame: number,
    project: AnimationProject,
    priority = 2,
  ) {
    cancelBuild();

    // Snapshot project to avoid proxy mutation mid-build
    const snap = JSON.parse(JSON.stringify(project)) as AnimationProject;
    buildTotal = snap.totalFrames; // frames 0..totalFrames-1 (end anchor excluded from output)
    isBuilding = true;

    abortCtrl = new AbortController();
    const signal = abortCtrl.signal;

    const [lw, lh] = computeLowRes(snap.width, snap.height);

    // Build order: startFrame → totalFrames-1, then 0 → startFrame-1
    const order: number[] = [];
    for (let f = startFrame; f < snap.totalFrames; f++) order.push(f);
    for (let f = 0; f < startFrame; f++) order.push(f);

    // Run one worker lane: claims frames from the shared queue and renders them.
    // Multiple lanes run in parallel (up to hardwareConcurrency), each awaiting
    // renderFrameLowRes independently so all pool workers stay busy.
    let idx = 0;
    async function lane() {
      while (!signal.aborted && idx < order.length) {
        const frame = order[idx++]; // claim atomically (JS is single-threaded between awaits)
        if (frames.has(frame)) continue;
        const bm = await renderFrameLowRes(
          frame,
          snap,
          lw,
          lh,
          signal,
          priority,
          ++_seq,
        );
        if (!signal.aborted && bm) {
          frames.set(frame, bm);
          cachedCount++;
        }
      }
    }

    // Background mode (priority 2): use 1 lane so at most one worker is occupied,
    // keeping the rest free for higher-priority foreground renders.
    // Boosted mode (priority 1, modal open): AnimatorPreview is suspended, so use
    // full concurrency to saturate all workers with cache frames.
    const concurrency = priority <= 1 ? navigator.hardwareConcurrency || 4 : 1;
    await Promise.all(Array.from({ length: concurrency }, lane));

    if (!signal.aborted) isBuilding = false;
  }

  return {
    get cachedCount() {
      return cachedCount;
    },
    get buildTotal() {
      return buildTotal;
    },
    get isBuilding() {
      return isBuilding;
    },
    get ranges() {
      return ranges;
    },
    get isReady() {
      return isReady;
    },
    has: (f: number) => frames.has(f),
    get: (f: number) => frames.get(f),
    invalidate,
    startFrom,
  };
}

async function renderFrameLowRes(
  frame: number,
  project: AnimationProject,
  lw: number,
  lh: number,
  signal: AbortSignal,
  priority = 2,
  seq = 0,
): Promise<ImageBitmap | null> {
  const state = interpolateAll(project, frame);
  const zoom = state.zoom;
  const scale = scaleForZoom(zoom, 256);
  const precisionMode = getPrecisionMode(zoom);
  const colorConfig: ColorConfig = JSON.parse(JSON.stringify(state.colors));
  const maxIter = state.maxIter;
  const power = state.power;
  const isHistogram = baseAlgorithm(colorConfig.algorithm) === "histogram";

  const id = `cache-f${frame}-${seq}`;
  const pool = AnimatorCachePool.instance;

  return new Promise<ImageBitmap | null>((resolve) => {
    if (signal.aborted) {
      resolve(null);
      return;
    }

    const onAbort = () => {
      pool.cancel(id);
      resolve(null);
    };
    signal.addEventListener("abort", onAbort, { once: true });

    pool.submit(
      {
        id,
        cx: state.cx,
        cy: state.cy,
        scale: scale.toString(),
        tileW: lw,
        tileH: lh,
        maxIter,
        power,
        precisionMode,
        colorConfig,
        priority,
      },
      async (result) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) {
          resolve(null);
          return;
        }

        if (isHistogram && result.iters) {
          // Single-tile histogram: build CDF from this tile, then recolor
          const cdf = buildCdf([result.iters], maxIter);
          const rcId = `${id}-rc`;
          const rcPool = AnimatorRecolorPool.instance;

          const onAbortRc = () => {
            rcPool.cancel(rcId);
            resolve(null);
          };
          signal.addEventListener("abort", onAbortRc, { once: true });

          const rcIters = new Float32Array(result.iters);
          rcPool.submit(
            {
              id: rcId,
              iters: rcIters,
              tileW: lw,
              tileH: lh,
              maxIter,
              colorConfig,
              cdf,
              priority,
            },
            async (rcResult) => {
              signal.removeEventListener("abort", onAbortRc);
              if (signal.aborted) {
                resolve(null);
                return;
              }
              resolve(await createImageBitmap(rcResult.imageData));
            },
            [rcIters.buffer],
          );
        } else {
          resolve(await createImageBitmap(result.imageData));
        }
      },
    );
  });
}

export const frameCache = createFrameCache();
