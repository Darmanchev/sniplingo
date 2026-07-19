import type {
  SelectionRect,
  ViewportSize,
} from '@/types/selection';

export async function cropImage(
  imageDataUrl: string,
  rect: SelectionRect,
  viewport: ViewportSize,
): Promise<string> {
  const image = await loadImage(imageDataUrl);
  const scaleX = image.naturalWidth / viewport.width;
  const scaleY = image.naturalHeight / viewport.height;

  const sourceX = Math.max(0, Math.floor(rect.x * scaleX));
  const sourceY = Math.max(0, Math.floor(rect.y * scaleY));
  const sourceRight = Math.min(
    image.naturalWidth,
    Math.ceil((rect.x + rect.width) * scaleX),
  );
  const sourceBottom = Math.min(
    image.naturalHeight,
    Math.ceil((rect.y + rect.height) * scaleY),
  );
  const sourceWidth = sourceRight - sourceX;
  const sourceHeight = sourceBottom - sourceY;

  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new Error('The selected area is outside the captured image.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas is not available.');
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  return canvas.toDataURL('image/png');
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The screenshot could not be loaded.'));
    image.src = source;
  });
}
