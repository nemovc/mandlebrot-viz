/// Double-double arithmetic using Knuth/Dekker two-sum.
/// Represents a value as hi + lo where |lo| <= ulp(hi)/2.
#[derive(Clone, Copy)]
pub struct DoubleDouble {
    pub hi: f64,
    pub lo: f64,
}

impl DoubleDouble {
    pub fn new(hi: f64, lo: f64) -> Self {
        Self { hi, lo }
    }

    pub fn from_f64(x: f64) -> Self {
        Self { hi: x, lo: 0.0 }
    }

    /// Knuth two-sum: exact split of a + b into sum + error
    pub fn add(a: Self, b: Self) -> Self {
        let s = a.hi + b.hi;
        let e = b.hi - (s - a.hi);
        let lo = a.lo + b.lo + e;
        let hi = s + lo;
        let lo = lo - (hi - s);
        Self { hi, lo }
    }

    pub fn sub(a: Self, b: Self) -> Self {
        Self::add(a, Self { hi: -b.hi, lo: -b.lo })
    }

    /// Veltkamp splitting for exact multiplication
    pub fn mul(a: Self, b: Self) -> Self {
        let p = a.hi * b.hi;
        // Use fused multiply-add if available for exact error
        let e = a.hi.mul_add(b.hi, -p) + a.hi * b.lo + a.lo * b.hi;
        let hi = p + e;
        let lo = e - (hi - p);
        Self { hi, lo }
    }

    pub fn abs_sq(self) -> Self {
        let re2 = Self::mul(self, self);
        re2
    }

    pub fn norm_sq(re: Self, im: Self) -> Self {
        Self::add(Self::mul(re, re), Self::mul(im, im))
    }

    pub fn to_f64(self) -> f64 {
        self.hi + self.lo
    }
}
