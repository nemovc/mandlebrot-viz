/** Moves the element to document.body, escaping any CSS transform stacking context. */
export function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
