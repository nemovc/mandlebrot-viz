<script lang="ts">
	import type { MandelbrotLayerInstance } from '$lib/rendering/leaflet/MandelbrotLayer';
	import type * as Leaflet from 'leaflet';
	import type { PointExpression } from 'leaflet';

	import { onMount, onDestroy, untrack } from 'svelte';
	import { viewerState, type ViewerState } from '$lib/stores/viewerState.svelte';
	import { debugState } from '$lib/stores/debugState.svelte';
	import { scaleForZoom } from '$lib/utils/precision';

	const TILE_SIZE = 256;

	let {
		state = $bindable(viewerState),
		zoomOffset = 0,
		zoomSnap = 1,
		inspectorActive = false,
		onInspectorMove,
		onInspectorClick,
		bindLeafletContainer
	}: {
		state?: ViewerState;
		zoomOffset?: number;
		zoomSnap?: number;
		inspectorActive?: boolean;
		onInspectorMove?: (re: number, im: number, sx: number, sy: number) => void;
		onInspectorClick?: () => void;
		bindLeafletContainer?: (el: HTMLDivElement) => void;
	} = $props();

	$effect(() => {
		if (bindLeafletContainer && mapContainer) {
			bindLeafletContainer(mapContainer);
		}
	});

	let mapContainer: HTMLDivElement;
	let leafletMap: Leaflet.Map | null = null;
	let mandelbrotLayer: MandelbrotLayerInstance | null = null;
	let _L: typeof Leaflet | null = null;
	let _lockMarker: Leaflet.Marker | null = null;
	let _lockContainer: HTMLDivElement | null = null;

	// CRS.Simple uses pixel units. Our world [-4,4] maps to [0,256] at zoom 0.
	// Scale = 256/8 = 32 pixels per complex unit.
	const S = 32;
	const reToLng = (re: number) => (re + 4) * S;
	const imToLat = (im: number) => -(im + 4) * S;
	const lngToRe = (lng: number) => lng / S - 4;
	const latToIm = (lat: number) => -lat / S - 4;

	onMount(async () => {
		const L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');
		const { createMandelbrotLayer } = await import('$lib/rendering/leaflet/MandelbrotLayer');

		const worldBounds = L.latLngBounds([imToLat(-2), reToLng(-4)], [imToLat(2), reToLng(4)]);

		leafletMap = L.map(mapContainer, {
			crs: L.CRS.Simple,
			center: [imToLat(parseFloat(state.cy)), reToLng(parseFloat(state.cx))],
			zoom: state.zoom - zoomOffset,
			minZoom: 0,
			zoomSnap: zoomSnap,
			zoomDelta: 1,
			attributionControl: false,
			zoomControl: false,
			scrollWheelZoom: true,
			maxBounds: worldBounds,
			maxBoundsViscosity: 1.0,
			fadeAnimation: false
		});

		const LayerClass = createMandelbrotLayer(L);
		mandelbrotLayer = new LayerClass();
		mandelbrotLayer.maxIter = state.maxIter;
		mandelbrotLayer.power = state.power;
		mandelbrotLayer.colorConfig = state.colors;
		mandelbrotLayer.addTo(leafletMap);
		_L = L;

		leafletMap.on('moveend zoomend', () => {
			if (!leafletMap) return;
			const center = leafletMap.getCenter();
			state.cx = lngToRe(center.lng).toString();
			state.cy = latToIm(center.lat).toString();
			state.zoom = leafletMap.getZoom() + zoomOffset;
		});

		mapContainer.addEventListener('mousemove', (e) => {
			if (!inspectorActive) return;
			const rect = mapContainer.getBoundingClientRect();
			const sx = e.clientX - rect.left;
			const sy = e.clientY - rect.top;
			const latlng = leafletMap!.containerPointToLatLng(L.point(sx, sy));
			const re = lngToRe(latlng.lng);
			const im = latToIm(latlng.lat);
			onInspectorMove?.(re, im, e.clientX, e.clientY);
		});

		leafletMap.on('click', () => {
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
	let _lastAlgorithm = '';
	$effect(() => {
		state.colors;
		if (mandelbrotLayer) {
			mandelbrotLayer.colorConfig = state.colors;
			const alg = state.colors.algorithm;
			const isDem = (a: string) =>
				a === 'distance_estimation' || a === 'distance_estimation_banded';
			const needsRecompute = isDem(alg) !== isDem(_lastAlgorithm);
			_lastAlgorithm = alg;
			if (needsRecompute) {
				untrack(() => mandelbrotLayer?.recompute());
			} else {
				untrack(() => mandelbrotLayer?.recolor());
			}
		}
	});

	// Recompute via workers when maxIter changes
	$effect(() => {
		state.maxIter;
		if (mandelbrotLayer) {
			mandelbrotLayer.maxIter = state.maxIter;
			untrack(() => mandelbrotLayer?.recompute());
		}
	});

	// Recompute via workers when power changes
	$effect(() => {
		state.power;
		if (mandelbrotLayer) {
			mandelbrotLayer.power = state.power;
			untrack(() => mandelbrotLayer?.recompute());
		}
	});

	$effect(() => {
		if (!mapContainer) return;
		mapContainer.classList.toggle('inspector-active', inspectorActive);
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

	// Lock point — a zero-size Leaflet marker whose divIcon container is returned
	// to the caller, who mounts the locked tooltip Svelte component into it.
	// Leaflet handles all positioning (pan + zoom animations) natively.

	export function setLockPoint(re: number, im: number): HTMLDivElement | null {
		const map = leafletMap;
		const L = _L;
		if (!map || !L) return null;
		const latlng: [number, number] = [imToLat(im), reToLng(re)];
		if (_lockMarker) {
			_lockMarker.setLatLng(latlng);
			return _lockContainer;
		}
		_lockContainer = document.createElement('div');
		_lockMarker = L.marker(latlng, {
			icon: L.divIcon({
				html: _lockContainer,
				className: '',
				iconSize: [0, 0],
				iconAnchor: [0, 0]
			}),
			interactive: false,
			keyboard: false
		}).addTo(map);
		// Prevent clicks inside the container from bubbling to the Leaflet map.
		// Must be a real DOM listener (not Svelte-delegated) to fire before Leaflet's
		// map-container handler.
		L.DomEvent.disableClickPropagation(_lockContainer);
		return _lockContainer;
	}

	export function clearLockPoint() {
		_lockMarker?.remove();
		_lockMarker = null;
		_lockContainer = null;
	}

	export function screenToComplex(
		clientX: number,
		clientY: number
	): { re: number; im: number } | null {
		const map = leafletMap;
		if (!map || !mapContainer) return null;
		const rect = mapContainer.getBoundingClientRect();
		const latlng = map.containerPointToLatLng({
			x: clientX - rect.left,
			y: clientY - rect.top
		} as PointExpression);
		return { re: lngToRe(latlng.lng), im: latToIm(latlng.lat) };
	}

	export function getLastCdf(): Float32Array | null {
		const layer = mandelbrotLayer;
		return layer ? layer._lastCdf : null;
	}

	export function panTo(re: number, im: number, zoom?: number) {
		state.cx = re.toString();
		state.cy = im.toString();
		if (zoom !== undefined) state.zoom = zoom;
		leafletMap?.setView([imToLat(im), reToLng(re)], state.zoom - zoomOffset, {
			animate: true
		});
	}

	export function zoomIn() {
		leafletMap?.zoomIn();
	}

	export function zoomOut() {
		leafletMap?.zoomOut();
	}

	export function resetView() {
		state.cx = '-0.5';
		state.cy = '0.0';
		state.zoom = 3;
		state.maxIter = 256;
		state.power = 2;
		leafletMap?.setView([imToLat(0.0), reToLng(-0.5)], 3 - zoomOffset, { animate: true });
	}
</script>

<div class="relative w-full h-full" bind:this={mapContainer}>
	<div class="absolute inset-0 flex items-center justify-center z-[2000] pointer-events-none">
		{#if debugState.showTileSquare}
			<div
				class="absolute w-64 h-64"
				style="box-shadow: 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.5); outline: 1px solid rgba(255,255,255,0.6);"
			></div>
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
