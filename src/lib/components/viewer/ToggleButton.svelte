<script lang="ts">
	const VARIANTS = {
		blue: {
			active: 'bg-blue-700 border-blue-600 text-white',
			inactive: 'border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500',
		},
		neutral: {
			active: 'bg-neutral-600 border-neutral-500 text-white',
			inactive: 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white',
		},
	};

	let {
		active,
		onclick,
		title,
		disabled,
		variant = 'blue',
		class: extraClass = '',
		children,
	}: {
		active: boolean;
		onclick: () => void;
		title?: string;
		disabled?: boolean;
		variant?: keyof typeof VARIANTS;
		class?: string;
		children: import('svelte').Snippet;
	} = $props();

	const { active: activeClass, inactive: inactiveClass } = VARIANTS[variant];
</script>

<button
	class="flex items-center gap-1 text-left px-2 py-1 rounded text-xs transition-colors border {active ? activeClass : inactiveClass} {extraClass}"
	{onclick}
	{title}
	{disabled}
>
	{@render children()}
</button>
