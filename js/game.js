'use strict';
// =============================================
//         超級瑪利歐 - HTML5 Canvas Game
// =============================================

// ---- 常數 CONSTANTS ----
const GW = 800, GH = 480;
const HUD_H = 40;
const TS = 32;
const GAME_H = GH - HUD_H;

const T = {
  EMPTY: 0, GROUND: 1, BRICK: 2, QBLOCK: 3, USED: 4,
  COIN_T: 5, PIPE_TL: 6, PIPE_TR: 7, PIPE_BL: 8, PIPE_BR: 9,
  SOLID: 10, FPOLE: 11, FBASE: 12, CASTLE: 13, LAVA: 14, CLOUD: 15,
};

const SOLID_SET = new Set([
  T.GROUND, T.BRICK, T.QBLOCK, T.USED,
  T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR,
  T.SOLID, T.FBASE, T.CASTLE,
]);

const CLR = {
  sky1: '#5c94fc', sky2: '#3060d0',
  ugSky: '#000033', castleSky: '#200040',
  groundTop: '#54b800', groundBody: '#9c6420', groundDark: '#7a4c18',
  brick: '#c84c0c', brickDk: '#8c3006', brickHi: '#e06020',
  qBlock: '#e8b000', qBlockHi: '#fcd040', qMark: '#7a4000',
  used: '#8c8c8c', usedDk: '#606060',
  pipe: '#00a800', pipeDk: '#007000', pipeHi: '#00cc00',
  solid: '#8c8c8c', solidDk: '#505050', solidHi: '#aaaaaa',
  coin: '#fcd020', coinDk: '#c8a000',
  lava: '#e84000', lavaBright: '#ff8800',
  castle: '#888888', castleDk: '#505050',
  white: '#ffffff', black: '#000000',
  sky: '#5c94fc',
};
