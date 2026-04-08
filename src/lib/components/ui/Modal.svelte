<script lang="ts">
	import type { Snippet } from 'svelte';
	import { portal } from '$lib/actions/portal';

	export type ModalAction = {
		label: string;
		title?: string;
		color?: 'blue' | 'red' | 'neutral';
		callback: () => void;
		disabled?: boolean;
	};

	let {
		open = $bindable(false),
		title,
		closeOnBackdrop = true,
		closeOnEscape = true,
		showX = true,
		actions = [],
		onClose,
		children
	}: {
		open?: boolean;
		title?: string;
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		showX?: boolean;
		actions?: ModalAction[];
		/** Called whenever the modal closes via built-in mechanisms (X, backdrop, Escape) */
		onClose?: () => void;
		children: Snippet;
	} = $props();

	function close() {
		open = false;
		onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (closeOnEscape && e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	function actionClass(color?: string) {
		if (color === 'blue')
			return 'px-3 py-1 rounded text-xs bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
		if (color === 'red')
			return 'px-3 py-1 rounded text-xs bg-red-700 border border-red-600 text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
		return 'px-3 py-1 rounded text-xs border border-neutral-700 text-neutral-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		use:portal
		class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
		role="dialog"
		aria-modal="true"
		onclick={() => closeOnBackdrop && close()}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="w-80 rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl flex flex-col max-h-[90vh]"
			onclick={(e) => e.stopPropagation()}
		>
			{#if title !== undefined || showX}
				<div class="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-neutral-800">
					<span class="text-sm font-medium text-white">{title ?? ''}</span>
					{#if showX}
						<button
							class="text-neutral-500 hover:text-white transition-colors text-sm leading-none"
							onclick={close}
							aria-label="Close">✕</button
						>
					{/if}
				</div>
			{/if}

			<div class="p-4 overflow-y-auto flex-1">
				{@render children()}
			</div>

			{#if actions.length > 0}
				<div class="flex gap-2 justify-end px-4 pb-3 pt-2 border-t border-neutral-800">
					{#each actions as action (action.label)}
						<button
							class={actionClass(action.color)}
							title={action.title}
							disabled={action.disabled}
							onclick={action.callback}>{action.label}</button
						>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
