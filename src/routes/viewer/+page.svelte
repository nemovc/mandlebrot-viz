<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import MandelbrotMap from "$lib/components/viewer/MandelbrotMap.svelte";
  import ControlPanel from "$lib/components/viewer/ControlPanel.svelte";
  import ColorSchemeEditor from "$lib/components/viewer/ColorSchemeEditor.svelte";
  import ExportDialog from "$lib/components/viewer/ExportDialog.svelte";
  import { viewerState } from "$lib/stores/viewerState.svelte";
  import { debugState } from "$lib/stores/debugState.svelte";
  import { encodeState } from "$lib/utils/urlSerializer";
  import { getWorkerPool, getRecolorPool } from "$lib/rendering/worker/workerPool";
  import { getPrecisionMode } from "$lib/utils/precision";

  let showExport = $state(false);
  let mapComponent: MandelbrotMap;
  let shareCopied = $state(false);
  let debugOpen = $state(false);

  // Pool progress
  let s2Completed = $state(0), s2Total = $state(0);
  let s3Completed = $state(0), s3Total = $state(0);
  let rcCompleted = $state(0), rcTotal = $state(0);

  type PoolDebug = { poolSize: number; idle: number; activeS2: number; activeS3: number; queued: number };
  const emptyPool: PoolDebug = { poolSize: 0, idle: 0, activeS2: 0, activeS3: 0, queued: 0 };
  let renderPoolDebug = $state<PoolDebug>(emptyPool);
  let recolorPoolDebug = $state<PoolDebug>(emptyPool);

  // Memory snapshot (Chrome only)
  let memUsed = $state<number | null>(null);
  let memTotal = $state<number | null>(null);

  onMount(() => {
    const renderPool = getWorkerPool();
    renderPool.onProgress = (stage, completed, total) => {
      if (stage === 2) { s2Completed = completed; s2Total = total; }
      else             { s3Completed = completed; s3Total = total; }
      renderPoolDebug = renderPool.debugState;
    };

    const rcPool = getRecolorPool();
    rcPool.onProgress = (_stage, completed, total) => {
      rcCompleted = completed; rcTotal = total;
      recolorPoolDebug = rcPool.debugState;
    };

    // Refresh memory every 2s when debug panel is open
    const memInterval = setInterval(() => {
      if (!debugOpen) return;
      const mem = (performance as any).memory;
      if (mem) { memUsed = mem.usedJSHeapSize; memTotal = mem.jsHeapSizeLimit; }
    }, 2000);
    return () => clearInterval(memInterval);
  });

  function shareLink() {
    const encoded = encodeState(viewerState.toJSON());
    navigator.clipboard.writeText(`${location.origin}${location.pathname}#${encoded}`);
    shareCopied = true;
    setTimeout(() => (shareCopied = false), 2000);
  }

  // Sync state to URL hash whenever it changes.
  $effect(() => {
    if (!browser) return;
    const encoded = encodeState(viewerState.toJSON());
    location.hash = encoded;
  });

  function fmtBytes(b: number) {
    return (b / 1024 / 1024).toFixed(0) + ' MB';
  }

  function bar(completed: number, total: number) {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }
</script>

<svelte:head>
  <title>Mandelbrot Explorer — Viewer</title>
</svelte:head>

