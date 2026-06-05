import bombSvg from '../images/characters/bomb.svg';
import booomSvg from '../images/characters/booom.svg';
import lemmingSvg from '../images/characters/lemming.svg';
import gameSongOgg from '../sounds/03_-_Lemmings_-_DOS_-_Lemming_2.ogg';

export const SPRITES = {
  bomb: bombSvg,
  booom: booomSvg,
  lemming: lemmingSvg,
} as const;

export const GAME_SONG = gameSongOgg;
