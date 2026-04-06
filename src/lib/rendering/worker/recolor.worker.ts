import type { RecolorJob, RecolorResult } from './jobs';
import { buildImageData } from '$lib/utils/colorPalettes';

self.onmessage = async (e: MessageEvent<RecolorJob>) => {
	const { id, tileW, tileH, maxIter, colorConfig, iters, cdf, slow } = e.data;
	if (slow) await new Promise((r) => setTimeout(r, 200));
	const imageData = buildImageData(iters, tileW, tileH, maxIter, colorConfig, cdf);
	(self as unknown as Worker).postMessage(
		{ id, imageData } satisfies RecolorResult,
		{ transfer: [imageData.data.buffer] }
	);
};
