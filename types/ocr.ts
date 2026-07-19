export const RECOGNIZE_IMAGE_MESSAGE = 'RECOGNIZE_IMAGE' as const;
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
    message.requestId.length > 0 &&
    'imageDataUrl' in message &&
    typeof message.imageDataUrl === 'string' &&
    message.imageDataUrl.startsWith('data:image/')
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
    'progress' in message &&
    typeof message.progress === 'number' &&
    'status' in message &&
    typeof message.status === 'string'
  );
}
