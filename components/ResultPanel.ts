import {
  TARGET_LANGUAGES,
  isTargetLanguage,
  type TargetLanguage,
} from '@/types/translation';
import { appendStaticMarkup } from '@/components/staticMarkup';

export interface ResultPanelLayout {
  height: number;
  width: number;
  x: number;
  y: number;
}

type ResizeDirection = 'ne' | 'nw' | 'se' | 'sw';

type PanelInteraction =
  | {
      kind: 'drag';
      pointerId: number;
      pointerX: number;
      pointerY: number;
      startLayout: ResultPanelLayout;
    }
  | {
      direction: ResizeDirection;
      kind: 'resize';
      pointerId: number;
      pointerX: number;
      pointerY: number;
      startLayout: ResultPanelLayout;
    };

interface ResultPanelOptions {
  initialLayout?: ResultPanelLayout;
  initialTargetLanguage?: TargetLanguage;
  onLayoutChange: (layout: ResultPanelLayout) => void;
  onScanAgain: () => void;
  onTargetLanguageChange: (language: TargetLanguage) => void;
}

const VIEWPORT_MARGIN = 8;
const MIN_PANEL_WIDTH = 360;
const MIN_PANEL_HEIGHT = 240;
const DEFAULT_PANEL_WIDTH = 780;
const DEFAULT_PANEL_HEIGHT = 460;

export class ResultPanel {
  private readonly host = document.createElement('div');
  private readonly header: HTMLElement;
  private readonly resizeHandles: HTMLElement[];
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
  private currentLayout: ResultPanelLayout;
  private interaction: PanelInteraction | null = null;
  private layoutSaveTimer: number | null = null;
  private translationHandler:
    | ((text: string, language: TargetLanguage) => void)
    | null = null;

  constructor(private readonly options: ResultPanelOptions) {
    this.host.dataset.sniplingo = 'result-panel';
    const shadowRoot = this.host.attachShadow({
      mode: import.meta.env.MODE === 'e2e' ? 'open' : 'closed',
    });

    appendStaticMarkup(shadowRoot, `
      <style>
        :host {
          all: initial;
          box-sizing: border-box;
          position: fixed;
          z-index: 2147483647;
          display: block;
          min-width: min(360px, calc(100vw - 16px));
          min-height: min(240px, calc(100vh - 16px));
          max-width: calc(100vw - 16px);
          max-height: calc(100vh - 16px);
          color: #0f172a;
          font: 14px/1.4 system-ui, sans-serif;
        }

        #panel {
          position: relative;
          box-sizing: border-box;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          width: 100%;
          height: 100%;
          overflow: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 12px 36px rgb(15 23 42 / 28%);
          container-type: inline-size;
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
          padding: 10px 22px;
          border-bottom: 1px solid #e2e8f0;
          cursor: grab;
          font-weight: 650;
          touch-action: none;
          user-select: none;
        }

        header[data-dragging='true'] {
          cursor: grabbing;
        }

        #header-actions,
        .actions {
          gap: 8px;
        }

        #header-actions {
          cursor: default;
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
          min-height: 0;
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

        #privacy-disclosure {
          margin: -4px 0 12px;
          color: #475569;
          font-size: 11px;
          line-height: 1.45;
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

        .resize-handle {
          position: absolute;
          z-index: 3;
          box-sizing: border-box;
          width: 16px;
          height: 16px;
          color: #94a3b8;
          touch-action: none;
        }

        .resize-handle[data-direction='nw'] {
          top: 3px;
          left: 3px;
          border-top: 2px solid currentColor;
          border-left: 2px solid currentColor;
          cursor: nwse-resize;
        }

        .resize-handle[data-direction='ne'] {
          top: 3px;
          right: 3px;
          border-top: 2px solid currentColor;
          border-right: 2px solid currentColor;
          cursor: nesw-resize;
        }

        .resize-handle[data-direction='sw'] {
          bottom: 3px;
          left: 3px;
          border-bottom: 2px solid currentColor;
          border-left: 2px solid currentColor;
          cursor: nesw-resize;
        }

        .resize-handle[data-direction='se'] {
          right: 3px;
          bottom: 3px;
          border-right: 2px solid currentColor;
          border-bottom: 2px solid currentColor;
          cursor: nwse-resize;
        }

        @container (max-width: 620px) {
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
        <header id="panel-header">
          <span>SnipLingo</span>
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
              <p id="privacy-disclosure" hidden>Screenshots and OCR stay on this device. Clicking Translate sends only the text above to SnipLingo’s server and DeepL.</p>
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
        <span class="resize-handle" data-direction="nw" aria-hidden="true"></span>
        <span class="resize-handle" data-direction="ne" aria-hidden="true"></span>
        <span class="resize-handle" data-direction="sw" aria-hidden="true"></span>
        <span class="resize-handle" data-direction="se" aria-hidden="true"></span>
      </section>
    `);

    this.header = shadowRoot.querySelector<HTMLElement>('#panel-header')!;
    this.resizeHandles = Array.from(
      shadowRoot.querySelectorAll<HTMLElement>('.resize-handle'),
    );
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

    this.currentLayout = normalizePanelLayout(options.initialLayout);
    this.applyLayout(this.currentLayout);
  }

