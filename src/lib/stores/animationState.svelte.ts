import type { ColorConfig, ViewerState } from '$lib/stores/viewerState.svelte';
import { viewerState } from '$lib/stores/viewerState.svelte';

export type TrackParameter = 'zoom' | 'cx' | 'cy' | 'maxIter' | 'cyclePeriod' | 'offset';

export const TRACK_PARAMS: TrackParameter[] = ['zoom', 'cx', 'cy', 'maxIter', 'cyclePeriod', 'offset'];

export const TRACK_LABELS: Record<TrackParameter, string> = {
	zoom: 'Zoom',
	cx: 'Centre Re',
	cy: 'Centre Im',
	maxIter: 'Max Iter',
	cyclePeriod: 'Cycle Period',
	offset: 'Offset',
};

export interface Keyframe {
	frame: number; // integer
	value: number;
	easing: 'linear';
}

export interface ParameterTrack {
	parameter: TrackParameter;
	keyframes: Keyframe[]; // always sorted by frame ascending
}

export interface AnimationProject {
	totalFrames: number;
	fps: number;
	width: number;
	height: number;
	power: number;
	algorithm: ColorConfig['algorithm'];
	palette: ColorConfig['palette'];
	inSetColor: string;
	reverse: boolean;
	tracks: ParameterTrack[]; // always length 6, in TRACK_PARAMS order
}

function defaultProject(): AnimationProject {
	return {
		totalFrames: 300,
		fps: 30,
		width: 1920,
		height: 1080,
		power: 2,
		algorithm: 'smooth',
		palette: [],
		inSetColor: '#000000',
		reverse: false,
		tracks: TRACK_PARAMS.map((p) => ({ parameter: p, keyframes: [] })),
	};
}

function snap(p: AnimationProject): AnimationProject {
	return JSON.parse(JSON.stringify(p));
}

function createAnimationState() {
	let project = $state<AnimationProject>(defaultProject());
	let currentFrame = $state(0);
	let revision = $state(0);
	const undoStack: AnimationProject[] = [];
	const redoStack: AnimationProject[] = [];

	function commit() {
		undoStack.push(snap(project));
		if (undoStack.length > 100) undoStack.shift();
		redoStack.length = 0;
		revision++;
	}

	function clampFrame(f: number) {
		return Math.max(0, Math.min(Math.round(f), project.totalFrames - 1));
	}

	return {
		get project() {
			return project;
		},
		get currentFrame() {
			return currentFrame;
		},
		set currentFrame(v: number) {
			currentFrame = clampFrame(v);
		},
		get canUndo() {
			return undoStack.length > 0;
		},
		get canRedo() {
			return redoStack.length > 0;
		},

		get revision() {
			return revision;
		},

		undo() {
			if (!undoStack.length) return;
			redoStack.push(snap(project));
			project = undoStack.pop()!;
			currentFrame = clampFrame(currentFrame);
			revision++;
		},

		redo() {
			if (!redoStack.length) return;
			undoStack.push(snap(project));
			project = redoStack.pop()!;
			currentFrame = clampFrame(currentFrame);
			revision++;
		},

		/** Seed all tracks from current explorer state. Only commits to undo stack if there is existing work. */
		seedFromExplorer() {
			const hasWork = project.tracks.some((t) => t.keyframes.length > 0);
			if (hasWork) commit();

			const s = viewerState.toJSON();
			project.power = s.power;
			project.algorithm = s.colors.algorithm;
			project.palette = JSON.parse(JSON.stringify(s.colors.palette));
			project.inSetColor = s.colors.inSetColor ?? '#000000';
			project.reverse = s.colors.reverse ?? false;

			const values: Record<TrackParameter, number> = {
				zoom: s.zoom,
				cx: parseFloat(s.cx),
				cy: parseFloat(s.cy),
				maxIter: s.maxIter,
				cyclePeriod: s.colors.cyclePeriod,
				offset: s.colors.offset,
			};
			for (const track of project.tracks) {
				track.keyframes = [{ frame: 0, value: values[track.parameter], easing: 'linear' as const }];
			}
		},

		addKeyframe(trackIdx: number, frame: number, value: number) {
			commit();
			const track = project.tracks[trackIdx];
			track.keyframes = [
				...track.keyframes.filter((k) => k.frame !== frame),
				{ frame, value, easing: 'linear' as const },
			].sort((a, b) => a.frame - b.frame);
		},

		removeKeyframe(trackIdx: number, frame: number) {
			commit();
			project.tracks[trackIdx].keyframes = project.tracks[trackIdx].keyframes.filter(
				(k) => k.frame !== frame,
			);
		},

		updateKeyframeValue(trackIdx: number, frame: number, value: number) {
			commit();
			const kf = project.tracks[trackIdx].keyframes.find((k) => k.frame === frame);
			if (kf) kf.value = value;
		},

		moveKeyframe(trackIdx: number, fromFrame: number, toFrame: number) {
			commit();
			const track = project.tracks[trackIdx];
			const kf = track.keyframes.find((k) => k.frame === fromFrame);
			if (!kf) return;
			track.keyframes = [
				...track.keyframes.filter((k) => k.frame !== fromFrame && k.frame !== toFrame),
				{ ...kf, frame: toFrame },
			].sort((a, b) => a.frame - b.frame);
		},

		updateProject(patch: Partial<Omit<AnimationProject, 'tracks'>>) {
			commit();
			Object.assign(project, patch);
			if (patch.totalFrames !== undefined) {
				currentFrame = clampFrame(currentFrame);
			}
		},
	};
}

export const animationState = createAnimationState();
