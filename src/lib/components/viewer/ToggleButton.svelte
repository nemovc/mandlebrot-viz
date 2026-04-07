<script lang="ts">
	import type { Snippet } from 'svelte';

	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	const VARIANTS = {
		blue: {
			active: 'bg-blue-700 border-blue-600 text-white',
			inactive: 'border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'
		},
		neutral: {
			active: 'bg-neutral-600 border-neutral-500 text-white',
			inactive: 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
		}
	};

	let {
		active,
		onclick,
		title,
		disabled,
		checkbox = false,
		chevron,
		variant = 'blue',
		class: extraClass = '',
		children
	}: {
		active: boolean;
		onclick: () => void;
		title?: string;
		disabled?: boolean;
		checkbox?: boolean;
		chevron?: 'left' | 'right';
		variant?: keyof typeof VARIANTS;
		class?: string;
		children: Snippet;
	} = $props();

	const classes = $derived(VARIANTS[variant]);
</script>

<button
	class="flex items-center gap-1.5 text-left px-2 py-1 rounded text-xs transition-colors border {active
		? classes.active
		: classes.inactive} {disabled ? 'opacity-40 cursor-not-allowed' : ''} {extraClass}"
	{onclick}
	{title}
	{disabled}
>
	{#if checkbox}
		<span
			class="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 {active
				? 'bg-blue-500 border-blue-400'
				: 'border-neutral-500'}"
		>
			{#if active}
				<svg
					viewBox="0 0 10 10"
					class="w-2.5 h-2.5"
					fill="none"
					stroke="white"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="1.5,5 4,7.5 8.5,2.5" />
				</svg>
			{/if}
		</span>
	{/if}
	{#if chevron === 'left'}
		<ChevronLeft size={12} class="shrink-0" />
	{/if}
	{@render children()}
	{#if chevron === 'right'}
		<ChevronRight size={12} class="ml-auto shrink-0" />
	{/if}
</button>
