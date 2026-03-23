<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { Stage1Renderer } from '$lib/rendering/webgl/stage1Renderer';
	import { scaleForZoom } from '$lib/utils/precision';

	let mapContainer: HTMLDivElement;
	let glCanvas: HTMLCanvasElement;
	let renderer: Stage1Renderer | null = null;
	let leafletMap: import('leaflet').Map | null = null;
	let mandelbrotLayer: any = null;

	onMount(async () => {
		const L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');
		const { createMandelbrotLayer } = await import('$lib/rendering/leaflet/MandelbrotLayer');

		// Init WebGL stage 1 canvas
		renderer = new Stage1Renderer(glCanvas);
		resizeGl();

		// Init Leaflet map with simple CRS
		leafletMap = L.map(mapContainer, {
			crs: L.CRS.Simple,
			center: [parseFloat(viewerState.cy), parseFloat(viewerState.cx)],
			zoom: viewerState.zoom,
			zoomSnap: 1,
			zoomDelta: 1,
			attributionControl: false,
			zoomControl: false
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
			viewerState.cx = center.lng.toString();
			viewerState.cy = center.lat.toString();
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

	// React to store changes (color/iter updates from control panel)
	$effect(() => {
		viewerState.colors; // track
		viewerState.maxIter;
		if (mandelbrotLayer) {
			mandelbrotLayer.colorConfig = viewerState.colors;
			mandelbrotLayer.maxIter = viewerState.maxIter;
			mandelbrotLayer.redraw();
		}
		drawGL();
	});
</script>

<svelte:window on:resize={resizeGl} />

<div class="relative w-full h-full" bind:this={mapContainer}>
	<!-- Stage 1: WebGL preview (below tiles) -->
	<canvas
		bind:this={glCanvas}
		class="absolute inset-0 z-0 pointer-events-none"
		style="width:100%;height:100%"
	></canvas>
	<!-- Leaflet mounts into mapContainer itself -->
</div>
