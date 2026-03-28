use crate::double_double::DoubleDouble;

// ---------------------------------------------------------------------------
// Complex power helpers
// ---------------------------------------------------------------------------

/// Compute (z_re + i*z_im)^n by repeated multiplication. n=0 returns (1,0).
#[inline]
fn complex_pow_f64(z_re: f64, z_im: f64, n: u32) -> (f64, f64) {
    match n {
        0 => (1.0, 0.0),
        1 => (z_re, z_im),
        2 => (z_re * z_re - z_im * z_im, 2.0 * z_re * z_im),
        _ => {
            let (mut rr, mut ri) = (z_re, z_im);
            for _ in 1..n {
                let nr = rr * z_re - ri * z_im;
                let ni = rr * z_im + ri * z_re;
                rr = nr;
                ri = ni;
            }
            (rr, ri)
        }
    }
}

/// Smooth-coloring normalization for power `n`. Equivalent to log_n(log_n(|z|)).
/// For n=2 this reduces to log2(log2(|z|)).
#[inline]
fn smooth_color_f64(z_re: f64, z_im: f64, iter: u32, power: u32) -> f32 {
    let log_zn = (z_re * z_re + z_im * z_im).ln() / 2.0; // = ln|z|
    let ln_p = (power as f64).ln();
    (iter as f64 + 1.0 - (log_zn / ln_p).ln() / ln_p) as f32
}

fn complex_pow_dd(z_re: DoubleDouble, z_im: DoubleDouble, n: u32) -> (DoubleDouble, DoubleDouble) {
    let zero = DoubleDouble::from_f64(0.0);
    let one = DoubleDouble::from_f64(1.0);
    match n {
        0 => (one, zero),
        1 => (z_re, z_im),
        2 => (
            DoubleDouble::sub(DoubleDouble::mul(z_re, z_re), DoubleDouble::mul(z_im, z_im)),
            DoubleDouble::mul(DoubleDouble::from_f64(2.0), DoubleDouble::mul(z_re, z_im)),
        ),
        _ => {
            let (mut rr, mut ri) = (z_re, z_im);
            for _ in 1..n {
                let nr = DoubleDouble::sub(DoubleDouble::mul(rr, z_re), DoubleDouble::mul(ri, z_im));
                let ni = DoubleDouble::add(DoubleDouble::mul(rr, z_im), DoubleDouble::mul(ri, z_re));
                rr = nr;
                ri = ni;
            }
            (rr, ri)
        }
    }
}

// ---------------------------------------------------------------------------
// f64 iteration
// ---------------------------------------------------------------------------

