<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { viewerState } from "$lib/stores/viewerState.svelte";
  import { getWorkerPool } from "$lib/rendering/worker/workerPool";

  let mapContainer: HTMLDivElement;
  let leafletMap: import("leaflet").Map | null = null;
  let mandelbrotLayer: any = null;

  let s2Completed = $state(0);
  let s2Total = $state(0);
  let s3Completed = $state(0);
  let s3Total = $state(0);

  let poolDebug = $state({
    poolSize: 0,
    idle: 0,
    activeS2: 0,
    activeS3: 0,
    queued: 0,
  });

  // CRS.Simple uses pixel units. Our world [-4,4] maps to [0,256] at zoom 0.
  // Scale = 256/8 = 32 pixels per complex unit.
  const S = 32;
  const reToLng = (re: number) => (re + 4) * S;
  const imToLat = (im: number) => -(im + 4) * S;
  const lngToRe = (lng: number) => lng / S - 4;
  const latToIm = (lat: number) => -lat / S - 4;

  onMount(async () => {
    const L = await import("leaflet");
    await import("leaflet/dist/leaflet.css");
    const { createMandelbrotLayer } = await import(
      "$lib/rendering/leaflet/MandelbrotLayer"
    );

    const worldBounds = L.latLngBounds(
      [imToLat(-2), reToLng(-4)],
      [imToLat(2), reToLng(4)],
    );

    leafletMap = L.map(mapContainer, {
      crs: L.CRS.Simple,
      center: [
        imToLat(parseFloat(viewerState.cy)),
        reToLng(parseFloat(viewerState.cx)),
      ],
      zoom: viewerState.zoom,
      minZoom: 0,
      zoomSnap: 1,
      zoomDelta: 1,
      attributionControl: false,
      zoomControl: false,
      scrollWheelZoom: true,
      maxBounds: worldBounds,
      maxBoundsViscosity: 1.0,
    });

    const LayerClass = createMandelbrotLayer(L);
    mandelbrotLayer = new LayerClass();
    mandelbrotLayer.maxIter = viewerState.maxIter;
    mandelbrotLayer.colorConfig = viewerState.colors;
    mandelbrotLayer.addTo(leafletMap);

    leafletMap.on("moveend zoomend", () => {
      if (!leafletMap) return;
      const center = leafletMap.getCenter();
      viewerState.cx = lngToRe(center.lng).toString();
      viewerState.cy = latToIm(center.lat).toString();
      viewerState.zoom = leafletMap.getZoom();
    });

    const pool = getWorkerPool();
    pool.onProgress = (stage, completed, total) => {
      if (stage === 2) {
        s2Completed = completed;
        s2Total = total;
      } else {
        s3Completed = completed;
        s3Total = total;
      }
      poolDebug = pool.debugState;
    };
  });

  onDestroy(() => {
    leafletMap?.remove();
  });

  // Recolor in-place when only the palette changes — no WASM needed
  $effect(() => {
    viewerState.colors;
    if (mandelbrotLayer) {
      mandelbrotLayer.colorConfig = viewerState.colors;
      untrack(() => mandelbrotLayer.recolor());
    }
  });

  // Recompute via workers when maxIter changes
  $effect(() => {
    viewerState.maxIter;
    if (mandelbrotLayer) {
      mandelbrotLayer.maxIter = viewerState.maxIter;
      untrack(() => mandelbrotLayer.recompute());
    }
  });

  export function panTo(re: number, im: number, zoom?: number) {
    viewerState.cx = re.toString();
    viewerState.cy = im.toString();
    if (zoom !== undefined) viewerState.zoom = zoom;
    leafletMap?.setView([imToLat(im), reToLng(re)], viewerState.zoom, {
      animate: true,
    });
  }

  export function resetView() {
    viewerState.cx = "-0.5";
    viewerState.cy = "0.0";
    viewerState.zoom = 3;
    viewerState.maxIter = 256;
    leafletMap?.setView([imToLat(0.0), reToLng(-0.5)], 3, { animate: true });
  }
</script>

<div class="relative w-full h-full" bind:this={mapContainer}>
  <!-- Render progress bars: stage 2 (low-res) on top, stage 3 (full-res) below -->
  {#if s2Total > 0 && s2Completed < s2Total}
    <div
      class="absolute top-0 left-0 right-0 z-[2000] h-1 bg-neutral-800 pointer-events-none"
    >
      <div
        class="h-full bg-blue-400 transition-all duration-150"
        style="width: {(s2Completed / s2Total) * 100}%"
      ></div>
    </div>
  {/if}
  {#if s3Total > 0 && s3Completed < s3Total}
    <div
      class="absolute top-1 left-0 right-0 z-[2000] h-1 bg-neutral-800 pointer-events-none"
    >
      <div
        class="h-full bg-green-500 transition-all duration-150"
        style="width: {(s3Completed / s3Total) * 100}%"
      ></div>
    </div>
  {/if}

  <!-- Worker pool debug overlay -->
  <div
    class="absolute bottom-2 left-2 z-[2000] pointer-events-none flex flex-col gap-2 p-3 bg-neutral-900 border border-neutral-800 rounded-lg"
  >
    <div class="text-neutral-400 text-xs font-medium uppercase tracking-wider">Workers</div>
    <div class="font-mono text-xs text-neutral-300 leading-5">
      <div>{poolDebug.idle} idle / {poolDebug.activeS2} s2 / {poolDebug.activeS3} s3</div>
      <div>queued: {poolDebug.queued}</div>
    </div>
  </div>
</div>
