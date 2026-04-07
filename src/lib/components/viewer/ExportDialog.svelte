<script lang="ts">
  import { onDestroy } from "svelte";
  import { viewerState } from "$lib/stores/viewerState.svelte";
  import { ViewerExportPool } from "$lib/rendering/worker/pools/viewerExportPool";
  import { getPrecisionMode, scaleForZoom } from "$lib/utils/precision";
  import { presetsFor } from "$lib/utils/colorPalettes";
  import { savedPalettes } from "$lib/stores/savedPalettes.svelte";
  import { PRESET_LOCATIONS } from "$lib/utils/locations";
  import type { Location } from "$lib/utils/locations";
  import { savedLocations } from "$lib/stores/savedLocations.svelte";
  import type { ColorConfig } from "$lib/utils/colorPalettes";
  import ToggleButton from "./ToggleButton.svelte";
  import { ALGORITHMS } from "$lib/utils/colorPalettes";

  let { onclose }: { onclose: () => void } = $props();

  const dpr = window.devicePixelRatio || 1;
  const physW = Math.round(window.innerWidth * dpr);
  const physH = Math.round(window.innerHeight * dpr);

  const resolutions = [
    {
      label: `Current view (${physW}×${physH})`,
      w: physW,
      h: physH,
      wide: true,
    },
    { label: "256×256", w: 256, h: 256 },
    { label: "1920×1080 (FHD)", w: 1920, h: 1080 },
    { label: "3840×2160 (4K)", w: 3840, h: 2160 },
    { label: "7680×4320 (8K)", w: 7680, h: 4320 },
  ];

  const formats = [
    { label: "PNG", mime: "image/png", ext: "png" },
    { label: "WebP", mime: "image/webp", ext: "webp" },
    { label: "JPEG", mime: "image/jpeg", ext: "jpg" },
  ];

  let selectedRes = $state(0);
  let selectedFormat = $state(0);
  let showOverlay = $state(true);

  type Phase = "idle" | "exporting" | "done";
  let phase = $state<Phase>("idle");
  let progress = $state(0);
  let resultUrl = $state("");
  let resultFilename = $state("");
  let cancelFn: (() => void) | null = null;

  onDestroy(() => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  });

  function saveFile() {
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = resultFilename;
    a.click();
  }

  function reset() {
    URL.revokeObjectURL(resultUrl);
    resultUrl = "";
    phase = "idle";
  }

  function findLocationName(
    cx: string,
    cy: string,
    zoom: number,
  ): string | null {
    const re = parseFloat(cx);
    const im = parseFloat(cy);
    const eps = scaleForZoom(zoom) * 2;
    const match = (loc: Location) =>
      loc.zoom === zoom &&
      Math.abs(re - loc.re) < eps &&
      Math.abs(im - loc.im) < eps;
    return (
      PRESET_LOCATIONS.find(match)?.name ??
      savedLocations.all.find(match)?.name ??
      null
    );
  }

  function drawOverlay(
    ctx: OffscreenCanvasRenderingContext2D,
    w: number,
    h: number,
    cx: string,
    cy: string,
    zoom: number,
    maxIter: number,
    power: number,
    colorConfig: ColorConfig,
  ) {
    const fontSize = Math.max(12, Math.round(Math.min(w, h) / 50));
    const pad = fontSize;
    const lineH = fontSize * 1.6;

    const paletteStr = JSON.stringify(colorConfig.palette);
    const presetName = Object.entries(presetsFor(colorConfig.algorithm)).find(
      ([, p]) => JSON.stringify(p.palette) === paletteStr,
    )?.[0];
    const savedName = savedPalettes.all.find(
      (p) => JSON.stringify(p.config.palette) === paletteStr,
    )?.name;
    const paletteName = presetName ?? (savedName ? `${savedName}*` : "Custom");
    const algorithm =
      ALGORITHMS.find((a) => (a.value = colorConfig.algorithm))?.label ??
      "Custom";

    const locationName = findLocationName(cx, cy, zoom);
    const lines = [
      ...(locationName ? [locationName] : []),
      algorithm,
      `${cx}Re ${cy}Im`,
      `Z${zoom}/I${maxIter}/E${power}`,
      `Palette: ${paletteName}`,
      `C_P${colorConfig.cyclePeriod}/O${colorConfig.offset.toFixed(3)}`,
    ];

    ctx.font = `${fontSize}px monospace`;
    const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxW = textWidth + pad * 2;
    const boxH = lines.length * lineH + pad * 1.5;

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(pad / 2, h - boxH - pad / 2, boxW, boxH);
    ctx.fillStyle = "white";
    lines.forEach((line, i) => {
      ctx.fillText(line, pad, h - boxH - pad / 2 + pad + i * lineH + fontSize);
    });
  }

  async function exportPng() {
    const { w, h } = resolutions[selectedRes];
    phase = "exporting";
    progress = 0;

    const TILE = 256;
    const tilesX = Math.ceil(w / TILE);
    const tilesY = Math.ceil(h / TILE);
    const total = tilesX * tilesY;

    const offscreen = new OffscreenCanvas(w, h);
    const ctx = offscreen.getContext("2d")!;

    const zoom = viewerState.zoom;
    const cx = viewerState.cx;
    const cy = viewerState.cy;
    const scale = scaleForZoom(zoom, TILE);
    const precisionMode = getPrecisionMode(zoom);
    const pool = ViewerExportPool.instance;
    const cxCenter = parseFloat(cx);
    const cyCenter = parseFloat(cy);
    const colorConfig: ColorConfig = JSON.parse(
      JSON.stringify(viewerState.colors),
    );
    const maxIter = viewerState.maxIter;
    const power = viewerState.power;
    const exportId = Date.now();
    const jobIds: string[] = [];

    try {
      await new Promise<void>((resolve, reject) => {
        cancelFn = () => {
          for (const id of jobIds) pool.cancel(id);
          reject(new Error("cancelled"));
        };

        if (total === 0) {
          resolve();
          return;
        }
        let done = 0;

        for (let ty = 0; ty < tilesY; ty++) {
          for (let tx = 0; tx < tilesX; tx++) {
            const tileCx = (
              cxCenter +
              (tx * TILE + TILE / 2 - w / 2) * scale
            ).toString();
            const tileCy = (
              cyCenter +
              (ty * TILE + TILE / 2 - h / 2) * scale
            ).toString();
            const id = `export-${exportId}-${tx}-${ty}`;
            jobIds.push(id);

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
                priority: 0,
              },
              (result) => {
                ctx.putImageData(result.imageData, tx * TILE, ty * TILE);
                done++;
                progress = done / total;
                if (done === total) resolve();
              },
            );
          }
        }
      });

      if (showOverlay)
        drawOverlay(ctx, w, h, cx, cy, zoom, maxIter, power, colorConfig);

      const fmt = formats[selectedFormat];
      const blob = await offscreen.convertToBlob({ type: fmt.mime });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(blob);
      resultFilename = `mandelbrot-z${zoom}-${w}x${h}.${fmt.ext}`;
      phase = "done";
    } catch (e: any) {
      if (e.message !== "cancelled") throw e;
      phase = "idle";
    } finally {
      cancelFn = null;
    }
  }
