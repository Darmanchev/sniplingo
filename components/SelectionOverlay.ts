import type { SelectionRect } from '@/types/selection';

interface SelectionOverlayOptions {
  onCancel: () => void;
  onComplete: (rect: SelectionRect) => void;
}

const MIN_SELECTION_SIZE = 4;

export class SelectionOverlay {
  private readonly host = document.createElement('div');
  private readonly root: HTMLDivElement;
  private readonly selection: HTMLDivElement;
  private readonly instruction: HTMLDivElement;
  private readonly topMask: HTMLDivElement;
  private readonly rightMask: HTMLDivElement;
  private readonly bottomMask: HTMLDivElement;
  private readonly leftMask: HTMLDivElement;
  private startPoint: { x: number; y: number } | null = null;
  private pendingEndPoint: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private animationFrameId: number | null = null;

  constructor(private readonly options: SelectionOverlayOptions) {
    const shadowRoot = this.host.attachShadow({ mode: 'closed' });

    shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: block;
          width: 100vw;
          height: 100vh;
        }

        #root {
          position: absolute;
          inset: 0;
          overflow: hidden;
          cursor: crosshair;
          user-select: none;
          touch-action: none;
          background: rgb(15 23 42 / 58%);
        }

        .mask {
          position: absolute;
          display: none;
          background: rgb(15 23 42 / 58%);
          pointer-events: none;
        }

        #selection {
          position: absolute;
          display: none;
          z-index: 1;
          box-sizing: border-box;
          border: 2px solid #38bdf8;
          background: rgb(255 255 255 / 8%);
          pointer-events: none;
        }

        #instruction {
          position: fixed;
          z-index: 2;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          padding: 8px 12px;
          border-radius: 8px;
          color: #f8fafc;
          background: rgb(15 23 42 / 90%);
          box-shadow: 0 4px 16px rgb(0 0 0 / 24%);
          font: 500 13px/1.4 system-ui, sans-serif;
          white-space: nowrap;
          pointer-events: none;
        }
      </style>
      <div id="root">
        <div id="mask-top" class="mask"></div>
        <div id="mask-right" class="mask"></div>
        <div id="mask-bottom" class="mask"></div>
        <div id="mask-left" class="mask"></div>
        <div id="selection"></div>
        <div id="instruction">Drag to select an area · Esc to cancel</div>
      </div>
    `;

    this.root = shadowRoot.querySelector<HTMLDivElement>('#root')!;
    this.selection = shadowRoot.querySelector<HTMLDivElement>('#selection')!;
    this.instruction = shadowRoot.querySelector<HTMLDivElement>('#instruction')!;
    this.topMask = shadowRoot.querySelector<HTMLDivElement>('#mask-top')!;
    this.rightMask = shadowRoot.querySelector<HTMLDivElement>('#mask-right')!;
    this.bottomMask = shadowRoot.querySelector<HTMLDivElement>('#mask-bottom')!;
    this.leftMask = shadowRoot.querySelector<HTMLDivElement>('#mask-left')!;
  }

  mount(): void {
    document.documentElement.append(this.host);
    this.root.addEventListener('pointerdown', this.handlePointerDown);
    this.root.addEventListener('pointermove', this.handlePointerMove);
    this.root.addEventListener('pointerup', this.handlePointerUp);
    this.root.addEventListener('pointercancel', this.handlePointerCancel);
    window.addEventListener('keydown', this.handleKeyDown, true);
  }

  destroy(): void {
    this.cancelScheduledRender();
    this.root.removeEventListener('pointerdown', this.handlePointerDown);
    this.root.removeEventListener('pointermove', this.handlePointerMove);
    this.root.removeEventListener('pointerup', this.handlePointerUp);
    this.root.removeEventListener('pointercancel', this.handlePointerCancel);
    window.removeEventListener('keydown', this.handleKeyDown, true);
    this.host.remove();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;

    this.blockPageEvent(event);
    this.pointerId = event.pointerId;
    this.startPoint = { x: event.clientX, y: event.clientY };
    this.root.setPointerCapture(event.pointerId);
    this.root.style.background = 'transparent';
    this.selection.style.display = 'block';
    this.renderSelection(this.toRect(this.startPoint, this.startPoint));
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId || this.startPoint === null) return;

    this.blockPageEvent(event);
    this.pendingEndPoint = { x: event.clientX, y: event.clientY };

    if (this.animationFrameId !== null) return;

    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;

      if (this.startPoint === null || this.pendingEndPoint === null) return;
      this.renderSelection(this.toRect(this.startPoint, this.pendingEndPoint));
    });
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId || this.startPoint === null) return;

    this.blockPageEvent(event);
    const rect = this.toRect(this.startPoint, {
      x: event.clientX,
      y: event.clientY,
    });

    this.cancelScheduledRender();
    this.root.releasePointerCapture(event.pointerId);
    this.pointerId = null;
    this.startPoint = null;

    if (
      rect.width < MIN_SELECTION_SIZE ||
      rect.height < MIN_SELECTION_SIZE
    ) {
      this.resetSelection();
      return;
    }

    this.renderSelection(rect);
    this.instruction.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px · Esc to cancel`;
    this.options.onComplete(rect);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) return;

    this.cancelScheduledRender();
    this.pointerId = null;
    this.startPoint = null;
    this.resetSelection();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;

    this.blockPageEvent(event);
    this.destroy();
    this.options.onCancel();
  };

  private blockPageEvent(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private resetSelection(): void {
    this.root.style.background = 'rgb(15 23 42 / 58%)';
    this.selection.style.display = 'none';
    this.setMasksDisplay('none');
    this.instruction.textContent = 'Drag to select an area · Esc to cancel';
  }

  private renderSelection(rect: SelectionRect): void {
    this.setMasksDisplay('block');

    this.topMask.style.inset = `0 0 auto 0`;
    this.topMask.style.height = `${rect.y}px`;

    this.bottomMask.style.inset = `${rect.y + rect.height}px 0 0 0`;

    this.leftMask.style.inset = `${rect.y}px auto auto 0`;
    this.leftMask.style.width = `${rect.x}px`;
    this.leftMask.style.height = `${rect.height}px`;

    this.rightMask.style.inset = `${rect.y}px 0 auto ${rect.x + rect.width}px`;
    this.rightMask.style.height = `${rect.height}px`;

    this.selection.style.left = `${rect.x}px`;
    this.selection.style.top = `${rect.y}px`;
    this.selection.style.width = `${rect.width}px`;
    this.selection.style.height = `${rect.height}px`;
  }

  private setMasksDisplay(display: 'block' | 'none'): void {
    this.topMask.style.display = display;
    this.rightMask.style.display = display;
    this.bottomMask.style.display = display;
    this.leftMask.style.display = display;
  }

  private cancelScheduledRender(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.pendingEndPoint = null;
  }

  private toRect(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): SelectionRect {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }
}
