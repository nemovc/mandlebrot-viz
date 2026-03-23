use crate::double_double::DoubleDouble;

/// Smooth iteration count for a single point using f64.
/// Returns max_iter if point is in set, otherwise smooth escape value.
pub fn iterate_f64(c_re: f64, c_im: f64, max_iter: u32) -> f32 {
    let mut z_re = 0.0f64;
    let mut z_im = 0.0f64;
    let mut iter = 0u32;

    while iter < max_iter {
        let re2 = z_re * z_re;
        let im2 = z_im * z_im;
        if re2 + im2 > 4.0 {
            break;
        }
        let new_re = re2 - im2 + c_re;
        let new_im = 2.0 * z_re * z_im + c_im;
        z_re = new_re;
        z_im = new_im;
        iter += 1;
    }

    if iter < max_iter {
        let log_zn = ((z_re * z_re + z_im * z_im) as f32).ln() / 2.0;
        iter as f32 + 1.0 - (log_zn / std::f32::consts::LN_2).log2()
    } else {
        max_iter as f32
    }
}

/// Smooth iteration count using double-double arithmetic.
pub fn iterate_dd(c_re: DoubleDouble, c_im: DoubleDouble, max_iter: u32) -> f32 {
    let mut z_re = DoubleDouble::from_f64(0.0);
    let mut z_im = DoubleDouble::from_f64(0.0);
    let mut iter = 0u32;

    while iter < max_iter {
        let re2 = DoubleDouble::mul(z_re, z_re);
        let im2 = DoubleDouble::mul(z_im, z_im);
        let norm2 = DoubleDouble::add(re2, im2);

        if norm2.hi > 4.0 {
            break;
        }

        let two = DoubleDouble::from_f64(2.0);
        let new_re = DoubleDouble::add(DoubleDouble::sub(re2, im2), c_re);
        let new_im =
            DoubleDouble::add(DoubleDouble::mul(DoubleDouble::mul(two, z_re), z_im), c_im);

        z_re = new_re;
        z_im = new_im;
        iter += 1;
    }

    if iter < max_iter {
        let norm_sq = z_re.hi * z_re.hi + z_im.hi * z_im.hi;
        let log_zn = (norm_sq as f32).ln() / 2.0;
        iter as f32 + 1.0 - (log_zn / std::f32::consts::LN_2).log2()
    } else {
        max_iter as f32
    }
}

pub fn compute_tile_f64(
    cx: f64,
    cy: f64,
    scale: f64,
    w: usize,
    h: usize,
    max_iter: u32,
) -> Vec<f32> {
    let w_half = w as f64 / 2.0;
    let h_half = h as f64 / 2.0;
    let mut result = vec![0.0f32; w * h];

    for py in 0..h {
        for px in 0..w {
            let c_re = cx + (px as f64 - w_half) * scale;
            let c_im = cy + (py as f64 - h_half) * scale;
            result[py * w + px] = iterate_f64(c_re, c_im, max_iter);
        }
    }

    result
}

pub fn compute_tile_dd(
    cx_hi: f64,
    cx_lo: f64,
    cy_hi: f64,
    cy_lo: f64,
    scale_hi: f64,
    scale_lo: f64,
    w: usize,
    h: usize,
    max_iter: u32,
) -> Vec<f32> {
    let cx = DoubleDouble::new(cx_hi, cx_lo);
    let cy = DoubleDouble::new(cy_hi, cy_lo);
    let scale = DoubleDouble::new(scale_hi, scale_lo);

    let w_half = DoubleDouble::from_f64(w as f64 / 2.0);
    let h_half = DoubleDouble::from_f64(h as f64 / 2.0);
    let mut result = vec![0.0f32; w * h];

    for py in 0..h {
        for px in 0..w {
            let px_dd = DoubleDouble::from_f64(px as f64);
            let py_dd = DoubleDouble::from_f64(py as f64);

            let c_re = DoubleDouble::add(
                cx,
                DoubleDouble::mul(DoubleDouble::sub(px_dd, w_half), scale),
            );
            let c_im = DoubleDouble::add(
                cy,
                DoubleDouble::mul(DoubleDouble::sub(py_dd, h_half), scale),
            );

            result[py * w + px] = iterate_dd(c_re, c_im, max_iter);
        }
    }

    result
}
