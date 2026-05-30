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

// ---- 音效 AUDIO ----
class SFX {
  constructor() {
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { this.ac = null; }
  }

  _tone(freq, start, dur, type = 'square', vol = 0.25) {
    if (!this.ac) return;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.connect(g); g.connect(this.ac.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ac.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + start + dur + 0.01);
    o.start(this.ac.currentTime + start);
    o.stop(this.ac.currentTime + start + dur + 0.05);
  }

  jump()      { this._tone(300, 0, 0.06); this._tone(500, 0.06, 0.08); }
  coin()      { this._tone(1047, 0, 0.07, 'sine', 0.35); this._tone(1319, 0.07, 0.12, 'sine', 0.35); }
  stomp()     { this._tone(180, 0, 0.12, 'sawtooth', 0.4); }
  powerup()   { [400,500,600,800].forEach((f,i) => this._tone(f, i*0.07, 0.1, 'sine', 0.3)); }
  hit()       { this._tone(200, 0, 0.05, 'sawtooth', 0.5); this._tone(120, 0.05, 0.2, 'sawtooth', 0.4); }
  kick()      { this._tone(400, 0, 0.05); this._tone(600, 0.04, 0.06); }
  flagpole()  { [800,1000,1200,1500,2000].forEach((f,i) => this._tone(f, i*0.12, 0.15, 'sine', 0.3)); }
  gameOver()  { [400,350,300,200,150,100].forEach((f,i) => this._tone(f, i*0.12, 0.12, 'sawtooth', 0.4)); }
  bossHit()   { [300,200,150].forEach((f,i) => this._tone(f, i*0.1, 0.1, 'sawtooth', 0.5)); }
  bossDie()   { for(let i=0;i<10;i++) this._tone(200+i*30, i*0.1, 0.12, 'sawtooth', 0.4); }
  brick()     { this._tone(300, 0, 0.03, 'square', 0.3); this._tone(200, 0.03, 0.06, 'square', 0.2); }
  levelup()   { [523,659,784,1047,1319,1568,2093].forEach((f,i) => this._tone(f, i*0.1, 0.12, 'sine', 0.3)); }
  fireball()  { this._tone(800, 0, 0.04, 'sawtooth', 0.2); }
  piranh()    { this._tone(150, 0, 0.1, 'sawtooth', 0.3); }
}

// ---- 輸入 INPUT ----
class Input {
  constructor() {
    this.held = {}; this.just = {};
    window.addEventListener('keydown', e => {
      const prevent = ['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
      if (prevent.includes(e.code)) e.preventDefault();
      if (!this.held[e.code]) this.just[e.code] = true;
      this.held[e.code] = true;
    });
    window.addEventListener('keyup', e => { delete this.held[e.code]; });
  }
  flush()     { this.just = {}; }
  left()      { return !!(this.held['ArrowLeft']  || this.held['KeyA']); }
  right()     { return !!(this.held['ArrowRight'] || this.held['KeyD']); }
  jump()      { return !!(this.held['ArrowUp'] || this.held['Space'] || this.held['KeyZ']); }
  run()       { return !!(this.held['KeyX'] || this.held['ShiftLeft'] || this.held['ShiftRight']); }
  jumpJust()  { return !!(this.just['ArrowUp'] || this.just['Space'] || this.just['KeyZ']); }
  enter()     { return !!(this.just['Enter']); }

  // 觸控按鍵支援
  touch(key, on) {
    if (on) {
      if (!this.held[key]) this.just[key] = true;
      this.held[key] = true;
    } else {
      delete this.held[key];
    }
  }
}

// ---- 粒子特效 PARTICLES ----
class Particles {
  constructor() { this.list = []; }

  emit(x, y, color, n = 8, speed = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (1 + Math.random() * speed);
      this.list.push({
        x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 2,
        color, life: 20 + Math.random()*20|0, maxLife: 0,
        size: 3 + Math.random()*3, text: null
      });
      this.list[this.list.length-1].maxLife = this.list[this.list.length-1].life;
    }
  }

  score(x, y, pts) {
    this.list.push({ x, y: y-10, vx: 0, vy: -0.7, color: '#fff',
      life: 50, maxLife: 50, size: 0, text: '+'+pts });
  }

  brickPiece(x, y) {
    for (let i = 0; i < 6; i++) {
      const vx = (Math.random()-0.5)*6;
      const vy = -6 - Math.random()*4;
      this.list.push({
        x: x + Math.random()*TS, y, vx, vy, color: CLR.brick,
        life: 40, maxLife: 40, size: 6, text: null
      });
    }
  }

