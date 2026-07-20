import {
  TARGET_LANGUAGES,
  isTargetLanguage,
  type TargetLanguage,
} from '@/types/translation';

interface ResultPanelOptions {
  initialTargetLanguage?: TargetLanguage;
  onScanAgain: () => void;
  onTargetLanguageChange: (language: TargetLanguage) => void;
}

export class ResultPanel {
  private readonly host = document.createElement('div');
  private readonly error: HTMLParagraphElement;
  private readonly scanAgainButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly ocrProgress: HTMLParagraphElement;
  private readonly ocrError: HTMLParagraphElement;
  private readonly columns: HTMLDivElement;
  private readonly sourceLanguage: HTMLSpanElement;
  private readonly ocrText: HTMLTextAreaElement;
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
  private readonly translationActions: HTMLDivElement;
  private readonly copyTranslationButton: HTMLButtonElement;
  private readonly copyTranslationStatus: HTMLSpanElement;
  private recognizedText = '';
  private translatedValue = '';
  private translationHandler:
    | ((text: string, language: TargetLanguage) => void)
    | null = null;

  constructor(private readonly options: ResultPanelOptions) {
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
          width: min(780px, calc(100vw - 32px));
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

        header,
        #header-actions,
        .title-row,
        .actions {
          display: flex;
          align-items: center;
        }

        header {
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 650;
        }

        #header-actions,
        .actions {
          gap: 8px;
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

        #scan-again {
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          color: #334155;
          background: #ffffff;
          cursor: pointer;
          font: 600 12px/1.4 system-ui, sans-serif;
        }

        #close:hover,
        #scan-again:hover {
          color: #0f172a;
          background: #f1f5f9;
        }

