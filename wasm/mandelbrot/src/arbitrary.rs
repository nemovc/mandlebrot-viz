use astro_float::{BigFloat, Consts, RoundingMode};

/// Compute (z_re + i*z_im)^n by repeated BigFloat multiplication.
fn complex_pow_arb(
    z_re: &BigFloat,
    z_im: &BigFloat,
    n: u32,
    p: usize,
    rm: RoundingMode,
) -> (BigFloat, BigFloat) {
    match n {
        0 => (BigFloat::from_f64(1.0, p), BigFloat::from_f64(0.0, p)),
        1 => (z_re.clone(), z_im.clone()),
        _ => {
            let (mut rr, mut ri) = (z_re.clone(), z_im.clone());
            for _ in 1..n {
                let nr = rr.mul(z_re, p, rm).sub(&ri.mul(z_im, p, rm), p, rm);
                let ni = rr.mul(z_im, p, rm).add(&ri.mul(z_re, p, rm), p, rm);
                rr = nr;
                ri = ni;
            }
            (rr, ri)
        }
    }
}

/// Parallel f64 complex power for smooth coloring / DEM derivative.
#[inline]
fn complex_pow_f64(zr: f64, zi: f64, n: u32) -> (f64, f64) {
    match n {
        0 => (1.0, 0.0),
        1 => (zr, zi),
        2 => (zr * zr - zi * zi, 2.0 * zr * zi),
        _ => {
            let (mut rr, mut ri) = (zr, zi);
            for _ in 1..n {
                let nr = rr * zr - ri * zi;
                let ni = rr * zi + ri * zr;
                rr = nr;
                ri = ni;
            }
            (rr, ri)
        }
    }
}

pub fn compute_tile_arb(
    cx: &str,
    cy: &str,
    scale: &str,
    precision_bits: usize,
    w: usize,
    h: usize,
    max_iter: u32,
    power: u32,
) -> Vec<f32> {
    let rm = RoundingMode::ToEven;
    let mut cc = Consts::new().expect("Failed to create constants");
    let p = precision_bits;

    let cx_bf = BigFloat::parse(cx, astro_float::Radix::Dec, p, rm, &mut cc);
    let cy_bf = BigFloat::parse(cy, astro_float::Radix::Dec, p, rm, &mut cc);
    let scale_bf = BigFloat::parse(scale, astro_float::Radix::Dec, p, rm, &mut cc);

    let w_half = BigFloat::from_f64(w as f64 / 2.0, p);
    let h_half = BigFloat::from_f64(h as f64 / 2.0, p);
    let bailout = BigFloat::from_f64(65536.0, p);

    // f64 approximations for smooth coloring log
    let cx_f64: f64 = cx.parse().unwrap_or(0.0);
    let cy_f64: f64 = cy.parse().unwrap_or(0.0);
    let scale_f64: f64 = scale.parse().unwrap_or(1.0);
    let w_half_f = w as f64 / 2.0;
    let h_half_f = h as f64 / 2.0;
    let ln_p = (power as f64).ln();

    let mut result = vec![0.0f32; w * h];

    for py in 0..h {
        let c_im_f64 = cy_f64 + (py as f64 - h_half_f) * scale_f64;

        for px in 0..w {
            let c_re_f64 = cx_f64 + (px as f64 - w_half_f) * scale_f64;

            let dx = BigFloat::from_f64(px as f64, p)
                .sub(&w_half, p, rm)
                .mul(&scale_bf, p, rm);
            let dy = BigFloat::from_f64(py as f64, p)
                .sub(&h_half, p, rm)
                .mul(&scale_bf, p, rm);

            let c_re = cx_bf.add(&dx, p, rm);
            let c_im = cy_bf.add(&dy, p, rm);

            let mut z_re = BigFloat::from_f64(0.0, p);
            let mut z_im = BigFloat::from_f64(0.0, p);
            // Parallel f64 for smooth coloring log
            let mut zr = 0.0f64;
            let mut zi = 0.0f64;
            let mut iter = 0u32;

            while iter < max_iter {
                let re2 = z_re.mul(&z_re, p, rm);
                let im2 = z_im.mul(&z_im, p, rm);
                let norm2 = re2.add(&im2, p, rm);

                if norm2.cmp(&bailout).map_or(false, |c| c > 0) {
                    break;
                }

                let (new_re_p, new_im_p) = complex_pow_arb(&z_re, &z_im, power, p, rm);
                z_re = new_re_p.add(&c_re, p, rm);
                z_im = new_im_p.add(&c_im, p, rm);

                let (new_zr, new_zi) = complex_pow_f64(zr, zi, power);
                zr = new_zr + c_re_f64;
                zi = new_zi + c_im_f64;

                iter += 1;
            }

            let smooth = if iter < max_iter {
                let log_zn = (zr * zr + zi * zi).ln() / 2.0;
                (iter as f64 + 1.0 - (log_zn / ln_p).ln() / ln_p) as f32
            } else {
                max_iter as f32
            };

            result[py * w + px] = smooth;
        }
    }

    result
}

