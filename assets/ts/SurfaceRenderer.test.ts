import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { SurfaceRenderer } from './SurfaceRenderer';
import { makeCanvas } from './test-helpers';

/* The offscreen erosion context comes from jsdom's stubbed getContext (test-setup),
   so its drawImage is already a vi.fn() we can assert on directly. */
describe('SurfaceRenderer — erosion canvas drawing', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(); });

  it('draws each loaded stamp onto the erosion canvas', () => {
    const renderer = new SurfaceRenderer(canvas);
    const drawImage = renderer['erosionCtx'].drawImage as unknown as Mock;
    const img = { complete: true } as HTMLImageElement;

    renderer['drawStamps']([{ img, x: 100, y: 350, width: 30, height: 90 }]);

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledWith(img, 100, 350, 30, 90);
  });

  it('skips stamps whose image has not loaded yet', () => {
    const renderer = new SurfaceRenderer(canvas);
    const drawImage = renderer['erosionCtx'].drawImage as unknown as Mock;
    const img = { complete: false } as HTMLImageElement;

    renderer['drawStamps']([{ img, x: 50, y: 360, width: 80, height: 48 }]);

    expect(drawImage).not.toHaveBeenCalled();
  });
});

describe('SurfaceRenderer — ground coverage', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(); });

  it('reports zero coverage until a hole is stamped, then more than zero', () => {
    const renderer = new SurfaceRenderer(canvas);
    expect(renderer.coverage()).toBe(0);

    renderer.stampHole(canvas.width / 2);

    expect(renderer.coverage()).toBeGreaterThan(0);
  });

  it('cracks alone never erode the ground (coverage stays zero)', () => {
    const renderer = new SurfaceRenderer(canvas);

    renderer.stampCrack(canvas.width / 2, 0);
    renderer.stampCrack(canvas.width / 2, 2);

    expect(renderer.coverage()).toBe(0);
  });
});
