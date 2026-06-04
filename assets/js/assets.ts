import bombSvg from '../images/svg/bomb.svg';
import booomSvg from '../images/svg/booom.svg';
import lemmingSvg from '../images/svg/lemming.svg';
import lemming2LivesSvg from '../images/svg/lemming--2-lives.svg';
import lemming1LifeSvg from '../images/svg/lemming--1-life.svg';
import gameSongOgg from '../sounds/03_-_Lemmings_-_DOS_-_Lemming_2.ogg';

export const SPRITES = {
  bomb: bombSvg,
  booom: booomSvg,
  lemming: lemmingSvg,
  lemming2Lives: lemming2LivesSvg,
  lemming1Life: lemming1LifeSvg,
} as const;

export const GAME_SONG = gameSongOgg;
