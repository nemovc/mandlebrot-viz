export interface DebugStateSnapshot {
	debugLogging: boolean;
	showCrosshair: boolean;
	showTileSquare: boolean;
	slowMode: boolean;
	showTileFlash: boolean;
}

function createDebugState() {
	let debugLogging = $state(false);
	let showCrosshair = $state(false);
	let showTileSquare = $state(false);
	let slowMode = $state(false);
	let showTileFlash = $state(false);

	return {
		get debugLogging() { return debugLogging; },
		set debugLogging(v) { debugLogging = v; },
		get showCrosshair() { return showCrosshair; },
		set showCrosshair(v) { showCrosshair = v; },
		get showTileSquare() { return showTileSquare; },
		set showTileSquare(v) { showTileSquare = v; },
		get slowMode() { return slowMode; },
		set slowMode(v) { slowMode = v; },
		get showTileFlash() { return showTileFlash; },
		set showTileFlash(v) { showTileFlash = v; },

		toJSON(): DebugStateSnapshot {
			return { debugLogging, showCrosshair, showTileSquare, slowMode, showTileFlash };
		},
		loadFrom(s: Partial<DebugStateSnapshot>) {
			if (s.debugLogging !== undefined) debugLogging = s.debugLogging;
			if (s.showCrosshair !== undefined) showCrosshair = s.showCrosshair;
			if (s.showTileSquare !== undefined) showTileSquare = s.showTileSquare;
			if (s.slowMode !== undefined) slowMode = s.slowMode;
			if (s.showTileFlash !== undefined) showTileFlash = s.showTileFlash;
		},
	};
}

export const debugState = createDebugState();

/** Lazy debug logger — msgFn is never called when logging is disabled. */
export function debugLog(msgFn: () => string) {
	if (debugState.debugLogging) console.log(msgFn());
}