</script>

<div
  class="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
  role="dialog"
  aria-modal="true"
>
  <div
    class="bg-neutral-900 border border-neutral-700 rounded-lg p-5 flex flex-col gap-4 {phase ===
    'done'
      ? 'max-w-[90vw]'
      : 'w-80'}"
  >
    <div class="flex items-center justify-between">
      <h2 class="text-white font-medium">Export</h2>
      <button class="text-neutral-400 hover:text-white" onclick={onclose}
        >✕</button
      >
    </div>

    {#if phase !== "done"}
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <div class="text-neutral-400 text-xs">Resolution</div>
          <div class="grid grid-cols-2 gap-1">
            {#each resolutions as r, i (r.label)}
              <ToggleButton
                active={selectedRes === i}
                onclick={() => (selectedRes = i)}
                disabled={phase === "exporting"}
                variant="neutral"
                class={r.wide ? "col-span-2" : ""}>{r.label}</ToggleButton
              >
            {/each}
          </div>
          {#if selectedRes === 0}
            <p class="text-xs text-neutral-400">
              Pixel-exact match of the current view.
            </p>
          {:else}
            <p class="text-xs text-neutral-400">
              Centered on the current view, but the field of view will differ
              due to the different aspect ratio and resolution.
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-neutral-400 text-xs">Format</div>
          <div class="flex gap-1">
            {#each formats as f, i (f.label)}
              <ToggleButton
                active={selectedFormat === i}
                onclick={() => (selectedFormat = i)}
                disabled={phase === "exporting"}
                variant="neutral"
                class="flex-1">{f.label}</ToggleButton
              >
            {/each}
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-neutral-400 text-xs">Options</div>
          <ToggleButton
            active={showOverlay}
            onclick={() => (showOverlay = !showOverlay)}
            disabled={phase === "exporting"}
            variant="neutral"
            checkbox>Include info overlay</ToggleButton
          >
        </div>

        {#if phase === "exporting"}
          <div class="flex flex-col gap-2">
            <div class="h-1.5 bg-neutral-700 rounded overflow-hidden">
              <div
                class="h-full bg-blue-500 transition-all"
                style="width:{progress * 100}%"
              ></div>
            </div>
            <div
              class="flex items-center justify-between text-xs text-neutral-400"
            >
              <span>Generating… {Math.round(progress * 100)}%</span>
              <button
                class="text-red-400 hover:text-red-300"
                onclick={() => cancelFn?.()}>Cancel</button
              >
            </div>
          </div>
        {:else}
          <button
            class="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm py-1.5 rounded transition-colors"
            onclick={exportPng}>Export {formats[selectedFormat].label}</button
          >
        {/if}
      </div>
    {:else}
      <img
        src={resultUrl}
        alt="Export preview"
        class="rounded border border-neutral-700 max-h-[70vh] object-contain"
      />
      <div class="flex gap-2">
        <button
          class="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-sm py-1.5 rounded transition-colors"
          onclick={saveFile}>Save {formats[selectedFormat].label}</button
        >
        <button
          class="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white text-sm py-1.5 rounded border border-neutral-700 transition-colors"
          onclick={reset}>Export Another</button
        >
      </div>
    {/if}
  </div>
</div>
