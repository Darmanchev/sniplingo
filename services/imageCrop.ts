import type {
  SelectionRect,
  ViewportSize,
} from '@/types/selection';

export interface ImageSize {
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateCropRect(
  rect: SelectionRect,
  viewport: ViewportSize,
  imageSize: ImageSize,
): CropRect {
  assertPositiveSize(viewport, 'Viewport');
  assertPositiveSize(imageSize, 'Image');

  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new Error('Selection coordinates must be finite and non-negative.');
  }

  const scaleX = imageSize.width / viewport.width;
  const scaleY = imageSize.height / viewport.height;
  const x = Math.min(imageSize.width, Math.max(0, Math.floor(rect.x * scaleX)));
  const y = Math.min(imageSize.height, Math.max(0, Math.floor(rect.y * scaleY)));
  const right = Math.min(
    imageSize.width,
    Math.max(0, Math.ceil((rect.x + rect.width) * scaleX)),
  );
  const bottom = Math.min(
    imageSize.height,
    Math.max(0, Math.ceil((rect.y + rect.height) * scaleY)),
  );
  const width = right - x;
  const height = bottom - y;

  if (width < 1 || height < 1) {
    throw new Error('The selected area is outside the captured image.');
  }

  return { x, y, width, height };
}

export async function cropImage(
  imageDataUrl: string,
  rect: SelectionRect,
  viewport: ViewportSize,
): Promise<string> {
  if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
    return cropImageOffscreen(imageDataUrl, rect, viewport);
  }

  const image = await loadImage(imageDataUrl);
  const cropRect = calculateCropRect(rect, viewport, {
    width: image.naturalWidth,
    height: image.naturalHeight,
  });

  const canvas = document.createElement('canvas');
  canvas.width = cropRect.width;
  canvas.height = cropRect.height;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas is not available.');
  }

  context.drawImage(
    image,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height,
  );

  return canvas.toDataURL('image/png');
}

async function cropImageOffscreen(
  imageDataUrl: string,
  rect: SelectionRect,
  viewport: ViewportSize,
): Promise<string> {
  const image = await createImageBitmap(await (await fetch(imageDataUrl)).blob());
  try {
    const cropRect = calculateCropRect(rect, viewport, {
      width: image.width,
      height: image.height,
    });
    const canvas = new OffscreenCanvas(cropRect.width, cropRect.height);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Canvas is not available.');

    context.drawImage(
      image,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      cropRect.width,
      cropRect.height,
    );

    return blobToDataUrl(await canvas.convertToBlob({ type: 'image/png' }));
  } finally {
    image.close();
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

function assertPositiveSize(size: ImageSize, label: string): void {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new Error(`${label} dimensions must be positive and finite.`);
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The screenshot could not be loaded.'));
    image.src = source;
  });
}
