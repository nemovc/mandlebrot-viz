import type { RenderJob, TileResult } from './workerPool';
import { buildImageData } from '$lib/utils/colorPalettes';

self.onmessage = (e: MessageEvent<RenderJob>) => {
	const { id, tileSize, maxIter, colorConfig, iters } = e.data;
	const imageData = buildImageData(iters!, tileSize, tileSize, maxIter, colorConfig);
	(self as unknown as Worker).postMessage(
		{ id, imageData } satisfies TileResult,
		{ transfer: [imageData.data.buffer] }
	);
};
