import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders';
import type { ViewerState } from '$lib/stores/viewerState.svelte';
import { samplePalette } from '$lib/utils/colorPalettes';
import { scaleForZoom } from '$lib/utils/precision';

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
	}
	return shader;
}

export class Stage1Renderer {
	private gl: WebGL2RenderingContext;
	private program: WebGLProgram;
	private vao: WebGLVertexArrayObject;
	private uniforms: Record<string, WebGLUniformLocation | null> = {};

	constructor(private canvas: HTMLCanvasElement) {
		const gl = canvas.getContext('webgl2');
		if (!gl) throw new Error('WebGL2 not supported');
		this.gl = gl;

		const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
		const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
		const prog = gl.createProgram()!;
		gl.attachShader(prog, vert);
		gl.attachShader(prog, frag);
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
		}
		this.program = prog;

		// Full-screen quad
		const vao = gl.createVertexArray()!;
		gl.bindVertexArray(vao);
		const buf = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);
		const loc = gl.getAttribLocation(prog, 'a_position');
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		gl.bindVertexArray(null);
		this.vao = vao;

		for (const name of [
			'u_center', 'u_scale', 'u_maxIter', 'u_resolution',
			'u_stopCount', 'u_stopColors', 'u_stopPositions', 'u_cyclePeriod', 'u_colorOffset'
		]) {
			this.uniforms[name] = gl.getUniformLocation(prog, name);
		}
	}

	resize(width: number, height: number) {
		this.canvas.width = width;
		this.canvas.height = height;
		this.gl.viewport(0, 0, width, height);
	}

	draw(state: ViewerState) {
		const gl = this.gl;
		gl.useProgram(this.program);
		gl.bindVertexArray(this.vao);

		const scale = scaleForZoom(state.zoom);
		gl.uniform2f(this.uniforms['u_center'], parseFloat(state.cx), parseFloat(state.cy));
		gl.uniform1f(this.uniforms['u_scale'], scale);
		gl.uniform1i(this.uniforms['u_maxIter'], state.maxIter);
		gl.uniform2f(this.uniforms['u_resolution'], this.canvas.width, this.canvas.height);

		const { palette, cyclePeriod, offset } = state.colors;
		const count = Math.min(palette.length, 8);
		gl.uniform1i(this.uniforms['u_stopCount'], count);
		gl.uniform1f(this.uniforms['u_cyclePeriod'], cyclePeriod);
		gl.uniform1f(this.uniforms['u_colorOffset'], offset);

		const colors: number[] = [];
		const positions: number[] = [];
		for (let i = 0; i < count; i++) {
			const [r, g, b] = samplePalette(palette, palette[i].stop);
			colors.push(r / 255, g / 255, b / 255);
			positions.push(palette[i].stop);
		}
		// Pad to 8
		while (colors.length < 24) colors.push(0);
		while (positions.length < 8) positions.push(0);

		gl.uniform3fv(this.uniforms['u_stopColors'], new Float32Array(colors));
		gl.uniform1fv(this.uniforms['u_stopPositions'], new Float32Array(positions));

		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.bindVertexArray(null);
	}

	destroy() {
		this.gl.deleteProgram(this.program);
	}
}
