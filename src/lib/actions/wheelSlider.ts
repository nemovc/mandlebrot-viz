export function wheelSlider(node: HTMLInputElement) {
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const step = parseFloat(node.step) || 1;
		const min = parseFloat(node.min);
		const max = parseFloat(node.max);
		const current = parseFloat(node.value);
		const next = Math.max(min, Math.min(max, current + (e.deltaY < 0 ? step : -step)));
		node.value = String(next);
		node.dispatchEvent(new Event('input', { bubbles: true }));
	}
	node.addEventListener('wheel', onWheel, { passive: false });
	return {
		destroy() {
			node.removeEventListener('wheel', onWheel);
		}
	};
}