<div class="relative w-full h-full">
  <MandelbrotMap bind:this={mapComponent} />

  <!-- Render progress bars -->
  {#if s2Total > 0 && s2Completed < s2Total}
    <div class="absolute top-0 left-0 right-0 z-[2000] h-1 bg-neutral-800 pointer-events-none">
      <div class="h-full bg-blue-400 transition-all duration-150" style="width:{bar(s2Completed,s2Total)}%"></div>
    </div>
  {/if}
  {#if s3Total > 0 && s3Completed < s3Total}
    <div class="absolute top-1 left-0 right-0 z-[2000] h-1 bg-neutral-800 pointer-events-none">
      <div class="h-full bg-green-500 transition-all duration-150" style="width:{bar(s3Completed,s3Total)}%"></div>
    </div>
  {/if}

  <!-- HUD overlays -->
  <div class="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
    <ControlPanel onNavigate={(re, im, zoom) => mapComponent.panTo(re, im, zoom)} />
  </div>

  <div class="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
    <ColorSchemeEditor />
  </div>

  <!-- Actions -->
  <div class="absolute bottom-3 right-3 z-[1000]">
    <div class="flex flex-col gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded-lg min-w-36">
      <div class="text-neutral-400 text-xs font-medium uppercase tracking-wider">Actions</div>
      <div class="flex flex-col gap-1.5">
        <button
          class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
          onclick={() => mapComponent.resetView()}>Reset View</button>
        <button
          class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
          onclick={shareLink}
        >{#if shareCopied}<span class="text-green-400">✓ Copied</span>{:else}Share Link{/if}</button>
        <button
          class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
          onclick={() => (showExport = true)}>Export Image</button>
      </div>
    </div>
  </div>

  <!-- Debug panel -->
  <div class="absolute bottom-3 left-3 z-[1000]">
    <div class="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden min-w-52">
      <button
        class="w-full flex items-center justify-between px-3 py-2 text-neutral-400 text-xs font-medium uppercase tracking-wider hover:text-white transition-colors"
        onclick={() => (debugOpen = !debugOpen)}
      >
        Debug
        <span class="text-neutral-600">{debugOpen ? '▲' : '▼'}</span>
      </button>

      {#if debugOpen}
        <div class="flex flex-col gap-4 px-3 pb-3 border-t border-neutral-800">

          <!-- Toggles -->
          <div class="flex flex-col gap-1.5 pt-3">
            <label class="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
              <input type="checkbox" bind:checked={debugState.debugLogging} class="accent-blue-500" />
              Debug logging
            </label>
            <label class="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
              <input type="checkbox" bind:checked={debugState.showCrosshair} class="accent-blue-500" />
              Show crosshair
            </label>
            <label class="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
              <input type="checkbox" bind:checked={debugState.showTileSquare} class="accent-blue-500" />
              Show tile square
            </label>
            <label class="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
              <input type="checkbox" bind:checked={debugState.slowMode} class="accent-blue-500" />
              Slow mode
            </label>
          </div>

          <!-- Render pool -->
          <div class="flex flex-col gap-1.5">
            <div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">Render Pool ({renderPoolDebug.poolSize})</div>
            <div class="font-mono text-xs text-neutral-300 leading-5">
              <div class="flex gap-3">
                <span>idle <span class="text-white">{renderPoolDebug.idle}</span></span>
                <span>S2 <span class="text-blue-400">{renderPoolDebug.activeS2}</span></span>
                <span>S3 <span class="text-green-400">{renderPoolDebug.activeS3}</span></span>
                <span>q <span class="text-white">{renderPoolDebug.queued}</span></span>
              </div>
            </div>
            {#if s2Total > 0}
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-500 w-4">S2</span>
                <div class="flex-1 h-1 bg-neutral-700 rounded overflow-hidden">
                  <div class="h-full bg-blue-400 transition-all" style="width:{bar(s2Completed,s2Total)}%"></div>
                </div>
                <span class="text-xs text-neutral-500 w-12 text-right">{s2Completed}/{s2Total}</span>
              </div>
            {/if}
            {#if s3Total > 0}
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-500 w-4">S3</span>
                <div class="flex-1 h-1 bg-neutral-700 rounded overflow-hidden">
                  <div class="h-full bg-green-500 transition-all" style="width:{bar(s3Completed,s3Total)}%"></div>
                </div>
                <span class="text-xs text-neutral-500 w-12 text-right">{s3Completed}/{s3Total}</span>
              </div>
            {/if}
          </div>

          <!-- Recolor pool -->
          <div class="flex flex-col gap-1.5">
            <div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">Recolor Pool ({recolorPoolDebug.poolSize})</div>
            <div class="font-mono text-xs text-neutral-300 leading-5">
              <div class="flex gap-3">
                <span>idle <span class="text-white">{recolorPoolDebug.idle}</span></span>
                <span>active <span class="text-purple-400">{recolorPoolDebug.activeS3}</span></span>
                <span>q <span class="text-white">{recolorPoolDebug.queued}</span></span>
              </div>
            </div>
            {#if rcTotal > 0}
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-500 w-4">RC</span>
                <div class="flex-1 h-1 bg-neutral-700 rounded overflow-hidden">
                  <div class="h-full bg-purple-400 transition-all" style="width:{bar(rcCompleted,rcTotal)}%"></div>
                </div>
                <span class="text-xs text-neutral-500 w-12 text-right">{rcCompleted}/{rcTotal}</span>
              </div>
            {/if}
          </div>

          <!-- System info -->
          <div class="flex flex-col gap-1.5">
            <div class="text-neutral-500 text-xs font-medium uppercase tracking-wider">System</div>
            <div class="font-mono text-xs text-neutral-300 leading-5 flex flex-col gap-0.5">
              <div>{window.innerWidth}×{window.innerHeight} px @ {window.devicePixelRatio}x DPR</div>
              <div>zoom {viewerState.zoom} · {getPrecisionMode(viewerState.zoom)}</div>
              {#if memUsed !== null && memTotal !== null}
                <div>heap {fmtBytes(memUsed)} / {fmtBytes(memTotal)}</div>
              {:else}
                <div class="text-neutral-600">heap n/a</div>
              {/if}
            </div>
          </div>

        </div>
      {/if}
    </div>
  </div>
</div>

{#if showExport}
  <ExportDialog onclose={() => (showExport = false)} />
{/if}
