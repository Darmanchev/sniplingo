import { OcrService } from '@/services/ocr';
import {
  OCR_PROGRESS_MESSAGE,
  isOffscreenOcrMessage,
  type OcrProgressMessage,
  type RecognizeImageResponse,
} from '@/types/ocr';

const ocrService = new OcrService();

browser.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'OFFSCREEN_PING' &&
    'target' in message &&
    message.target === 'offscreen'
  ) {
    return Promise.resolve({ ready: true });
  }
  if (!isOffscreenOcrMessage(message)) return;
  return recognizeImage(message.imageDataUrl, message.requestId);
});

async function recognizeImage(
  imageDataUrl: string,
  requestId: string,
): Promise<RecognizeImageResponse> {
  try {
    const text = await ocrService.recognize(
      imageDataUrl,
      ({ progress, status }) => {
        const progressMessage: OcrProgressMessage = {
          type: OCR_PROGRESS_MESSAGE,
          requestId,
          progress,
          status,
        };
        void browser.runtime.sendMessage(progressMessage).catch(() => {});
      },
    );
    return { ok: true, text };
  } catch (error) {
    console.error('SnipLingo offscreen OCR failed:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'OCR failed.',
    };
  }
}
