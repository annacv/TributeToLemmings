import { describe, it, expect } from 'vitest';
import { bombHitsPlayer } from './geometry';
import { defaultPlayerHitbox } from '../test-helpers';

const { x: PLAYER_X, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H } = defaultPlayerHitbox();

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