  update() {
    this.list = this.list.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life--;
      return p.life > 0;
    });
  }

  draw(ctx, camX) {
    for (const p of this.list) {
      const px = p.x - camX, py = p.y + HUD_H;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      if (p.text) {
        ctx.fillStyle = p.color;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, px, py);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(px - p.size/2, py - p.size/2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---- 磁磚地圖 TILEMAP ----
class TileMap {
  constructor(tiles, width, height, theme) {
    this.tiles = tiles;
    this.width  = width;
    this.height = height;
    this.theme  = theme || 'grass';
    this.frame  = 0;
  }

  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return T.SOLID;
    return this.tiles[ty * this.width + tx];
  }

  set(tx, ty, tile) {
    if (tx >= 0 && ty >= 0 && tx < this.width && ty < this.height)
      this.tiles[ty * this.width + tx] = tile;
  }

  isSolid(tx, ty) { return SOLID_SET.has(this.get(tx, ty)); }

  update() { this.frame++; }

  drawBackground(ctx, camX) {
    const th = this.theme;
    if (th === 'underground') {
      ctx.fillStyle = CLR.ugSky;
      ctx.fillRect(0, HUD_H, GW, GAME_H);
    } else if (th === 'castle') {
      ctx.fillStyle = CLR.castleSky;
      ctx.fillRect(0, HUD_H, GW, GAME_H);
      // Faint stone pattern
      ctx.fillStyle = 'rgba(80,40,120,0.3)';
      for (let y = 0; y < GAME_H; y += 32) {
        for (let x = 0; x < GW; x += 64) {
          ctx.fillRect(x + (y%64 === 0 ? 0 : 32), HUD_H + y, 32, 16);
        }
      }
    } else {
      // Sky gradient
      const grad = ctx.createLinearGradient(0, HUD_H, 0, GH);
      grad.addColorStop(0, '#3060d8');
      grad.addColorStop(1, '#80b0ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, HUD_H, GW, GAME_H);
      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const cloudOff = (camX * 0.3) % GW;
      [[100,60],[300,40],[550,70],[750,50],[950,65],[1150,45]].forEach(([cx, cy]) => {
        const px = (cx - cloudOff % GW + GW) % GW;
        const py = cy + HUD_H;
        this._drawCloud(ctx, px, py);
      });
    }
  }

  _drawCloud(ctx, px, py) {
    const r = [18,14,20,14];
    const ox = [-14,-5,5,16];
    r.forEach((radius, i) => {
      ctx.beginPath();
      ctx.arc(px + ox[i], py, radius, 0, Math.PI*2);
      ctx.fill();
    });
  }

  draw(ctx, camX) {
    const sx = Math.max(0, Math.floor(camX/TS) - 1);
    const ex = Math.min(this.width, sx + Math.ceil(GW/TS) + 3);

    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = sx; tx < ex; tx++) {
        const tile = this.get(tx, ty);
        if (tile === T.EMPTY) continue;
        const px = tx*TS - camX;
        const py = ty*TS + HUD_H;
        this._drawTile(ctx, tile, px, py, tx, ty);
      }
    }
  }

  _drawTile(ctx, tile, px, py, tx, ty) {
    const s = TS;
    switch (tile) {
      case T.GROUND: {
        const topEmpty = this.get(tx, ty-1) === T.EMPTY;
        ctx.fillStyle = CLR.groundBody;
        ctx.fillRect(px, py, s, s);
        if (topEmpty) {
          ctx.fillStyle = this.theme === 'underground' ? '#444' : CLR.groundTop;
          ctx.fillRect(px, py, s, 8);
          // Tufts
          if (this.theme !== 'underground') {
            ctx.fillStyle = '#3a9000';
            ctx.fillRect(px+4, py, 4, 4);
            ctx.fillRect(px+14, py-2, 4, 6);
            ctx.fillRect(px+24, py, 4, 4);
          }
        }
        ctx.strokeStyle = CLR.groundDark;
        ctx.lineWidth = 1;
        ctx.strokeRect(px+0.5, py+0.5, s-1, s-1);
        break;
      }
      case T.BRICK: {
        ctx.fillStyle = CLR.brick;
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = CLR.brickHi;
        ctx.fillRect(px+1, py+1, s-2, 4);
        ctx.fillStyle = CLR.brickDk;
        ctx.fillRect(px, py, s, 2);
        ctx.fillRect(px, py + s/2, s, 2);
        ctx.fillRect(px, py+2, 2, s/2-2);
        ctx.fillRect(px+s/2, py+s/2+2, 2, s/2-2);
        break;
      }
      case T.QBLOCK: {
        const bob = (Math.floor(this.frame/15) % 2) ? -1 : 0;
        ctx.fillStyle = CLR.qBlock;
        ctx.fillRect(px, py+bob, s, s);
        ctx.fillStyle = CLR.qBlockHi;
        ctx.fillRect(px+1, py+bob+1, s-2, 5);
        ctx.fillStyle = CLR.qMark;
        ctx.fillRect(px, py+bob, s, 2);
        ctx.fillRect(px, py+bob+s-2, s, 2);
        ctx.fillRect(px, py+bob, 2, s);
        ctx.fillRect(px+s-2, py+bob, 2, s);
        // "?" symbol
        ctx.fillStyle = CLR.white;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', px+s/2, py+s/2+bob);
        break;
      }
      case T.USED: {
        ctx.fillStyle = CLR.used;
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = CLR.usedDk;
        ctx.strokeStyle = CLR.usedDk;
        ctx.lineWidth = 2;
        ctx.strokeRect(px+2, py+2, s-4, s-4);
        ctx.fillRect(px+s/2-3, py+s/2-3, 6, 6);
        break;
      }
      case T.COIN_T: {
        const pulse = 0.8 + 0.2*Math.sin(this.frame*0.1);
        ctx.fillStyle = CLR.coin;
        ctx.beginPath();
        ctx.ellipse(px+s/2, py+s/2, 7*pulse, 9, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = CLR.coinDk;
        ctx.beginPath();
        ctx.ellipse(px+s/2-2, py+s/2-2, 3*pulse, 4, 0, 0, Math.PI*2);
        ctx.fill();
        break;
      }
      case T.PIPE_TL: {
        ctx.fillStyle = CLR.pipeDk;
        ctx.fillRect(px, py, s+2, s);
        ctx.fillStyle = CLR.pipe;
        ctx.fillRect(px+2, py+6, s-2, s-6);
        ctx.fillStyle = CLR.pipeHi;
        ctx.fillRect(px+4, py+6, 6, s-6);
        // Wider rim
        ctx.fillStyle = CLR.pipe;
        ctx.fillRect(px-2, py, s+6, 7);
        ctx.fillStyle = CLR.pipeDk;
        ctx.fillRect(px-2, py, s+6, 2);
        ctx.fillStyle = CLR.pipeHi;
        ctx.fillRect(px, py+1, 8, 4);
        break;
      }
      case T.PIPE_TR: {
        ctx.fillStyle = CLR.pipeDk;
        ctx.fillRect(px-2, py, s+2, s);
        ctx.fillStyle = CLR.pipe;
        ctx.fillRect(px, py+6, s-2, s-6);
        break;
      }
      case T.PIPE_BL: {
        ctx.fillStyle = CLR.pipeDk;
        ctx.fillRect(px, py, s+2, s);
        ctx.fillStyle = CLR.pipe;
        ctx.fillRect(px+2, py, s-2, s);
        ctx.fillStyle = CLR.pipeHi;
        ctx.fillRect(px+4, py, 6, s);
        break;
      }
      case T.PIPE_BR: {
        ctx.fillStyle = CLR.pipeDk;
        ctx.fillRect(px-2, py, s+2, s);
        ctx.fillStyle = CLR.pipe;
        ctx.fillRect(px, py, s-2, s);
        break;
      }
      case T.SOLID:
      case T.CASTLE: {
        const c = tile === T.CASTLE ? '#706060' : CLR.solid;
        ctx.fillStyle = c;
        ctx.fillRect(px, py, s, s);
        ctx.fillStyle = tile === T.CASTLE ? '#504040' : CLR.solidDk;
        ctx.strokeStyle = tile === T.CASTLE ? '#504040' : CLR.solidDk;
        ctx.lineWidth = 1;
        ctx.strokeRect(px+0.5, py+0.5, s-1, s-1);
        // Crosshatch
        ctx.fillRect(px, py, s/2, s/2);
        ctx.fillRect(px+s/2, py+s/2, s/2, s/2);
        break;
      }
      case T.FPOLE: {
        ctx.fillStyle = '#aaaaaa';
        ctx.fillRect(px+s/2-3, py, 6, s);
        break;
      }
      case T.FBASE: {
        ctx.fillStyle = '#aaaaaa';
        ctx.fillRect(px+s/2-3, py, 6, s);
        ctx.fillStyle = '#e80000';
        ctx.fillRect(px+s/2+3, py+4, 14, 10);
        break;
      }
      case T.LAVA: {
        const wave = Math.sin(this.frame*0.1 + tx*0.5) * 3;
        ctx.fillStyle = CLR.lava;
        ctx.fillRect(px, py+wave, s, s);
        ctx.fillStyle = CLR.lavaBright;
        ctx.fillRect(px, py+wave, s, 6);
        break;
      }
      case T.CLOUD: {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(px, py+s/3, s, s*2/3);
        ctx.beginPath();
        ctx.arc(px+s/2, py+s/3, s/3, 0, Math.PI*2);
        ctx.fill();
        break;
      }
    }
  }
}

// ---- 實體基礎類 BASE ENTITY ----
class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.grounded = false;
    this.dead = false;
  }

  get right() { return this.x + this.w; }
  get bottom() { return this.y + this.h; }
  get cx() { return this.x + this.w/2; }
  get cy() { return this.y + this.h/2; }

  overlaps(other) {
    return this.x < other.x + other.w && this.right > other.x &&
           this.y < other.y + other.h && this.bottom > other.y;
  }

  _moveX(map) {
    this.x += this.vx;
    if (this.vx < 0) {
      const tx = Math.floor(this.x / TS);
      const y1 = Math.floor((this.y + 2) / TS), y2 = Math.floor((this.bottom - 3) / TS);
      for (let ty = y1; ty <= y2; ty++) {
        if (map.isSolid(tx, ty)) { this.x = (tx+1)*TS; this.vx = 0; return; }
      }
    } else if (this.vx > 0) {
      const tx = Math.floor((this.right - 1) / TS);
      const y1 = Math.floor((this.y + 2) / TS), y2 = Math.floor((this.bottom - 3) / TS);
      for (let ty = y1; ty <= y2; ty++) {
        if (map.isSolid(tx, ty)) { this.x = tx*TS - this.w; this.vx = 0; return; }
      }
    }
    // Clamp to left wall
    if (this.x < 0) { this.x = 0; this.vx = 0; }
  }

  _moveY(map) {
    this.grounded = false;
    this.y += this.vy;
    if (this.vy >= 0) {
      const ty = Math.floor((this.bottom - 1) / TS);
      const x1 = Math.floor((this.x + 2) / TS), x2 = Math.floor((this.right - 3) / TS);
      for (let tx = x1; tx <= x2; tx++) {
        if (map.isSolid(tx, ty)) {
          this.y = ty*TS - this.h; this.vy = 0; this.grounded = true; return;
        }
      }
    } else {
      const ty = Math.floor(this.y / TS);
      const x1 = Math.floor((this.x + 3) / TS), x2 = Math.floor((this.right - 4) / TS);
      for (let tx = x1; tx <= x2; tx++) {
        if (map.isSolid(tx, ty)) { this.y = (ty+1)*TS; this.vy = 0; return; }
      }
    }
  }
}

// ---- 玩家 PLAYER ----
const PW = 26, PH_SM = 30, PH_BIG = 46;

class Player extends Entity {
  constructor(tx, ty) {
    super(tx*TS + 3, ty*TS, PW, PH_SM);
    this.state = 'small'; // small | super | fire
    this.facing = 1;
    this.invincible = 0;
    this.jumpHeld = 0;
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.reachedFlag = false;
    this.fireballCooldown = 0;
  }

  get h() { return this.state === 'small' ? PH_SM : PH_BIG; }
  set h(_) {}
  isBig() { return this.state !== 'small'; }

  update(input, map, sfx, game) {
    if (this.dead) {
      this.deathTimer++;
      if (this.deathTimer === 15) this.vy = -14;
      this.vy = Math.min(this.vy + 0.55, 14);
      this.y += this.vy;
      return;
    }
    if (this.reachedFlag) return;
    if (this.invincible > 0) this.invincible--;
    if (this.fireballCooldown > 0) this.fireballCooldown--;

    // Horizontal — 快速響應
    const spd = input.run() ? 6.0 : 4.0;
    if (input.left() && !input.right()) {
      if (this.vx > 0) this.vx = 0;          // 瞬間換向
      this.vx = Math.max(this.vx - 2.0, -spd);
      this.facing = -1;
    } else if (input.right() && !input.left()) {
      if (this.vx < 0) this.vx = 0;          // 瞬間換向
      this.vx = Math.min(this.vx + 2.0, spd);
      this.facing = 1;
    } else {
      this.vx *= this.grounded ? 0.68 : 0.90; // 地面快速煞車
      if (Math.abs(this.vx) < 0.3) this.vx = 0;
    }

    // Jump — 可變高度，按越久跳越高
    if (input.jumpJust() && this.grounded) {
      this.vy = -14;
      this.jumpHeld = 1;
      sfx.jump();
    } else if (input.jump() && this.jumpHeld > 0 && this.vy < 0) {
      this.jumpHeld++;
      if (this.jumpHeld < 16) this.vy -= 0.3;
    } else {
      this.jumpHeld = 0;
    }

    // Gravity
    const holdingJump = input.jump() && this.jumpHeld > 0 && this.vy < 0;
    this.vy += holdingJump ? 0.40 : 0.62;
    this.vy = Math.min(this.vy, 14);

    this._moveX(map);
    this._moveYPlayer(map, sfx, game);

    // Kill zone
    if (this.y > map.height * TS + 64) this.die(sfx);

    // Walk animation
    if (this.grounded && Math.abs(this.vx) > 0.5) {
      this.walkTimer++;
      if (this.walkTimer > 5) { this.walkTimer = 0; this.walkFrame = (this.walkFrame + 1) % 3; }
    } else if (this.grounded) {
      this.walkFrame = 0;
    }
  }

  _moveYPlayer(map, sfx, game) {
    this.grounded = false;
    this.y += this.vy;

    if (this.vy >= 0) {
      const ty = Math.floor((this.bottom - 1) / TS);
      const x1 = Math.floor((this.x + 2) / TS), x2 = Math.floor((this.right - 3) / TS);
      for (let tx = x1; tx <= x2; tx++) {
        const t = map.get(tx, ty);
        if (SOLID_SET.has(t)) {
          this.y = ty*TS - this.h; this.vy = 0; this.grounded = true;
          if (t === T.FBASE) { this.reachedFlag = true; game.startFlag(sfx); }
          return;
        }
        if (t === T.LAVA) { this.die(sfx); return; }
      }
    } else {
      const ty = Math.floor(this.y / TS);
      const x1 = Math.floor((this.x + 3) / TS), x2 = Math.floor((this.right - 4) / TS);
      for (let tx = x1; tx <= x2; tx++) {
        if (map.isSolid(tx, ty)) {
          this.y = (ty+1)*TS; this.vy = 0;
          game.hitBlock(tx, ty, sfx);
          return;
        }
      }
    }
  }

