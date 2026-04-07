import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		}
	},
	worker: {
		format: 'es'
	},
	optimizeDeps: {
		exclude: ['$lib/wasm/mandelbrot.js']
	},
	assetsInclude: ['**/*.wasm'],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
