<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { viewerState } from "$lib/stores/viewerState.svelte";
  import { debugState } from "$lib/stores/debugState.svelte";
  import type { MandelbrotLayerInstance } from "$lib/rendering/leaflet/MandelbrotLayer";
  import { scaleForZoom } from "$lib/utils/precision";

  const TILE_SIZE = 256;

  let {
    inspectorActive = false,
    onInspectorMove,
    onInspectorClick,
    onMove,
    onZoomStart,
    onZoomEnd,
  }: {
    inspectorActive?: boolean;
    onInspectorMove?: (re: number, im: number, sx: number, sy: number) => void;
    onInspectorClick?: () => void;
    onMove?: () => void;
    onZoomStart?: () => void;
    onZoomEnd?: () => void;
  } = $props();

  let mapContainer: HTMLDivElement;
  let leafletMap: import("leaflet").Map | null = null;
  let mandelbrotLayer: MandelbrotLayerInstance | null = null;

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
      fadeAnimation: false,
    });

    const LayerClass = createMandelbrotLayer(L);
    mandelbrotLayer = new LayerClass();
    mandelbrotLayer.maxIter = viewerState.maxIter;
    mandelbrotLayer.power = viewerState.power;
    mandelbrotLayer.colorConfig = viewerState.colors;
    mandelbrotLayer.addTo(leafletMap);

    leafletMap.on("move", () => onMove?.());
    leafletMap.on("zoomstart", () => onZoomStart?.());
    leafletMap.on("viewreset", () => _updateLockAnchor());

    leafletMap.on("moveend zoomend", () => {
      if (!leafletMap) return;
      const center = leafletMap.getCenter();
      viewerState.cx = lngToRe(center.lng).toString();
      viewerState.cy = latToIm(center.lat).toString();
      viewerState.zoom = leafletMap.getZoom();
      _updateLockAnchor();
      onZoomEnd?.();
    });

    mapContainer.addEventListener("mousemove", (e) => {
      if (!inspectorActive) return;
      const rect = mapContainer.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const latlng = leafletMap!.containerPointToLatLng(L.point(sx, sy));
      const re = lngToRe(latlng.lng);
      const im = latToIm(latlng.lat);
      onInspectorMove?.(re, im, e.clientX, e.clientY);
    });

    leafletMap.on("click", () => {
      if (!inspectorActive) return;
      onInspectorClick?.();
    });
  });

  onDestroy(() => {
    leafletMap?.remove();
  });

  // Recolor in-place when palette/algorithm changes.
  // Switching to/from distance_estimation requires a full recompute since a different
  // WASM function runs and the cached iters are incompatible.
  let _lastAlgorithm = "";
  $effect(() => {
    viewerState.colors;
    if (mandelbrotLayer) {
      mandelbrotLayer.colorConfig = viewerState.colors;
      const alg = viewerState.colors.algorithm;
      const isDem = (a: string) =>
        a === "distance_estimation" || a === "distance_estimation_banded";
      const needsRecompute = isDem(alg) !== isDem(_lastAlgorithm);
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

  // Recompute via workers when power changes
  $effect(() => {
    viewerState.power;
    if (mandelbrotLayer) {
      mandelbrotLayer.power = viewerState.power;
      untrack(() => mandelbrotLayer.recompute());
    }
  });

  $effect(() => {
    if (!mapContainer) return;
    mapContainer.classList.toggle("inspector-active", inspectorActive);
  });

  export function getIterAt(re: number, im: number): number | null {
    const layer = mandelbrotLayer;
    const map = leafletMap;
    if (!layer || !map) return null;
    const z = map.getZoom();
    const scale = scaleForZoom(z, TILE_SIZE);
    const tileUnits = scale * TILE_SIZE;
    const tx = Math.floor((re + 4) / tileUnits);
    const ty = Math.floor((im + 4) / tileUnits);
    const cached = layer._itersCache.get(`${z}/${tx}/${ty}`);
    if (!cached) return null;
    const cx = -4 + (tx + 0.5) * tileUnits;
    const cy = -4 + (ty + 0.5) * tileUnits;
    const px = Math.round((re - cx) / scale + TILE_SIZE / 2);
    const py = Math.round((im - cy) / scale + TILE_SIZE / 2);
    const clampedPx = Math.max(0, Math.min(TILE_SIZE - 1, px));
    const clampedPy = Math.max(0, Math.min(TILE_SIZE - 1, py));
    return cached.iters[clampedPy * TILE_SIZE + clampedPx] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Lock anchor — an invisible div inside the Leaflet popup pane so that
  // Leaflet's own CSS transforms (pan AND zoom animation) keep it positioned
  // correctly without any JS polling. getBoundingClientRect() on it always
  // returns the visually-correct screen position mid-animation.
  // ---------------------------------------------------------------------------
  let _lockAnchorEl: HTMLDivElement | null = null;
  let _lockRe = 0;
  let _lockIm = 0;

  function _updateLockAnchor() {
    const map = leafletMap;
    if (!map || !_lockAnchorEl) return;
    const pt = map.latLngToLayerPoint([imToLat(_lockIm), reToLng(_lockRe)]);
    _lockAnchorEl.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
  }

  export function setLockPoint(re: number, im: number) {
    const map = leafletMap;
    if (!map) return;
    _lockRe = re;
    _lockIm = im;
    if (!_lockAnchorEl) {
      _lockAnchorEl = document.createElement("div");
      _lockAnchorEl.style.cssText = "position:absolute;width:0;height:0;pointer-events:none;";
      map.getPanes().popupPane.appendChild(_lockAnchorEl);
    }
    _updateLockAnchor();
  }

  export function clearLockPoint() {
    _lockAnchorEl?.remove();
    _lockAnchorEl = null;
  }

  export function getLockAnchorPos(): { x: number; y: number } | null {
    if (!_lockAnchorEl) return null;
    const rect = _lockAnchorEl.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  export function screenToComplex(clientX: number, clientY: number): { re: number; im: number } | null {
    const map = leafletMap;
    if (!map || !mapContainer) return null;
    const rect = mapContainer.getBoundingClientRect();
    const latlng = map.containerPointToLatLng({ x: clientX - rect.left, y: clientY - rect.top } as import("leaflet").PointExpression);
    return { re: lngToRe(latlng.lng), im: latToIm(latlng.lat) };
  }

  export function getLastCdf(): Float32Array | null {
    const layer = mandelbrotLayer;
    return layer ? layer._lastCdf : null;
  }

  export function panTo(re: number, im: number, zoom?: number) {
    viewerState.cx = re.toString();
    viewerState.cy = im.toString();
    if (zoom !== undefined) viewerState.zoom = zoom;
    leafletMap?.setView([imToLat(im), reToLng(re)], viewerState.zoom, {
      animate: true,
    });
  }

  export function zoomIn() {
    leafletMap?.zoomIn();
  }

  export function zoomOut() {
    leafletMap?.zoomOut();
  }

  export function resetView() {
    viewerState.cx = "-0.5";
    viewerState.cy = "0.0";
    viewerState.zoom = 3;
    viewerState.maxIter = 256;
    viewerState.power = 2;
    leafletMap?.setView([imToLat(0.0), reToLng(-0.5)], 3, { animate: true });
  }
</script>

<div class="relative w-full h-full" bind:this={mapContainer}>
  <div
    class="absolute inset-0 flex items-center justify-center z-[2000] pointer-events-none"
  >
    {#if debugState.showTileSquare}
      <div
        class="absolute w-64 h-64"
        style="box-shadow: 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.5); outline: 1px solid rgba(255,255,255,0.6);"
      ></div>
    {/if}
    {#if debugState.showCrosshair}
      <div class="relative w-16 h-16">
        <div
          class="absolute top-1/2 left-0 right-0 h-[3px] -translate-y-1/2 bg-black/50"
        ></div>
        <div
          class="absolute left-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2 bg-black/50"
        ></div>
        <div
          class="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-white/80"
        ></div>
        <div
          class="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/80"
        ></div>
      </div>
    {/if}
  </div>
</div>
