<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import MandelbrotMap from "$lib/components/viewer/MandelbrotMap.svelte";
  import ControlPanel from "$lib/components/viewer/ControlPanel.svelte";
  import ColorSchemeEditor from "$lib/components/viewer/ColorSchemeEditor.svelte";
  import ExportDialog from "$lib/components/viewer/ExportDialog.svelte";
  import ActionsPanel from "$lib/components/viewer/ActionsPanel.svelte";
  import DebugPanel from "$lib/components/viewer/DebugPanel.svelte";
  import { viewerState } from "$lib/stores/viewerState.svelte";
  import { debugState } from "$lib/stores/debugState.svelte";
  import { encodeState, decodeState } from "$lib/utils/urlSerializer";
  import {
    getWorkerPool,
    getRecolorPool,
  } from "$lib/rendering/worker/workerPool";

  let showExport = $state(false);
  let mapComponent: MandelbrotMap;

  // Pool progress
  let s2Completed = $state(0),
    s2Total = $state(0);
  let s3Completed = $state(0),
    s3Total = $state(0);
  let rcCompleted = $state(0),
    rcTotal = $state(0);

  type PoolDebug = {
    poolSize: number;
    idle: number;
    activeS2: number;
    activeS3: number;
    queued: number;
  };
  const emptyPool: PoolDebug = {
    poolSize: 0,
    idle: 0,
    activeS2: 0,
    activeS3: 0,
    queued: 0,
  };
  let renderPoolDebug = $state<PoolDebug>(emptyPool);
  let recolorPoolDebug = $state<PoolDebug>(emptyPool);

  // Restore debug state from URL on load
  if (browser && window.location.hash) {
    const decoded = decodeState(window.location.hash);
    if (decoded?.debug) debugState.loadFrom(decoded.debug);
  }

  onMount(() => {
    const renderPool = getWorkerPool();
    renderPool.onProgress = (stage, completed, total) => {
      if (stage === 2) {
        s2Completed = completed;
        s2Total = total;
      } else {
        s3Completed = completed;
        s3Total = total;
      }
      renderPoolDebug = renderPool.debugState;
    };

    const rcPool = getRecolorPool();
    rcPool.onProgress = (_stage, completed, total) => {
      rcCompleted = completed;
      rcTotal = total;
      recolorPoolDebug = rcPool.debugState;
    };
  });

  // Sync state to URL hash whenever it changes.
  $effect(() => {
    if (!browser) return;
    const encoded = encodeState(viewerState.toJSON(), debugState.toJSON());
    history.replaceState(null, '', '#' + encoded);
  });

  function bar(completed: number, total: number) {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }
</script>

<svelte:head>
  <title>Mandelbrot Explorer — Viewer</title>
</svelte:head>

<div class="relative w-full h-full">
  <MandelbrotMap bind:this={mapComponent} />

  <!-- Render progress bars (hidden during export, which has its own progress UI) -->
  {#if !showExport && s2Total > 0 && s2Completed < s2Total}
    <div
      class="absolute top-0 left-0 right-0 z-[2000] h-1 bg-neutral-800 pointer-events-none"
    >
      <div
        class="h-full bg-blue-400 transition-all duration-150"
        style="width:{bar(s2Completed, s2Total)}%"
      ></div>
    </div>
  {/if}
  {#if !showExport && s3Total > 0 && s3Completed < s3Total}
    <div
      class="absolute top-1 left-0 right-0 z-[2000] h-1 bg-neutral-800 pointer-events-none"
    >
      <div
        class="h-full bg-green-500 transition-all duration-150"
        style="width:{bar(s3Completed, s3Total)}%"
      ></div>
    </div>
  {/if}

  <!-- HUD overlays -->
  <div class="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
    <ControlPanel
      onNavigate={(re, im, zoom) => mapComponent.panTo(re, im, zoom)}
    />
  </div>

  <div class="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
    <ColorSchemeEditor />
  </div>

  <!-- Actions -->
  <div class="absolute bottom-3 right-3 z-[1000]">
    <ActionsPanel
      onResetView={() => mapComponent.resetView()}
      onExport={() => (showExport = true)}
    />
  </div>

  <!-- Debug panel -->
  <div class="absolute bottom-3 left-3 z-[1000]">
    <DebugPanel
      {s2Completed}
      {s2Total}
      {s3Completed}
      {s3Total}
      {rcCompleted}
      {rcTotal}
      {renderPoolDebug}
      {recolorPoolDebug}
    />
  </div>
</div>

{#if showExport}
  <ExportDialog onclose={() => (showExport = false)} />
{/if}
