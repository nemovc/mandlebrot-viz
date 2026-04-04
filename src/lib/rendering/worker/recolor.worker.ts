import type { RenderJob, TileResult } from './workerPool';
import { buildImageData } from '$lib/utils/colorPalettes';

self.onmessage = async (e: MessageEvent<RenderJob>) => {
	const { id, tileSize, maxIter, colorConfig, iters, cdf, slow } = e.data;
	if (slow) await new Promise((r) => setTimeout(r, 200));
	const imageData = buildImageData(iters!, tileSize, tileSize, maxIter, colorConfig, cdf);
	(self as unknown as Worker).postMessage(
		{ id, imageData } satisfies TileResult,
		{ transfer: [imageData.data.buffer] }
	);
};
