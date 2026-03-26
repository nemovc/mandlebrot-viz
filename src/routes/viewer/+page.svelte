<script lang="ts">
	import { browser } from '$app/environment';
	import MandelbrotMap from '$lib/components/viewer/MandelbrotMap.svelte';
	import ControlPanel from '$lib/components/viewer/ControlPanel.svelte';
	import ColorSchemeEditor from '$lib/components/viewer/ColorSchemeEditor.svelte';
	import ExportDialog from '$lib/components/viewer/ExportDialog.svelte';
	import { viewerState } from '$lib/stores/viewerState.svelte';
	import { encodeState } from '$lib/utils/urlSerializer';

	let showExport = $state(false);
	let mapComponent: MandelbrotMap;

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
		<ControlPanel onNavigate={(re, im, zoom) => mapComponent.panTo(re, im, zoom)} />
	</div>

	<div class="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
		<ColorSchemeEditor />
	</div>

	<div class="absolute bottom-3 right-3 z-[1000] flex gap-2">
		<button
			class="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
			onclick={() => mapComponent.resetView()}
		>
			Reset
		</button>
		<button
			class="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded transition-colors"
			onclick={() => (showExport = true)}
		>
			Export / Share
		</button>
	</div>
</div>

{#if showExport}
	<ExportDialog onclose={() => (showExport = false)} />
{/if}