  mount(): void {
    this.header.addEventListener('pointerdown', this.handleDragStart);
    for (const handle of this.resizeHandles) {
      handle.addEventListener('pointerdown', this.handleResizeStart);
    }
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
    window.addEventListener('resize', this.handleWindowResize);
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
    this.ocrProgress.textContent =
      'Preparing local OCR… The first scan can take up to a minute while the OCR model starts.';
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

  private readonly handleDragStart = (event: PointerEvent): void => {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target instanceof Element && event.target.closest('button') !== null)
    ) {
      return;
    }

    event.preventDefault();
    this.header.setPointerCapture(event.pointerId);
    this.interaction = {
      kind: 'drag',
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startLayout: { ...this.currentLayout },
    };
    this.header.dataset.dragging = 'true';
    this.startPointerTracking();
  };

  private readonly handleResizeStart = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0) return;

    const direction = (event.currentTarget as HTMLElement).dataset.direction;
    if (!isResizeDirection(direction)) return;

    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.interaction = {
      direction,
      kind: 'resize',
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startLayout: { ...this.currentLayout },
    };
    this.startPointerTracking();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const interaction = this.interaction;
    if (interaction === null || event.pointerId !== interaction.pointerId) return;

    event.preventDefault();
    const deltaX = event.clientX - interaction.pointerX;
    const deltaY = event.clientY - interaction.pointerY;

    if (interaction.kind === 'drag') {
      this.applyLayout(
        normalizePanelLayout({
          ...interaction.startLayout,
          x: interaction.startLayout.x + deltaX,
          y: interaction.startLayout.y + deltaY,
        }),
      );
      return;
    }

    this.applyLayout(
      resizePanel(interaction.startLayout, interaction.direction, deltaX, deltaY),
    );
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (this.interaction === null || event.pointerId !== this.interaction.pointerId) {
      return;
    }

    this.stopPointerTracking();
    this.persistLayout();
  };

  private readonly handleWindowResize = (): void => {
    this.applyLayout(normalizePanelLayout(this.currentLayout));
    this.scheduleLayoutSave();
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
    const privacyDisclosure = this.translationControls.nextElementSibling;
    if (privacyDisclosure instanceof HTMLParagraphElement) {
      privacyDisclosure.hidden = !hasText;
    }
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

  private startPointerTracking(): void {
    window.addEventListener('pointermove', this.handlePointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', this.handlePointerEnd);
    window.addEventListener('pointercancel', this.handlePointerEnd);
  }

  private stopPointerTracking(): void {
    this.interaction = null;
    delete this.header.dataset.dragging;
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerEnd);
    window.removeEventListener('pointercancel', this.handlePointerEnd);
  }

  private applyLayout(layout: ResultPanelLayout): void {
    this.currentLayout = layout;
    this.host.style.left = `${layout.x}px`;
    this.host.style.top = `${layout.y}px`;
    this.host.style.width = `${layout.width}px`;
    this.host.style.height = `${layout.height}px`;
  }

  private scheduleLayoutSave(): void {
    if (this.layoutSaveTimer !== null) {
      window.clearTimeout(this.layoutSaveTimer);
    }

    this.layoutSaveTimer = window.setTimeout(() => {
      this.layoutSaveTimer = null;
      this.persistLayout();
    }, 150);
  }

  private persistLayout(): void {
    this.options.onLayoutChange({ ...this.currentLayout });
  }

  readonly destroy = (): void => {
    if (this.layoutSaveTimer !== null) {
      window.clearTimeout(this.layoutSaveTimer);
      this.layoutSaveTimer = null;
      this.persistLayout();
    }
    this.stopPointerTracking();
    this.header.removeEventListener('pointerdown', this.handleDragStart);
    for (const handle of this.resizeHandles) {
      handle.removeEventListener('pointerdown', this.handleResizeStart);
    }
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
    window.removeEventListener('resize', this.handleWindowResize);
    this.host.remove();
  };
}

