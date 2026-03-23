<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';

	let { children } = $props();

	const tabs = [
		{ href: '/viewer', label: 'Viewer' },
		{ href: '/animator', label: 'Animator' }
	];
</script>

<div class="flex flex-col h-screen">
	<nav class="flex gap-1 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="px-3 py-1 text-sm rounded transition-colors
					{$page.url.pathname.startsWith(tab.href)
					? 'bg-neutral-700 text-white'
					: 'text-neutral-400 hover:text-white hover:bg-neutral-800'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>
	<main class="flex-1 min-h-0">
		{@render children()}
	</main>
</div>
