export class ResultPanel {
  private readonly host = document.createElement('div');
  private readonly image: HTMLImageElement;
  private readonly error: HTMLParagraphElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly ocrButton: HTMLButtonElement;
  private readonly ocrSection: HTMLElement;
  private readonly ocrTestImage: HTMLImageElement;
  private readonly ocrProgress: HTMLParagraphElement;
  private readonly ocrError: HTMLParagraphElement;
  private readonly ocrText: HTMLPreElement;
  private ocrHandler: (() => void) | null = null;

  constructor() {
    const shadowRoot = this.host.attachShadow({ mode: 'closed' });

    shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 2147483647;
          display: block;
          width: min(420px, calc(100vw - 32px));
          color: #0f172a;
          font: 14px/1.4 system-ui, sans-serif;
        }

        #panel {
          overflow: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 12px 36px rgb(15 23 42 / 28%);
        }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 650;
        }

        #close {
          display: grid;
          width: 28px;
          height: 28px;
          padding: 0;
          place-items: center;
          border: 0;
          border-radius: 6px;
          color: #475569;
          background: transparent;
          cursor: pointer;
          font: 20px/1 system-ui, sans-serif;
        }

        #close:hover {
          color: #0f172a;
          background: #f1f5f9;
        }

        #close:focus-visible,
        #ocr-test:focus-visible {
          outline: 3px solid rgb(56 189 248 / 45%);
          outline-offset: 1px;
        }

        #content {
          max-height: min(680px, calc(100vh - 80px));
          overflow: auto;
          padding: 12px;
        }

        img {
          display: block;
          width: 100%;
          max-height: 280px;
          object-fit: contain;
          border-radius: 6px;
          background: #f8fafc;
        }

        #error,
        #ocr-error {
          margin: 0;
          color: #b91c1c;
        }

        #ocr-test {
          width: 100%;
          margin-top: 12px;
          padding: 9px 12px;
          border: 0;
          border-radius: 7px;
          color: #ffffff;
          background: #0284c7;
          cursor: pointer;
          font: 600 13px/1.4 system-ui, sans-serif;
        }

        #ocr-test:hover {
          background: #0369a1;
        }

        #ocr-test:disabled {
          background: #94a3b8;
          cursor: wait;
        }

        #ocr-section {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }

        #ocr-label,
        #ocr-progress {
          margin: 0 0 8px;
          color: #475569;
          font-size: 12px;
        }

        #ocr-test-image {
          max-height: 140px;
          border: 1px solid #e2e8f0;
        }

        #ocr-text {
          max-height: 180px;
          overflow: auto;
          margin: 10px 0 0;
          padding: 10px;
          border-radius: 6px;
          color: #0f172a;
          background: #f1f5f9;
          font: 13px/1.5 ui-monospace, SFMono-Regular, monospace;
          white-space: pre-wrap;
        }
      </style>
      <section id="panel" aria-label="SnipLingo result">
        <header>
          <span>Captured selection</span>
          <button id="close" type="button" aria-label="Close">×</button>
        </header>
        <div id="content">
          <img id="image" alt="Selected page area" hidden />
          <p id="error" role="alert" hidden></p>
          <button id="ocr-test" type="button" hidden>Run OCR test</button>
          <section id="ocr-section" hidden>
            <p id="ocr-label">Fixed OCR test image (not the screenshot)</p>
            <img id="ocr-test-image" alt="OCR test with English and Russian text" />
            <p id="ocr-progress" role="status" aria-live="polite"></p>
            <p id="ocr-error" role="alert" hidden></p>
            <pre id="ocr-text" hidden></pre>
          </section>
        </div>
      </section>
    `;

    this.image = shadowRoot.querySelector<HTMLImageElement>('#image')!;
    this.error = shadowRoot.querySelector<HTMLParagraphElement>('#error')!;
    this.closeButton = shadowRoot.querySelector<HTMLButtonElement>('#close')!;
    this.ocrButton = shadowRoot.querySelector<HTMLButtonElement>('#ocr-test')!;
    this.ocrSection = shadowRoot.querySelector<HTMLElement>('#ocr-section')!;
    this.ocrTestImage =
      shadowRoot.querySelector<HTMLImageElement>('#ocr-test-image')!;
    this.ocrProgress =
      shadowRoot.querySelector<HTMLParagraphElement>('#ocr-progress')!;
    this.ocrError =
      shadowRoot.querySelector<HTMLParagraphElement>('#ocr-error')!;
    this.ocrText = shadowRoot.querySelector<HTMLPreElement>('#ocr-text')!;
  }

  mount(): void {
    this.closeButton.addEventListener('click', this.destroy);
    document.documentElement.append(this.host);
  }

  showImage(imageDataUrl: string): void {
    this.error.hidden = true;
    this.image.src = imageDataUrl;
    this.image.hidden = false;
    this.ocrButton.hidden = false;
  }

  showError(message: string): void {
    this.image.hidden = true;
    this.ocrButton.hidden = true;
    this.error.textContent = message;
    this.error.hidden = false;
  }

  enableOcrTest(handler: () => void): void {
    if (this.ocrHandler !== null) {
      this.ocrButton.removeEventListener('click', this.ocrHandler);
    }

    this.ocrHandler = handler;
    this.ocrButton.addEventListener('click', handler);
  }

  showOcrLoading(testImageDataUrl: string): void {
    this.ocrButton.disabled = true;
    this.ocrSection.hidden = false;
    this.ocrTestImage.src = testImageDataUrl;
    this.ocrProgress.textContent = 'Preparing OCR…';
    this.ocrError.hidden = true;
    this.ocrText.hidden = true;
  }

  showOcrProgress(status: string, progress: number): void {
    const percentage = Math.round(progress * 100);
    this.ocrProgress.textContent = `${status} · ${percentage}%`;
  }

  showOcrResult(text: string): void {
    this.ocrButton.disabled = false;
    this.ocrProgress.textContent = 'OCR complete';
    this.ocrText.textContent = text || '(No text recognized)';
    this.ocrText.hidden = false;
  }

  showOcrError(message: string): void {
    this.ocrButton.disabled = false;
    this.ocrProgress.textContent = '';
    this.ocrError.textContent = message;
    this.ocrError.hidden = false;
  }

  readonly destroy = (): void => {
    this.closeButton.removeEventListener('click', this.destroy);
    if (this.ocrHandler !== null) {
      this.ocrButton.removeEventListener('click', this.ocrHandler);
    }
    this.host.remove();
  };
}
