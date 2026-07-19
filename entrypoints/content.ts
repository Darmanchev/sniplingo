import { ResultPanel } from '@/components/ResultPanel';
import { SelectionOverlay } from '@/components/SelectionOverlay';
import { createOcrTestImage } from '@/services/ocrTestImage';
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

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let overlay: SelectionOverlay | null = null;
    let resultPanel: ResultPanel | null = null;
    let operationId = 0;
    let activeOcrRequestId: string | null = null;

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
          resultPanel.showImage(response.imageDataUrl);
          const panel = resultPanel;
          panel.enableOcrTest(() => {
            void runOcrTest(panel, completedOperationId);
          });
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

    async function runOcrTest(
      panel: ResultPanel,
      completedOperationId: number,
    ): Promise<void> {
      const testImage = createOcrTestImage();
      const requestId = crypto.randomUUID();
      activeOcrRequestId = requestId;
      panel.showOcrLoading(testImage);

      try {
        const request: RecognizeImageMessage = {
          type: RECOGNIZE_IMAGE_MESSAGE,
          requestId,
          imageDataUrl: testImage,
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