        button:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: 3px solid rgb(56 189 248 / 45%);
          outline-offset: 1px;
        }

        #content {
          max-height: min(580px, calc(100vh - 80px));
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

        .title-row {
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }

        h2 {
          margin: 0;
          font-size: 13px;
          line-height: 1.3;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        #source-language {
          color: #64748b;
          font-size: 11px;
        }

        #ocr-text,
        #translated-text {
          box-sizing: border-box;
          width: 100%;
          min-height: 150px;
          max-height: 250px;
          overflow: auto;
          margin: 0;
          padding: 10px;
          border: 1px solid transparent;
          border-radius: 6px;
          font: 13px/1.5 ui-monospace, SFMono-Regular, monospace;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        #ocr-text {
          resize: vertical;
          color: #0f172a;
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        #translated-text {
          color: #3b0764;
          background: #faf5ff;
        }

        .actions {
          margin-top: 10px;
        }

        #copy,
        #copy-translation,
        #translate {
          padding: 8px 14px;
          border: 0;
          border-radius: 7px;
          color: #ffffff;
          cursor: pointer;
          font: 600 13px/1.4 system-ui, sans-serif;
        }

        #copy,
        #copy-translation {
          background: #0284c7;
        }

        #copy:hover,
        #copy-translation:hover {
          background: #0369a1;
        }

        #translate {
          background: #7c3aed;
        }

        #translate:hover {
          background: #6d28d9;
        }

        button:disabled,
        select:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        #copy-status,
        #copy-translation-status,
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

        #translation-status[data-tone='warning'] {
          color: #b45309;
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
          <div id="header-actions">
            <button id="scan-again" type="button">Scan again</button>
            <button id="close" type="button" aria-label="Close">×</button>
          </div>
        </header>
        <div id="content">
          <p id="error" role="alert" hidden></p>
          <p id="ocr-progress" role="status" aria-live="polite"></p>
          <p id="ocr-error" role="alert" hidden></p>
          <div id="columns" hidden>
            <section class="column" aria-labelledby="original-title">
              <div class="title-row">
                <h2 id="original-title">Original</h2>
                <span id="source-language" hidden></span>
              </div>
              <textarea id="ocr-text" aria-label="Recognized text" spellcheck="true"></textarea>
              <div id="actions" class="actions" hidden>
                <button id="copy" type="button">Copy</button>
                <span id="copy-status" role="status" aria-live="polite"></span>
              </div>
            </section>
            <section id="translation-column" class="column" aria-labelledby="translation-title">
              <div class="title-row">
                <h2 id="translation-title">Translation</h2>
              </div>
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
                <div id="translation-actions" class="actions" hidden>
                  <button id="copy-translation" type="button">Copy translation</button>
                  <span id="copy-translation-status" role="status" aria-live="polite"></span>
                </div>
              </section>
            </section>
          </div>
        </div>
      </section>
    `;

    this.error = shadowRoot.querySelector<HTMLParagraphElement>('#error')!;
    this.scanAgainButton =
      shadowRoot.querySelector<HTMLButtonElement>('#scan-again')!;
    this.closeButton = shadowRoot.querySelector<HTMLButtonElement>('#close')!;
    this.ocrProgress =
      shadowRoot.querySelector<HTMLParagraphElement>('#ocr-progress')!;
    this.ocrError =
      shadowRoot.querySelector<HTMLParagraphElement>('#ocr-error')!;
    this.columns = shadowRoot.querySelector<HTMLDivElement>('#columns')!;
    this.sourceLanguage =
      shadowRoot.querySelector<HTMLSpanElement>('#source-language')!;
    this.ocrText = shadowRoot.querySelector<HTMLTextAreaElement>('#ocr-text')!;
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
    this.translationActions =
      shadowRoot.querySelector<HTMLDivElement>('#translation-actions')!;
    this.copyTranslationButton =
      shadowRoot.querySelector<HTMLButtonElement>('#copy-translation')!;
    this.copyTranslationStatus =
      shadowRoot.querySelector<HTMLSpanElement>('#copy-translation-status')!;

    const preferredLanguage =
      options.initialTargetLanguage ?? navigator.language.slice(0, 2);
    if (isTargetLanguage(preferredLanguage)) {
      this.targetLanguage.value = preferredLanguage;
    }
  }

  mount(): void {
    this.scanAgainButton.addEventListener('click', this.handleScanAgain);
    this.closeButton.addEventListener('click', this.destroy);
    this.ocrText.addEventListener('input', this.handleOriginalInput);
    this.copyButton.addEventListener('click', this.handleCopyOriginal);
    this.targetLanguage.addEventListener('change', this.handleLanguageChange);
    this.translateButton.addEventListener('click', this.handleTranslate);
    this.copyTranslationButton.addEventListener(
      'click',
      this.handleCopyTranslation,
    );
    document.documentElement.append(this.host);
  }

  getOriginalText(): string {
    return this.ocrText.value.trim();
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
    this.ocrText.value = this.recognizedText;
    this.ocrText.placeholder = 'No text recognized';
    this.columns.hidden = false;
    this.copyStatus.textContent = '';
    this.updateTextDependentControls();
    this.resetTranslation();
  }

  showOcrError(message: string): void {
    this.recognizedText = '';
    this.ocrProgress.hidden = true;
    this.columns.hidden = true;
    this.ocrError.textContent = message;
    this.ocrError.hidden = false;
  }

  enableTranslation(
    handler: (text: string, language: TargetLanguage) => void,
  ): void {
    this.translationHandler = handler;
  }

  showTranslationLoading(): void {
    this.setTranslationControlsDisabled(true);
    this.translationPlaceholder.hidden = true;
    this.translationResult.hidden = false;
    this.translationStatus.dataset.tone = 'default';
    this.translationStatus.textContent = 'Translating…';
    this.translationError.hidden = true;
    this.translatedText.hidden = true;
    this.translationActions.hidden = true;
  }

  showTranslationResult(text: string, detectedSourceLanguage: string): void {
    this.translatedValue = text.trim();
    this.setTranslationControlsDisabled(false);
    this.translationError.hidden = true;
    this.translatedText.textContent = this.translatedValue;
    this.translatedText.hidden = false;
    this.translationActions.hidden = this.translatedValue.length === 0;
    this.copyTranslationStatus.textContent = '';

    const detectedLanguage = formatLanguage(detectedSourceLanguage);
    this.sourceLanguage.textContent = `Detected: ${detectedLanguage}`;
    this.sourceLanguage.hidden = false;

    const isSameLanguage =
      getBaseLanguage(detectedSourceLanguage) === this.targetLanguage.value;
    this.translationStatus.dataset.tone = isSameLanguage ? 'warning' : 'default';
    this.translationStatus.textContent = isSameLanguage
      ? 'Source and target languages are the same'
      : `Translated from ${detectedLanguage}`;
  }

  showTranslationError(message: string): void {
    this.translatedValue = '';
    this.setTranslationControlsDisabled(false);
    this.translationStatus.textContent = '';
    this.translationError.textContent = message;
    this.translationError.hidden = false;
    this.translatedText.hidden = true;
    this.translationActions.hidden = true;
  }

  private readonly handleScanAgain = (): void => {
    this.options.onScanAgain();
  };

  private readonly handleOriginalInput = (): void => {
    this.recognizedText = this.getOriginalText();
    this.sourceLanguage.hidden = true;
    this.copyStatus.textContent = '';
    this.updateTextDependentControls();
    this.resetTranslation();
  };

  private readonly handleCopyOriginal = async (): Promise<void> => {
    await this.copyText(
      this.getOriginalText(),
      this.copyButton,
      this.copyStatus,
    );
  };

  private readonly handleCopyTranslation = async (): Promise<void> => {
    await this.copyText(
      this.translatedValue,
      this.copyTranslationButton,
      this.copyTranslationStatus,
    );
  };

  private readonly handleLanguageChange = (): void => {
    if (!isTargetLanguage(this.targetLanguage.value)) return;

    this.options.onTargetLanguageChange(this.targetLanguage.value);
    this.resetTranslation();
  };

  private readonly handleTranslate = (): void => {
    if (
      this.translationHandler === null ||
      this.recognizedText.length === 0 ||
      !isTargetLanguage(this.targetLanguage.value)
    ) {
      return;
    }

    this.translationHandler(this.recognizedText, this.targetLanguage.value);
  };

  private async copyText(
    text: string,
    button: HTMLButtonElement,
    status: HTMLElement,
  ): Promise<void> {
    if (text.length === 0) return;

    button.disabled = true;
    status.textContent = 'Copying…';

    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied';
    } catch (error) {
      console.error('SnipLingo could not copy text:', error);
      status.textContent = 'Copy failed';
    } finally {
      button.disabled = false;
    }
  }

  private updateTextDependentControls(): void {
    const hasText = this.recognizedText.length > 0;
    this.setActionsHidden(!hasText);
    this.translationControls.hidden = !hasText;
    this.translationPlaceholder.hidden = !hasText;
  }

  private resetTranslation(): void {
    this.translatedValue = '';
    this.setTranslationControlsDisabled(false);
    this.translationResult.hidden = true;
    this.translationPlaceholder.hidden = this.recognizedText.length === 0;
    this.copyTranslationStatus.textContent = '';
  }

  private setActionsHidden(hidden: boolean): void {
    const actions = this.copyButton.parentElement;
    if (actions !== null) actions.hidden = hidden;
  }

  private setTranslationControlsDisabled(disabled: boolean): void {
    this.targetLanguage.disabled = disabled;
    this.translateButton.disabled = disabled;
  }

  readonly destroy = (): void => {
    this.scanAgainButton.removeEventListener('click', this.handleScanAgain);
    this.closeButton.removeEventListener('click', this.destroy);
    this.ocrText.removeEventListener('input', this.handleOriginalInput);
    this.copyButton.removeEventListener('click', this.handleCopyOriginal);
    this.targetLanguage.removeEventListener('change', this.handleLanguageChange);
    this.translateButton.removeEventListener('click', this.handleTranslate);
    this.copyTranslationButton.removeEventListener(
      'click',
      this.handleCopyTranslation,
    );
    this.host.remove();
  };
}

function getBaseLanguage(language: string): string {
  return language.toLowerCase().split('-')[0];
}

function formatLanguage(language: string): string {
  const baseLanguage = getBaseLanguage(language);
  return (
    TARGET_LANGUAGES.find(({ code }) => code === baseLanguage)?.label ??
    language.toUpperCase()
  );
}
