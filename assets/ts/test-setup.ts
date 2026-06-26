import { makeCtx } from './test-helpers';

// Path2D is not implemented by jsdom; provide a minimal stub for all tests.
(globalThis as unknown as Record<string, unknown>).Path2D = class {
  moveTo() {} lineTo() {} closePath() {} rect() {}
};

// HTMLMediaElement.play/pause are not implemented by jsdom.
HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = function () {};

// canvas.getContext is not implemented by jsdom (it errors loudly); return a mock 2d context
// whose `.canvas` points back at its element, mirroring the real API.
HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement) {
  return makeCtx(this);
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// ResizeObserver is not implemented by jsdom; provide a no-op stub.
(globalThis as unknown as Record<string, unknown>).ResizeObserver ??= class {
  observe() {} unobserve() {} disconnect() {}
};

// matchMedia is not implemented by jsdom; queries (reduced motion) report no match.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;
