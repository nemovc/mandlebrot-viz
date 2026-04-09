import type { ColorConfig } from "$lib/utils/colorPalettes";
import { samplePalette, hexToRgb, baseAlgorithm } from "$lib/utils/colorPalettes";

const JULIA_SIZE = 192;
const MAX_STOPS = 16;
const HISTOGRAM_BINS = 256;  // Max iterations we track for histogram
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
  private iterProgram: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private paletteBuffer = new Float32Array(MAX_STOPS * 4);
  private lostContext: WEBGL_lose_context | null = null;

  // Iteration texture for histogram building
  private iterTexture: WebGLTexture | null = null;
  private iterFramebuffer: WebGLFramebuffer | null = null;
  private cdfTexture: WebGLTexture | null = null;
  private iterData = new Float32Array(JULIA_SIZE * JULIA_SIZE);
  private histogramBins = new Uint32Array(HISTOGRAM_BINS);

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      throw new Error('WebGL2 not supported');
    }
    this.gl = gl;

    this.lostContext = gl.getExtension('WEBGL_lose_context');

    // Enable float color buffer support for R32F render targets
    gl.getExtension('EXT_color_buffer_float');

    this.initHistogramResources();
    this.initShaders();
    this.initGeometry();
  }

  private initHistogramResources() {
    const gl = this.gl;

    // Create iteration texture (R32F format)
    this.iterTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.iterTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, JULIA_SIZE, JULIA_SIZE, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create framebuffer for iteration rendering
    this.iterFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.iterFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.iterTexture, 0);

    // Create CDF texture (R32F)
    this.cdfTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.cdfTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, HISTOGRAM_BINS, 1, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private initShaders() {
    const gl = this.gl;
    const vertexSource = `#version 300 es
      in vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Iteration shader - outputs raw iteration value to R32F texture
    const iterFragmentSource = `#version 300 es
      precision highp float;

      uniform vec2 u_c;
      uniform float u_scale;
      uniform int u_maxIter;
      uniform int u_power;

      out float fragIter;

      void main() {
        float zx = (gl_FragCoord.x - 96.5) * u_scale;
        float zy = (gl_FragCoord.y - 96.5) * u_scale;
        float cr = u_c.x;
        float ci = u_c.y;

        int escapedIter = u_maxIter;
        float smoothVal = float(u_maxIter);
        const float escapeRadius2 = 1e12;  // Large radius for accurate smooth values

        for (int i = 0; i < 256; i++) {
          if (i >= u_maxIter) break;

          float pzr = zx, pzi = zy;
          for (int p = 0; p < 9; p++) {
            if (p + 1 >= u_power) break;
            float nr = pzr * zx - pzi * zy;
            float ni = pzr * zy + pzi * zx;
            pzr = nr;
            pzi = ni;
          }

          zx = pzr + cr;
          zy = pzi + ci;

          float mag2 = zx * zx + zy * zy;
          if (mag2 > escapeRadius2) {
            escapedIter = i;
            // Smooth coloring for accurate histogram
            float log_zn = log(mag2) / 2.0;
            float ln_p = log(float(u_power));
            smoothVal = float(i) + 1.0 - log(log_zn / ln_p) / ln_p;
            break;
          }
        }

        fragIter = (escapedIter >= u_maxIter) ? float(u_maxIter) : smoothVal;
      }
    `;

    // Main color shader with DEM and histogram support
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
      uniform int u_histogram;
      uniform vec4 u_palette[${MAX_STOPS}];
      uniform int u_paletteSize;
      uniform vec3 u_inSetColor;
      uniform sampler2D u_cdfTexture;

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

      float getCdf(float iter) {
        // CDF is stored in 256-wide texture, sample at iter/256
        // Use linear filtering for smooth interpolation between bins
        float coord = iter / 256.0;
        return texture(u_cdfTexture, vec2(coord, 0.5)).r;
      }

      void main() {
        float zx = (gl_FragCoord.x - 96.5) * u_scale;
        float zy = (gl_FragCoord.y - 96.5) * u_scale;
        float cr = u_c.x;
        float ci = u_c.y;

        int escapedIter = u_maxIter;
        float smoothVal = float(u_maxIter);
        float distEst = -1.0;

        float dzr = 1.0;
        float dzi = 0.0;

        const float escapeRadius2 = 1e12;  // Large radius for accurate smooth values

        for (int i = 0; i < 256; i++) {
          if (i >= u_maxIter) break;

          float pzr = zx, pzi = zy;
          float zn1r = 1.0, zn1i = 0.0;
          for (int p = 0; p < 9; p++) {
            if (p + 1 >= u_power) break;
            float nr = pzr * zx - pzi * zy;
            float ni = pzr * zy + pzi * zx;
            float nnr = zn1r * zx - zn1i * zy;
            float nni = zn1r * zy + zn1i * zx;
            pzr = nr;
            pzi = ni;
            zn1r = nnr;
            zn1i = nni;
          }

          float new_dzr = float(u_power) * (zn1r * dzr - zn1i * dzi);
          float new_dzi = float(u_power) * (zn1r * dzi + zn1i * dzr);
          dzr = new_dzr;
          dzi = new_dzi;

          zx = pzr + cr;
          zy = pzi + ci;

          float mag2 = zx * zx + zy * zy;
          if (mag2 > escapeRadius2) {
            escapedIter = i;
            if (u_dem == 1) {
              float norm_z = sqrt(mag2);
              float norm_dz = sqrt(dzr * dzr + dzi * dzi);
              if (norm_dz > 1e-30 && norm_z > 1e-30) {
                distEst = 2.0 * norm_z * log(norm_z) / norm_dz;
              }
            } else {
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
        if (u_histogram == 1 && escapedIter < u_maxIter) {
          // Histogram equalization: use CDF with linear interpolation
          // Use smoothVal (not escapedIter) for continuous transitions
          float lo = floor(smoothVal);
          float hi = min(lo + 1.0, float(u_maxIter - 1));
          float cdfLo = getCdf(lo);
          float cdfHi = getCdf(hi);
          float fracPart = fract(smoothVal);
          float rawT = cdfLo + (cdfHi - cdfLo) * fracPart;
          if (u_banded == 1) {
            rawT = getCdf(lo);
          }
          t = fract(rawT + u_offset);
        } else if (u_dem == 1 && distEst > 0.0) {
          float logDist = -log2(max(distEst, 1e-30));
          float scaledLog = u_banded == 1 ? floor(logDist) : logDist;
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
    const iterFragmentShader = this.compileShader(gl.FRAGMENT_SHADER, iterFragmentSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    this.program = this.createProgram(vertexShader, fragmentShader);
    this.iterProgram = this.createProgram(vertexShader, iterFragmentShader);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteShader(iterFragmentShader);
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

  private renderIterations(params: RenderParams): Float32Array {
    const gl = this.gl;

    // Render iteration values to texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.iterFramebuffer);
    gl.viewport(0, 0, JULIA_SIZE, JULIA_SIZE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.iterProgram);
    gl.uniform2f(gl.getUniformLocation(this.iterProgram!, 'u_c'), params.cRe, params.cIm);
    gl.uniform1f(gl.getUniformLocation(this.iterProgram!, 'u_scale'), params.scale);
    gl.uniform1i(gl.getUniformLocation(this.iterProgram!, 'u_maxIter'), params.maxIter);
    gl.uniform1i(gl.getUniformLocation(this.iterProgram!, 'u_power'), params.power);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    // Read back iteration data (R32F format)
    gl.readPixels(0, 0, JULIA_SIZE, JULIA_SIZE, gl.RED, gl.FLOAT, this.iterData);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return this.iterData;
  }

  private buildHistogramFromIterations(iters: Float32Array, maxIter: number): Uint32Array {
    this.histogramBins.fill(0);
    for (let i = 0; i < iters.length; i++) {
      const v = iters[i];
      if (v < maxIter) {
        const bin = Math.min(Math.floor(v), maxIter - 1);
        this.histogramBins[bin]++;
      }
    }
    return this.histogramBins;
  }

  private computeCdfFromHistogram(histogram: Uint32Array, maxIter: number): Float32Array {
    const cdf = new Float32Array(HISTOGRAM_BINS);
    let total = 0;
    for (let i = 0; i < maxIter; i++) {
      total += histogram[i];
    }
    if (total === 0) return cdf;
    let cumulative = 0;
    for (let i = 0; i < maxIter; i++) {
      cumulative += histogram[i];
      cdf[i] = cumulative / total;
    }
    // Fill remaining entries with 1.0 so sampling beyond maxIter still works
    for (let i = maxIter; i < HISTOGRAM_BINS; i++) {
      cdf[i] = 1.0;
    }
    return cdf;
  }

  private uploadCdf(cdf: Float32Array) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.cdfTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, HISTOGRAM_BINS, 1, 0, gl.RED, gl.FLOAT, cdf);
  }

  render(params: RenderParams) {
    const gl = this.gl;
    const { cyclePeriod, offset, palette, reverse, inSetColor, algorithm } = params.colorConfig;
    const banded = algorithm.endsWith('_banded');
    const dem = algorithm.startsWith('distance_estimation');
    const isHistogram = baseAlgorithm(algorithm) === 'histogram';

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

    // For histogram mode: render iterations, build histogram on CPU, upload CDF
    if (isHistogram) {
      const iters = this.renderIterations(params);
      this.buildHistogramFromIterations(iters, params.maxIter);
      const cdf = this.computeCdfFromHistogram(this.histogramBins, params.maxIter);
      this.uploadCdf(cdf);
    }

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
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_histogram'), isHistogram ? 1 : 0);
    gl.uniform3f(gl.getUniformLocation(this.program!, 'u_inSetColor'), inSetRgb[0] / 255, inSetRgb[1] / 255, inSetRgb[2] / 255);

    const paletteLoc = gl.getUniformLocation(this.program!, 'u_palette');
    gl.uniform4fv(paletteLoc, this.paletteBuffer);
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_paletteSize'), palette.length);

    // Bind CDF texture to texture unit 0
    gl.uniform1i(gl.getUniformLocation(this.program!, 'u_cdfTexture'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cdfTexture);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  destroy() {
    const gl = this.gl;

    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
    if (this.iterProgram) gl.deleteProgram(this.iterProgram);
    if (this.iterTexture) gl.deleteTexture(this.iterTexture);
    if (this.cdfTexture) gl.deleteTexture(this.cdfTexture);
    if (this.iterFramebuffer) gl.deleteFramebuffer(this.iterFramebuffer);

    if (this.lostContext) {
      this.lostContext.loseContext();
    }
  }
}
