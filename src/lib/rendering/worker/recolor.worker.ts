import type { RenderJob, TileResult } from './workerPool';
import { buildImageData } from '$lib/utils/colorPalettes';

self.onmessage = async (e: MessageEvent<RenderJob>) => {
	const { id, tileSize, maxIter, colorConfig, iters, cdf, slow } = e.data;
	const tileW = e.data.tileW ?? tileSize;
	const tileH = e.data.tileH ?? tileSize;
	if (slow) await new Promise((r) => setTimeout(r, 200));
	const imageData = buildImageData(iters!, tileW, tileH, maxIter, colorConfig, cdf);
	(self as unknown as Worker).postMessage(
		{ id, imageData } satisfies TileResult,
		{ transfer: [imageData.data.buffer] }
	);
};