  growUp(sfx) {
    if (this.state === 'small') {
      this.state = 'super';
      this.y -= (PH_BIG - PH_SM);
      sfx.powerup();
    } else if (this.state === 'super') {
      this.state = 'fire';
      sfx.powerup();
    }
  }

  getHit(sfx) {
    if (this.invincible > 0 || this.dead) return false;
    if (this.state !== 'small') {
      const wasBig = this.isBig();
      this.state = 'small';
      if (wasBig) this.y += (PH_BIG - PH_SM);
      this.invincible = 120;
      sfx.hit();
      return false;
    }
    this.die(sfx);
    return true;
  }

  die(sfx) {
    if (this.dead) return;
    this.dead = true; this.deathTimer = 0;
    this.vx = 0; this.vy = 0;
    sfx.gameOver();
  }

  draw(ctx, camX) {
    if (this.dead && this.deathTimer < 1) return;
    if (this.invincible > 0 && Math.floor(this.invincible/4) % 2) return;
    const px = this.x - camX, py = this.y + HUD_H;
    this._drawMario(ctx, px, py);
  }

  _drawMario(ctx, px, py) {
    const big  = this.isBig();
    const f    = this.facing;   // 1=right, -1=left
    const fire = this.state === 'fire';
    const wk   = this.walkFrame;
    const air  = !this.grounded;

    // 調色盤
    const HAT  = fire ? '#f0f0f0' : '#cc0000';
    const OVR  = fire ? '#cc0000' : '#0055cc';
    const RED  = '#cc0000';
    const SKIN = '#ffaa55';
    const DARK = '#5c2400';   // 頭髮/鬍子
    const SHOE = '#6b2800';
    const K    = '#000000';
    const W    = '#ffffff';

    // 快捷繪製 helper
    const d = (col, x, y, w, h) => {
      ctx.fillStyle = col;
      ctx.fillRect(px + x, py + y, w, h);
    };

    if (!big) {
      // ===== 小瑪利歐 (26 × 30) 像素風 =====
      // — 帽子 —
      d(HAT, 8,  0, 11, 4);   // 帽頂
      d(HAT, 1,  4, 24, 4);   // 帽簷（比臉寬）
      d(DARK, 1, 4,  5, 4);   // 帽簷左邊頭髮
      d(DARK, 20,4,  5, 4);   // 帽簷右邊頭髮

      // — 臉 —
      d(SKIN, 3, 8, 20, 9);   // 臉部底色
      // 耳朵（背面）
      d(SKIN, f===1 ? 1 : 22, 9, 3, 6);
      // 眼睛
      d(K,    f===1 ? 19 : 4, 9,  4, 4);
      d(W,    f===1 ? 20 : 5, 9,  2, 2); // 眼白高光
      // 大鼻子（朝前凸出）
      d(SKIN, f===1 ? 21 : 2, 12, 5, 4);

      // — 鬍子（寬且厚）—
      d(DARK, 1, 17, 24, 4);

      // — 紅色領口 —
      d(RED,  3, 21, 20, 2);

      // — 吊帶褲 —
      // 吊帶
      d(OVR,  5, 22, 5, 2);
      d(OVR, 16, 22, 5, 2);
      // 吊帶間露出紅色
      d(RED, 10, 22, 6, 2);
      // 褲子主體
      d(OVR,  4, 24, 18, 5);
      d(RED,  2, 24,  2, 5);  // 左側紅衫
      d(RED, 22, 24,  2, 5);  // 右側紅衫

      // — 腿（走路動畫）—
      const lx = [4, 3, 5][wk];    // 左腿 x 偏移
      const rx = [16, 17, 15][wk]; // 右腿 x 偏移
      d(OVR, lx, 29, 8, 3);
      d(OVR, rx, 29, 8, 3);

      // — 鞋子（朝前的鞋子較大）—
      const frontX = f===1 ? rx+2  : lx-2;
      const backX  = f===1 ? lx-2  : rx+2;
      d(SHOE, frontX, 31, 11, 4);  // 前鞋（大）
      d(SHOE, backX,  31,  8, 4);  // 後鞋（小）

      // — 手臂（朝前方向）—
      d(SKIN, f===1 ? 22 : -4, 22, 6, 8);

    } else {
      // ===== 大瑪利歐 (26 × 46) 像素風 =====
      // — 帽子 —
      d(HAT,  6,  0, 14, 6);   // 帽頂
      d(HAT,  1,  5, 24, 6);   // 帽簷
      d(DARK, 1,  5,  6, 6);
      d(DARK, 20, 5,  5, 6);

      // — 臉 —
      d(SKIN, 2, 11, 22, 14);
      // 耳朵
      d(SKIN, f===1 ? 0 : 23, 13, 3, 8);
      // 眼睛
      d(K,    f===1 ? 19 : 3, 12, 5, 5);
      d(W,    f===1 ? 20 : 4, 12, 3, 2);  // 高光
      // 大鼻子
      d(SKIN, f===1 ? 22 : 1, 17, 5, 6);

      // — 鬍子 —
      d(DARK, 2, 25, 22, 5);

      // — 紅色領口 —
      d(RED,  2, 30, 22, 3);

      // — 吊帶褲 —
      d(OVR,  5, 33,  6, 5);
      d(OVR, 15, 33,  6, 5);
      d(RED, 11, 33,  4, 4);
      // 褲子主體
      d(OVR,  4, 38, 18, 6);
      d(RED,  2, 38,  2, 6);
      d(RED, 22, 38,  2, 6);

      // — 腿 —
      const lx2 = [3, 2, 4][wk];
      const rx2 = [15,16,14][wk];
      d(OVR, lx2, 44, 10, 4);
      d(OVR, rx2, 44, 10, 4);

      // — 鞋子 —
      const fxB = f===1 ? rx2+2  : lx2-2;
      const bxB = f===1 ? lx2-2  : rx2+2;
      d(SHOE, fxB, 47, 14, 5);
      d(SHOE, bxB, 47, 10, 5);

      // — 手臂 —
      d(SKIN, f===1 ? 22 : -4, 33, 7, 12);
    }
  }
}

// ---- 敵人 ENEMIES ----
class Enemy extends Entity {
  constructor(tx, ty, w, h) {
    super(tx*TS + (TS-w)/2, ty*TS + (TS-h), w, h);
    this.dying = false;
    this.dyingTimer = 0;
    this.stompable = true;
    this.shootable = true;
  }

  baseUpdate(map) {
    if (this.dead) return false;
    if (this.dying) {
      this.dyingTimer++;
      this.vy += 0.5;
      this.y += this.vy;
      if (this.dyingTimer > 80) this.dead = true;
      return false;
    }
    this.vy = Math.min(this.vy + 0.55, 14);
    return true;
  }

  turnAtWall(map) {
    if (this.vx < 0) {
      const tx = Math.floor(this.x / TS);
      const y1 = Math.floor((this.y + 2) / TS), y2 = Math.floor((this.bottom-3)/TS);
      for (let ty = y1; ty <= y2; ty++) {
        if (map.isSolid(tx, ty)) { this.x = (tx+1)*TS; this.vx = -this.vx; return; }
      }
    } else if (this.vx > 0) {
      const tx = Math.floor((this.right-1)/TS);
      const y1 = Math.floor((this.y+2)/TS), y2 = Math.floor((this.bottom-3)/TS);
      for (let ty = y1; ty <= y2; ty++) {
        if (map.isSolid(tx, ty)) { this.x = tx*TS - this.w; this.vx = -this.vx; return; }
      }
    }
    if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); }
  }

  turnAtLedge(map) {
    if (!this.grounded) return;
    if (this.vx < 0) {
      const tx = Math.floor(this.x/TS), ty = Math.floor(this.bottom/TS);
      if (!map.isSolid(tx, ty)) this.vx = -this.vx;
    } else if (this.vx > 0) {
      const tx = Math.floor(this.right/TS), ty = Math.floor(this.bottom/TS);
      if (!map.isSolid(tx, ty)) this.vx = -this.vx;
    }
  }

  stomp(player, sfx, particles) { /* override */ }
  hitByFireball(sfx, particles) {
    this.dying = true; this.vy = -6;
    this.vx = this.vx > 0 ? 3 : -3;
    sfx.stomp();
  }

  draw(ctx, camX) {
    if (this.dead) return;
    this._draw(ctx, this.x - camX, this.y + HUD_H);
  }
  _draw(ctx, px, py) {}
}

// --- 栗寶寶 Goomba ---
class Goomba extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 28, 28);
    this.vx = -1.5;
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.flat = false;
    this.flatTimer = 0;
  }

  update(map, sfx, particles) {
    if (this.flat) {
      this.flatTimer++;
      if (this.flatTimer > 40) this.dead = true;
      return;
    }
    if (!this.baseUpdate(map)) return;
    this.x += this.vx;
    this.turnAtWall(map);
    this._moveY(map);
    this.turnAtLedge(map);
    if (this.y > map.height*TS + 64) this.dead = true;

    this.walkTimer++;
    if (this.walkTimer > 10) { this.walkTimer = 0; this.walkFrame ^= 1; }
  }

  stomp(player, sfx, particles) {
    this.flat = true;
    this.flatTimer = 0;
    sfx.stomp();
    particles.emit(this.cx, this.y + this.h/2, '#8c3800', 6, 3);
    particles.score(this.cx, this.y, 100);
  }

  _draw(ctx, px, py) {
    if (this.flat) {
      // Flat squished goomba
      ctx.fillStyle = '#8c3800';
      ctx.fillRect(px, py + this.h - 8, this.w, 8);
      ctx.fillStyle = '#5c1800';
      ctx.fillRect(px+2, py + this.h - 6, this.w-4, 4);
      // X eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(px+6, py+this.h-12, 4, 4);
      ctx.fillRect(px+this.w-10, py+this.h-12, 4, 4);
      return;
    }
    const w = this.w, h = this.h;
    // Body (mushroom cap shape)
    ctx.fillStyle = '#8c3800';
    ctx.fillRect(px+2, py, w-4, h*0.65);
    ctx.fillRect(px, py+h*0.35, w, h*0.65);
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(px+3, py+8, 8, 6);
    ctx.fillRect(px+w-11, py+8, 8, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(px+5, py+9, 4, 4);
    ctx.fillRect(px+w-9, py+9, 4, 4);
    // Angry brow
    ctx.fillStyle = '#5c1800';
    ctx.fillRect(px+3, py+6, 8, 3);
    ctx.fillRect(px+w-11, py+6, 8, 3);
    // Feet
    ctx.fillStyle = '#5c1800';
    if (this.walkFrame === 0) {
      ctx.fillRect(px, py+h-8, 12, 8);
      ctx.fillRect(px+w-10, py+h-6, 10, 6);
    } else {
      ctx.fillRect(px, py+h-6, 10, 6);
      ctx.fillRect(px+w-12, py+h-8, 12, 8);
    }
  }
}

