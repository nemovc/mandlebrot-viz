export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
export type TrackParameter = 'cx' | 'cy' | 'zoom' | 'maxIter' | 'colorOffset' | 'colorCycle';

export interface Keyframe {
	time: number;
	value: number | string;
	easing: EasingType;
	easingParams?: [number, number, number, number];
}

export interface ParameterTrack {
	parameter: TrackParameter;
	keyframes: Keyframe[];
}

export interface AnimationProject {
	width: number;
	height: number;
	fps: number;
	duration: number;
	tracks: ParameterTrack[];
}

function createAnimationState() {
	let project = $state<AnimationProject>({
		width: 1920,
		height: 1080,
		fps: 30,
		duration: 10,
		tracks: []
	});
	let currentTime = $state(0);
	let playing = $state(false);

	return {
		get project() { return project; },
		set project(v) { project = v; },
		get currentTime() { return currentTime; },
		set currentTime(v) { currentTime = v; },
		get playing() { return playing; },
		set playing(v) { playing = v; },

		addTrack(parameter: TrackParameter) {
			project.tracks = [...project.tracks, { parameter, keyframes: [] }];
		},

		addKeyframe(trackIndex: number, keyframe: Keyframe) {
			const track = project.tracks[trackIndex];
			track.keyframes = [...track.keyframes, keyframe].sort((a, b) => a.time - b.time);
		},

		removeKeyframe(trackIndex: number, time: number) {
			const track = project.tracks[trackIndex];
			track.keyframes = track.keyframes.filter((k) => k.time !== time);
		}
	};
}

export const animationState = createAnimationState();
