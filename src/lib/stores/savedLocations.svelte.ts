import type { Location } from '$lib/utils/locations';
import { PRESET_LOCATIONS } from '$lib/utils/locations';

const STORAGE_KEY = 'mandelbrot-saved-locations';

function createSavedLocations() {
	let locations = $state<Location[]>(
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
		localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
	}

	return {
		get all() {
			return locations;
		},

		validateName(name: string): string | null {
			if (!name.trim()) return 'Name cannot be empty';
			if (name.trim().length > 48) return 'Name cannot exceed 48 characters';
			if (PRESET_LOCATIONS.some((l) => l.name === name.trim())) return 'Cannot use the name of a preset location';
			return null;
		},

		exists(name: string): boolean {
			return locations.some((l) => l.name === name.trim());
		},

		save(location: Location) {
			const n = location.name.trim();
			const idx = locations.findIndex((l) => l.name === n);
			if (idx >= 0) {
				locations[idx] = { ...location, name: n };
			} else {
				locations = [...locations, { ...location, name: n }];
			}
			persist();
		},

		remove(name: string) {
			locations = locations.filter((l) => l.name !== name);
			persist();
		}
	};
}

export const savedLocations = createSavedLocations();