// --- 烏龜 Koopa ---
class Koopa extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 28, 40);
    this.vx = -1.5;
    this.inShell = false;
    this.shellKicked = false;
    this.shellTimer = 0;
    this.walkFrame = 0;
    this.walkTimer = 0;
  }

  update(map, sfx, particles) {
    if (this.inShell) {
      if (!this.shellKicked) {
        this.shellTimer++;
        if (this.shellTimer > 180) { // wake up
          this.inShell = false;
          this.shellKicked = false;
          this.vx = -1.5;
        }
        this.vy = Math.min(this.vy + 0.55, 14);
        this._moveY(map);
        return;
      }
      // Shell sliding
      if (!this.baseUpdate(map)) return;
      this.x += this.vx;
      this.turnAtWall(map);
      this._moveY(map);
      if (this.y > map.height*TS + 64) this.dead = true;
      return;
    }
    if (!this.baseUpdate(map)) return;
    this.x += this.vx;
    this.turnAtWall(map);
    this._moveY(map);
    this.turnAtLedge(map);
    if (this.y > map.height*TS + 64) this.dead = true;

    this.walkTimer++;
    if (this.walkTimer > 10) { this.walkTimer = 0; this.walkFrame ^= 1; }
  }

  stomp(player, sfx, particles) {
    if (!this.inShell) {
      this.inShell = true;
      this.shellKicked = false;
      this.shellTimer = 0;
      this.vx = 0; this.vy = 0;
      this.h = 28;
      this.y += 12;
      sfx.stomp();
      particles.score(this.cx, this.y, 200);
    } else if (!this.shellKicked) {
      // Kick shell
      const dir = player.cx > this.cx ? -1 : 1;
      this.vx = dir * 8;
      this.shellKicked = true;
      sfx.kick();
      particles.score(this.cx, this.y, 400);
    } else {
      // Stop shell
      this.vx = 0;
      this.shellKicked = false;
      this.shellTimer = 0;
      sfx.stomp();
    }
  }

  checkShellCollision(other, sfx, particles) {
    if (!this.shellKicked) return false;
    if (other === this) return false;
    if (other.dead || other.dying) return false;
    if (this.overlaps(other)) {
      other.dying = true;
      other.vy = -7;
      sfx.stomp();
      particles.emit(other.cx, other.cy, '#00a800', 6);
      particles.score(other.cx, other.y, 500);
      return true;
    }
    return false;
  }

  _draw(ctx, px, py) {
    const w = this.w;
    if (this.inShell) {
      const sh = this.h;
      // Shell
      ctx.fillStyle = '#00a800';
      ctx.fillRect(px+2, py, w-4, sh);
      ctx.fillStyle = '#007000';
      ctx.fillRect(px+2, py, w-4, sh/2);
      ctx.fillStyle = '#00cc00';
      ctx.fillRect(px+6, py+3, 6, sh-6);
      // Shell pattern
      ctx.strokeStyle = '#005000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px+w/2, py+2); ctx.lineTo(px+w/2, py+sh-2);
      ctx.moveTo(px+4, py+sh/2); ctx.lineTo(px+w-4, py+sh/2);
      ctx.stroke();
      // Eyes if waking
      if (this.shellTimer > 140) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(px+4, py+4, 6, 5);
        ctx.fillRect(px+w-10, py+4, 6, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(px+6, py+5, 3, 3);
        ctx.fillRect(px+w-8, py+5, 3, 3);
      }
      return;
    }
    // Standing Koopa
    // Shell/body
    ctx.fillStyle = '#00a800';
    ctx.fillRect(px+2, py+8, w-4, 24);
    // Shell highlight
    ctx.fillStyle = '#00cc00';
    ctx.fillRect(px+6, py+10, 6, 18);
    // Head
    ctx.fillStyle = '#fcbc3c'; // skin
    ctx.fillRect(px+4, py, w-8, 12);
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(px+6, py+2, 6, 5);
    ctx.fillRect(px+w-12, py+2, 6, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(px+8, py+3, 3, 3);
    ctx.fillRect(px+w-10, py+3, 3, 3);
    // Legs
    ctx.fillStyle = '#007000';
    if (this.walkFrame === 0) {
      ctx.fillRect(px+2, py+32, 8, 8);
      ctx.fillRect(px+w-8, py+34, 8, 6);
    } else {
      ctx.fillRect(px+2, py+34, 8, 6);
      ctx.fillRect(px+w-8, py+32, 8, 8);
    }
  }
}

// --- 食人花 PiranhaPlant ---
class PiranhaPlant extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 24, 36);
    this.x = tx * TS + 4;
    this.baseY = ty * TS;
    this.timer = Math.random() * 120 | 0;
    this.phase = 'down'; // down | up
    this.vx = 0;
    this.stompable = false;
    this.mouthOpen = false;
  }

  update(map) {
    if (this.dead) return;
    this.timer++;
    const cycle = 160;
    const t = this.timer % cycle;
    if (t < 20) {
      this.phase = 'down';
      this.y = this.baseY + (20-t)/20 * this.h;
    } else if (t < cycle/2) {
      this.phase = 'up';
      this.y = this.baseY;
    } else if (t < cycle/2 + 20) {
      this.phase = 'down';
      this.y = this.baseY + (t - cycle/2)/20 * this.h;
    } else {
      this.phase = 'down';
      this.y = this.baseY + this.h;
    }
    this.mouthOpen = (t > 30 && t < cycle/2 - 10);
  }

  stomp() { /* can't stomp piranha */ }

  hitByFireball(sfx, particles) {
    this.dead = true;
    sfx.stomp();
    particles.emit(this.cx, this.cy, '#00a800', 8);
    particles.score(this.cx, this.y, 200);
  }

  _draw(ctx, px, py) {
    if (this.phase === 'down' && this.y > this.baseY + this.h * 0.5) return;
    const w = this.w, h = this.h;
    // Stem
    ctx.fillStyle = '#00a800';
    ctx.fillRect(px + w/2 - 4, py + h - 12, 8, 12);
    // Head
    ctx.fillStyle = '#e80000';
    ctx.fillRect(px, py, w, h - 12);
    // White spots
    ctx.fillStyle = '#fff';
    ctx.fillRect(px+3, py+4, 5, 5);
    ctx.fillRect(px+w-8, py+4, 5, 5);
    ctx.fillRect(px+5, py+14, 4, 4);
    ctx.fillRect(px+w-9, py+14, 4, 4);
    // Mouth
    if (this.mouthOpen) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(px+2, py+h/2, w-4, h/2 - 14);
      // Teeth
      ctx.fillStyle = '#e80000';
      ctx.fillRect(px+4, py+h/2, 5, 5);
      ctx.fillRect(px+12, py+h/2, 5, 5);
      ctx.fillRect(px+w-9, py+h/2, 5, 5);
    } else {
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(px+2, py+h/2-2, w-4, 4);
    }
  }
}