function normalizePanelLayout(
  layout: ResultPanelLayout | undefined,
): ResultPanelLayout {
  const maxWidth = Math.max(1, window.innerWidth - VIEWPORT_MARGIN * 2);
  const maxHeight = Math.max(1, window.innerHeight - VIEWPORT_MARGIN * 2);
  const minWidth = Math.min(MIN_PANEL_WIDTH, maxWidth);
  const minHeight = Math.min(MIN_PANEL_HEIGHT, maxHeight);
  const width = clamp(
    layout?.width ?? DEFAULT_PANEL_WIDTH,
    minWidth,
    maxWidth,
  );
  const height = clamp(
    layout?.height ?? DEFAULT_PANEL_HEIGHT,
    minHeight,
    maxHeight,
  );
  const defaultX = window.innerWidth - VIEWPORT_MARGIN - width;
  const defaultY = window.innerHeight - VIEWPORT_MARGIN - height;

  return {
    width,
    height,
    x: clamp(
      layout?.x ?? defaultX,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width),
    ),
    y: clamp(
      layout?.y ?? defaultY,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - height),
    ),
  };
}

function resizePanel(
  layout: ResultPanelLayout,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
): ResultPanelLayout {
  const minWidth = Math.min(
    MIN_PANEL_WIDTH,
    window.innerWidth - VIEWPORT_MARGIN * 2,
  );
  const minHeight = Math.min(
    MIN_PANEL_HEIGHT,
    window.innerHeight - VIEWPORT_MARGIN * 2,
  );
  let left = layout.x;
  let right = layout.x + layout.width;
  let top = layout.y;
  let bottom = layout.y + layout.height;

  if (direction.includes('w')) {
    left = clamp(
      layout.x + deltaX,
      VIEWPORT_MARGIN,
      right - minWidth,
    );
  } else {
    right = clamp(
      right + deltaX,
      left + minWidth,
      window.innerWidth - VIEWPORT_MARGIN,
    );
  }

  if (direction.includes('n')) {
    top = clamp(
      layout.y + deltaY,
      VIEWPORT_MARGIN,
      bottom - minHeight,
    );
  } else {
    bottom = clamp(
      bottom + deltaY,
      top + minHeight,
      window.innerHeight - VIEWPORT_MARGIN,
    );
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function isResizeDirection(value: string | undefined): value is ResizeDirection {
  return value === 'ne' || value === 'nw' || value === 'se' || value === 'sw';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
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
