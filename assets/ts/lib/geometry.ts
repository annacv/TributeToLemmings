/** Bomb sprite draw size (bomb.svg); spawn math and hitboxes share it. */
export const BOMB_WIDTH = 28;
export const BOMB_HEIGHT = 32;

/** Bomb-vs-lemming hitbox insets */
const PLAYER_HITBOX_INSET_X = 8;   // torso/head span x≈15–35 of 50
const PLAYER_HITBOX_INSET_TOP = 5; // hair top starts at y≈5 of 50
const BOMB_HITBOX_TRIM_RIGHT = 6;  // spark occupies x≈22–28 of 28; bombs never mirror

/** Lemming draw size as a fraction of the canvas on cinematic screens. */
export const LEMMING_SIZE_FRAC = 0.14;

/** How close (canvas fraction) the lemming must be to a floor bomb to pick it up */
export const PICKUP_RANGE_FRAC = 0.08;
/** Square canvas maximum size shared by all screens. */
const MAX_CANVAS_SIZE = 532;

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

export function getCanvasSize(): number {
  const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
  const footerHeight = document.querySelector('.site-footer')?.getBoundingClientRect().height ?? 0;
  const maxByHeight = window.innerHeight - headerHeight - footerHeight;
  const maxByWidth = document.documentElement.clientWidth;
  return Math.max(280, Math.min(maxByWidth, maxByHeight, MAX_CANVAS_SIZE));
}

export function bombHitsPlayer(
  playerScreenX: number, playerY: number, playerWidth: number, playerHeight: number,
  bombScreenX: number, bombY: number,
): boolean {
  const playerLeft = playerScreenX + PLAYER_HITBOX_INSET_X;
  const playerRight = playerScreenX + playerWidth - PLAYER_HITBOX_INSET_X;
  const playerTop = playerY + PLAYER_HITBOX_INSET_TOP;
  const playerBottom = playerY + playerHeight;
  const bombRight = bombScreenX + BOMB_WIDTH - BOMB_HITBOX_TRIM_RIGHT;
  return playerRight >= bombScreenX && playerLeft <= bombRight
    && playerBottom >= bombY && playerTop <= bombY + BOMB_HEIGHT;
}
