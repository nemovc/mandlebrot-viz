<script lang="ts">
  import { browser } from "$app/environment";
  import MandelbrotMap from "$lib/components/viewer/MandelbrotMap.svelte";
  import ControlPanel from "$lib/components/viewer/ControlPanel.svelte";
  import ColorSchemeEditor from "$lib/components/viewer/ColorSchemeEditor.svelte";
  import ExportDialog from "$lib/components/viewer/ExportDialog.svelte";
  import { viewerState } from "$lib/stores/viewerState.svelte";
  import { encodeState } from "$lib/utils/urlSerializer";

  let showExport = $state(false);
  let mapComponent: MandelbrotMap;
  let shareCopied = $state(false);

  function shareLink() {
    const encoded = encodeState(viewerState.toJSON());
    navigator.clipboard.writeText(
      `${location.origin}${location.pathname}#${encoded}`,
    );
    shareCopied = true;
    setTimeout(() => (shareCopied = false), 2000);
  }

  // Sync state to URL hash whenever it changes.
  // Use location.hash directly — SvelteKit only manages pathname,
  // not hash, so this doesn't conflict with its router.
  $effect(() => {
    if (!browser) return;
    const encoded = encodeState(viewerState.toJSON());
    location.hash = encoded;
  });
</script>

<svelte:head>
  <title>Mandelbrot Explorer — Viewer</title>
</svelte:head>

<div class="relative w-full h-full">
  <MandelbrotMap bind:this={mapComponent} />

  <!-- HUD overlays -->
  <div class="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
    <ControlPanel
      onNavigate={(re, im, zoom) => mapComponent.panTo(re, im, zoom)}
    />
  </div>

  <div class="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
    <ColorSchemeEditor />
  </div>

  <div class="absolute bottom-3 right-3 z-[1000]">
    <div
      class="flex flex-col gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded-lg min-w-36"
    >
      <div
        class="text-neutral-400 text-xs font-medium uppercase tracking-wider"
      >
        Actions
      </div>
      <div class="flex flex-col gap-1.5">
        <button
          class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
          onclick={() => mapComponent.resetView()}>Reset View</button
        >
        <button
          class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
          onclick={shareLink}
          >{#if shareCopied}<span class="text-green-400">✓ Copied</span
            >{:else}Share Link{/if}</button
        >
        <button
          class="w-full px-2 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
          onclick={() => (showExport = true)}>Export Image</button
        >
      </div>
    </div>
  </div>
</div>

{#if showExport}
  <ExportDialog onclose={() => (showExport = false)} />
{/if}
