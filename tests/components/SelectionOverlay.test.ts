// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectionOverlay } from '@/components/SelectionOverlay';

describe('SelectionOverlay', () => {
  afterEach(() => {
    document.documentElement.querySelectorAll(':scope > div').forEach((node) => {
      node.remove();
    });
  });

  it('cancels and removes itself when Escape is pressed', () => {
    const onCancel = vi.fn();
    const overlay = new SelectionOverlay({
      onCancel,
      onComplete: vi.fn(),
    });
    const initialChildren = document.documentElement.childElementCount;

    overlay.mount();
    expect(document.documentElement.childElementCount).toBe(initialChildren + 1);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }),
    );

    expect(onCancel).toHaveBeenCalledOnce();
    expect(document.documentElement.childElementCount).toBe(initialChildren);
  });
});
