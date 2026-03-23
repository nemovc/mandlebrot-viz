mod arbitrary;
mod double_double;
mod mandelbrot;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn compute_tile_f64(
    cx: f64,
    cy: f64,
    scale: f64,
    w: u32,
    h: u32,
    max_iter: u32,
) -> Vec<f32> {
    mandelbrot::compute_tile_f64(cx, cy, scale, w as usize, h as usize, max_iter)
}

#[wasm_bindgen]
pub fn compute_tile_dd(
    cx_hi: f64,
    cx_lo: f64,
    cy_hi: f64,
    cy_lo: f64,
    scale_hi: f64,
    scale_lo: f64,
    w: u32,
    h: u32,
    max_iter: u32,
) -> Vec<f32> {
    mandelbrot::compute_tile_dd(
        cx_hi, cx_lo, cy_hi, cy_lo, scale_hi, scale_lo, w as usize, h as usize, max_iter,
    )
}

#[wasm_bindgen]
pub fn compute_tile_arb(
    cx: &str,
    cy: &str,
    scale: &str,
    precision_bits: u32,
    w: u32,
    h: u32,
    max_iter: u32,
) -> Vec<f32> {
    arbitrary::compute_tile_arb(
        cx,
        cy,
        scale,
        precision_bits as usize,
        w as usize,
        h as usize,
        max_iter,
    )
}
