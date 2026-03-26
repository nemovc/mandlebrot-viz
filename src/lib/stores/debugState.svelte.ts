function createDebugState() {
	let debugLogging = $state(false);
	let showCrosshair = $state(false);
	let showTileSquare = $state(false);
	let slowMode = $state(false);

	return {
		get debugLogging() { return debugLogging; },
		set debugLogging(v) { debugLogging = v; },
		get showCrosshair() { return showCrosshair; },
		set showCrosshair(v) { showCrosshair = v; },
		get showTileSquare() { return showTileSquare; },
		set showTileSquare(v) { showTileSquare = v; },
		get slowMode() { return slowMode; },
		set slowMode(v) { slowMode = v; },
	};
}

export const debugState = createDebugState();

/** Lazy debug logger — msgFn is never called when logging is disabled. */
export function debugLog(msgFn: () => string) {
	if (debugState.debugLogging) console.log(msgFn());
}
