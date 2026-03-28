use astro_float::{BigFloat, Consts, RoundingMode};

pub fn compute_tile_arb(
    cx: &str,
    cy: &str,
    scale: &str,
    precision_bits: usize,
    w: usize,
    h: usize,
    max_iter: u32,
) -> Vec<f32> {
    let rm = RoundingMode::ToEven;
    let mut cc = Consts::new().expect("Failed to create constants");
    let p = precision_bits;

    let cx_bf = BigFloat::parse(cx, astro_float::Radix::Dec, p, rm, &mut cc);
    let cy_bf = BigFloat::parse(cy, astro_float::Radix::Dec, p, rm, &mut cc);
    let scale_bf = BigFloat::parse(scale, astro_float::Radix::Dec, p, rm, &mut cc);

    let w_half = BigFloat::from_f64(w as f64 / 2.0, p);
    let h_half = BigFloat::from_f64(h as f64 / 2.0, p);
    let four = BigFloat::from_f64(65536.0, p);
    let two = BigFloat::from_f64(2.0, p);

    // f64 approximations of center/scale for smooth coloring log only
    let cx_f64: f64 = cx.parse().unwrap_or(0.0);
    let cy_f64: f64 = cy.parse().unwrap_or(0.0);
    let scale_f64: f64 = scale.parse().unwrap_or(1.0);
    let w_half_f = w as f64 / 2.0;
    let h_half_f = h as f64 / 2.0;

    let mut result = vec![0.0f32; w * h];

    for py in 0..h {
        let c_im_f64 = cy_f64 + (py as f64 - h_half_f) * scale_f64;

        for px in 0..w {
            let c_re_f64 = cx_f64 + (px as f64 - w_half_f) * scale_f64;

            // High-precision center coords for this pixel
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
            // Parallel f64 tracking for smooth coloring log (low precision ok here)
            let mut zr = 0.0f64;
            let mut zi = 0.0f64;
            let mut iter = 0u32;

            while iter < max_iter {
                let re2 = z_re.mul(&z_re, p, rm);
                let im2 = z_im.mul(&z_im, p, rm);
                let norm2 = re2.add(&im2, p, rm);

                // cmp returns Option<SignedWord> (i128 on 64-bit); > 0 means self > other
                if norm2.cmp(&four).map_or(false, |c| c > 0) {
                    break;
                }

                let new_re = re2.sub(&im2, p, rm).add(&c_re, p, rm);
                let new_im = two.mul(&z_re, p, rm).mul(&z_im, p, rm).add(&c_im, p, rm);
                z_re = new_re;
                z_im = new_im;

                // Update parallel f64 approximation
                let new_zr = zr * zr - zi * zi + c_re_f64;
                let new_zi = 2.0 * zr * zi + c_im_f64;
                zr = new_zr;
                zi = new_zi;

                iter += 1;
            }

            let smooth = if iter < max_iter {
                let log_zn = (zr * zr + zi * zi).ln() / 2.0;
                (iter as f64 + 1.0 - (log_zn / std::f64::consts::LN_2).log2()) as f32
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
) -> Vec<f32> {
    let rm = RoundingMode::ToEven;
    let mut cc = Consts::new().expect("Failed to create constants");
    let p = precision_bits;

    let cx_bf = BigFloat::parse(cx, astro_float::Radix::Dec, p, rm, &mut cc);
    let cy_bf = BigFloat::parse(cy, astro_float::Radix::Dec, p, rm, &mut cc);
    let scale_bf = BigFloat::parse(scale, astro_float::Radix::Dec, p, rm, &mut cc);

    let w_half = BigFloat::from_f64(w as f64 / 2.0, p);
    let h_half = BigFloat::from_f64(h as f64 / 2.0, p);
    // DEM needs a large bailout so ln(|z|) is nearly constant at escape — see
    // iterate_f64_dem for a full explanation. 1e12 = radius 1e6.
    let bailout = BigFloat::from_f64(1e12, p);
    let two = BigFloat::from_f64(2.0, p);

    // f64 approximations of center/scale for parallel dz tracking
    let cx_f64: f64 = cx.parse().unwrap_or(0.0);
    let cy_f64: f64 = cy.parse().unwrap_or(0.0);
    let scale_f64: f64 = scale.parse().unwrap_or(1.0);
    let w_half_f = w as f64 / 2.0;
    let h_half_f = h as f64 / 2.0;

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
            // Parallel f64 z for dz/dc computation (same pattern as smooth coloring)
            let mut zr = 0.0f64;
            let mut zi = 0.0f64;
            // dz/dc tracked in f64
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

                // Update dz = 2*z*dz + 1 in f64 using parallel z approximation
                let new_dz_re = 2.0 * (zr * dz_re - zi * dz_im) + 1.0;
                let new_dz_im = 2.0 * (zr * dz_im + zi * dz_re);

                let new_re = re2.sub(&im2, p, rm).add(&c_re, p, rm);
                let new_im = two.mul(&z_re, p, rm).mul(&z_im, p, rm).add(&c_im, p, rm);
                z_re = new_re;
                z_im = new_im;

                let new_zr = zr * zr - zi * zi + c_re_f64;
                let new_zi = 2.0 * zr * zi + c_im_f64;
                zr = new_zr;
                zi = new_zi;
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
