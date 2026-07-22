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
    if (tab.id === undefined) return;

    if (!isSupportedPage(tab.url)) {
      await showUnsupportedPageError(tab.id, tab.url, extensionAction);
      return;
    }

    await clearActionError(tab.id, extensionAction);

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
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    return parsedUrl.hostname !== 'addons.mozilla.org';
  } catch {
    return false;
  }
}

async function showUnsupportedPageError(
  tabId: number,
  url: string | undefined,
  extensionAction: typeof browser.action,
): Promise<void> {
  const message = getUnsupportedPageMessage(url);

  await Promise.allSettled([
    extensionAction.setBadgeBackgroundColor({ color: '#b91c1c', tabId }),
    extensionAction.setBadgeText({ text: '!', tabId }),
    extensionAction.setTitle({ title: `SnipLingo: ${message}`, tabId }),
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/96.png'),
      title: 'SnipLingo cannot run here',
      message,
    }),
  ]);
}

async function clearActionError(
  tabId: number,
  extensionAction: typeof browser.action,
): Promise<void> {
  await Promise.allSettled([
    extensionAction.setBadgeText({ text: '', tabId }),
    extensionAction.setTitle({
      title: 'SnipLingo — select an area to translate',
      tabId,
    }),
  ]);
}

function getUnsupportedPageMessage(url: string | undefined): string {
  try {
    const parsedUrl = new URL(url ?? '');
    if (parsedUrl.hostname === 'addons.mozilla.org') {
      return 'Firefox blocks extensions on addons.mozilla.org. Open a regular website and try again.';
    }
  } catch {
    // Fall through to the generic browser-page explanation.
  }

  return 'Firefox does not allow extensions to capture internal pages such as about: and the Add-ons Manager.';
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

    if (import.meta.env.MODE === 'e2e') {
      await browser.storage.local.set({ e2eCroppedImage: croppedImage });
    }

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
