import {
  TARGET_LANGUAGES,
  isTargetLanguage,
  type TargetLanguage,
} from '@/types/translation';

export class ResultPanel {
  private readonly host = document.createElement('div');
  private readonly error: HTMLParagraphElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly ocrProgress: HTMLParagraphElement;
  private readonly ocrError: HTMLParagraphElement;
  private readonly columns: HTMLDivElement;
  private readonly ocrText: HTMLPreElement;
  private readonly copyButton: HTMLButtonElement;
  private readonly copyStatus: HTMLSpanElement;
  private readonly translationControls: HTMLDivElement;
  private readonly targetLanguage: HTMLSelectElement;
  private readonly translateButton: HTMLButtonElement;
  private readonly translationPlaceholder: HTMLParagraphElement;
  private readonly translationResult: HTMLElement;
  private readonly translationStatus: HTMLParagraphElement;
  private readonly translationError: HTMLParagraphElement;
  private readonly translatedText: HTMLPreElement;
  private recognizedText = '';
  private translationHandler: ((language: TargetLanguage) => void) | null = null;

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
          width: min(760px, calc(100vw - 32px));
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
          padding: 10px 14px;
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
        #copy:focus-visible,
        #target-language:focus-visible,
        #translate:focus-visible {
          outline: 3px solid rgb(56 189 248 / 45%);
          outline-offset: 1px;
        }

        #content {
          max-height: min(560px, calc(100vh - 80px));
          overflow: auto;
          padding: 14px;
        }

        #error,
        #ocr-error,
        #translation-error {
          margin: 0;
          color: #b91c1c;
        }

        #ocr-progress {
          margin: 0;
          color: #475569;
          font-size: 12px;
        }

        #columns {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
        }

        .column {
          min-width: 0;
        }

        #translation-column {
          padding-left: 16px;
          border-left: 1px solid #cbd5e1;
        }

        h2 {
          margin: 0 0 10px;
          font-size: 13px;
          line-height: 1.3;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        pre {
          max-height: 230px;
          overflow: auto;
          margin: 0;
          padding: 10px;
          border-radius: 6px;
          font: 13px/1.5 ui-monospace, SFMono-Regular, monospace;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        #ocr-text {
          color: #0f172a;
          background: #f1f5f9;
        }

        #actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
        }

        #copy,
        #translate {
          padding: 8px 14px;
          border: 0;
          border-radius: 7px;
          color: #ffffff;
          cursor: pointer;
          font: 600 13px/1.4 system-ui, sans-serif;
        }

        #copy {
          background: #0284c7;
        }

        #copy:hover {
          background: #0369a1;
        }

        #translate {
          background: #7c3aed;
        }

        #translate:hover {
          background: #6d28d9;
        }

        #copy:disabled,
        #translate:disabled,
        #target-language:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        #copy-status,
        #translation-placeholder {
          color: #64748b;
          font-size: 12px;
        }

        #translation-controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          margin-bottom: 12px;
        }

        #translation-controls label {
          grid-column: 1 / -1;
          color: #475569;
          font-size: 12px;
        }

        #target-language {
          min-width: 0;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          color: #0f172a;
          background: #ffffff;
          font: 13px/1.4 system-ui, sans-serif;
        }

        #translation-placeholder {
          margin: 0;
        }

        #translation-status {
          margin: 0 0 8px;
          color: #7c3aed;
          font-size: 12px;
          font-weight: 600;
        }

        #translated-text {
          color: #3b0764;
          background: #faf5ff;
        }

        @media (max-width: 620px) {
          #columns {
            grid-template-columns: 1fr;
          }

          #translation-column {
            padding-top: 16px;
            padding-left: 0;
            border-top: 1px solid #cbd5e1;
            border-left: 0;
          }
        }
      </style>
      <section id="panel" aria-label="SnipLingo result">
        <header>
          <span>SnipLingo — OCR &amp; Translate</span>
          <button id="close" type="button" aria-label="Close">×</button>
        </header>
        <div id="content">
          <p id="error" role="alert" hidden></p>
          <p id="ocr-progress" role="status" aria-live="polite"></p>
          <p id="ocr-error" role="alert" hidden></p>
          <div id="columns" hidden>
            <section class="column" aria-labelledby="original-title">
              <h2 id="original-title">Original</h2>
              <pre id="ocr-text"></pre>
              <div id="actions" hidden>
                <button id="copy" type="button">Copy</button>
                <span id="copy-status" role="status" aria-live="polite"></span>
              </div>
            </section>
            <section id="translation-column" class="column" aria-labelledby="translation-title">
              <h2 id="translation-title">Translation</h2>
              <div id="translation-controls" hidden>
                <label for="target-language">Translate to</label>
                <select id="target-language">
                  ${TARGET_LANGUAGES.map(
                    ({ code, label }) => `<option value="${code}">${label}</option>`,
                  ).join('')}
                </select>
                <button id="translate" type="button">Translate</button>
              </div>
              <p id="translation-placeholder" hidden>Select a language and click Translate.</p>
              <section id="translation-result" hidden>
                <p id="translation-status" role="status" aria-live="polite"></p>
                <p id="translation-error" role="alert" hidden></p>
                <pre id="translated-text" hidden></pre>
              </section>
            </section>
          </div>
        </div>
      </section>
    `;

    this.error = shadowRoot.querySelector<HTMLParagraphElement>('#error')!;
    this.closeButton = shadowRoot.querySelector<HTMLButtonElement>('#close')!;
    this.ocrProgress =
      shadowRoot.querySelector<HTMLParagraphElement>('#ocr-progress')!;
    this.ocrError =
      shadowRoot.querySelector<HTMLParagraphElement>('#ocr-error')!;
    this.columns = shadowRoot.querySelector<HTMLDivElement>('#columns')!;
    this.ocrText = shadowRoot.querySelector<HTMLPreElement>('#ocr-text')!;
    this.copyButton = shadowRoot.querySelector<HTMLButtonElement>('#copy')!;
    this.copyStatus =
      shadowRoot.querySelector<HTMLSpanElement>('#copy-status')!;
    this.translationControls =
      shadowRoot.querySelector<HTMLDivElement>('#translation-controls')!;
    this.targetLanguage =
      shadowRoot.querySelector<HTMLSelectElement>('#target-language')!;
    this.translateButton =
      shadowRoot.querySelector<HTMLButtonElement>('#translate')!;
    this.translationPlaceholder =
      shadowRoot.querySelector<HTMLParagraphElement>('#translation-placeholder')!;
    this.translationResult =
      shadowRoot.querySelector<HTMLElement>('#translation-result')!;
    this.translationStatus =
      shadowRoot.querySelector<HTMLParagraphElement>('#translation-status')!;
    this.translationError =
      shadowRoot.querySelector<HTMLParagraphElement>('#translation-error')!;
    this.translatedText =
      shadowRoot.querySelector<HTMLPreElement>('#translated-text')!;

    const browserLanguage = navigator.language.slice(0, 2);
    if (isTargetLanguage(browserLanguage)) {
      this.targetLanguage.value = browserLanguage;
    }
  }

  mount(): void {
    this.closeButton.addEventListener('click', this.destroy);
    this.copyButton.addEventListener('click', this.handleCopy);
    this.translateButton.addEventListener('click', this.handleTranslate);
    document.documentElement.append(this.host);
  }

  showError(message: string): void {
    this.ocrProgress.hidden = true;
    this.columns.hidden = true;
    this.error.textContent = message;
    this.error.hidden = false;
  }

  showOcrLoading(): void {
    this.error.hidden = true;
    this.columns.hidden = true;
    this.ocrProgress.hidden = false;
    this.ocrProgress.textContent = 'Preparing OCR…';
    this.ocrError.hidden = true;
  }

  showOcrProgress(status: string, progress: number): void {
    const percentage = Math.round(progress * 100);
    this.ocrProgress.textContent = `${status} · ${percentage}%`;
  }

  showOcrResult(text: string): void {
    this.recognizedText = text.trim();
    this.ocrProgress.hidden = true;
    this.ocrError.hidden = true;
    this.ocrText.textContent = this.recognizedText || '(No text recognized)';
    this.columns.hidden = false;
    this.copyStatus.textContent = '';

    const hasText = this.recognizedText.length > 0;
    this.setActionsHidden(!hasText);
    this.setTranslationControlsHidden(!hasText);
    this.translationPlaceholder.hidden = !hasText;
    this.translationResult.hidden = true;
  }

  showOcrError(message: string): void {
    this.recognizedText = '';
    this.ocrProgress.hidden = true;
    this.columns.hidden = true;
    this.ocrError.textContent = message;
    this.ocrError.hidden = false;
  }

  enableTranslation(handler: (language: TargetLanguage) => void): void {
    this.translationHandler = handler;
  }

  showTranslationLoading(): void {
    this.setTranslationControlsDisabled(true);
    this.translationPlaceholder.hidden = true;
    this.translationResult.hidden = false;
    this.translationStatus.textContent = 'Translating…';
    this.translationError.hidden = true;
    this.translatedText.hidden = true;
  }

  showTranslationResult(text: string): void {
    this.setTranslationControlsDisabled(false);
    this.translationStatus.textContent = 'Mock translation';
    this.translationError.hidden = true;
    this.translatedText.textContent = text;
    this.translatedText.hidden = false;
  }

  showTranslationError(message: string): void {
    this.setTranslationControlsDisabled(false);
    this.translationStatus.textContent = '';
    this.translationError.textContent = message;
    this.translationError.hidden = false;
    this.translatedText.hidden = true;
  }

  private readonly handleCopy = async (): Promise<void> => {
    if (this.recognizedText.length === 0) return;

    this.copyButton.disabled = true;
    this.copyStatus.textContent = 'Copying…';

    try {
      await navigator.clipboard.writeText(this.recognizedText);
      this.copyStatus.textContent = 'Copied';
    } catch (error) {
      console.error('SnipLingo could not copy text:', error);
      this.copyStatus.textContent = 'Copy failed';
    } finally {
      this.copyButton.disabled = false;
    }
  };

  private readonly handleTranslate = (): void => {
    if (
      this.translationHandler === null ||
      !isTargetLanguage(this.targetLanguage.value)
    ) {
      return;
    }

    this.translationHandler(this.targetLanguage.value);
  };

  private setActionsHidden(hidden: boolean): void {
    const actions = this.copyButton.parentElement;
    if (actions !== null) actions.hidden = hidden;
  }

  private setTranslationControlsHidden(hidden: boolean): void {
    this.translationControls.hidden = hidden;
  }

  private setTranslationControlsDisabled(disabled: boolean): void {
    this.targetLanguage.disabled = disabled;
    this.translateButton.disabled = disabled;
  }

  readonly destroy = (): void => {
    this.closeButton.removeEventListener('click', this.destroy);
    this.copyButton.removeEventListener('click', this.handleCopy);
    this.translateButton.removeEventListener('click', this.handleTranslate);
    this.host.remove();
  };
}
