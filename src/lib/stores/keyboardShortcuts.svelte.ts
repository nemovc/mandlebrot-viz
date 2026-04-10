type KeyHandler = (e: KeyboardEvent) => void;

class KeyboardManager {
  private layers: { handler: KeyHandler }[] = [];
  private listening = false;

  private dispatch = (e: KeyboardEvent) => {
    this.layers.at(-1)?.handler(e);
  };

  push(handler: KeyHandler): () => void {
    if (!this.listening && typeof window !== 'undefined') {
      window.addEventListener('keydown', this.dispatch);
      this.listening = true;
    }
    const layer = { handler };
    this.layers.push(layer);
    return () => {
      const i = this.layers.lastIndexOf(layer);
      if (i >= 0) this.layers.splice(i, 1);
    };
  }
}

export const keyboard = new KeyboardManager();

/**
 * Svelte action that registers a keyboard handler while the element is mounted.
 * Only the topmost registered handler fires — layers below are suppressed.
 * Use on a conditionally-rendered element (e.g. a modal backdrop) so that
 * the handler is active only while that element exists in the DOM.
 *
 * Usage: <div use:keyboardLayer={handleKeydown}>
 */
export function keyboardLayer(_node: Element, handler: KeyHandler) {
  const remove = keyboard.push(handler);
  return { destroy: remove };
}
