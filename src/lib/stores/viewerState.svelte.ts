import { DEFAULT_PALETTE } from '$lib/utils/colorPalettes';
import { decodeState } from '$lib/utils/urlSerializer';

export interface ColorStop {
	stop: number;
	color: string;
}

export interface ColorConfig {
	algorithm: 'escape_time_smooth' | 'escape_time_banded' | 'distance_estimation' | 'distance_estimation_banded' | 'histogram_equalized_smooth' | 'histogram_equalized_banded';
	palette: ColorStop[];
	cyclePeriod: number;
	offset: number;
	reverse?: boolean;
	inSetColor?: string;
}

export interface ViewerState {
	cx: string;
	cy: string;
	zoom: number;
	maxIter: number;
	power: number;
	colors: ColorConfig;
}

function createViewerState() {
	const initial: Partial<ViewerState> = (typeof window !== 'undefined' && window.location.hash)
		? (decodeState(window.location.hash)?.viewer ?? {})
		: {};

	let cx = $state(initial.cx ?? '-0.5');
	let cy = $state(initial.cy ?? '0.0');
	let zoom = $state(initial.zoom ?? 3);
	let maxIter = $state(initial.maxIter ?? 256);
	let power = $state(initial.power ?? 2);
	let colors = $state<ColorConfig>(initial.colors ?? DEFAULT_PALETTE);

	return {
		get cx() { return cx; },
		set cx(v) { cx = v; },
		get cy() { return cy; },
		set cy(v) { cy = v; },
		get zoom() { return zoom; },
		set zoom(v) { zoom = v; },
		get maxIter() { return maxIter; },
		set maxIter(v) { maxIter = v; },
		get power() { return power; },
		set power(v) { power = v; },
		get colors() { return colors; },
		set colors(v) { colors = v; },

		toJSON(): ViewerState {
			return { cx, cy, zoom, maxIter, power, colors };
		},

		loadFrom(s: Partial<ViewerState>) {
			if (s.cx !== undefined) cx = s.cx;
			if (s.cy !== undefined) cy = s.cy;
			if (s.zoom !== undefined) zoom = s.zoom;
			if (s.maxIter !== undefined) maxIter = s.maxIter;
			if (s.power !== undefined) power = s.power;
			if (s.colors !== undefined) colors = s.colors;
		}
	};
}

export const viewerState = createViewerState();
