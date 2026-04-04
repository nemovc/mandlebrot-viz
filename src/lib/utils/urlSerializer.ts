import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import type { ViewerState } from '$lib/stores/viewerState.svelte';
import type { DebugStateSnapshot } from '$lib/stores/debugState.svelte';

export interface EncodedState {
	viewer: ViewerState;
	debug?: Partial<DebugStateSnapshot>;
}

export function encodeState(viewer: ViewerState, debug?: Partial<DebugStateSnapshot>): string {
	const state: EncodedState = debug ? { viewer, debug } : { viewer };
	const json = JSON.stringify(state);
	const compressed = deflateSync(strToU8(json));
	const b64 = btoa(String.fromCharCode(...compressed))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
	return b64;
}

export function decodeState(hash: string): EncodedState | null {
	try {
		const raw = hash.startsWith('#') ? hash.slice(1) : hash;
		const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
		const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const json = strFromU8(inflateSync(binary));
		return JSON.parse(json) as EncodedState;
	} catch {
		return null;
	}
}
