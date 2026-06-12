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
import caveLoopOgg from '../sounds/113_-_Lemmings_-_DOS_-_Tim_5.ogg';
import explodeSfxWav from '../sounds/EXPLODE.WAV';
import chainSfxWav from '../sounds/CHAIN.WAV';
import scrapeSfxWav from '../sounds/SCRAPE.WAV';
import tingSfxWav from '../sounds/TING.WAV';
import mousepreSfxWav from '../sounds/MOUSEPRE.WAV';
import backgroundUndergroundSvg from '../images/backgrounds/background-underground.svg';
import backgroundTunnelSvg from '../images/backgrounds/background-tunnel.svg';
import tunnelCeilingSvg from '../images/backgrounds/tunnel-ceiling.svg';
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
export const CAVE_LOOP = caveLoopOgg;
export const EXPLODE_SFX = explodeSfxWav;
export const CHAIN_SFX = chainSfxWav;
export const SCRAPE_SFX = scrapeSfxWav;
export const TING_SFX = tingSfxWav;
export const MOUSEPRE_SFX = mousepreSfxWav;
export const TALLY_TICK_SFX: string | null = tingSfxWav;
export const TALLY_CHIME_SFX: string | null = mousepreSfxWav;
export const UNDERGROUND_BACKGROUND_SVG = backgroundUndergroundSvg;
export const TUNNEL_BACKGROUND_SVG = backgroundTunnelSvg;
export const TUNNEL_CEILING_SVG = tunnelCeilingSvg;

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
