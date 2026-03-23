export const VERTEX_SHADER = /* glsl */`#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */`#version 300 es
precision highp float;

uniform vec2 u_center;   // complex center (re, im)
uniform float u_scale;   // complex units per pixel
uniform int u_maxIter;
uniform vec2 u_resolution;

// Color palette (up to 8 stops)
uniform int u_stopCount;
uniform vec3 u_stopColors[8];
uniform float u_stopPositions[8];
uniform float u_cyclePeriod;
uniform float u_colorOffset;

out vec4 fragColor;

vec3 samplePalette(float t) {
  t = mod(t + u_colorOffset, 1.0);
  if (t < 0.0) t += 1.0;

  vec3 color = u_stopColors[0];
  for (int i = 0; i < 7; i++) {
    if (i + 1 >= u_stopCount) break;
    float s0 = u_stopPositions[i];
    float s1 = u_stopPositions[i + 1];
    if (t >= s0 && t <= s1) {
      float f = (t - s0) / (s1 - s0);
      color = mix(u_stopColors[i], u_stopColors[i + 1], f);
    }
  }
  return color;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  // Map pixel to complex plane
  float re = u_center.x + (gl_FragCoord.x - u_resolution.x * 0.5) * u_scale;
  float im = u_center.y + (gl_FragCoord.y - u_resolution.y * 0.5) * u_scale;

  float zr = 0.0, zi = 0.0;
  int iter = 0;

  for (int i = 0; i < 2048; i++) {
    if (i >= u_maxIter) break;
    float zr2 = zr * zr;
    float zi2 = zi * zi;
    if (zr2 + zi2 > 4.0) {
      iter = i;
      // Smooth iteration count
      float log_zn = log(zr2 + zi2) * 0.5;
      float smooth = float(iter) + 1.0 - log2(log_zn / log(2.0));
      float t = mod(smooth / u_cyclePeriod, 1.0);
      fragColor = vec4(samplePalette(t), 1.0);
      return;
    }
    float new_zr = zr2 - zi2 + re;
    zi = 2.0 * zr * zi + im;
    zr = new_zr;
  }

  // In set
  fragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;
