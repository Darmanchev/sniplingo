import { describe, expect, it } from 'vitest';
import { calculateCropRect } from '@/services/imageCrop';

describe('calculateCropRect', () => {
  it.each([
    { zoom: '100%', viewport: [1920, 1080], expected: [100, 50, 200, 100] },
    { zoom: '125%', viewport: [1536, 864], expected: [125, 62, 250, 126] },
    { zoom: '150%', viewport: [1280, 720], expected: [150, 75, 300, 150] },
    { zoom: '200%', viewport: [960, 540], expected: [200, 100, 400, 200] },
  ])('maps CSS pixels at $zoom zoom', ({ viewport, expected }) => {
    expect(
      calculateCropRect(
        { x: 100, y: 50, width: 200, height: 100 },
        { width: viewport[0], height: viewport[1] },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({
      x: expected[0],
      y: expected[1],
      width: expected[2],
      height: expected[3],
    });
  });

  it('rounds outward so fractional edge pixels are not lost', () => {
    expect(
      calculateCropRect(
        { x: 10.4, y: 20.6, width: 30.2, height: 40.2 },
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ),
    ).toEqual({ x: 10, y: 20, width: 31, height: 41 });
  });

  it('clamps a selection at the right and bottom image edges', () => {
    expect(
      calculateCropRect(
        { x: 950, y: 750, width: 100, height: 100 },
        { width: 1000, height: 800 },
        { width: 2000, height: 1600 },
      ),
    ).toEqual({ x: 1900, y: 1500, width: 100, height: 100 });
  });

  it('uses independent horizontal and vertical scales', () => {
    expect(
      calculateCropRect(
        { x: 100, y: 100, width: 200, height: 200 },
        { width: 1000, height: 1000 },
        { width: 2000, height: 1500 },
      ),
    ).toEqual({ x: 200, y: 150, width: 400, height: 300 });
  });

  it.each([
    [{ width: 0, height: 100 }, { width: 100, height: 100 }],
    [{ width: 100, height: Number.NaN }, { width: 100, height: 100 }],
    [{ width: 100, height: 100 }, { width: -1, height: 100 }],
  ])('rejects invalid viewport or image dimensions', (viewport, imageSize) => {
    expect(() =>
      calculateCropRect(
        { x: 0, y: 0, width: 10, height: 10 },
        viewport,
        imageSize,
      ),
    ).toThrow();
  });

  it('rejects selections outside the image', () => {
    expect(() =>
      calculateCropRect(
        { x: 101, y: 0, width: 10, height: 10 },
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ),
    ).toThrow('outside');
  });
});
