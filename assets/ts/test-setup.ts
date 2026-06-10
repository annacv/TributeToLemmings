import { makeCtx } from './test-helpers';

// Path2D is not implemented by jsdom; provide a minimal stub for all tests.
(globalThis as unknown as Record<string, unknown>).Path2D = class {
  moveTo() {} lineTo() {} closePath() {} rect() {}
};

// HTMLMediaElement.play/pause are not implemented by jsdom.
HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = function () {};

// canvas.getContext is not implemented by jsdom (it errors loudly); return a mock 2d context.
HTMLCanvasElement.prototype.getContext = (() =>
  makeCtx()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
