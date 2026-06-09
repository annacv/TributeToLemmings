import bombSvg from '../images/characters/bomb.svg';
import booomSvg from '../images/characters/booom.svg';
import lemmingSvg from '../images/characters/lemming.svg';
import gameSongOgg from '../sounds/03_-_Lemmings_-_DOS_-_Lemming_2.ogg';
import fireSfxWav from '../sounds/FIRE.WAV';
import dieSfxWav from '../sounds/DIE.WAV';
import rankingMusicOgg from '../sounds/14_-_Lemmings_-_DOS_-_Dance_of_the_Reed-Flutes.ogg';

export const SPRITES = {
  bomb: bombSvg,
  booom: booomSvg,
  lemming: lemmingSvg,
} as const;

export const GAME_SONG = gameSongOgg;
export const FIRE_SFX = fireSfxWav;
export const DIE_SFX = dieSfxWav;
export const RANKING_MUSIC = rankingMusicOgg;
