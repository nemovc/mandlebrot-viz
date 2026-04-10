<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { animationState } from '$lib/stores/animationState.svelte';
  import { interpolateAll } from '$lib/utils/animator/interpolation';
  import { AnimatorPreviewPool } from '$lib/rendering/worker/pools/animatorPreviewPool';
  import { AnimatorRecolorPool } from '$lib/rendering/worker/pools/animatorRecolorPool';
  import { getPrecisionMode, scaleForZoom } from '$lib/utils/precision';
  import { buildCdf, baseAlgorithm } from '$lib/utils/colorPalettes';
  import type { ColorConfig } from '$lib/utils/colorPalettes';
  import { SvelteMap } from 'svelte/reactivity';

  const TILE = 256;

  let { active = true } = $props();

  let canvas: HTMLCanvasElement;
  let wrapper: HTMLDivElement;
  let container: HTMLDivElement;
  let canvasW = 0;
  let canvasH = 0;

  let activeCancels: Array<() => void> = [];
  let renderSeq = 0;

  function cancelActive() {
    for (const cancel of activeCancels) cancel();
    activeCancels = [];
  }

  function renderFrame(frame: number) {
    if (!canvas || canvasW === 0 || canvasH === 0) return;
    if (animationState.project.tracks.every((t) => t.keyframes.length === 0)) return;

    cancelActive();
    const seq = ++renderSeq;

    const project = animationState.project;
    const state = interpolateAll(project, frame);

    const ctx = canvas.getContext('2d')!;

    const zoom = state.zoom;
    const cxCenter = parseFloat(state.cx);
    const cyCenter = parseFloat(state.cy);
    const scale = (scaleForZoom(zoom, TILE) * project.width) / canvasW;
    const precisionMode = getPrecisionMode(zoom);
    const colorConfig: ColorConfig = JSON.parse(JSON.stringify(state.colors));
    const maxIter = state.maxIter;
    const power = state.power;

    const tilesX = Math.ceil(canvasW / TILE);
    const tilesY = Math.ceil(canvasH / TILE);
    const total = tilesX * tilesY;
    if (total === 0) return;

    const pool = AnimatorPreviewPool.instance;
    const batchId = `preview-${seq}`;
    const isHistogram = baseAlgorithm(colorConfig.algorithm) === 'histogram';
    const tileIters = new SvelteMap<string, Float32Array>();
    let passOneDone = 0;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tileCx = (cxCenter + (tx * TILE + TILE / 2 - canvasW / 2) * scale).toString();
        const tileCy = (cyCenter + (ty * TILE + TILE / 2 - canvasH / 2) * scale).toString();
        const id = `${batchId}-${tx}-${ty}`;
        activeCancels.push(() => pool.cancel(id));
        pool.submit(
          {
            id,
            cx: tileCx,
            cy: tileCy,
            scale: scale.toString(),
            tileW: TILE,
            tileH: TILE,
            maxIter,
            power,
            precisionMode,
            colorConfig,
            priority: 1
          },
          (result) => {
            if (seq !== renderSeq) return;
            ctx.putImageData(result.imageData, tx * TILE, ty * TILE);
            if (isHistogram && result.iters) tileIters.set(`${tx},${ty}`, result.iters);
            passOneDone++;
            if (isHistogram && passOneDone === total) {
              // Pass 2: build CDF from all tiles and recolor
              const cdf = buildCdf([...tileIters.values()], maxIter);
              const rcPool = AnimatorRecolorPool.instance;
              for (let ry = 0; ry < tilesY; ry++) {
                for (let rx = 0; rx < tilesX; rx++) {
                  const iters = tileIters.get(`${rx},${ry}`);
                  if (!iters) continue;
                  const rcId = `${batchId}-rc-${rx}-${ry}`;
                  const rcIters = new Float32Array(iters);
                  activeCancels.push(() => rcPool.cancel(rcId));
                  rcPool.submit(
                    {
                      id: rcId,
                      iters: rcIters,
                      tileW: TILE,
                      tileH: TILE,
                      maxIter,
                      colorConfig,
                      cdf,
                      priority: 1
                    },
                    (rcResult) => {
                      if (seq !== renderSeq) return;
                      ctx.putImageData(rcResult.imageData, rx * TILE, ry * TILE);
                    },
                    [rcIters.buffer]
                  );
                }
              }
            }
          }
        );
      }
    }
  }

  function updateCanvasSize() {
    if (!canvas || !wrapper || !container) return;
    const { width: projW, height: projH } = animationState.project;
    const ar = projW / projH;
    // Cap at animation dimensions — don't upscale beyond what the export would be
    const availW = Math.min(container.clientWidth, projW);
    const availH = Math.min(container.clientHeight, projH);
    let w = availW;
    let h = availW / ar;
    if (h > availH) {
      h = availH;
      w = availH * ar;
    }
    const newW = Math.round(w);
    const newH = Math.round(h);
    // Only update if dimensions actually changed - prevents canvas clearing on every state change
    if (newW !== canvasW || newH !== canvasH) {
      canvasW = newW;
      canvasH = newH;
      wrapper.style.width = `${canvasW}px`;
      wrapper.style.height = `${canvasH}px`;
      canvas.width = canvasW;
      canvas.height = canvasH;
      if (active) renderFrame(animationState.currentFrame);
    }
  }

  // Re-size canvas when animation dimensions change
  // The function itself checks if dimensions actually changed to avoid unnecessary canvas clears
  const dimensionsKey = $derived(
    `${animationState.project.width}x${animationState.project.height}`
  );
  $effect(() => {
    dimensionsKey;
    updateCanvasSize();
  });

  // Re-render when frame changes OR when project is first seeded (keyframes go from 0 → >0).
  // `active` is checked first so that when inactive, currentFrame/hasKeyframes are never read
  // and therefore not tracked — the effect won't re-run on every playback frame advance.
  const hasKeyframes = $derived(animationState.project.tracks.some((t) => t.keyframes.length > 0));
  $effect(() => {
    if (!active) {
      cancelActive();
      return;
    }
    const frame = animationState.currentFrame;
    hasKeyframes;
    renderFrame(frame);
  });

  let ro: ResizeObserver;
  onMount(() => {
    ro = new ResizeObserver(updateCanvasSize);
    ro.observe(container);
    updateCanvasSize();
  });

  onDestroy(() => {
    ro?.disconnect();
    cancelActive();
  });
</script>

<!--
  The wrapper sizes itself to fit the available space while maintaining the animation aspect ratio.
  CSS `aspect-ratio` + `max-width/max-height` gives contain-style behavior.
-->
<div
  bind:this={container}
  class="flex items-center justify-center w-full h-full bg-neutral-950 overflow-hidden"
>
  <div bind:this={wrapper} class="relative bg-black shrink-0">
    <canvas bind:this={canvas} class="absolute inset-0 w-full h-full block"></canvas>
  </div>
</div>
