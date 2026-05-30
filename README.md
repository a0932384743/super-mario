# 🍄 超級瑪利歐 — Super Mario Canvas Game

A browser-based Super Mario game built with pure HTML5 Canvas and vanilla JavaScript — no libraries, no frameworks, no build tools required.

**▶ Play now:** https://a0932384743.github.io/super-mario/

---

## Screenshot

```
┌─────────────────────────────────────────────────────────────┐
│  分數 0000100   🪙×03   第一關 - 綠野平原   時間 380  ♥ × 3 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│       ☁️        ☁️                    ☁️                    │
│                         [?]                                 │
│                 [B][B][B]                                   │
│         🍄                                                  │
│  ──────     ─────────  🌿🌿  ──────  🌿🌿  ───────────────  │
│             🌿🌿🌿🌿        🌿🌿🌿🌿       🌿🌿🌿🌿🌿🌿🌿🌿  │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### 🎮 Gameplay
- **3 full levels** with increasing difficulty
- **Stomp enemies** by jumping on their heads
- **Kick Koopa shells** to knock out chains of enemies
- **Break brick blocks** (Super Mario only)
- **Hit question blocks** to reveal coins, mushrooms, and flowers
- **Shoot fireballs** as Fire Mario (X + Z simultaneously)
- **Score system** — coins, stomps, time bonus on level clear
- **Lives system** — 3 lives; game over when all are lost
- **Countdown timer** — run out of time and you lose a life

### 🌍 Levels

| Level | Theme | Highlights |
|-------|-------|------------|
| 1 | 🌿 Grassland | Tutorial area, Goombas, question blocks, pipes |
| 2 | 🌑 Underground | Piranha plants, ceiling maze, more Koopas |
| 3 | 🏰 Castle | Lava pits, staircase platforms, **Bowser boss fight** |

### 👾 Enemies

| Enemy | Behavior | Defeat Method |
|-------|----------|---------------|
| 🍄 Goomba | Walks, turns at ledges | Stomp (1 hit) |
| 🐢 Koopa | Walks; retracts into shell when stomped | Stomp → kick shell |
| 🌱 Piranha Plant | Rises from pipes periodically | Fireball only |
| 👹 Bowser (Boss) | Jumps, shoots fireballs, speeds up at low HP | 3 stomps or fireballs |

### 🍄 Power-Ups

| Item | Effect |
|------|--------|
| Mushroom | Small → Super Mario (bigger hitbox, can break bricks) |
| Fire Flower | Super → Fire Mario (can shoot fireballs) |
| Star ⭐ | Immediate power-up upgrade |

---

## Controls

### ⌨️ Keyboard (Desktop)

| Key | Action |
|-----|--------|
| `← / →` or `A / D` | Move left / right |
| `Z` or `Space` or `↑` | Jump (hold longer = jump higher) |
| `X` or `Shift` | Run (hold to move faster) |
| `X` + `Z` | Shoot fireball (Fire Mario only) |
| `Enter` | Start / confirm |

### 📱 Touch (Mobile)

On-screen virtual gamepad is automatically displayed on touch devices:

```
┌────────────────────────────────────────────────┐
│  ◀  ▶         [ START ]          B      A     │
│  Left Right                      Run   Jump   │
└────────────────────────────────────────────────┘
```

- **Multi-touch supported** — hold run and tap jump simultaneously
- **Landscape mode** — control bar shrinks to preserve screen space
- **No sticky keys** — Pointer Events API with pointer capture

---

## Technical Details

### Architecture

```
super-mario/
├── index.html       # Shell, CSS, canvas scaling, touch controls
└── js/
    └── game.js      # Complete game engine (~2,200 lines)
```

### Engine Design

The entire game is written in a single JavaScript file organized into classes:

| Class | Responsibility |
|-------|---------------|
| `SFX` | Web Audio API procedural sound effects |
| `Input` | Keyboard + touch input with just-pressed detection |
| `TileMap` | Tile rendering, collision queries, level themes |
| `Particles` | Particle system (stomps, brick shards, score popups) |
| `Entity` | Base class: AABB physics, tile collision, velocity |
| `Player` | Mario physics, power-up states, variable-height jump |
| `Goomba` | Walk AI, ledge detection, flat-stomp animation |
| `Koopa` | Shell mechanic, shell kick, wake-up timer |
| `PiranhaPlant` | Sine-wave emergence from pipes |
| `Boss` | HP system, fireball spawning, phase 2 speed increase |
| `Fireball` | Bouncing projectiles (player & boss) |
| `Item` | Emerging items (Mushroom, FireFlower, Star) |
| `Game` | Game loop, state machine, camera, HUD |

### Physics

- **Separate X/Y resolution** — no corner-catching glitches
- **Variable jump height** — reduced gravity while holding jump key
- **Instant direction reversal** — zero velocity on direction change for snappy feel
- **Ground friction vs air drag** — 0.68 ground, 0.90 air

### Rendering

- Pure Canvas 2D API — no sprites or image assets
- Pixel-art style drawn entirely with `fillRect` calls
- Animated tiles: question block bob, lava wave, coin pulse
- Parallax clouds on grassland background
- Mario walk animation: 3-frame leg cycle with front/back shoe distinction

### Mobile

- Canvas auto-scales via JavaScript (`min(availW/800, availH/480)`)
- Virtual buttons use Pointer Events + `setPointerCapture` (no stuck keys)
- `100dvh` dynamic viewport for iOS Safari
- `@media (pointer: coarse)` auto-detects touch devices

---

## Running Locally

No build step needed — just open the file:

```bash
git clone https://github.com/a0932384743/super-mario.git
cd super-mario
# Option A: open directly
open index.html

# Option B: local server (recommended to avoid CORS on some browsers)
npx serve .
# then visit http://localhost:3000
```

---

## License

MIT — feel free to fork, modify, and build upon this project.
