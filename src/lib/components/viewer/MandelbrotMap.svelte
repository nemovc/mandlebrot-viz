<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { viewerState } from "$lib/stores/viewerState.svelte";
  import { Stage1Renderer } from "$lib/rendering/webgl/stage1Renderer";
  import { getWorkerPool } from "$lib/rendering/worker/workerPool";

  let mapContainer: HTMLDivElement;
  let glCanvas: HTMLCanvasElement;
  let renderer: Stage1Renderer | null = null;
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

    // Init WebGL stage 1 canvas
    renderer = new Stage1Renderer(glCanvas);
    resizeGl();

    // Bounds in CRS.Simple lat/lng space, converted from our complex plane [-4,4]×[-4i,4i]
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

    // Create tile layer
    const LayerClass = createMandelbrotLayer(L);
    mandelbrotLayer = new LayerClass();
    mandelbrotLayer.maxIter = viewerState.maxIter;
    mandelbrotLayer.colorConfig = viewerState.colors;
    mandelbrotLayer.addTo(leafletMap);

    // Sync map events back to store
    leafletMap.on("moveend zoomend", () => {
      if (!leafletMap) return;
      const center = leafletMap.getCenter();
      viewerState.cx = lngToRe(center.lng).toString();
      viewerState.cy = latToIm(center.lat).toString();
      viewerState.zoom = leafletMap.getZoom();
      drawGL();
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

    drawGL();
  });

  onDestroy(() => {
    leafletMap?.remove();
    renderer?.destroy();
  });

  function resizeGl() {
    if (!renderer || !mapContainer) return;
    renderer.resize(mapContainer.clientWidth, mapContainer.clientHeight);
  }

  function drawGL() {
    if (!renderer) return;
    renderer.draw(viewerState.toJSON());
  }

  export function panTo(re: number, im: number, zoom?: number) {
    viewerState.cx = re.toString();
    viewerState.cy = im.toString();
    if (zoom !== undefined) viewerState.zoom = zoom;
    leafletMap?.setView([imToLat(im), reToLng(re)], viewerState.zoom, {
      animate: true,
    });
    drawGL();
  }

  export function resetView() {
    viewerState.cx = "-0.5";
    viewerState.cy = "0.0";
    viewerState.zoom = 3;
    viewerState.maxIter = 256;
    leafletMap?.setView([imToLat(0.0), reToLng(-0.5)], 3, { animate: true });
    drawGL();
  }

  // Recolor in-place when only the palette changes — no WASM needed
  $effect(() => {
    viewerState.colors;
    if (mandelbrotLayer) {
      mandelbrotLayer.colorConfig = viewerState.colors;
      mandelbrotLayer.recolor();
    }
    untrack(() => drawGL());
  });

  // Recompute via workers when maxIter changes
  $effect(() => {
    viewerState.maxIter;
    if (mandelbrotLayer) {
      mandelbrotLayer.maxIter = viewerState.maxIter;
      mandelbrotLayer.recompute();
    }
    untrack(() => drawGL());
  });
</script>

<svelte:window on:resize={resizeGl} />

<div class="relative w-full h-full" bind:this={mapContainer}>
  <!-- Stage 1: WebGL preview — temporarily disabled for debugging -->
  <canvas
    bind:this={glCanvas}
    class="absolute inset-0 z-0 pointer-events-none"
    style="width:100%;height:100%"
    id="#glCanvas"
  ></canvas>
  <!-- Leaflet mounts into mapContainer itself -->

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
    class="absolute bottom-2 left-2 z-[2000] pointer-events-none font-mono text-xs text-white/70 bg-black/50 rounded px-2 py-1 leading-5"
  >
    <div>
      workers: {poolDebug.idle} idle / {poolDebug.activeS2} s2 / {poolDebug.activeS3}
      s3
    </div>
    <div>queued: {poolDebug.queued}</div>
  </div>
</div>
