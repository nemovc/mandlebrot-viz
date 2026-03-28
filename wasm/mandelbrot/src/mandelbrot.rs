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
        if re2 + im2 > 65536.0 {
            break;
        }
        let new_re = re2 - im2 + c_re;
        let new_im = 2.0 * z_re * z_im + c_im;
        z_re = new_re;
        z_im = new_im;
        iter += 1;
    }

    if iter < max_iter {
        let log_zn = (z_re * z_re + z_im * z_im).ln() / 2.0;
        (iter as f64 + 1.0 - (log_zn / std::f64::consts::LN_2).log2()) as f32
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

        if norm2.hi > 65536.0 {
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
        let log_zn = norm_sq.ln() / 2.0;
        (iter as f64 + 1.0 - (log_zn / std::f64::consts::LN_2).log2()) as f32
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

/// Distance Estimation Method (DEM) for a single point using f64.
///
/// DEM computes an approximation of the minimum distance from the point `c` to
/// the boundary of the Mandelbrot set. It does this by simultaneously tracking
/// the derivative of the iteration function with respect to `c` (written dz/dc).
///
/// The iteration z_{n+1} = z_n² + c has derivative:
///   dz_{n+1}/dc = 2·z_n·(dz_n/dc) + 1,  with dz_0/dc = 0
///
/// After the orbit escapes, the distance estimate is:
///   dist ≈ 2·|z|·ln(|z|) / |dz/dc|
///
/// Points inside the set return -1.0. Outside points return a positive distance
/// value in the same units as the c-plane (complex units per pixel at scale 1).
/// Smaller values are closer to the boundary and produce the characteristic
/// "edge-lit" appearance of DEM renders.
///
/// Note: DEM uses a much larger bailout radius than smooth/escape-time coloring.
/// With a small bailout (|z|=2), |z| at escape varies from 2 to ~4, so ln(|z|)
/// varies enough to create spurious iteration-count banding on top of the DEM
/// coloring. With a large bailout (|z|=1e6), ln(|z|) ≈ 13.8 is nearly constant
/// across all escaping points, so the distance is driven almost entirely by
/// |dz/dc| as intended. The extra iterations are negligible since |z| grows
/// exponentially once it escapes.
pub fn iterate_f64_dem(c_re: f64, c_im: f64, max_iter: u32) -> f32 {
    let mut z_re = 0.0f64;
    let mut z_im = 0.0f64;
    // dz/dc starts at 0; each iteration applies the chain rule: dz = 2·z·dz + 1
    let mut dz_re = 0.0f64;
    let mut dz_im = 0.0f64;
    let mut iter = 0u32;

    while iter < max_iter {
        let re2 = z_re * z_re;
        let im2 = z_im * z_im;
        if re2 + im2 > 1e12 {
            break;
        }
        let new_dz_re = 2.0 * (z_re * dz_re - z_im * dz_im) + 1.0;
        let new_dz_im = 2.0 * (z_re * dz_im + z_im * dz_re);
        let new_re = re2 - im2 + c_re;
        let new_im = 2.0 * z_re * z_im + c_im;
        z_re = new_re;
        z_im = new_im;
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
) -> Vec<f32> {
    let w_half = w as f64 / 2.0;
    let h_half = h as f64 / 2.0;
    let mut result = vec![0.0f32; w * h];
    for py in 0..h {
        for px in 0..w {
            let c_re = cx + (px as f64 - w_half) * scale;
            let c_im = cy + (py as f64 - h_half) * scale;
            result[py * w + px] = iterate_f64_dem(c_re, c_im, max_iter);
        }
    }
    result
}

/// DEM using double-double arithmetic for both z and dz/dc.
///
/// Same algorithm as iterate_f64_dem but both the orbit (z) and its derivative
/// (dz/dc) are tracked in double-double precision. This is necessary at deep
/// zoom levels where f64 loses enough mantissa bits that the derivative
/// accumulates significant rounding error, producing coloring artifacts.
pub fn iterate_dd_dem(c_re: DoubleDouble, c_im: DoubleDouble, max_iter: u32) -> f32 {
    let mut z_re = DoubleDouble::from_f64(0.0);
    let mut z_im = DoubleDouble::from_f64(0.0);
    let mut dz_re = DoubleDouble::from_f64(0.0);
    let mut dz_im = DoubleDouble::from_f64(0.0);
    let two = DoubleDouble::from_f64(2.0);
    let one = DoubleDouble::from_f64(1.0);
    let mut iter = 0u32;

    while iter < max_iter {
        let re2 = DoubleDouble::mul(z_re, z_re);
        let im2 = DoubleDouble::mul(z_im, z_im);
        if DoubleDouble::add(re2, im2).hi > 1e12 {
            break;
        }
        // dz = 2*z*dz + 1
        let new_dz_re = DoubleDouble::add(
            DoubleDouble::mul(two, DoubleDouble::sub(DoubleDouble::mul(z_re, dz_re), DoubleDouble::mul(z_im, dz_im))),
            one,
        );
        let new_dz_im = DoubleDouble::mul(
            two,
            DoubleDouble::add(DoubleDouble::mul(z_re, dz_im), DoubleDouble::mul(z_im, dz_re)),
        );
        let new_re = DoubleDouble::add(DoubleDouble::sub(re2, im2), c_re);
        let new_im = DoubleDouble::add(DoubleDouble::mul(DoubleDouble::mul(two, z_re), z_im), c_im);
        z_re = new_re;
        z_im = new_im;
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
            result[py * w + px] = iterate_dd_dem(c_re, c_im, max_iter);
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
