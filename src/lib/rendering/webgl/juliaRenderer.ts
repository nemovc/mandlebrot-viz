import type { ColorConfig } from "$lib/utils/colorPalettes";
import { samplePalette, hexToRgb } from "$lib/utils/colorPalettes";

const JULIA_SIZE = 192;
const MAX_STOPS = 16;
// Scale to show [-2, 2] on a 192x192 canvas: 4 units / 192 pixels
const JULIA_SCALE = 4.0 / JULIA_SIZE;

interface RenderParams {
  cRe: number;
  cIm: number;
  scale: number;
  maxIter: number;
  power: number;
  colorConfig: ColorConfig;
}

export class JuliaRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private paletteBuffer = new Float32Array(MAX_STOPS * 4);
  private lostContext: WEBGL_lose_context | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      throw new Error('WebGL2 not supported');
    }
    this.gl = gl;

    this.lostContext = gl.getExtension('WEBGL_lose_context');

    this.initShaders();
    this.initGeometry();
  }

  private initShaders() {
    const gl = this.gl;
    const vertexSource = `#version 300 es
      in vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment shader with escape-time and DEM support
    const fragmentSource = `#version 300 es
      precision highp float;

      uniform vec2 u_c;
      uniform float u_scale;
      uniform int u_maxIter;
      uniform int u_power;
      uniform float u_cyclePeriod;
      uniform float u_offset;
      uniform int u_reverse;
      uniform int u_banded;
      uniform int u_dem;
      uniform vec4 u_palette[${MAX_STOPS}];
      uniform int u_paletteSize;
      uniform vec3 u_inSetColor;

      out vec4 fragColor;

      vec3 samplePalette(float t) {
        if (u_paletteSize == 0) return vec3(0.0);
        float scaled = t * float(u_paletteSize - 1);
        int idx = int(scaled);
        float f = fract(scaled);
        if (idx >= u_paletteSize - 1) return u_palette[u_paletteSize - 1].rgb;
        vec4 a = u_palette[idx];
        vec4 b = u_palette[idx + 1];
        return mix(a.rgb, b.rgb, f);
      }

      void main() {
        // Julia set: z = z^power + c, starting from pixel coordinate
        // Center at origin: pixel (96, 96) maps to (0, 0)
        float zx = (gl_FragCoord.x - 96.5) * u_scale;
        float zy = (gl_FragCoord.y - 96.5) * u_scale;
        float cr = u_c.x;
        float ci = u_c.y;

        int escapedIter = u_maxIter;
        float smoothVal = float(u_maxIter);
        float distEst = -1.0;

        // Derivative for DEM: dz/dz starts at 1
        float dzr = 1.0;
        float dzi = 0.0;

        const float escapeRadius2 = 4.0;
        const float demEscapeRadius2 = 1e12;  // Larger radius for DEM accuracy

        for (int i = 0; i < 256; i++) {
          if (i >= u_maxIter) break;

          // Compute z^power by repeated multiplication (start from z, multiply power-1 times)
          float pzr = zx, pzi = zy;
          float zn1r = 1.0, zn1i = 0.0;
          for (int p = 0; p < 9; p++) {
            if (p + 1 >= u_power) break;
            // pzi * zx for next iteration
            float nr = pzr * zx - pzi * zy;
            float ni = pzr * zy + pzi * zx;
            // z^(power-1) for derivative
            float nnr = zn1r * zx - zn1i * zy;
            float nni = zn1r * zy + zn1i * zx;
            pzr = nr;
            pzi = ni;
            zn1r = nnr;
            zn1i = nni;
          }

          // Update derivative: dz = n * z^(n-1) * dz
          float new_dzr = float(u_power) * (zn1r * dzr - zn1i * dzi);
          float new_dzi = float(u_power) * (zn1r * dzi + zn1i * dzr);
          dzr = new_dzr;
          dzi = new_dzi;

          zx = pzr + cr;
          zy = pzi + ci;

          float mag2 = zx * zx + zy * zy;
          float escapeThreshold = u_dem == 1 ? demEscapeRadius2 : escapeRadius2;
          if (mag2 > escapeThreshold) {
            escapedIter = i;
            if (u_dem == 1) {
              // DEM: dist = 2 * |z| * ln(|z|) / |dz|
              float norm_z = sqrt(mag2);
              float norm_dz = sqrt(dzr * dzr + dzi * dzi);
              if (norm_dz > 1e-30 && norm_z > 1e-30) {
                distEst = 2.0 * norm_z * log(norm_z) / norm_dz;
              }
            } else {
              // Smooth escape time
              float log_zn = log(mag2) / 2.0;
              float ln_p = log(float(u_power));
              smoothVal = float(i) + 1.0 - log(log_zn / ln_p) / ln_p;
            }
            break;
          }
        }

        if (escapedIter >= u_maxIter) {
          fragColor = vec4(u_inSetColor, 1.0);
          return;
        }

        float t;
        if (u_dem == 1 && distEst > 0.0) {
          // Log-scale the distance: -log₂(dist) gives dense bands at edge
          // Match the main viewer's formula: -log₂(max(dist, 1e-30))
          float logDist = -log2(max(distEst, 1e-30));
          float scaledLog = u_banded == 1 ? floor(logDist) : logDist;
          // Normalize to [0,1) matching JS ((x % 1) + 1) % 1 pattern
          t = fract(fract(scaledLog / u_cyclePeriod) + u_offset);
        } else {
          float n = u_banded == 1 ? floor(smoothVal) : smoothVal;
          t = fract(n / u_cyclePeriod + u_offset);
        }
        if (u_reverse == 1) t = 1.0 - t;
        fragColor = vec4(samplePalette(t), 1.0);
      }
    `;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    this.program = this.createProgram(vertexShader, fragmentShader);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${error}`);
    }
    return shader;
  }

  private createProgram(vertex: WebGLShader, fragment: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    this.gl.attachShader(program, vertex);
    this.gl.attachShader(program, fragment);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Program link error: ${error}`);
    }
    return program;
  }

  private initGeometry() {
    const gl = this.gl;

    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const loc = gl.getAttribLocation(this.program!, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  render(params: RenderParams) {
    const gl = this.gl;
    const { cyclePeriod, offset, palette, reverse, inSetColor, algorithm } = params.colorConfig;
    const banded = algorithm.endsWith('_banded');
    const dem = algorithm.startsWith('distance_estimation');

    this.paletteBuffer.fill(0);
    for (let i = 0; i < Math.min(palette.length, MAX_STOPS); i++) {
      const stop = palette[i];
      const rgb = hexToRgb(stop.color);
      this.paletteBuffer[i * 4 + 0] = rgb[0] / 255;
      this.paletteBuffer[i * 4 + 1] = rgb[1] / 255;
      this.paletteBuffer[i * 4 + 2] = rgb[2] / 255;
      this.paletteBuffer[i * 4 + 3] = 1;
    }

    const inSetRgb = inSetColor ? hexToRgb(inSetColor) : [0, 0, 0];

    gl.viewport(0, 0, JULIA_SIZE, JULIA_SIZE);
    gl.useProgram(this.program);

    gl.uniform2f(gl.getUniformLocation(this.program!, 'u_c'), params.cRe, params.cIm);
    gl.uniform1f(gl.getUniformLocation(this.program!, 'u_scale'), params.scale);
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_maxIter'), params.maxIter);
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_power'), params.power);
    gl.uniform1f(gl.getUniformLocation(this.program!, 'u_cyclePeriod'), cyclePeriod);
    gl.uniform1f(gl.getUniformLocation(this.program!, 'u_offset'), offset);
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_reverse'), reverse ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_banded'), banded ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_dem'), dem ? 1 : 0);
    gl.uniform3f(gl.getUniformLocation(this.program!, 'u_inSetColor'), inSetRgb[0] / 255, inSetRgb[1] / 255, inSetRgb[2] / 255);

    const paletteLoc = gl.getUniformLocation(this.program!, 'u_palette');
    gl.uniform4fv(paletteLoc, this.paletteBuffer);
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_paletteSize'), palette.length);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  destroy() {
    const gl = this.gl;

    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);

    if (this.lostContext) {
      this.lostContext.loseContext();
    }
  }
}
