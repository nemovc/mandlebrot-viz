/* tslint:disable */
/* eslint-disable */

export function compute_tile_arb(cx: string, cy: string, scale: string, precision_bits: number, w: number, h: number, max_iter: number): Float32Array;

export function compute_tile_arb_dem(cx: string, cy: string, scale: string, precision_bits: number, w: number, h: number, max_iter: number): Float32Array;

export function compute_tile_dd(cx_hi: number, cx_lo: number, cy_hi: number, cy_lo: number, scale_hi: number, scale_lo: number, w: number, h: number, max_iter: number): Float32Array;

export function compute_tile_dd_dem(cx_hi: number, cx_lo: number, cy_hi: number, cy_lo: number, scale_hi: number, scale_lo: number, w: number, h: number, max_iter: number): Float32Array;

export function compute_tile_f64(cx: number, cy: number, scale: number, w: number, h: number, max_iter: number): Float32Array;

export function compute_tile_f64_dem(cx: number, cy: number, scale: number, w: number, h: number, max_iter: number): Float32Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly compute_tile_arb: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number];
    readonly compute_tile_arb_dem: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number];
    readonly compute_tile_dd: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly compute_tile_dd_dem: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly compute_tile_f64: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly compute_tile_f64_dem: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