/// Smooth iteration count for a single point using f64.
/// Returns max_iter if point is in set, otherwise smooth escape value.
pub fn iterate_f64(c_re: f64, c_im: f64, max_iter: u32, power: u32) -> f32 {
    let mut z_re = 0.0f64;
    let mut z_im = 0.0f64;
    let mut iter = 0u32;

    while iter < max_iter {
        if z_re * z_re + z_im * z_im > 65536.0 {
            break;
        }
        let (new_re, new_im) = complex_pow_f64(z_re, z_im, power);
        z_re = new_re + c_re;
        z_im = new_im + c_im;
        iter += 1;
    }

    if iter < max_iter {
        smooth_color_f64(z_re, z_im, iter, power)
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
    power: u32,
) -> Vec<f32> {
    let w_half = w as f64 / 2.0;
    let h_half = h as f64 / 2.0;
    let mut result = vec![0.0f32; w * h];

    for py in 0..h {
        for px in 0..w {
            let c_re = cx + (px as f64 - w_half) * scale;
            let c_im = cy + (py as f64 - h_half) * scale;
            result[py * w + px] = iterate_f64(c_re, c_im, max_iter, power);
        }
    }

    result
}

// ---------------------------------------------------------------------------
// f64 DEM
// ---------------------------------------------------------------------------

/// Distance Estimation Method (DEM) for a single point using f64.
///
/// For z → z^n + c the derivative recurrence is:
///   dz_{k+1}/dc = n · z_k^(n-1) · (dz_k/dc) + 1,  with dz_0/dc = 0
///
/// After the orbit escapes, the distance estimate is:
///   dist ≈ 2·|z|·ln(|z|) / |dz/dc|
pub fn iterate_f64_dem(c_re: f64, c_im: f64, max_iter: u32, power: u32) -> f32 {
    let mut z_re = 0.0f64;
    let mut z_im = 0.0f64;
    let mut dz_re = 0.0f64;
    let mut dz_im = 0.0f64;
    let mut iter = 0u32;
    let n_f = power as f64;

    while iter < max_iter {
        if z_re * z_re + z_im * z_im > 1e12 {
            break;
        }
        // dz = n * z^(n-1) * dz + 1
        let (zn1_re, zn1_im) = complex_pow_f64(z_re, z_im, power - 1);
        let new_dz_re = n_f * (zn1_re * dz_re - zn1_im * dz_im) + 1.0;
        let new_dz_im = n_f * (zn1_re * dz_im + zn1_im * dz_re);

        let (new_re, new_im) = complex_pow_f64(z_re, z_im, power);
        z_re = new_re + c_re;
        z_im = new_im + c_im;
        dz_re = new_dz_re;
        dz_im = new_dz_im;
        iter += 1;
    }

    if iter >= max_iter {
        return -1.0;
    }

    let norm_z = (z_re * z_re + z_im * z_im).sqrt();
    let norm_dz = (dz_re * dz_re + dz_im * dz_im).sqrt();
    if norm_dz < 1e-30 || norm_z < 1e-30 {
        return -1.0;
    }
    (2.0 * norm_z * norm_z.ln() / norm_dz) as f32
}

pub fn compute_tile_f64_dem(
    cx: f64,
    cy: f64,
    scale: f64,
    w: usize,
    h: usize,
    max_iter: u32,
    power: u32,
) -> Vec<f32> {
    let w_half = w as f64 / 2.0;
    let h_half = h as f64 / 2.0;
    let mut result = vec![0.0f32; w * h];
    for py in 0..h {
        for px in 0..w {
            let c_re = cx + (px as f64 - w_half) * scale;
            let c_im = cy + (py as f64 - h_half) * scale;
            result[py * w + px] = iterate_f64_dem(c_re, c_im, max_iter, power);
        }
    }
    result
}

// ---------------------------------------------------------------------------
// Double-double iteration
// ---------------------------------------------------------------------------

/// Smooth iteration count using double-double arithmetic.
pub fn iterate_dd(c_re: DoubleDouble, c_im: DoubleDouble, max_iter: u32, power: u32) -> f32 {
    let mut z_re = DoubleDouble::from_f64(0.0);
    let mut z_im = DoubleDouble::from_f64(0.0);
    let mut iter = 0u32;

    while iter < max_iter {
        let norm2 = DoubleDouble::add(DoubleDouble::mul(z_re, z_re), DoubleDouble::mul(z_im, z_im));
        if norm2.hi > 65536.0 {
            break;
        }
        let (new_re_p, new_im_p) = complex_pow_dd(z_re, z_im, power);
        z_re = DoubleDouble::add(new_re_p, c_re);
        z_im = DoubleDouble::add(new_im_p, c_im);
        iter += 1;
    }

    if iter < max_iter {
        let norm_sq = z_re.hi * z_re.hi + z_im.hi * z_im.hi;
        let log_zn = norm_sq.ln() / 2.0;
        let ln_p = (power as f64).ln();
        (iter as f64 + 1.0 - (log_zn / ln_p).ln() / ln_p) as f32
    } else {
        max_iter as f32
    }
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
    power: u32,
) -> Vec<f32> {
    let cx = DoubleDouble::new(cx_hi, cx_lo);
    let cy = DoubleDouble::new(cy_hi, cy_lo);
    let scale = DoubleDouble::new(scale_hi, scale_lo);

    let w_half = DoubleDouble::from_f64(w as f64 / 2.0);
    let h_half = DoubleDouble::from_f64(h as f64 / 2.0);
    let mut result = vec![0.0f32; w * h];

    for py in 0..h {
        for px in 0..w {
            let c_re = DoubleDouble::add(
                cx,
                DoubleDouble::mul(DoubleDouble::sub(DoubleDouble::from_f64(px as f64), w_half), scale),
            );
            let c_im = DoubleDouble::add(
                cy,
                DoubleDouble::mul(DoubleDouble::sub(DoubleDouble::from_f64(py as f64), h_half), scale),
            );
            result[py * w + px] = iterate_dd(c_re, c_im, max_iter, power);
        }
    }

    result
}

// ---------------------------------------------------------------------------
// Double-double DEM
// ---------------------------------------------------------------------------

/// DEM using double-double arithmetic for both z and dz/dc.
pub fn iterate_dd_dem(c_re: DoubleDouble, c_im: DoubleDouble, max_iter: u32, power: u32) -> f32 {
    let mut z_re = DoubleDouble::from_f64(0.0);
    let mut z_im = DoubleDouble::from_f64(0.0);
    let mut dz_re = DoubleDouble::from_f64(0.0);
    let mut dz_im = DoubleDouble::from_f64(0.0);
    let one = DoubleDouble::from_f64(1.0);
    let n_dd = DoubleDouble::from_f64(power as f64);
    let mut iter = 0u32;

    while iter < max_iter {
        let norm2 = DoubleDouble::add(DoubleDouble::mul(z_re, z_re), DoubleDouble::mul(z_im, z_im));
        if norm2.hi > 1e12 {
            break;
        }
        // dz = n * z^(n-1) * dz + 1
        let (zn1_re, zn1_im) = complex_pow_dd(z_re, z_im, power - 1);
        let new_dz_re = DoubleDouble::add(
            DoubleDouble::mul(n_dd, DoubleDouble::sub(
                DoubleDouble::mul(zn1_re, dz_re),
                DoubleDouble::mul(zn1_im, dz_im),
            )),
            one,
        );
        let new_dz_im = DoubleDouble::mul(n_dd, DoubleDouble::add(
            DoubleDouble::mul(zn1_re, dz_im),
            DoubleDouble::mul(zn1_im, dz_re),
        ));

        let (new_re_p, new_im_p) = complex_pow_dd(z_re, z_im, power);
        z_re = DoubleDouble::add(new_re_p, c_re);
        z_im = DoubleDouble::add(new_im_p, c_im);
        dz_re = new_dz_re;
        dz_im = new_dz_im;
        iter += 1;
    }

    if iter >= max_iter {
        return -1.0;
    }

    let norm_z = (z_re.hi * z_re.hi + z_im.hi * z_im.hi).sqrt();
    let norm_dz = (dz_re.hi * dz_re.hi + dz_im.hi * dz_im.hi).sqrt();
    if norm_dz < 1e-30 || norm_z < 1e-30 {
        return -1.0;
    }
    (2.0 * norm_z * norm_z.ln() / norm_dz) as f32
}

pub fn compute_tile_dd_dem(
    cx_hi: f64,
    cx_lo: f64,
    cy_hi: f64,
    cy_lo: f64,
    scale_hi: f64,
    scale_lo: f64,
    w: usize,
    h: usize,
    max_iter: u32,
    power: u32,
) -> Vec<f32> {
    let cx = DoubleDouble::new(cx_hi, cx_lo);
    let cy = DoubleDouble::new(cy_hi, cy_lo);
    let scale = DoubleDouble::new(scale_hi, scale_lo);
    let w_half = DoubleDouble::from_f64(w as f64 / 2.0);
    let h_half = DoubleDouble::from_f64(h as f64 / 2.0);
    let mut result = vec![0.0f32; w * h];

    for py in 0..h {
        for px in 0..w {
            let c_re = DoubleDouble::add(cx, DoubleDouble::mul(DoubleDouble::sub(DoubleDouble::from_f64(px as f64), w_half), scale));
            let c_im = DoubleDouble::add(cy, DoubleDouble::mul(DoubleDouble::sub(DoubleDouble::from_f64(py as f64), h_half), scale));
            result[py * w + px] = iterate_dd_dem(c_re, c_im, max_iter, power);
        }
    }
    result
}
