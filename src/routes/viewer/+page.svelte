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
  import { Code2, CircleUserRound } from "lucide-svelte";
  import { ViewerS2Pool } from "$lib/rendering/worker/pools/viewerS2Pool";
  import { ViewerS3Pool } from "$lib/rendering/worker/pools/viewerS3Pool";
  import { ViewerRecolorPool } from "$lib/rendering/worker/pools/viewerRecolorPool";

  let showExport = $state(false);
  let mapComponent: MandelbrotMap;

  // Pool progress (drives the HUD progress bars)
  let s2Completed = $state(0),
    s2Total = $state(0);
  let s3Completed = $state(0),
    s3Total = $state(0);
  let rcCompleted = $state(0),
    rcTotal = $state(0);

  // Restore debug state from URL on load
  if (browser && window.location.hash) {
    const decoded = decodeState(window.location.hash);
    if (decoded?.debug) debugState.loadFrom(decoded.debug);
  }

  onMount(() => {
    const s2Handler = (completed: number, total: number) => { s2Completed = completed; s2Total = total; };
    const s3Handler = (completed: number, total: number) => { s3Completed = completed; s3Total = total; };
    const rcHandler = (completed: number, total: number) => { rcCompleted = completed; rcTotal = total; };
    ViewerS2Pool.instance.onProgress.push(s2Handler);
    ViewerS3Pool.instance.onProgress.push(s3Handler);
    ViewerRecolorPool.instance.onProgress.push(rcHandler);
    return () => {
      ViewerS2Pool.instance.onProgress.splice(ViewerS2Pool.instance.onProgress.indexOf(s2Handler), 1);
      ViewerS3Pool.instance.onProgress.splice(ViewerS3Pool.instance.onProgress.indexOf(s3Handler), 1);
      ViewerRecolorPool.instance.onProgress.splice(ViewerRecolorPool.instance.onProgress.indexOf(rcHandler), 1);
    };
  });

  onMount(() => {
    function handleHashChange() {
      const decoded = decodeState(window.location.hash);
      if (!decoded?.viewer) return;
      viewerState.loadFrom(decoded.viewer);
      if (decoded.debug) debugState.loadFrom(decoded.debug);
      const re = parseFloat(decoded.viewer.cx ?? viewerState.cx);
      const im = parseFloat(decoded.viewer.cy ?? viewerState.cy);
      const zoom = decoded.viewer.zoom ?? viewerState.zoom;
      mapComponent?.panTo(re, im, zoom);
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });

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

  <!-- Zoom controls -->
  <div class="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col">
    <button
      class="w-8 h-8 flex items-center justify-center bg-neutral-900/90 hover:bg-neutral-700 border border-neutral-700 border-b-0 text-white text-lg rounded-t transition-colors select-none"
      onclick={() => mapComponent.zoomIn()}
      title="Zoom in"
    >+</button>
    <button
      class="w-8 h-8 flex items-center justify-center bg-neutral-900/90 hover:bg-neutral-700 border border-neutral-700 text-white text-lg rounded-b transition-colors select-none"
      onclick={() => mapComponent.zoomOut()}
      title="Zoom out"
    >−</button>
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
    />
  </div>

  <!-- Info bar -->
  <div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000]">
    <div class="flex items-center gap-3 text-[11px] text-neutral-400 select-none bg-neutral-900/80 border border-neutral-700 rounded px-2 py-1">
      <a
        href="https://github.com/nemovc/mandlebrot-viz"
        target="_blank"
        rel="noopener noreferrer"
        class="text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1.5"
      >
        Mandelbrot Explorer
        <Code2 size={13} />
      </a>
      <span class="text-neutral-700">·</span>
      <a
        href="https://github.com/nemovc"
        target="_blank"
        rel="noopener noreferrer"
        class="text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1"
      >
        by nemovc
        <CircleUserRound size={13} />
      </a>
    </div>
  </div>
</div>

{#if showExport}
  <ExportDialog onclose={() => (showExport = false)} />
{/if}
