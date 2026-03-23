<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { Stage1Renderer } from '$lib/rendering/webgl/stage1Renderer';

	let mapContainer: HTMLDivElement;
	let glCanvas: HTMLCanvasElement;
	let renderer: Stage1Renderer | null = null;
	let leafletMap: import('leaflet').Map | null = null;
	let mandelbrotLayer: any = null;

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

		// Init WebGL stage 1 canvas
		renderer = new Stage1Renderer(glCanvas);
		resizeGl();

		// Bounds in CRS.Simple lat/lng space, converted from our complex plane [-4,4]×[-4i,4i]
		const worldBounds = L.latLngBounds(
			[imToLat(-2), reToLng(-4)],
			[imToLat(2),  reToLng(4)]
		);

		leafletMap = L.map(mapContainer, {
			crs: L.CRS.Simple,
			center: [imToLat(parseFloat(viewerState.cy)), reToLng(parseFloat(viewerState.cx))],
			zoom: viewerState.zoom,
			minZoom: 0,
			zoomSnap: 1,
			zoomDelta: 1,
			attributionControl: false,
			zoomControl: false,
			scrollWheelZoom: true,
			maxBounds: worldBounds,
			maxBoundsViscosity: 1.0
		});

		// Create tile layer
		const LayerClass = createMandelbrotLayer(L);
		mandelbrotLayer = new LayerClass();
		mandelbrotLayer.maxIter = viewerState.maxIter;
		mandelbrotLayer.colorConfig = viewerState.colors;
		mandelbrotLayer.addTo(leafletMap);

		// Sync map events back to store
		leafletMap.on('moveend zoomend', () => {
			if (!leafletMap) return;
			const center = leafletMap.getCenter();
			viewerState.cx = lngToRe(center.lng).toString();
			viewerState.cy = latToIm(center.lat).toString();
			viewerState.zoom = leafletMap.getZoom();
			drawGL();
		});

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
		leafletMap?.setView([imToLat(im), reToLng(re)], viewerState.zoom, { animate: true });
		drawGL();
	}

	export function resetView() {
		viewerState.cx = '-0.5';
		viewerState.cy = '0.0';
		viewerState.zoom = 3;
		viewerState.maxIter = 256;
		leafletMap?.setView([imToLat(0.0), reToLng(-0.5)], 3, { animate: true });
		drawGL();
	}

	// React to store changes (color/iter updates from control panel)
	$effect(() => {
		viewerState.colors; // track
		viewerState.maxIter;
		if (mandelbrotLayer) {
			mandelbrotLayer.colorConfig = viewerState.colors;
			mandelbrotLayer.maxIter = viewerState.maxIter;
			mandelbrotLayer.softRedraw();
		}
		drawGL();
	});
</script>

<svelte:window on:resize={resizeGl} />

<div class="relative w-full h-full" bind:this={mapContainer}>
	<!-- Stage 1: WebGL preview — temporarily disabled for debugging -->
	<canvas
		bind:this={glCanvas}
		class="absolute inset-0 z-0 pointer-events-none hidden"
		style="width:100%;height:100%"
	></canvas>
	<!-- Leaflet mounts into mapContainer itself -->
</div>
