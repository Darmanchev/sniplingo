import {
  ResultPanel,
  type ResultPanelLayout,
} from '@/components/ResultPanel';
import { SelectionOverlay } from '@/components/SelectionOverlay';
import {
  RECOGNIZE_IMAGE_MESSAGE,
  isOcrProgressMessage,
  type RecognizeImageMessage,
  type RecognizeImageResponse,
} from '@/types/ocr';
import {
  CAPTURE_SELECTION_MESSAGE,
  isStartSelectionMessage,
  type CaptureSelectionMessage,
  type CaptureSelectionResponse,
  type SelectionRect,
} from '@/types/selection';
import {
  TRANSLATE_TEXT_MESSAGE,
  isTargetLanguage,
  type TargetLanguage,
  type TranslateTextMessage,
  type TranslateTextResponse,
} from '@/types/translation';

export default defineContentScript({
  registration: 'runtime',
  matches: [],
  main() {
    let overlay: SelectionOverlay | null = null;
    let resultPanel: ResultPanel | null = null;
    let operationId = 0;
    let activeOcrRequestId: string | null = null;
    let activeTranslationRequestId: string | null = null;
    let preferredPanelLayout: ResultPanelLayout | undefined;
    let preferredTargetLanguage: TargetLanguage | undefined;

    void loadPreferredTargetLanguage().then((language) => {
      preferredTargetLanguage = language;
    });
    void loadPreferredPanelLayout().then((layout) => {
      if (preferredPanelLayout === undefined) {
        preferredPanelLayout = layout;
      }
    });

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (isOcrProgressMessage(message)) {
        if (message.requestId === activeOcrRequestId) {
          resultPanel?.showOcrProgress(message.status, message.progress);
        }
        return;
      }

      if (!isStartSelectionMessage(message)) return;
      startSelection();
    });

    startSelection();

    function startSelection(): void {
      operationId += 1;
      activeOcrRequestId = null;
      activeTranslationRequestId = null;
      overlay?.destroy();
      resultPanel?.destroy();
      resultPanel = null;

      overlay = new SelectionOverlay({
        onCancel: () => {
          overlay = null;
        },
        onComplete: (rect) => {
          const completedOperationId = operationId;
          overlay?.destroy();
          overlay = null;
          void captureAndShow(rect, completedOperationId);
        },
      });
      overlay.mount();
    }

    function createResultPanel(): ResultPanel {
      const panel = new ResultPanel({
        initialLayout: preferredPanelLayout,
        initialTargetLanguage: preferredTargetLanguage,
        onLayoutChange: (layout) => {
          preferredPanelLayout = layout;
          void browser.storage.local
            .set({ [PANEL_LAYOUT_STORAGE_KEY]: layout })
            .catch((error) => {
              console.error('SnipLingo could not save panel layout:', error);
            });
        },
        onScanAgain: startSelection,
        onTargetLanguageChange: (language) => {
          preferredTargetLanguage = language;
          void browser.storage.local
            .set({ [TARGET_LANGUAGE_STORAGE_KEY]: language })
            .catch((error) => {
              console.error('SnipLingo could not save target language:', error);
            });
        },
      });
      panel.mount();
      return panel;
    }

    async function captureAndShow(
      rect: SelectionRect,
      completedOperationId: number,
    ): Promise<void> {
      await waitForOverlayRemoval();

      const request: CaptureSelectionMessage = {
        type: CAPTURE_SELECTION_MESSAGE,
        rect,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };

      try {
        const response = (await browser.runtime.sendMessage(
          request,
        )) as CaptureSelectionResponse;

        if (completedOperationId !== operationId) return;

        resultPanel?.destroy();
        resultPanel = createResultPanel();

        if (response.ok) {
          const panel = resultPanel;
          void runOcr(response.imageDataUrl, panel, completedOperationId);
        } else {
          resultPanel.showError(response.error);
        }
      } catch (error) {
        if (completedOperationId !== operationId) return;

        resultPanel?.destroy();
        resultPanel = createResultPanel();
        resultPanel.showError(getErrorMessage(error));
      }
    }

    async function runOcr(
      imageDataUrl: string,
      panel: ResultPanel,
      completedOperationId: number,
    ): Promise<void> {
      const requestId = crypto.randomUUID();
      activeOcrRequestId = requestId;
      panel.showOcrLoading();

      try {
        const request: RecognizeImageMessage = {
          type: RECOGNIZE_IMAGE_MESSAGE,
          requestId,
          imageDataUrl,
        };
        const response = (await browser.runtime.sendMessage(
          request,
        )) as RecognizeImageResponse;

        if (
          completedOperationId !== operationId ||
          resultPanel !== panel ||
          activeOcrRequestId !== requestId
        ) {
          return;
        }

        if (response.ok) {
          panel.showOcrResult(response.text);
          panel.enableTranslation((text, targetLanguage) => {
            void runTranslation(
              text,
              targetLanguage,
              panel,
              completedOperationId,
            );
          });
        } else {
          panel.showOcrError(response.error);
        }
      } catch (error) {
        if (completedOperationId !== operationId || resultPanel !== panel) {
          return;
        }

        panel.showOcrError(getErrorMessage(error, 'OCR failed.'));
      } finally {
        if (activeOcrRequestId === requestId) {
          activeOcrRequestId = null;
        }
      }
    }

    async function runTranslation(
      text: string,
      targetLanguage: TargetLanguage,
      panel: ResultPanel,
      completedOperationId: number,
    ): Promise<void> {
      const requestId = crypto.randomUUID();
      activeTranslationRequestId = requestId;
      panel.showTranslationLoading();

      try {
        const request: TranslateTextMessage = {
          type: TRANSLATE_TEXT_MESSAGE,
          requestId,
          targetLanguage,
          text,
        };
        const response = (await browser.runtime.sendMessage(
          request,
        )) as TranslateTextResponse;

        if (
          completedOperationId !== operationId ||
          resultPanel !== panel ||
          activeTranslationRequestId !== requestId ||
          panel.getOriginalText() !== text.trim()
        ) {
          return;
        }

        if (response.ok) {
          panel.showTranslationResult(
            response.translatedText,
            response.detectedSourceLanguage,
          );
        } else {
          panel.showTranslationError(response.error);
        }
      } catch (error) {
        if (
          completedOperationId !== operationId ||
          resultPanel !== panel ||
          panel.getOriginalText() !== text.trim()
        ) {
          return;
        }

        panel.showTranslationError(
          getErrorMessage(error, 'Translation failed.'),
        );
      } finally {
        if (activeTranslationRequestId === requestId) {
          activeTranslationRequestId = null;
        }
      }
    }
  },
});

