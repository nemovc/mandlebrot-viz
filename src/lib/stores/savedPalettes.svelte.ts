import { PRESETS } from '$lib/utils/colorPalettes';
import type { ColorConfig } from './viewerState.svelte';

const STORAGE_KEY = 'mandelbrot-saved-palettes';

export interface SavedPalette {
	name: string;
	config: ColorConfig;
}

function createSavedPalettes() {
	let palettes = $state<SavedPalette[]>(
		typeof localStorage !== 'undefined'
			? (() => {
					try {
						return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
					} catch {
						return [];
					}
				})()
			: []
	);

	function persist() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
	}

	return {
		get all() {
			return palettes;
		},

		/** Returns error message or null if valid */
		validateName(name: string): string | null {
			if (!name.trim()) return 'Name cannot be empty';
			if (name.trim().length > 48) return 'Name cannot exceed 48 characters';
			if (!/^[a-zA-Z0-9 ]+$/.test(name.trim()))
				return 'Name can only contain letters, numbers, and spaces';
			if (name.trim() in PRESETS) return 'Cannot use the name of a built-in palette';
			return null;
		},

		exists(name: string): boolean {
			return palettes.some((p) => p.name === name.trim());
		},

		save(name: string, config: ColorConfig) {
			const n = name.trim();
			const idx = palettes.findIndex((p) => p.name === n);
			if (idx >= 0) {
				palettes[idx] = { name: n, config: JSON.parse(JSON.stringify(config)) };
			} else {
				palettes = [...palettes, { name: n, config: JSON.parse(JSON.stringify(config)) }];
			}
			persist();
		},

		remove(name: string) {
			palettes = palettes.filter((p) => p.name !== name);
			persist();
		}
	};
}

export const savedPalettes = createSavedPalettes();
