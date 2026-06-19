/* Shared geometry: every screen sizes its square canvas through getCanvasSize,
   and constants baked to asset artwork live here so no screen re-derives them
   by eye. */

/** Bomb sprite draw size (bomb.svg); spawn math and hitboxes share it. */
export const BOMB_WIDTH = 28;
export const BOMB_HEIGHT = 32;

/** Lemming draw size as a fraction of the canvas on cinematic screens. */
export const LEMMING_SIZE_FRAC = 0.14;

/* Composition constants baked to background-underground.svg's transition-screen geometry. */
export const TRANSITION_GEOMETRY = {
  /** Hole center within the erosion frame the lemming falls into. */
  HOLE_CENTER_Y_FRAC: 0.435,
  /** Ground erosion intrinsic aspect (h/w). */
  GROUND_EROSION_ASPECT: 299 / 400,
  /** Background zoom factor (1.5 = 1.5x original size). */
  BG_ZOOM: 1.5,
  /** Fraction of the 800-tall surface art cropped above the grass line. */
  BG_CROP_TOP_FRAC: 547 / 800,
  /** Erosion slot width and stack top as canvas fractions (svg shaft layout). */
  EROSION_SLOT_WIDTH_FRAC: 0.85,
  EROSION_STACK_TOP_FRAC: 0.02,
} as const;

/** Square canvas maximum size shared by all screens. */
const MAX_CANVAS_SIZE = 600;

export function getCanvasSize(): number {
  const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
  const footerHeight = document.querySelector('.site-footer')?.getBoundingClientRect().height ?? 0;
  const maxByHeight = window.innerHeight - headerHeight - footerHeight;
  const maxByWidth = document.documentElement.clientWidth;
  return Math.max(280, Math.min(maxByWidth, maxByHeight, MAX_CANVAS_SIZE));
}