const TARGET_LANGUAGE_STORAGE_KEY = 'targetLanguage';
const PANEL_LAYOUT_STORAGE_KEY = 'resultPanelLayout';

async function loadPreferredTargetLanguage(): Promise<
  TargetLanguage | undefined
> {
  try {
    const stored = await browser.storage.local.get(TARGET_LANGUAGE_STORAGE_KEY);
    const language = stored[TARGET_LANGUAGE_STORAGE_KEY];
    return isTargetLanguage(language) ? language : undefined;
  } catch (error) {
    console.error('SnipLingo could not load target language:', error);
    return undefined;
  }
}

async function loadPreferredPanelLayout(): Promise<
  ResultPanelLayout | undefined
> {
  try {
    const stored = await browser.storage.local.get(PANEL_LAYOUT_STORAGE_KEY);
    const layout = stored[PANEL_LAYOUT_STORAGE_KEY];
    return isResultPanelLayout(layout) ? layout : undefined;
  } catch (error) {
    console.error('SnipLingo could not load panel layout:', error);
    return undefined;
  }
}

function isResultPanelLayout(value: unknown): value is ResultPanelLayout {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'x' in value &&
    isFiniteNumber(value.x) &&
    'y' in value &&
    isFiniteNumber(value.y) &&
    'width' in value &&
    isFiniteNumber(value.width) &&
    value.width > 0 &&
    'height' in value &&
    isFiniteNumber(value.height) &&
    value.height > 0
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function waitForOverlayRemoval(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function getErrorMessage(error: unknown, fallback = 'The screenshot failed.'): string {
  return error instanceof Error ? error.message : fallback;
}
