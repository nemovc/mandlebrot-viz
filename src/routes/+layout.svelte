<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const isAnimator = $derived(page.url.pathname.startsWith('/animator'));
	const isViewer = $derived(
		page.url.pathname.startsWith('/viewer') || page.url.pathname === '/',
	);
</script>

<div class="h-screen">
	<!-- Floating Explorer / Animator nav pill -->
	<div
		class="fixed top-3 left-1/2 -translate-x-1/2 z-[3000] flex items-center bg-neutral-900/90 border border-neutral-700 rounded select-none backdrop-blur-sm"
	>
		<a
			href="/viewer"
			class="px-3 py-1 text-[11px] rounded-l transition-colors {isViewer
				? 'text-white bg-neutral-700'
				: 'text-neutral-500 hover:text-neutral-300'}"
		>
			Explorer
		</a>
		<a
			href="/animator"
			class="px-3 py-1 text-[11px] rounded-r border-l border-neutral-700 transition-colors {isAnimator
				? 'text-white bg-neutral-700'
				: 'text-neutral-500 hover:text-neutral-300'}"
		>
			Animator
		</a>
	</div>

	{@render children()}
</div>
