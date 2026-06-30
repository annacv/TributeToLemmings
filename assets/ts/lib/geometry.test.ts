import { describe, it, expect } from 'vitest';
import { bombHitsPlayer } from './geometry';
import { TEST_CANVAS_SIZE } from '../test-helpers';

/* Default lemming placement on the 468×468 test canvas (Player constructor):
   box (40, 380) 50×50 → hurtbox x 48–82, y 385–430; bomb 28×32 with the
   right 6px (spark) trimmed → dangerous span dx..dx+22. */
const PLAYER_X = 40;
const PLAYER_Y = TEST_CANVAS_SIZE - 50 - 38;
const PLAYER_W = 50;
const PLAYER_H = 50;

describe('bombHitsPlayer', () => {
  it.each([
    { dx: 83, dy: 390, hit: false, note: 'body just past the hurtbox right edge (82)' },
    { dx: 25, dy: 390, hit: false, note: 'only the trimmed spark zone (47–53) reaches the player' },
    { dx: 50, dy: 352, hit: false, note: 'bomb bottom (384) just above the hurtbox top (385)' },
    { dx: 82, dy: 390, hit: true,  note: 'body left edge touches hurtbox right edge' },
    { dx: 26, dy: 390, hit: true,  note: 'body right edge (48) touches hurtbox left edge' },
  ])('hurtbox boundary: bomb at ($dx,$dy) → hit=$hit ($note)', ({ dx, dy, hit }) => {
    expect(bombHitsPlayer(PLAYER_X, PLAYER_Y, PLAYER_W, PLAYER_H, dx, dy)).toBe(hit);
  });
});
