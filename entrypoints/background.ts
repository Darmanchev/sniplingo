import { cropImage } from '@/services/imageCrop';
import { OcrService } from '@/services/ocr';
import { captureVisibleTab } from '@/services/screenshot';
import { translateText } from '@/services/translator';
import {
  OCR_PROGRESS_MESSAGE,
  isRecognizeImageMessage,
  type OcrProgressMessage,
  type RecognizeImageMessage,
  type RecognizeImageResponse,
} from '@/types/ocr';
import {
  START_SELECTION_MESSAGE,
  isCaptureSelectionMessage,
  type CaptureSelectionMessage,
  type CaptureSelectionResponse,
  type StartSelectionMessage,
} from '@/types/selection';
import {
  isTranslateTextMessage,
  type TranslateTextMessage,
  type TranslateTextResponse,
} from '@/types/translation';

export default defineBackground(() => {
  const ocrService = new OcrService();
  const extensionAction = browser.action ?? browser.browserAction;

  extensionAction.onClicked.addListener(async (tab) => {
    if (tab.id === undefined || !isSupportedPage(tab.url)) return;

    const message: StartSelectionMessage = {
      type: START_SELECTION_MESSAGE,
    };

    try {
      await browser.tabs.sendMessage(tab.id, message);
      return;
    } catch {
      // The content script has not been injected into this page yet.
    }

    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/content.js'],
      });
    } catch (error) {
      console.error('SnipLingo could not start selection:', error);
    }
  });

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (isCaptureSelectionMessage(message)) {
      return captureAndCrop(message, sender.tab?.windowId);
    }

    if (isRecognizeImageMessage(message)) {
      return recognizeImage(message, sender.tab?.id, ocrService);
    }

    if (isTranslateTextMessage(message)) {
      return translateRecognizedText(message);
    }
  });
});

function isSupportedPage(url: string | undefined): boolean {
  if (url === undefined) return false;

  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

async function captureAndCrop(
  message: CaptureSelectionMessage,
  windowId: number | undefined,
): Promise<CaptureSelectionResponse> {
  if (windowId === undefined) {
    return { ok: false, error: 'The source browser window was not found.' };
  }

  try {
    const screenshot = await captureVisibleTab(windowId);
    const croppedImage = await cropImage(
      screenshot,
      message.rect,
      message.viewport,
    );

    return { ok: true, imageDataUrl: croppedImage };
  } catch (error) {
    console.error('SnipLingo screenshot failed:', error);
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

function getErrorMessage(error: unknown, fallback = 'The screenshot failed.'): string {
  return error instanceof Error ? error.message : fallback;
}

async function recognizeImage(
  message: RecognizeImageMessage,
  tabId: number | undefined,
  ocrService: OcrService,
): Promise<RecognizeImageResponse> {
  try {
    const text = await ocrService.recognize(
      message.imageDataUrl,
      ({ progress, status }) => {
        if (tabId === undefined) return;

        const progressMessage: OcrProgressMessage = {
          type: OCR_PROGRESS_MESSAGE,
          requestId: message.requestId,
          progress,
          status,
        };

        void browser.tabs.sendMessage(tabId, progressMessage).catch(() => {});
      },
    );

    return { ok: true, text };
  } catch (error) {
    console.error('SnipLingo OCR failed:', error);
    return { ok: false, error: getErrorMessage(error, 'OCR failed.') };
  }
}

async function translateRecognizedText(
  message: TranslateTextMessage,
): Promise<TranslateTextResponse> {
  try {
    const result = await translateText(
      message.text,
      message.targetLanguage,
    );
    return { ok: true, ...result };
  } catch (error) {
    console.error('SnipLingo translation failed:', error);
    return { ok: false, error: getErrorMessage(error, 'Translation failed.') };
  }
}