// --- BOSS 庫巴 ---
class Boss extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 64, 64);
    this.maxHp = 3;
    this.hp = this.maxHp;
    this.vx = -2;
    this.jumpTimer = 0;
    this.stompable = true;
    this.shootable = true;
    this.fireTimer = 0;
    this.fireballs = [];
    this.hitFlash = 0;
    this.phase = 1; // 1=normal, 2=fast (hp<=1)
  }

  update(map, sfx, particles) {
    if (this.dead) return;
    if (this.dying) {
      this.dyingTimer++;
      this.vy += 0.3;
      this.y += this.vy;
      this.x += this.vx;
      this.hitFlash = Math.max(0, this.hitFlash - 1);
      if (this.dyingTimer > 120) { this.dead = true; sfx.bossDie(); }
      return;
    }
    this.hitFlash = Math.max(0, this.hitFlash - 1);

    const spd = this.hp <= 1 ? 3.5 : 2;
    if (Math.abs(this.vx) < 0.1) this.vx = -spd;

    this.vy = Math.min(this.vy + 0.55, 14);
    this.x += this.vx;
    this.turnAtWall(map);
    this._moveY(map);
    this.turnAtLedge(map);

    if (this.y > map.height*TS + 64) { this.dead = true; return; }

    // Jump periodically
    this.jumpTimer++;
    const jumpInterval = this.hp <= 1 ? 60 : 90;
    if (this.jumpTimer > jumpInterval && this.grounded) {
      this.vy = -12; this.jumpTimer = 0;
    }

    // Shoot fireballs
    this.fireTimer++;
    const fireInterval = this.hp <= 1 ? 80 : 130;
    if (this.fireTimer > fireInterval) {
      this.fireTimer = 0;
      this.fireballs.push(new BossFireball(this.cx, this.y + 20, this.vx > 0 ? 5 : -5));
      sfx.fireball && sfx.fireball();
    }

    // Update own fireballs
    for (const fb of this.fireballs) fb.update(map);
    this.fireballs = this.fireballs.filter(fb => !fb.dead);
  }

  stomp(player, sfx, particles) {
    this.hp--;
    this.hitFlash = 30;
    sfx.bossHit();
    particles.emit(this.cx, this.cy, '#e80000', 10, 5);
    particles.score(this.cx, this.y, 1000);
    if (this.hp <= 0) {
      this.dying = true; this.vy = -8; this.vx = this.vx > 0 ? 4 : -4;
      sfx.bossDie();
      particles.emit(this.cx, this.cy, '#ff8800', 20, 8);
    } else {
      this.vx = -this.vx;
    }
  }

  hitByFireball(sfx, particles) {
    this.stomp(null, sfx, particles);
  }

  checkFireballHit(player, sfx) {
    for (const fb of this.fireballs) {
      if (!fb.dead && player.overlaps(fb)) {
        fb.dead = true;
        return true;
      }
    }
    return false;
  }

  _draw(ctx, px, py) {
    if (this.hitFlash > 0 && Math.floor(this.hitFlash/3) % 2) {
      ctx.globalAlpha = 0.5;
    }
    const w = this.w, h = this.h;
    // Body
    ctx.fillStyle = '#c00000';
    ctx.fillRect(px+6, py+20, w-12, h-20);
    // Shell/back
    ctx.fillStyle = '#007000';
    ctx.fillRect(px+8, py+24, w-16, h-30);
    ctx.fillStyle = '#00a800';
    ctx.fillRect(px+12, py+28, w-24, h-40);
    // Head
    ctx.fillStyle = '#c00000';
    ctx.fillRect(px+10, py, w-20, 26);
    // Snout
    ctx.fillStyle = '#e04000';
    ctx.fillRect(px+14, py+14, w-28, 12);
    // Eyes
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(px+12, py+4, 10, 10);
    ctx.fillRect(px+w-22, py+4, 10, 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(px+15, py+6, 5, 6);
    ctx.fillRect(px+w-20, py+6, 5, 6);
    // Eyebrows (angry)
    ctx.fillStyle = '#800000';
    ctx.fillRect(px+11, py+2, 12, 4);
    ctx.fillRect(px+w-23, py+2, 12, 4);
    // Horns
    ctx.fillStyle = '#e8c000';
    ctx.fillRect(px+8, py-8, 8, 12);
    ctx.fillRect(px+w-16, py-8, 8, 12);
    // Teeth
    ctx.fillStyle = '#fff';
    ctx.fillRect(px+16, py+20, 6, 8);
    ctx.fillRect(px+24, py+20, 6, 6);
    ctx.fillRect(px+w-22, py+20, 6, 6);
    ctx.fillRect(px+w-14, py+20, 6, 8);
    // Arms
    ctx.fillStyle = '#c00000';
    ctx.fillRect(px-4, py+22, 14, 20);
    ctx.fillRect(px+w-10, py+22, 14, 20);
    // Claws
    ctx.fillStyle = '#e8c000';
    ctx.fillRect(px-6, py+36, 6, 8);
    ctx.fillRect(px-2, py+42, 6, 8);
    ctx.fillRect(px+w+0, py+36, 6, 8);
    ctx.fillRect(px+w-4, py+42, 6, 8);
    // HP bar
    if (this.hp > 0) {
      ctx.fillStyle = '#000';
      ctx.fillRect(px, py - 14, w, 8);
      ctx.fillStyle = this.hp > 1 ? '#00e800' : '#e80000';
      ctx.fillRect(px+1, py-13, (w-2) * this.hp / this.maxHp, 6);
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx, camX) {
    if (this.dead && !this.dying) return;
    const px = this.x - camX, py = this.y + HUD_H;
    this._draw(ctx, px, py);
    for (const fb of this.fireballs) {
      if (!fb.dead) fb.draw(ctx, camX);
    }
  }
}

class BossFireball extends Entity {
  constructor(x, y, vx) {
    super(x-8, y-8, 16, 16);
    this.vx = vx; this.vy = -2;
    this.frame = 0;
  }
  update(map) {
    this.vy = Math.min(this.vy + 0.3, 6);
    this.x += this.vx; this.y += this.vy;
    this.frame++;
    const ty = Math.floor((this.bottom) / TS), tx = this.vx > 0 ? Math.floor(this.right/TS) : Math.floor(this.x/TS);
    if (map.isSolid(tx, Math.floor(this.cy/TS))) { this.dead = true; return; }
    if (this.y > map.height*TS + 100 || this.x < -100) this.dead = true;
  }
  draw(ctx, camX) {
    const px = this.x - camX, py = this.y + HUD_H;
    const r = 7 + Math.sin(this.frame*0.4)*2;
    ctx.fillStyle = `hsl(${this.frame*20 % 60 + 10}, 100%, 50%)`;
    ctx.beginPath(); ctx.arc(px+8, py+8, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px+8, py+8, r*0.5, 0, Math.PI*2); ctx.fill();
  }
}

// ---- 火球 FIREBALL ----
class Fireball extends Entity {
  constructor(x, y, dir) {
    super(x, y, 12, 12);
    this.vx = dir * 9;
    this.vy = -3;
    this.bounces = 0;
    this.frame = 0;
    this.dir = dir;
  }

  update(map) {
    this.frame++;
    this.vy = Math.min(this.vy + 0.5, 8);
    this.x += this.vx; this.y += this.vy;

    // Bounce on floor
    const ty = Math.floor((this.bottom) / TS);
    const tx = this.dir > 0 ? Math.floor(this.right/TS) : Math.floor(this.x/TS);
    const tyCur = Math.floor(this.cy/TS);

    if (map.isSolid(tx, tyCur)) { this.dead = true; return; }

    for (let dtx = Math.floor(this.x/TS); dtx <= Math.floor(this.right/TS); dtx++) {
      if (map.isSolid(dtx, ty)) {
        this.y = ty*TS - this.h;
        this.vy = -7;
        this.bounces++;
        if (this.bounces > 4) this.dead = true;
        break;
      }
    }

    if (this.x < 0 || this.x > map.width*TS || this.y > map.height*TS + 100) this.dead = true;
  }

  draw(ctx, camX) {
    const px = this.x - camX, py = this.y + HUD_H;
    ctx.fillStyle = `hsl(${this.frame*30 % 60 + 10}, 100%, 60%)`;
    ctx.beginPath(); ctx.arc(px+6, py+6, 6+Math.sin(this.frame*0.5), 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px+4, py+4, 3, 0, Math.PI*2); ctx.fill();
  }
}

// ---- 道具 ITEMS ----
class Item extends Entity {
  constructor(tx, ty, w, h) {
    super(tx*TS + (TS-w)/2, ty*TS, w, h);
    this.vx = 1.5;
    this.vy = -4;
    this.collected = false;
    this.emerged = false;
    this.emergeY = ty*TS;
    this.startY = (ty+1)*TS;
    this.y = this.startY;
    this.emergeTimer = 0;
  }

  update(map) {
    if (this.collected || this.dead) return;
    if (!this.emerged) {
      this.emergeTimer++;
      this.y = this.startY - (this.emergeTimer / 20) * TS;
      if (this.emergeTimer >= 20) { this.emerged = true; this.y = this.emergeY; }
      return;
    }
    this.vy = Math.min(this.vy + 0.55, 12);
    this.x += this.vx;
    this.turnAtWall(map);
    this._moveX(map);
    this._moveY(map);
    if (this.y > map.height*TS + 100) this.dead = true;
  }

  turnAtWall(map) {
    if (this.vx < 0) {
      const tx = Math.floor(this.x/TS);
      if (map.isSolid(tx, Math.floor(this.cy/TS))) this.vx = -this.vx;
    } else {
      const tx = Math.floor(this.right/TS);
      if (map.isSolid(tx, Math.floor(this.cy/TS))) this.vx = -this.vx;
    }
    if (this.x < 0) this.vx = Math.abs(this.vx);
  }

  draw(ctx, camX) {
    if (this.collected || this.dead) return;
    this._draw(ctx, this.x - camX, this.y + HUD_H);
  }
  _draw(ctx, px, py) {}
}

class Mushroom extends Item {
  constructor(tx, ty) { super(tx, ty, 26, 26); }
  _draw(ctx, px, py) {
    const w = this.w, h = this.h;
    // Cap
    ctx.fillStyle = '#e80000';
    ctx.fillRect(px+2, py, w-4, h*0.6);
    ctx.beginPath(); ctx.arc(px+w/2, py+h*0.4, w/2, 0, Math.PI, true); ctx.fill();
    // Spots
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px+7, py+7, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px+w-7, py+7, 4, 0, Math.PI*2); ctx.fill();
    // Stem
    ctx.fillStyle = '#fcbc3c';
    ctx.fillRect(px+4, py+h*0.5, w-8, h*0.5);
    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(px+7, py+h*0.6, 4, 4);
    ctx.fillRect(px+w-11, py+h*0.6, 4, 4);
  }
}

class FireFlower extends Item {
  constructor(tx, ty) { super(tx, ty, 24, 28); this.vx = 0; }
  update(map) {
    if (this.collected || this.dead) return;
    if (!this.emerged) {
      this.emergeTimer++;
      this.y = this.startY - (this.emergeTimer/20)*TS;
      if (this.emergeTimer >= 20) { this.emerged = true; this.y = this.emergeY; }
    }
  }
  _draw(ctx, px, py) {
    const f = Math.floor(Date.now()/100) % 3;
    const colors = ['#ff8800','#e80000','#ff4400'];
    // Petals
    ctx.fillStyle = colors[f];
    [[0,-8],[8,0],[0,8],[-8,0]].forEach(([dx,dy]) => {
      ctx.beginPath(); ctx.arc(px+12+dx, py+8+dy, 5, 0, Math.PI*2); ctx.fill();
    });
    // Center
    ctx.fillStyle = '#ffff00';
    ctx.beginPath(); ctx.arc(px+12, py+8, 5, 0, Math.PI*2); ctx.fill();
    // Stem
    ctx.fillStyle = '#00a800';
    ctx.fillRect(px+10, py+12, 4, 16);
    // Leaf
    ctx.fillStyle = '#00c800';
    ctx.fillRect(px+4, py+18, 8, 5);
  }
}

