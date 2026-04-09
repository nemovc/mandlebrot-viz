<script lang="ts">
	import { onDestroy } from 'svelte';
	import { animationState } from '$lib/stores/animationState.svelte';
	import { frameCache } from '$lib/utils/animator/frameCache.svelte';
	import { Play, Pause, Repeat } from 'lucide-svelte';
	import { keyboardLayer } from '$lib/stores/keyboardShortcuts.svelte';

	let { open = $bindable(false), loopPlayback = $bindable(true) } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let isPlaying = $state(false);
	let rafId = 0;
	let lastFrameTime = 0;

	const project = $derived(animationState.project);
	const msPerFrame = $derived(1000 / project.fps);
	const totalFrames = $derived(project.totalFrames);

	// Cached ranges for scrub bar
	const cachedRanges = $derived(frameCache.ranges);

	// Draw cached frame to canvas whenever currentFrame changes
	$effect(() => {
		const frame = animationState.currentFrame;
		if (!canvas) return;
		const bm = frameCache.get(frame);
		const ctx = canvas.getContext('2d')!;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (bm) ctx.drawImage(bm, 0, 0, canvas.width, canvas.height);
	});

	// RAF playback loop
	function rafLoop(time: number) {
		if (!isPlaying) return;
		if (time - lastFrameTime >= msPerFrame) {
			const next = animationState.currentFrame + 1;
			if (next >= totalFrames) {
				if (loopPlayback) {
					animationState.currentFrame = 0;
				} else {
					isPlaying = false;
					return;
				}
			} else {
				animationState.currentFrame = next;
			}
			lastFrameTime = time;
		}
		rafId = requestAnimationFrame(rafLoop);
	}

	function play() {
		if (isPlaying) return;
		isPlaying = true;
		lastFrameTime = 0;
		rafId = requestAnimationFrame(rafLoop);
	}

	function pause() {
		isPlaying = false;
		cancelAnimationFrame(rafId);
	}

	function close() {
		pause();
		open = false;
	}

	// Auto-play when modal opens; pause when it closes.
	// setTimeout defers RAF start until after Svelte's effect cycle has settled,
	// and keeps isPlaying out of the effect's dependency set.
	$effect(() => {
		const isOpen = open;
		if (!isOpen) {
			isPlaying = false;
			cancelAnimationFrame(rafId);
			frameCache.startFrom(animationState.currentFrame, animationState.project, 2);
			return;
		}
		const timer = setTimeout(() => {
			lastFrameTime = 0;
			isPlaying = true;
			frameCache.startFrom(animationState.currentFrame, animationState.project, 1);
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(rafLoop);
		}, 0);
		return () => clearTimeout(timer);
	});

	onDestroy(pause);

	// ---- Scrub bar ----
	let scrubBar = $state<HTMLDivElement>();
	let scrubbing = $state(false);
	let scrubPlaying = $state(false);

	function frameFromScrubX(clientX: number): number {
		if (!scrubBar) return 0;
		const rect = scrubBar.getBoundingClientRect();
		const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		return Math.round(t * totalFrames);
	}

	function onScrubDown(e: MouseEvent) {
		scrubbing = true;
		scrubPlaying = isPlaying;
		pause();
		animationState.currentFrame = frameFromScrubX(e.clientX);
	}

	function onWindowMouseMove(e: MouseEvent) {
		if (scrubbing) animationState.currentFrame = frameFromScrubX(e.clientX);
	}

	function onWindowMouseUp() {
		if (scrubbing) {
			scrubbing = false;
			if (scrubPlaying) {
				play();
			}
		}
	}

	// ---- Keyboard ----
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === ' ') {
			e.preventDefault();
			isPlaying ? pause() : play();
		} else if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			animationState.currentFrame = 0;
		} else if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			animationState.currentFrame = totalFrames - 1;
		} else if (e.key === 'ArrowLeft' && e.shiftKey) {
			e.preventDefault();
			animationState.currentFrame = animationState.currentFrame - project.fps;
		} else if (e.key === 'ArrowRight' && e.shiftKey) {
			e.preventDefault();
			animationState.currentFrame = animationState.currentFrame + project.fps;
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			animationState.currentFrame = animationState.currentFrame - 1;
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			animationState.currentFrame = animationState.currentFrame + 1;
		} else if (e.key === 'r' || e.key === 'R') {
			loopPlayback = !loopPlayback;
		}
	}

	const progressPct = $derived(
		frameCache.buildTotal > 0
			? Math.round((frameCache.cachedCount / frameCache.buildTotal) * 100)
			: 0
	);

	function formatTime(frame: number): string {
		const secs = frame / project.fps;
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${m}:${s.toFixed(1).padStart(4, '0')}`;
	}
</script>

<svelte:window onmousemove={onWindowMouseMove} onmouseup={onWindowMouseUp} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		use:keyboardLayer={onKeydown}
		class="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center"
		onclick={close}
		role="dialog"
		aria-modal="true"
		tabindex="0"
	>
		<!-- Card — stop propagation so clicking inside doesn't close -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="bg-neutral-900 border border-neutral-700 rounded-lg p-4 flex flex-col gap-3"
			style="max-width: 90vw"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Canvas -->
			<div class="relative">
				{#if !frameCache.has(animationState.currentFrame)}
					<div
						class="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm select-none pointer-events-none"
					>
						Frame not cached
					</div>
				{/if}
				<canvas
					bind:this={canvas}
					width={project.width}
					height={project.height}
					class="block rounded border border-neutral-700"
					style="max-width: min(90vw - 2rem, {project.width}px); max-height: 70vh;"
				></canvas>
			</div>

			<!-- Scrub bar -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={scrubBar}
				class="relative h-2 bg-neutral-800 rounded-full cursor-pointer"
				onmousedown={onScrubDown}
			>
				{#each cachedRanges as range (range.start)}
					<div
						class="absolute top-0 h-full bg-blue-400/30 pointer-events-none"
						style="left: {(range.start / totalFrames) * 100}%; width: {((range.end -
							range.start +
							1) /
							totalFrames) *
							100}%"
					></div>
				{/each}
				<div
					class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full pointer-events-none shadow"
					style="left: calc({(animationState.currentFrame / (totalFrames - 1)) * 100}% - 6px)"
				></div>
			</div>

			<!-- Controls row -->
			<div class="flex items-center gap-2 text-[11px]">
				<button
					onclick={() => (isPlaying ? pause() : play())}
					class="text-white hover:text-neutral-300 transition-colors"
					title="{isPlaying ? 'Pause' : 'Play'} (Space)"
				>
					{#if isPlaying}
						<Pause size={16} />
					{:else}
						<Play size={16} />
					{/if}
				</button>

				<button
					onclick={() => (loopPlayback = !loopPlayback)}
					class="transition-colors {loopPlayback
						? 'text-blue-400'
						: 'text-neutral-500 hover:text-white'}"
					title="Loop (R)"
				>
					<Repeat size={16} />
				</button>

				<span class="text-neutral-500 font-mono ml-1">
					{animationState.currentFrame + 1} / {totalFrames}
					<span class="text-neutral-600 ml-1"
						>{formatTime(animationState.currentFrame)} / {formatTime(totalFrames)}</span
					>
				</span>

				<div class="flex-1"></div>

				{#if frameCache.isBuilding}
					<span class="text-neutral-600">{progressPct}% cached</span>
				{/if}

				<button
					onclick={close}
					class="text-neutral-500 hover:text-white transition-colors ml-1"
					title="Close (Escape)">✕</button
				>
			</div>
		</div>
	</div>
{/if}
