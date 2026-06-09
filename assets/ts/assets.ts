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
import groundErosion0Svg from '../images/backgrounds/ground-erosion-0.svg';
import groundErosion1Svg from '../images/backgrounds/ground-erosion-1.svg';
import groundErosion2Svg from '../images/backgrounds/ground-erosion-2.svg';
import groundErosion3Svg from '../images/backgrounds/ground-erosion-3.svg';

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
export const GROUND_EROSION_SVGS = [
  groundErosion0Svg,
  groundErosion1Svg,
  groundErosion2Svg,
  groundErosion3Svg,
] as const;
