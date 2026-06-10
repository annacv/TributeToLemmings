import bombSvg from '../images/characters/bomb.svg';
import booomSvg from '../images/characters/booom.svg';
import lemmingSvg from '../images/characters/lemming.svg';
import gameSongOgg from '../sounds/03_-_Lemmings_-_DOS_-_Lemming_2.ogg';
import fireSfxWav from '../sounds/FIRE.WAV';
import dieSfxWav from '../sounds/DIE.WAV';
import rankingMusicOgg from '../sounds/14_-_Lemmings_-_DOS_-_Dance_of_the_Reed-Flutes.ogg';
import yippeeSfxWav from '../sounds/YIPPEE.WAV';
import electricSfxWav from '../sounds/ELECTRIC.WAV';
import bangSfxWav from '../sounds/BANG.WAV';
import tentonSfxWav from '../sounds/TENTON.WAV';
import fallingSfxMp3 from '../sounds/intro-falling-sound-effect.mp3';
import groundErosionSvg from '../images/backgrounds/ground-erosion.svg';
import backgroundGameSvg from '../images/backgrounds/background-game.svg';
import backgroundUndergroundSvg from '../images/backgrounds/background-underground.svg';
import crackMark1Svg from '../images/backgrounds/crack-mark-1.svg';
import crackMark2Svg from '../images/backgrounds/crack-mark-2.svg';
import crackMark3Svg from '../images/backgrounds/crack-mark-3.svg';
import crackMark4Svg from '../images/backgrounds/crack-mark-4.svg';
import groundHole1Svg from '../images/backgrounds/ground-hole-1.svg';
import groundHole2Svg from '../images/backgrounds/ground-hole-2.svg';
import groundHole3Svg from '../images/backgrounds/ground-hole-3.svg';
import groundHole4Svg from '../images/backgrounds/ground-hole-4.svg';

export const SPRITES = {
  bomb: bombSvg,
  booom: booomSvg,
  lemming: lemmingSvg,
} as const;

export const GAME_SONG = gameSongOgg;
export const FIRE_SFX = fireSfxWav;
export const DIE_SFX = dieSfxWav;
export const RANKING_MUSIC = rankingMusicOgg;
export const YIPPEE_SFX = yippeeSfxWav;
export const ELECTRIC_SFX = electricSfxWav;
export const BANG_SFX = bangSfxWav;
export const TENTON_SFX = tentonSfxWav;
export const FALLING_SFX = fallingSfxMp3;
export const GROUND_EROSION_COLLAPSE_SVG = groundErosionSvg;
export const GAME_BACKGROUND_SVG = backgroundGameSvg;
export const UNDERGROUND_BACKGROUND_SVG = backgroundUndergroundSvg;

export const CRACK_MARK_SVGS = [
  crackMark1Svg,
  crackMark2Svg,
  crackMark3Svg,
  crackMark4Svg,
] as const;

export const GROUND_HOLE_SVGS = [
  groundHole1Svg,
  groundHole3Svg,
  groundHole2Svg,
  groundHole4Svg,
] as const;
