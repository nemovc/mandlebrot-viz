<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { viewerState } from "$lib/stores/viewerState.svelte";
  import { debugState } from "$lib/stores/debugState.svelte";
  import { getWorkerPool } from "$lib/rendering/worker/workerPool";

  let mapContainer: HTMLDivElement;
  let leafletMap: import("leaflet").Map | null = null;
  let mandelbrotLayer: any = null;

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
  });

  onDestroy(() => {
    leafletMap?.remove();
  });

  // Recolor in-place when palette/algorithm changes.
  // Switching to/from distance_estimation requires a full recompute since a different
  // WASM function runs and the cached iters are incompatible.
  let _lastAlgorithm = '';
  $effect(() => {
    viewerState.colors;
    if (mandelbrotLayer) {
      mandelbrotLayer.colorConfig = viewerState.colors;
      const alg = viewerState.colors.algorithm;
      const needsRecompute =
        (alg === 'distance_estimation') !== (_lastAlgorithm === 'distance_estimation');
      _lastAlgorithm = alg;
      if (needsRecompute) {
        untrack(() => mandelbrotLayer.recompute());
      } else {
        untrack(() => mandelbrotLayer.recolor());
      }
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
  <div class="absolute inset-0 flex items-center justify-center z-[2000] pointer-events-none">
    {#if debugState.showTileSquare}
      <div class="absolute w-64 h-64" style="box-shadow: 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.5); outline: 1px solid rgba(255,255,255,0.6);"></div>
    {/if}
    {#if debugState.showCrosshair}
      <div class="relative w-16 h-16">
        <div class="absolute top-1/2 left-0 right-0 h-[3px] -translate-y-1/2 bg-black/50"></div>
        <div class="absolute left-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 bg-black/50"></div>
        <div class="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-white/80"></div>
        <div class="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/80"></div>
      </div>
    {/if}
  </div>
</div>