/// DEM using arbitrary-precision z and f64 dz/dc.
///
/// At extreme zoom levels the orbit z must be tracked in arbitrary precision to
/// correctly determine escape — but the derivative dz/dc only affects coloring,
/// not the escape test, so f64 is accurate enough for it. We reuse the parallel
/// f64 orbit (zr/zi) that is already maintained for smooth-coloring purposes to
/// drive the f64 derivative update, keeping the arb-precision overhead minimal.
pub fn compute_tile_arb_dem(
    cx: &str,
    cy: &str,
    scale: &str,
    precision_bits: usize,
    w: usize,
    h: usize,
    max_iter: u32,
    power: u32,
) -> Vec<f32> {
    let rm = RoundingMode::ToEven;
    let mut cc = Consts::new().expect("Failed to create constants");
    let p = precision_bits;

    let cx_bf = BigFloat::parse(cx, astro_float::Radix::Dec, p, rm, &mut cc);
    let cy_bf = BigFloat::parse(cy, astro_float::Radix::Dec, p, rm, &mut cc);
    let scale_bf = BigFloat::parse(scale, astro_float::Radix::Dec, p, rm, &mut cc);

    let w_half = BigFloat::from_f64(w as f64 / 2.0, p);
    let h_half = BigFloat::from_f64(h as f64 / 2.0, p);
    let bailout = BigFloat::from_f64(1e12, p);

    let cx_f64: f64 = cx.parse().unwrap_or(0.0);
    let cy_f64: f64 = cy.parse().unwrap_or(0.0);
    let scale_f64: f64 = scale.parse().unwrap_or(1.0);
    let w_half_f = w as f64 / 2.0;
    let h_half_f = h as f64 / 2.0;
    let n_f = power as f64;

    let mut result = vec![0.0f32; w * h];

    for py in 0..h {
        let c_im_f64 = cy_f64 + (py as f64 - h_half_f) * scale_f64;

        for px in 0..w {
            let c_re_f64 = cx_f64 + (px as f64 - w_half_f) * scale_f64;

            let dx = BigFloat::from_f64(px as f64, p)
                .sub(&w_half, p, rm)
                .mul(&scale_bf, p, rm);
            let dy = BigFloat::from_f64(py as f64, p)
                .sub(&h_half, p, rm)
                .mul(&scale_bf, p, rm);
            let c_re = cx_bf.add(&dx, p, rm);
            let c_im = cy_bf.add(&dy, p, rm);

            let mut z_re = BigFloat::from_f64(0.0, p);
            let mut z_im = BigFloat::from_f64(0.0, p);
            let mut zr = 0.0f64;
            let mut zi = 0.0f64;
            let mut dz_re = 0.0f64;
            let mut dz_im = 0.0f64;
            let mut iter = 0u32;

            while iter < max_iter {
                let re2 = z_re.mul(&z_re, p, rm);
                let im2 = z_im.mul(&z_im, p, rm);
                let norm2 = re2.add(&im2, p, rm);

                if norm2.cmp(&bailout).map_or(false, |c| c > 0) {
                    break;
                }

                // dz = n * z^(n-1) * dz + 1 — computed in f64 using parallel orbit
                let (zn1_re, zn1_im) = complex_pow_f64(zr, zi, power - 1);
                let new_dz_re = n_f * (zn1_re * dz_re - zn1_im * dz_im) + 1.0;
                let new_dz_im = n_f * (zn1_re * dz_im + zn1_im * dz_re);

                let (new_re_p, new_im_p) = complex_pow_arb(&z_re, &z_im, power, p, rm);
                z_re = new_re_p.add(&c_re, p, rm);
                z_im = new_im_p.add(&c_im, p, rm);

                let (new_zr, new_zi) = complex_pow_f64(zr, zi, power);
                zr = new_zr + c_re_f64;
                zi = new_zi + c_im_f64;
                dz_re = new_dz_re;
                dz_im = new_dz_im;

                iter += 1;
            }

            let val = if iter >= max_iter {
                -1.0f32
            } else {
                let norm_z = (zr * zr + zi * zi).sqrt();
                let norm_dz = (dz_re * dz_re + dz_im * dz_im).sqrt();
                if norm_dz < 1e-30 || norm_z < 1e-30 {
                    -1.0
                } else {
                    (2.0 * norm_z * norm_z.ln() / norm_dz) as f32
                }
            };

            result[py * w + px] = val;
        }
    }

    result
}
