/* Shared geometry: every screen sizes its square canvas through getCanvasSize,
   and constants baked to asset artwork live here so no screen re-derives them
   by eye. */

/** Bomb sprite draw size (bomb.svg); spawn math and hitboxes share it. */
export const BOMB_WIDTH = 28;
export const BOMB_HEIGHT = 32;

/** Lemming draw size as a fraction of the canvas on cinematic screens. */
export const LEMMING_SIZE_FRAC = 0.14;

/* Composition constants baked to background-underground.svg's geometry (the
   fall interstitial and the tunnel's establishing shot share this artwork). */
export const TBC_GEOMETRY = {
  /** Hole center within the erosion frame the lemming falls into. */
  HOLE_CENTER_Y_FRAC: 0.435,
  /** ground-erosion.svg intrinsic aspect (h/w). */
  GROUND_EROSION_ASPECT: 299 / 400,
  BG_ZOOM: 1.5,
  /** Fraction of the 800-tall surface art cropped above the grass line. */
  BG_CROP_TOP_FRAC: 547 / 800,
  /** Erosion slot width and stack top as canvas fractions (svg shaft layout). */
  EROSION_SLOT_WIDTH_FRAC: 0.85,
  EROSION_STACK_TOP_FRAC: 0.02,
} as const;

/** Square canvas size shared by all screens: viewport-fit between 280 and 580,
    leaving room for the HUD/UI chrome. Screens with different chrome change
    this function — they do not fork it. */
export function getCanvasSize(): number {
  const isDesktop = window.innerWidth >= 768;
  const frameVPad = isDesktop ? 44 : 0;
  const frameHPad = isDesktop ? 44 : 32;
  const uiHeight = 256;
  const maxByHeight = window.innerHeight - uiHeight - frameVPad;
  const viewportWidth = document.documentElement.clientWidth;
  const maxByWidth = viewportWidth - frameHPad;
  return Math.max(280, Math.min(maxByWidth, maxByHeight, 580));
}
