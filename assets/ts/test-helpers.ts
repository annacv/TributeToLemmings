import { vi } from 'vitest';

export const TEST_CANVAS_SIZE = 468;

export function makeCtx(canvas?: HTMLCanvasElement) {
  const fills: string[] = [];
  const ctx = {
    canvas,
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    font: '',
    textAlign: 'start' as CanvasTextAlign,
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    ellipse: vi.fn(),
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fill: vi.fn().mockImplementation(() => { fills.push(ctx.fillStyle as string); }),
    _fills: fills,
  };
  return ctx;
}

export function makeCanvas(width = TEST_CANVAS_SIZE, height = TEST_CANVAS_SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = vi.fn().mockReturnValue(makeCtx(canvas)) as typeof canvas.getContext;
  return canvas;
}
