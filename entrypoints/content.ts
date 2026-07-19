import { ResultPanel } from '@/components/ResultPanel';
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
  type TargetLanguage,
  type TranslateTextMessage,
  type TranslateTextResponse,
} from '@/types/translation';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let overlay: SelectionOverlay | null = null;
    let resultPanel: ResultPanel | null = null;
    let operationId = 0;
    let activeOcrRequestId: string | null = null;
    let activeTranslationRequestId: string | null = null;

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (isOcrProgressMessage(message)) {
        if (message.requestId === activeOcrRequestId) {
          resultPanel?.showOcrProgress(message.status, message.progress);
        }
        return;
      }

      if (!isStartSelectionMessage(message)) return;

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
    });

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
        resultPanel = new ResultPanel();
        resultPanel.mount();

        if (response.ok) {
          const panel = resultPanel;
          void runOcr(response.imageDataUrl, panel, completedOperationId);
        } else {
          resultPanel.showError(response.error);
        }
      } catch (error) {
        if (completedOperationId !== operationId) return;

        resultPanel?.destroy();
        resultPanel = new ResultPanel();
        resultPanel.mount();
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
          panel.enableTranslation((targetLanguage) => {
            void runTranslation(
              response.text,
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
          activeTranslationRequestId !== requestId
        ) {
          return;
        }

        if (response.ok) {
          panel.showTranslationResult(response.translatedText);
        } else {
          panel.showTranslationError(response.error);
        }
      } catch (error) {
        if (completedOperationId !== operationId || resultPanel !== panel) {
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

function waitForOverlayRemoval(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function getErrorMessage(error: unknown, fallback = 'The screenshot failed.'): string {
  return error instanceof Error ? error.message : fallback;
}
