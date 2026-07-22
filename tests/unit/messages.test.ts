import { describe, expect, it } from 'vitest';
import {
  OFFSCREEN_OCR_MESSAGE,
  OCR_PROGRESS_MESSAGE,
  RECOGNIZE_IMAGE_MESSAGE,
  isOffscreenOcrMessage,
  isOcrProgressMessage,
  isRecognizeImageMessage,
} from '@/types/ocr';
import {
  CAPTURE_SELECTION_MESSAGE,
  START_SELECTION_MESSAGE,
  isCaptureSelectionMessage,
  isStartSelectionMessage,
} from '@/types/selection';
import {
  TRANSLATE_TEXT_MESSAGE,
  isTranslateTextMessage,
} from '@/types/translation';

describe('selection message guards', () => {
  const validCapture = {
    type: CAPTURE_SELECTION_MESSAGE,
    rect: { x: 1, y: 2, width: 100, height: 50 },
    viewport: { width: 1280, height: 720 },
  };

  it('accepts valid selection messages', () => {
    expect(isCaptureSelectionMessage(validCapture)).toBe(true);
    expect(isStartSelectionMessage({ type: START_SELECTION_MESSAGE })).toBe(true);
  });

  it.each([
    null,
    { ...validCapture, rect: { ...validCapture.rect, x: Number.NaN } },
    { ...validCapture, rect: { ...validCapture.rect, width: -1 } },
    { ...validCapture, viewport: { ...validCapture.viewport, height: 0 } },
    { ...validCapture, viewport: { ...validCapture.viewport, width: '1280' } },
  ])('rejects an invalid capture message', (message) => {
    expect(isCaptureSelectionMessage(message)).toBe(false);
  });

  it.each([null, {}, { type: 1 }, { type: 'START' }])(
    'rejects an invalid start message',
    (message) => {
      expect(isStartSelectionMessage(message)).toBe(false);
    },
  );
});

describe('OCR message guards', () => {
  const validRecognition = {
    type: RECOGNIZE_IMAGE_MESSAGE,
    requestId: 'request-1',
    imageDataUrl: 'data:image/png;base64,AAAA',
  };
  const validProgress = {
    type: OCR_PROGRESS_MESSAGE,
    requestId: 'request-1',
    progress: 0.5,
    status: 'recognizing text',
  };
  const validOffscreenRecognition = {
    ...validRecognition,
    type: OFFSCREEN_OCR_MESSAGE,
    target: 'offscreen',
  };

  it('accepts valid OCR messages', () => {
    expect(isRecognizeImageMessage(validRecognition)).toBe(true);
    expect(isOffscreenOcrMessage(validOffscreenRecognition)).toBe(true);
    expect(isOcrProgressMessage(validProgress)).toBe(true);
  });

  it.each([
    { ...validOffscreenRecognition, target: 'background' },
    { ...validOffscreenRecognition, requestId: '' },
    { ...validOffscreenRecognition, imageDataUrl: 'not-an-image' },
  ])('rejects an invalid offscreen OCR message', (message) => {
    expect(isOffscreenOcrMessage(message)).toBe(false);
  });

  it.each([
    { ...validRecognition, requestId: '' },
    { ...validRecognition, requestId: '   ' },
    { ...validRecognition, imageDataUrl: 'data:image/png,AAAA' },
    { ...validRecognition, imageDataUrl: 'data:image/png;base64,' },
    { ...validRecognition, imageDataUrl: 'data:image/svg+xml;base64,AAAA' },
    { ...validRecognition, imageDataUrl: 'data:image/png;base64,not-base64!' },
    { ...validRecognition, imageDataUrl: 123 },
  ])('rejects an invalid recognition message', (message) => {
    expect(isRecognizeImageMessage(message)).toBe(false);
  });

  it.each([
    { ...validProgress, requestId: '' },
    { ...validProgress, progress: Number.NaN },
    { ...validProgress, progress: -0.1 },
    { ...validProgress, progress: 1.1 },
    { ...validProgress, status: 10 },
  ])('rejects an invalid progress message', (message) => {
    expect(isOcrProgressMessage(message)).toBe(false);
  });
});

describe('translation message guard', () => {
  const validMessage = {
    type: TRANSLATE_TEXT_MESSAGE,
    requestId: 'request-1',
    targetLanguage: 'ru',
    text: 'Hello',
  };

  it('accepts a valid translation message', () => {
    expect(isTranslateTextMessage(validMessage)).toBe(true);
  });

  it.each([
    { ...validMessage, requestId: '' },
    { ...validMessage, targetLanguage: 'fr' },
    { ...validMessage, text: '   ' },
    { ...validMessage, text: 123 },
    { ...validMessage, requestId: Number.NaN },
  ])('rejects an invalid translation message', (message) => {
    expect(isTranslateTextMessage(message)).toBe(false);
  });
});
