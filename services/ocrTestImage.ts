export function createOcrTestImage(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 360;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas is not available.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#111827';
  context.font = '700 52px Arial, sans-serif';
  context.fillText('SNIPLINGO OCR TEST', 48, 82);

  context.font = '44px Arial, sans-serif';
  context.fillText('English text: Hello world 12345', 48, 178);
  context.fillText('Русский текст: Привет мир 67890', 48, 274);

  return canvas.toDataURL('image/png');
}
