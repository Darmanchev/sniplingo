const MAX_OUTPUT_WIDTH = 2400;
const MAX_OUTPUT_HEIGHT = 1800;
const MAX_OUTPUT_PIXELS = 4_000_000;
const CONTRAST_FACTOR = 1.3;

export interface ImageSize {
  width: number;
  height: number;
}

export async function preprocessImageForOcr(
  imageDataUrl: string,
): Promise<string> {
  if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
    return preprocessImageOffscreen(imageDataUrl);
  }

  const image = await loadImage(imageDataUrl);
  const outputSize = calculateOcrImageSize(
    image.naturalWidth,
    image.naturalHeight,
  );
  const canvas = document.createElement('canvas');
  canvas.width = outputSize.width;
  canvas.height = outputSize.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) {
    throw new Error('Canvas is not available.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  applyGrayscaleAndContrast(imageData.data);
  context.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}

async function preprocessImageOffscreen(imageDataUrl: string): Promise<string> {
  const image = await createImageBitmap(await (await fetch(imageDataUrl)).blob());
  try {
    const outputSize = calculateOcrImageSize(image.width, image.height);
    const canvas = new OffscreenCanvas(outputSize.width, outputSize.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('Canvas is not available.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    applyGrayscaleAndContrast(imageData.data);
    context.putImageData(imageData, 0, 0);

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

export function calculateOcrImageSize(
  sourceWidth: number,
  sourceHeight: number,
): ImageSize {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1
  ) {
    throw new Error('OCR image dimensions must be positive.');
  }

  const longestSide = Math.max(sourceWidth, sourceHeight);
  const shortestSide = Math.min(sourceWidth, sourceHeight);
  let desiredScale = 1;

  if (longestSide < 500) desiredScale = 4;
  else if (longestSide < 1000) desiredScale = 3;
  else if (longestSide < 1600) desiredScale = 2;

  if (shortestSide < 120) desiredScale = Math.max(desiredScale, 3);
  else if (shortestSide < 300) desiredScale = Math.max(desiredScale, 2);

  const maximumScale = Math.min(
    MAX_OUTPUT_WIDTH / sourceWidth,
    MAX_OUTPUT_HEIGHT / sourceHeight,
    Math.sqrt(MAX_OUTPUT_PIXELS / (sourceWidth * sourceHeight)),
  );
  const scale = Math.min(desiredScale, maximumScale);

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function applyGrayscaleAndContrast(pixels: Uint8ClampedArray): void {
  for (let index = 0; index < pixels.length; index += 4) {
    const grayscale =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;
    const contrasted = clamp((grayscale - 128) * CONTRAST_FACTOR + 128);

    pixels[index] = contrasted;
    pixels[index + 1] = contrasted;
    pixels[index + 2] = contrasted;
    pixels[index + 3] = 255;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The OCR image could not be loaded.'));
    image.src = source;
  });
}
