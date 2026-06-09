import { vi } from 'vitest';

export function makeCtx() {
  const fills: string[] = [];
  const ctx = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fill: vi.fn().mockImplementation(() => { fills.push(ctx.fillStyle as string); }),
    _fills: fills,
  };
  return ctx;
}

export function makeCanvas(width = 400, height = 400) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = vi.fn().mockReturnValue(makeCtx()) as typeof canvas.getContext;
  return canvas;
}