class StarPop extends Item {
  constructor(tx, ty) { super(tx, ty, 24, 24); this.vx = 2; this.vy = -10; }
  update(map) {
    if (this.dead) return;
    this.vy = Math.min(this.vy + 0.4, 8);
    this.x += this.vx; this.y += this.vy;
    this.turnAtWall(map);
    if (this.grounded) { this.vy = -8; }
    this._moveX(map); this._moveY(map);
    if (this.y > map.height*TS + 100) this.dead = true;
  }
  _draw(ctx, px, py) {
    const a = Date.now()*0.01;
    const colors = ['#ffd700','#ff8800','#ff4400','#ffff00'];
    ctx.fillStyle = colors[Math.floor(a) % colors.length];
    // Star shape
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI / 5) - Math.PI/2 + a*0.1;
      const x1 = px+12 + Math.cos(angle)*12;
      const y1 = py+12 + Math.sin(angle)*12;
      const angle2 = ((i+0.5) * 4 * Math.PI / 5) - Math.PI/2 + a*0.1;
      const x2 = px+12 + Math.cos(angle2)*5;
      const y2 = py+12 + Math.sin(angle2)*5;
      if (i === 0) ctx.beginPath();
      if (i === 0) { ctx.moveTo(x1,y1); } else { ctx.lineTo(x1,y1); }
      ctx.lineTo(x2,y2);
    }
    ctx.closePath(); ctx.fill();
  }
}

// ---- 關卡資料 LEVELS ----

function makeLevel(w, h) {
  return new Uint8Array(w * h);
}

function buildLevel1() {
  const W = 104, H = 14;
  const d = makeLevel(W, H);
  const s = (tx, ty, t) => { if (tx>=0&&tx<W&&ty>=0&&ty<H) d[ty*W+tx]=t; };
  const row = (ty, x1, x2, t) => { for (let x=x1;x<=x2;x++) s(x,ty,t); };
  const ground = (x1,x2) => { row(12,x1,x2,T.GROUND); row(13,x1,x2,T.GROUND); };
  const pipe = (tx, ph) => {
    s(tx,12-ph,T.PIPE_TL); s(tx+1,12-ph,T.PIPE_TR);
    for (let y=12-ph+1;y<=12;y++) { s(tx,y,T.PIPE_BL); s(tx+1,y,T.PIPE_BR); }
  };

  // Ground sections (with gaps)
  ground(0, 26);
  ground(29, 40);
  ground(43, 56);
  ground(59, 70);
  ground(73, 103);

  // Pipes
  pipe(20, 2);
  pipe(46, 3);
  pipe(64, 2);

  // Question blocks (row 8)
  s(16,8,T.QBLOCK); s(20,8,T.QBLOCK); s(22,8,T.QBLOCK); s(24,8,T.QBLOCK);

  // Single question block with mushroom
  s(55, 6, T.QBLOCK);

  // Brick row
  s(49,8,T.BRICK); s(50,8,T.BRICK); s(51,8,T.BRICK);
  s(33,8,T.BRICK); s(35,8,T.BRICK);

  // Elevated platform
  row(9, 75, 80, T.SOLID);

  // Staircase going up
  for (let i=0;i<4;i++) for (let j=0;j<=i;j++) s(87+i, 12-j, T.SOLID);
  // Staircase going down
  for (let i=0;i<4;i++) for (let j=0;j<=3-i;j++) s(92+i, 12-j, T.SOLID);

  // Coins
  [17,18,19].forEach(tx => s(tx, 7, T.COIN_T));
  [21,23].forEach(tx => s(tx, 7, T.COIN_T));
  [60,61,62].forEach(tx => s(tx, 10, T.COIN_T));

  // Flag pole
  for (let y=2;y<=12;y++) s(100, y, T.FPOLE);
  s(100, 12, T.FBASE);

  const enemies = [
    { type:'goomba', tx:14, ty:11 },
    { type:'goomba', tx:31, ty:11 },
    { type:'goomba', tx:33, ty:11 },
    { type:'goomba', tx:44, ty:11 },
    { type:'koopa',  tx:60, ty:11 },
    { type:'goomba', tx:76, ty:11 },
    { type:'koopa',  tx:84, ty:11 },
  ];

  const qContents = { '55,6':'mushroom', '16,8':'coin', '20,8':'coin', '22,8':'coin', '24,8':'coin' };

  return { data: d, width: W, height: H, theme: 'grass', enemies, qContents, playerStart:{tx:2,ty:11}, name:'第一關 - 綠野平原' };
}

function buildLevel2() {
  const W = 120, H = 14;
  const d = makeLevel(W, H);
  const s = (tx,ty,t) => { if(tx>=0&&tx<W&&ty>=0&&ty<H) d[ty*W+tx]=t; };
  const row = (ty,x1,x2,t) => { for(let x=x1;x<=x2;x++) s(x,ty,t); };
  const ground=(x1,x2)=>{ row(12,x1,x2,T.GROUND); row(13,x1,x2,T.GROUND); };
  const pipe=(tx,ph)=>{ s(tx,12-ph,T.PIPE_TL);s(tx+1,12-ph,T.PIPE_TR); for(let y=12-ph+1;y<=12;y++){s(tx,y,T.PIPE_BL);s(tx+1,y,T.PIPE_BR);} };
  const platform=(ty,x1,x2)=>row(ty,x1,x2,T.SOLID);

  // Continuous ceiling
  row(0, 0, 119, T.SOLID);
  row(1, 0, 119, T.SOLID);

  // Ground (mostly continuous underground)
  ground(0, 119);

  // Platforms (underground maze-like)
  platform(10, 5, 12);
  platform(8, 15, 22);
  platform(6, 10, 16);
  platform(9, 25, 32);
  platform(7, 35, 42);
  platform(5, 38, 44);
  platform(8, 50, 58);
  platform(6, 55, 62);
  platform(10, 65, 72);
  platform(7, 70, 78);
  platform(5, 75, 82);
  platform(9, 85, 92);
  platform(7, 95, 102);

  // Pipes with piranhas
  pipe(30, 3);
  pipe(60, 3);
  pipe(90, 3);

  // Brick formations (ceiling area)
  [6,7,8,9,10].forEach(tx => s(tx,3,T.BRICK));
  [18,19,20,21].forEach(tx => s(tx,4,T.BRICK));
  [40,41,42].forEach(tx => s(tx,3,T.BRICK));
  [70,71,72,73].forEach(tx => s(tx,4,T.BRICK));
  [100,101,102].forEach(tx => s(tx,3,T.BRICK));

  // Question blocks
  s(14,5,T.QBLOCK); s(48,6,T.QBLOCK); s(80,6,T.QBLOCK);
  s(20,4,T.QBLOCK); // fire flower

  // Coin rows
  for (let tx=3;tx<=8;tx++) s(tx,11,T.COIN_T);
  for (let tx=35;tx<=40;tx++) s(tx,6,T.COIN_T);
  for (let tx=65;tx<=70;tx++) s(tx,11,T.COIN_T);
  for (let tx=95;tx<=100;tx++) s(tx,11,T.COIN_T);

  // Flag pole
  for (let y=2;y<=12;y++) s(116,y,T.FPOLE);
  s(116,12,T.FBASE);

  const enemies = [
    {type:'koopa', tx:8, ty:11},
    {type:'goomba', tx:18, ty:11},
    {type:'goomba', tx:19, ty:11},
    {type:'koopa', tx:35, ty:11},
    {type:'piranha', tx:30, ty:9},
    {type:'goomba', tx:45, ty:11},
    {type:'koopa', tx:55, ty:11},
    {type:'piranha', tx:60, ty:9},
    {type:'goomba', tx:68, ty:11},
    {type:'koopa', tx:75, ty:11},
    {type:'piranha', tx:90, ty:9},
    {type:'goomba', tx:92, ty:11},
    {type:'koopa', tx:100, ty:11},
    {type:'goomba', tx:108, ty:11},
  ];

  const qContents = { '14,5':'coin', '48,6':'coin', '80,6':'coin', '20,4':'flower' };

  return { data: d, width: W, height: H, theme: 'underground', enemies, qContents, playerStart:{tx:2,ty:11}, name:'第二關 - 地下迷宮' };
}

function buildLevel3() {
  const W = 100, H = 14;
  const d = makeLevel(W, H);
  const s = (tx,ty,t) => { if(tx>=0&&tx<W&&ty>=0&&ty<H) d[ty*W+tx]=t; };
  const row = (ty,x1,x2,t) => { for(let x=x1;x<=x2;x++) s(x,ty,t); };
  const ground=(x1,x2)=>{ row(12,x1,x2,T.CASTLE); row(13,x1,x2,T.CASTLE); };
  const castle=(x1,x2,y1,y2)=>{ for(let ty=y1;ty<=y2;ty++) for(let tx=x1;tx<=x2;tx++) s(tx,ty,T.CASTLE); };

  // Ground
  ground(0, 99);

  // Castle walls
  castle(0, 5, 0, 13);    // Left wall
  castle(6, 8, 2, 6);     // Internal pillar
  castle(10, 12, 4, 13);  // Step
  castle(14, 16, 6, 13);  // Step
  castle(18, 20, 8, 13);  // Step

  // Platforms
  row(9, 25, 35, T.SOLID);
  row(7, 38, 48, T.SOLID);
  row(5, 50, 60, T.SOLID);
  row(9, 63, 72, T.SOLID);
  row(7, 75, 82, T.SOLID);

  // Lava pits
  row(13, 22, 24, T.LAVA);
  row(12, 22, 24, T.LAVA);
  row(13, 36, 37, T.LAVA);
  row(12, 36, 37, T.LAVA);
  row(13, 61, 62, T.LAVA);
  row(12, 61, 62, T.LAVA);

  // Question blocks and bricks
  s(26,6,T.QBLOCK); s(32,6,T.QBLOCK);
  s(40,4,T.QBLOCK);
  s(65,6,T.QBLOCK);
  [27,28,29].forEach(tx => s(tx,5,T.BRICK));
  [44,45,46].forEach(tx => s(tx,3,T.BRICK));

  // Coins
  [25,27,29,31,33].forEach(tx => s(tx,8,T.COIN_T));
  [40,42,44].forEach(tx => s(tx,6,T.COIN_T));
  [64,66,68].forEach(tx => s(tx,8,T.COIN_T));

  // Flag/endpoint (boss area)
  for (let y=2;y<=12;y++) s(96,y,T.FPOLE);
  s(96,12,T.FBASE);

  const enemies = [
    {type:'goomba', tx:8, ty:11},
    {type:'koopa',  tx:12, ty:11},
    {type:'goomba', tx:26, ty:8},
    {type:'koopa',  tx:40, ty:6},
    {type:'goomba', tx:50, ty:4},
    {type:'goomba', tx:52, ty:4},
    {type:'koopa',  tx:65, ty:8},
    {type:'goomba', tx:76, ty:6},
    {type:'boss',   tx:85, ty:11},
  ];

  const qContents = { '26,6':'mushroom', '32,6':'flower', '40,4':'star', '65,6':'coin' };

  return { data: d, width: W, height: H, theme: 'castle', enemies, qContents, playerStart:{tx:2,ty:11}, name:'第三關 - 庫巴城堡' };
}

