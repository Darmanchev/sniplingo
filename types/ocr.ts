export const RECOGNIZE_IMAGE_MESSAGE = 'RECOGNIZE_IMAGE' as const;
export const OFFSCREEN_OCR_MESSAGE = 'OFFSCREEN_OCR' as const;
export const OCR_PROGRESS_MESSAGE = 'OCR_PROGRESS' as const;

export interface RecognizeImageMessage {
  type: typeof RECOGNIZE_IMAGE_MESSAGE;
  requestId: string;
  imageDataUrl: string;
}

export interface OcrProgressMessage {
  type: typeof OCR_PROGRESS_MESSAGE;
  requestId: string;
  progress: number;
  status: string;
}

export interface OffscreenOcrMessage
  extends Omit<RecognizeImageMessage, 'type'> {
  type: typeof OFFSCREEN_OCR_MESSAGE;
  target: 'offscreen';
}

export type RecognizeImageResponse =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function isRecognizeImageMessage(
  message: unknown,
): message is RecognizeImageMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === RECOGNIZE_IMAGE_MESSAGE &&
    'requestId' in message &&
    typeof message.requestId === 'string' &&
    message.requestId.trim().length > 0 &&
    'imageDataUrl' in message &&
    typeof message.imageDataUrl === 'string' &&
    isSupportedImageDataUrl(message.imageDataUrl)
  );
}

export function isOffscreenOcrMessage(
  message: unknown,
): message is OffscreenOcrMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === OFFSCREEN_OCR_MESSAGE &&
    'target' in message &&
    message.target === 'offscreen' &&
    'requestId' in message &&
    typeof message.requestId === 'string' &&
    message.requestId.trim().length > 0 &&
    'imageDataUrl' in message &&
    typeof message.imageDataUrl === 'string' &&
    isSupportedImageDataUrl(message.imageDataUrl)
  );
}

export function isOcrProgressMessage(
  message: unknown,
): message is OcrProgressMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === OCR_PROGRESS_MESSAGE &&
    'requestId' in message &&
    typeof message.requestId === 'string' &&
    message.requestId.trim().length > 0 &&
    'progress' in message &&
    typeof message.progress === 'number' &&
    Number.isFinite(message.progress) &&
    message.progress >= 0 &&
    message.progress <= 1 &&
    'status' in message &&
    typeof message.status === 'string' &&
    message.status.trim().length > 0
  );
}

function isSupportedImageDataUrl(value: string): boolean {
  return /^data:image\/(?:png|jpeg|webp);base64,(?:(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)|(?:[A-Za-z0-9+/]{4})+)$/.test(
    value,
  );
}
