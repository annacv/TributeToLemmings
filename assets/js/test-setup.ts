// Path2D is not implemented by jsdom; provide a minimal stub for all tests.
(globalThis as unknown as Record<string, unknown>).Path2D = class {
  moveTo() {} lineTo() {} closePath() {} rect() {}
};