// ---- 遊戲主類 GAME ----
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.sfx = new SFX();
    this.particles = new Particles();

    this.state = 'title'; // title|playing|dead|levelComplete|win
    this.levelIdx = 0;
    this.score = 0;
    this.lives = 3;
    this.coins = 0;
    this.time = 400;
    this.timeTimer = 0;
    this.stateTimer = 0;

    this.levelDefs = [buildLevel1, buildLevel2, buildLevel3];
    this.loadLevel(0);

    this.frame = 0;
    this.lastTime = 0;
    requestAnimationFrame(t => this.loop(t));
  }

  loadLevel(idx) {
    const def = this.levelDefs[idx]();
    this.map = new TileMap(def.data, def.width, def.height, def.theme);
    this.qContents = def.qContents || {};
    this.time = 400;
    this.timeTimer = 0;

    const ps = def.playerStart;
    this.player = new Player(ps.tx, ps.ty);

    this.enemies = def.enemies.map(e => {
      switch (e.type) {
        case 'goomba':  return new Goomba(e.tx, e.ty);
        case 'koopa':   return new Koopa(e.tx, e.ty);
        case 'piranha': return new PiranhaPlant(e.tx, e.ty);
        case 'boss':    return new Boss(e.tx, e.ty);
        default:        return new Goomba(e.tx, e.ty);
      }
    });

    this.items = [];
    this.fireballs = [];
    this.camera = 0;
    this.flagTimer = 0;
    this.flagActive = false;
    this.levelName = def.name || ('關卡 ' + (idx+1));
  }

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.frame++;

    this.update();
    this.render();

    requestAnimationFrame(t => this.loop(t));
  }

  update() {
    if (this.state === 'title') {
      if (this.input.enter()) {
        this.state = 'playing';
        this.sfx.ac && this.sfx.ac.resume();
      }
      this.input.flush();
      return;
    }

    if (this.state === 'dead') {
      this.stateTimer++;
      this.player.update(this.input, this.map, this.sfx, this);
      if (this.stateTimer > 120) {
        this.lives--;
        if (this.lives <= 0) {
          this.state = 'gameover';
          this.stateTimer = 0;
        } else {
          this.loadLevel(this.levelIdx);
          this.state = 'playing';
        }
      }
      this.input.flush();
      return;
    }

    if (this.state === 'gameover') {
      this.stateTimer++;
      if (this.stateTimer > 180 && this.input.enter()) {
        this.lives = 3; this.score = 0; this.coins = 0;
        this.levelIdx = 0;
        this.loadLevel(0);
        this.state = 'playing';
      }
      this.input.flush();
      return;
    }

    if (this.state === 'levelComplete') {
      this.stateTimer++;
      if (this.stateTimer > 200) {
        this.levelIdx++;
        if (this.levelIdx >= this.levelDefs.length) {
          this.state = 'win';
          this.stateTimer = 0;
        } else {
          this.loadLevel(this.levelIdx);
          this.state = 'playing';
        }
      }
      this.input.flush();
      return;
    }

    if (this.state === 'win') {
      this.stateTimer++;
      if (this.stateTimer > 300 && this.input.enter()) {
        this.lives = 3; this.score = 0; this.coins = 0;
        this.levelIdx = 0;
        this.loadLevel(0);
        this.state = 'playing';
      }
      this.input.flush();
      return;
    }

    // ---- PLAYING ----
    if (this.flagActive) {
      this.flagTimer++;
      if (this.flagTimer > 150) {
        this.score += Math.max(0, this.time) * 10;
        this.time = 0;
        this.state = 'levelComplete';
        this.stateTimer = 0;
        this.sfx.levelup();
      }
      this.input.flush();
      return;
    }

    // Timer
    this.timeTimer++;
    if (this.timeTimer >= 60) { this.timeTimer = 0; this.time = Math.max(0, this.time - 1); }
    if (this.time === 0) { this.player.die(this.sfx); }

    // Shoot fireball
    if (this.player.state === 'fire' && this.player.fireballCooldown === 0) {
      if (this.input.run() && this.input.jumpJust()) {
        const dir = this.player.facing;
        const fx = dir > 0 ? this.player.right : this.player.x - 12;
        this.fireballs.push(new Fireball(fx, this.player.y + 10, dir));
        this.player.fireballCooldown = 20;
        this.sfx.fireball ? this.sfx.fireball() : this.sfx.kick();
      }
    }

    // Player
    this.player.update(this.input, this.map, this.sfx, this);

    if (this.player.dead && this.state === 'playing') {
      this.state = 'dead';
      this.stateTimer = 0;
    }

    // Enemies
    for (const e of this.enemies) {
      if (e instanceof Boss) {
        e.update(this.map, this.sfx, this.particles);
        // Boss fireballs hit player
        if (e.hp > 0 && !e.dying && e.checkFireballHit && e.checkFireballHit(this.player, this.sfx)) {
          this.player.getHit(this.sfx);
        }
      } else if (e instanceof PiranhaPlant) {
        e.update(this.map);
      } else {
        e.update(this.map, this.sfx, this.particles);
        // Shell collision with other enemies
        if (e instanceof Koopa && e.shellKicked) {
          for (const other of this.enemies) {
            if (other !== e) e.checkShellCollision(other, this.sfx, this.particles);
          }
        }
      }
    }

    // Player vs enemies
    this.player.checkEnemyCollision && this._checkPlayerEnemies();

    // Items
    for (const item of this.items) item.update(this.map);
    this._checkPlayerItems();
    this.items = this.items.filter(it => !it.dead && !it.collected);

    // Fireballs vs enemies
    for (const fb of this.fireballs) {
      fb.update(this.map);
      for (const e of this.enemies) {
        if (!fb.dead && !e.dead && !e.dying && e.shootable && fb.overlaps(e)) {
          e.hitByFireball(this.sfx, this.particles);
          fb.dead = true;
          this.score += 200;
          this.particles.score(e.cx, e.y, 200);
        }
      }
    }
    this.fireballs = this.fireballs.filter(fb => !fb.dead);

    // Collect coins on tile
    const pcx = Math.floor(this.player.cx/TS), pcy = Math.floor(this.player.cy/TS);
    for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) {
      const tx=pcx+dx, ty=pcy+dy;
      if (this.map.get(tx,ty) === T.COIN_T) {
        if (this.player.x < (tx+1)*TS && this.player.right > tx*TS &&
            this.player.y < (ty+1)*TS && this.player.bottom > ty*TS) {
          this.map.set(tx,ty,T.EMPTY);
          this.coins++;
          this.score += 100;
          this.sfx.coin();
          this.particles.emit(tx*TS+16, ty*TS+16, CLR.coin, 4, 3);
          if (this.coins % 100 === 0) { this.lives++; this.sfx.powerup(); }
        }
      }
    }

    // Clean up dead enemies
    this.enemies = this.enemies.filter(e => !e.dead);

    // Camera follow
    const targetCam = this.player.x - GW/2 + PW/2;
    this.camera += (targetCam - this.camera) * 0.12;
    this.camera = Math.max(0, Math.min(this.camera, this.map.width*TS - GW));

    this.map.update();
    this.particles.update();
    this.input.flush();
  }

  _checkPlayerEnemies() {
    const p = this.player;
    if (p.invincible > 0 || p.dead || p.reachedFlag) return;

    for (const e of this.enemies) {
      if (e.dead || e.dying) continue;
      if (!p.overlaps(e)) continue;

      const stompLine = e.y + e.h * 0.35;
      if (p.vy > 0 && p.bottom - 1 <= stompLine + 6 && p.vy > 0) {
        if (e.stompable) {
          e.stomp(p, this.sfx, this.particles);
          p.vy = p.jumpHeld > 0 ? -10 : -8;
          if (e instanceof Goomba) this.score += 100;
          else if (e instanceof Koopa) this.score += 200;
          else if (e instanceof Boss) this.score += 1000;
        } else {
          p.getHit(this.sfx);
        }
      } else {
        // Side/bottom collision — take damage
        if (!(e instanceof PiranhaPlant && e.phase === 'down')) {
          const died = p.getHit(this.sfx);
        }
      }
    }
  }

  _checkPlayerItems() {
    const p = this.player;
    for (const item of this.items) {
      if (item.collected || !item.emerged) continue;
      if (!p.overlaps(item)) continue;
      item.collected = true;
      if (item instanceof Mushroom || item instanceof StarPop) {
        p.growUp(this.sfx);
        this.score += 1000;
        this.particles.score(p.cx, p.y, 1000);
      } else if (item instanceof FireFlower) {
        if (p.state === 'small') p.state = 'super';
        p.state = 'fire';
        this.sfx.powerup();
        this.score += 1000;
        this.particles.score(p.cx, p.y, 1000);
      }
    }
  }

  hitBlock(tx, ty, sfx) {
    const tile = this.map.get(tx, ty);
    if (tile === T.QBLOCK) {
      this.map.set(tx, ty, T.USED);
      sfx.coin();
      const key = `${tx},${ty}`;
      const content = this.qContents[key] || 'coin';
      if (content === 'coin') {
        this.coins++;
        this.score += 200;
        this.particles.emit(tx*TS+16, (ty-1)*TS+8, CLR.coin, 5, 3);
        this.particles.score(tx*TS+16, ty*TS, 200);
        sfx.coin();
      } else if (content === 'mushroom') {
        const item = this.player.state === 'small' ? new Mushroom(tx, ty) : new FireFlower(tx, ty);
        this.items.push(item);
        sfx.powerup();
      } else if (content === 'flower') {
        this.items.push(new FireFlower(tx, ty));
        sfx.powerup();
      } else if (content === 'star') {
        this.items.push(new StarPop(tx, ty));
        sfx.powerup();
      }
      this.particles.emit(tx*TS+16, ty*TS, '#e8b000', 4, 2);
    } else if (tile === T.BRICK) {
      if (this.player.isBig()) {
        this.map.set(tx, ty, T.EMPTY);
        this.particles.brickPiece(tx*TS, ty*TS);
        sfx.brick();
        this.score += 50;
      } else {
        sfx.brick();
        this.particles.emit(tx*TS+16, ty*TS+16, CLR.brick, 3, 2);
      }
    }
  }

  startFlag(sfx) {
    this.flagActive = true;
    this.flagTimer = 0;
    sfx.flagpole();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, GW, GH);

    if (this.state === 'title') { this.drawTitle(ctx); return; }
    if (this.state === 'gameover') { this.drawGameOver(ctx); return; }
    if (this.state === 'win') { this.drawWin(ctx); return; }

    // Background
    this.map.drawBackground(ctx, this.camera);

    // Tiles
    this.map.draw(ctx, this.camera);

    // Items
    for (const item of this.items) item.draw(ctx, this.camera);

    // Enemies
    for (const e of this.enemies) e.draw(ctx, this.camera);

    // Fireballs
    for (const fb of this.fireballs) fb.draw(ctx, this.camera);

    // Player
    this.player.draw(ctx, this.camera);

    // Particles
    this.particles.draw(ctx, this.camera);

    // Level complete overlay
    if (this.state === 'levelComplete') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, GW, GH);
      ctx.fillStyle = '#fcd020';
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('關卡完成！', GW/2, GH/2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '20px monospace';
      ctx.fillText(`時間獎勵: +${Math.max(0,this.time)*10}`, GW/2, GH/2 + 20);
    }

    // HUD
    this.drawHUD(ctx);
  }

  drawHUD(ctx) {
    // HUD background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, GW, HUD_H);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, HUD_H-2, GW, 2);

    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px monospace';

    // Score
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'left';
    ctx.fillText('分數', 10, 13);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(this.score).padStart(7,'0'), 10, 28);

    // Coins
    ctx.fillStyle = CLR.coin;
    ctx.beginPath(); ctx.arc(105, 13, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('×' + String(this.coins).padStart(2,'0'), 116, 13);

    // Level name
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    ctx.font = '13px monospace';
    ctx.fillText(this.levelName, GW/2, 13);

    // Time
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('時間', GW - 100, 13);
    ctx.fillStyle = this.time < 100 ? '#e80000' : '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(this.time, GW - 60, 28);

    // Lives
    ctx.fillStyle = '#e80000';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('♥ × ' + this.lives, GW - 10, 13);

    // Dead/state overlay HUD
    if (this.state === 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, HUD_H, GW, GAME_H);
      ctx.fillStyle = '#e80000';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('瑪利歐倒下了！', GW/2, GH/2);
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText(`剩餘生命: ♥ × ${Math.max(0, this.lives - 1)}`, GW/2, GH/2 + 40);
    }
  }

  drawTitle(ctx) {
    // Sky background
    const grad = ctx.createLinearGradient(0, 0, 0, GH);
    grad.addColorStop(0, '#1a0050');
    grad.addColorStop(1, '#3060d8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GW, GH);

    // Stars
    ctx.fillStyle = '#fff';
    const stars = [[50,30],[120,80],[200,20],[350,60],[500,40],[650,90],[720,25],[780,70],[420,15]];
    stars.forEach(([x,y]) => {
      const s = 1.5 + Math.sin(this.frame*0.05 + x*0.1) * 0.5;
      ctx.fillRect(x-s/2, y-s/2, s, s);
    });

    // Title block decorations
    const colors = ['#e80000','#00a800','#0000cc','#e8b000'];
    for (let i=0;i<20;i++) {
      ctx.fillStyle = colors[i%4];
      ctx.fillRect(i*40, GH-40, 40, 40);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(i*40, GH-40, 40, 40);
    }

    // Logo shadow
    ctx.fillStyle = '#000';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('超級瑪利歐', GW/2 + 4, GH/2 - 80 + 4);

    // Logo
    const titleGrad = ctx.createLinearGradient(0, GH/2-140, 0, GH/2-70);
    titleGrad.addColorStop(0, '#ffd700');
    titleGrad.addColorStop(0.5, '#e80000');
    titleGrad.addColorStop(1, '#ffd700');
    ctx.fillStyle = titleGrad;
    ctx.fillText('超級瑪利歐', GW/2, GH/2 - 80);

    // Subtitle
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('打怪闖關大冒險', GW/2, GH/2 - 20);

    // Instructions
    ctx.fillStyle = `rgba(255,255,220,${0.5 + 0.5*Math.sin(this.frame*0.08)})`;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('按 Enter 開始遊戲', GW/2, GH/2 + 40);

    // Controls guide
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px monospace';
    ctx.fillText('← → 移動  |  Z / 空白 跳躍  |  X 奔跑  |  X+Z 射火球 (火焰馬力歐)', GW/2, GH/2 + 80);

    // Features
    const features = ['★ 3個精彩關卡', '★ 多種敵人 (栗寶寶、烏龜、食人花)', '★ 庫巴BOSS決戰', '★ 道具系統 (蘑菇/火焰花)'];
    ctx.fillStyle = '#cceeff';
    ctx.font = '13px monospace';
    features.forEach((f, i) => ctx.fillText(f, GW/2, GH/2 + 120 + i*22));

    // Mini mario
    this._drawMiniMario(ctx, GW/2 - 280, GH/2 - 50);
    this._drawMiniMario(ctx, GW/2 + 260, GH/2 - 50);
  }

  _drawMiniMario(ctx, x, y) {
    const t = Math.floor(this.frame/10) % 2;
    const d = (c, dx, dy, w, h) => { ctx.fillStyle = c; ctx.fillRect(x+dx, y+dy, w, h); };
    // Hat
    d('#cc0000', 4, 0, 14, 4);
    d('#cc0000', 0, 4, 26, 4);
    d('#5c2400', 0, 4, 6, 4);
    // Face
    d('#ffaa55', 2, 8, 22, 9);
    d('#000', 18, 9, 4, 4);
    d('#ffaa55', 22, 11, 5, 4);
    // Mustache
    d('#5c2400', 2, 17, 22, 4);
    // Overalls
    d('#cc0000', 2, 21, 22, 2);
    d('#0055cc', 4, 22, 18, 6);
    d('#cc0000', 2, 22, 2, 6);
    d('#cc0000', 22, 22, 2, 6);
    // Legs
    d('#0055cc', t===0?4:3, 28, 8, 4);
    d('#0055cc', t===0?16:17, 28, 8, 4);
    // Shoes
    d('#6b2800', t===0?14:15, 31, 12, 4);
    d('#6b2800', t===0?2:1, 31, 10, 4);
  }

  drawGameOver(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GW, GH);

    const flash = Math.sin(this.frame * 0.05) > 0;
    ctx.fillStyle = flash ? '#e80000' : '#ff4400';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', GW/2, GH/2 - 40);

    ctx.fillStyle = '#fff';
    ctx.font = '22px monospace';
    ctx.fillText(`最終分數: ${this.score}`, GW/2, GH/2 + 20);
    ctx.fillText(`收集金幣: ${this.coins}`, GW/2, GH/2 + 55);

    if (this.stateTimer > 180) {
      ctx.fillStyle = `rgba(255,255,200,${0.5+0.5*Math.sin(this.frame*0.1)})`;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('按 Enter 重新開始', GW/2, GH/2 + 110);
    }
  }

  drawWin(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, GH);
    grad.addColorStop(0, '#000040');
    grad.addColorStop(1, '#004000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GW, GH);

    // Fireworks
    for (let i = 0; i < 5; i++) {
      const angle = (this.frame * 0.05 + i * 1.2);
      const r = 60 + i * 20;
      const cx2 = GW/2 + Math.cos(angle) * r;
      const cy2 = GH/3 + Math.sin(angle*1.3) * 40;
      ctx.fillStyle = `hsl(${(this.frame*5 + i*72) % 360}, 100%, 60%)`;
      ctx.beginPath(); ctx.arc(cx2, cy2, 4, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('恭喜通關！', GW/2, GH/2 - 60);

    ctx.fillStyle = '#fff';
    ctx.font = '24px monospace';
    ctx.fillText(`最終分數: ${this.score}`, GW/2, GH/2 + 10);
    ctx.fillText(`收集金幣: ${this.coins}`, GW/2, GH/2 + 50);

    ctx.fillStyle = '#aaffaa';
    ctx.font = '18px monospace';
    ctx.fillText('公主已獲救！瑪利歐是真正的英雄！', GW/2, GH/2 + 90);

    if (this.stateTimer > 200) {
      ctx.fillStyle = `rgba(255,255,200,${0.5+0.5*Math.sin(this.frame*0.1)})`;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('按 Enter 再玩一次', GW/2, GH/2 + 140);
    }
  }
}

// ---- Player helper (collision with enemies) ----
Player.prototype.checkEnemyCollision = true;

// ---- INIT ----
window.addEventListener('load', () => {
  const canvas = document.getElementById('gameCanvas');
  canvas.width = GW;
  canvas.height = GH;
  // 暴露給 HTML 觸控按鍵使用
  window._mario = new Game(canvas);
});
