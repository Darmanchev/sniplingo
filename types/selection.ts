export const START_SELECTION_MESSAGE = 'START_SELECTION' as const;
export const CAPTURE_SELECTION_MESSAGE = 'CAPTURE_SELECTION' as const;

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StartSelectionMessage {
  type: typeof START_SELECTION_MESSAGE;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CaptureSelectionMessage {
  type: typeof CAPTURE_SELECTION_MESSAGE;
  rect: SelectionRect;
  viewport: ViewportSize;
}

export type CaptureSelectionResponse =
  | { ok: true; imageDataUrl: string }
  | { ok: false; error: string };

export function isStartSelectionMessage(
  message: unknown,
): message is StartSelectionMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === START_SELECTION_MESSAGE
  );
}

export function isCaptureSelectionMessage(
  message: unknown,
): message is CaptureSelectionMessage {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('type' in message) ||
    message.type !== CAPTURE_SELECTION_MESSAGE ||
    !('rect' in message) ||
    !('viewport' in message)
  ) {
    return false;
  }

  return (
    isSelectionRect(message.rect) &&
    isPositiveSize(message.viewport)
  );
}

function isSelectionRect(value: unknown): value is SelectionRect {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'x' in value &&
    isNonNegativeNumber(value.x) &&
    'y' in value &&
    isNonNegativeNumber(value.y) &&
    'width' in value &&
    isPositiveNumber(value.width) &&
    'height' in value &&
    isPositiveNumber(value.height)
  );
}

function isPositiveSize(value: unknown): value is ViewportSize {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'width' in value &&
    isPositiveNumber(value.width) &&
    'height' in value &&
    isPositiveNumber(value.height)
  );
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
