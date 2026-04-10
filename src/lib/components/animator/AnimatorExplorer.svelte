<script lang="ts">
  import { untrack } from 'svelte';
  import MandelbrotMap from '$lib/components/viewer/MandelbrotMap.svelte';
  import type { ViewerState } from '$lib/stores/viewerState.svelte';

  let {
    initialState,
    onUpdate,
    projectWidth,
    panelWidth,
    syncSignal = 0
  }: {
    initialState: ViewerState;
    onUpdate: (state: ViewerState) => void;
    projectWidth: number;
    panelWidth: number;
    syncSignal?: number;
  } = $props();

  const zoomOffset = $derived(Math.log2(projectWidth / panelWidth));

  let localState = $state<ViewerState>(JSON.parse(JSON.stringify(initialState)));
  let mapRef: { panTo: (re: number, im: number, zoom?: number) => void } | undefined = $state();
  let isSyncingFromParent = false;

  // Sync initialState changes (from parent) to localState
  $effect(() => {
    // Watch initialState properties for changes from parent
    initialState.maxIter;
    initialState.power;
    initialState.colors;
    initialState.cx;
    initialState.cy;
    initialState.zoom;
    syncSignal;

    untrack(() => {
      isSyncingFromParent = true;
      const s = initialState;
      localState.maxIter = s.maxIter;
      localState.power = s.power;
      localState.colors = JSON.parse(JSON.stringify(s.colors));
      localState.cx = s.cx;
      localState.cy = s.cy;
      localState.zoom = s.zoom;
      if (mapRef) {
        mapRef.panTo(parseFloat(s.cx), parseFloat(s.cy), s.zoom);
      }
      // Reset flag after a microtask to allow map to update
      setTimeout(() => { isSyncingFromParent = false; }, 0);
    });
  });

  // Watch for map-driven changes (cx/cy/zoom from user panning/zooming)
  // Only notify parent if the change didn't come from parent sync
  let lastCx = $state(localState.cx);
  let lastCy = $state(localState.cy);
  let lastZoom = $state(localState.zoom);

  $effect(() => {
    if (isSyncingFromParent) {
      // Update last values to match synced values (don't notify parent)
      lastCx = localState.cx;
      lastCy = localState.cy;
      lastZoom = localState.zoom;
      return;
    }

    const cx = localState.cx;
    const cy = localState.cy;
    const zoom = localState.zoom;

    // Only notify if values actually changed
    if (cx !== lastCx || cy !== lastCy || zoom !== lastZoom) {
      lastCx = cx;
      lastCy = cy;
      lastZoom = zoom;
      onUpdate({ cx, cy, zoom });
    }
  });
</script>

<div class="w-full h-full">
  <MandelbrotMap bind:this={mapRef} bind:state={localState} {zoomOffset} zoomSnap={0} />
</div>
