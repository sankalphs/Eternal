# Shadow Fight — The Shadow's Ascension

A cinematic 2D shadow fighting game built with Next.js 16, TypeScript, Canvas2D, and WebGL. You play as the **villain** — an ancient evil unsealed after a thousand years, hunting down the last heroes of the old world.

![Shadow Fight](https://z-cdn.chatglm.cn/z-ai/static/logo.svg)

## 🎮 Features

### Combat System
- **3 attack types**: Punch (fast, low damage), Kick (medium, high knockback), Roundhouse (slow, devastating)
- **Super Move**: Rage meter fills as you deal/take damage — press `Q` when full for a screen-shaking uppercut (30 damage)
- **Block**: Reduces damage by 82%, can be held
- **Roll Dodge**: I-frames during the entire roll animation, evades all attacks
- **Flip Jump**: Acrobatic forward flip with variable height (tap=short, hold=tall)
- **Momentum Physics**: Acceleration-based movement (not instant velocity), proper friction, air control with momentum preservation

### Fighter Rendering
- **Tapered limb anatomy**: Filled capsule paths (thick at joints, thin at extremities) — not stick figures
- **4 body types**: Lean (player), Bulky (Butcher/Titan), Tall (Crane/Shogun), Hunched (Hermit) — each with distinct proportions
- **Da Vinci proportions**: ~7.6 heads tall, correct segment ratios
- **12 animation principles**: Anticipation, follow-through, ease-in/out, weight shift, hip sway
- **Motion blur**: Translucent fan copies on attacking limbs during active frames
- **WebGL post-processing**: Bloom, chromatic aberration, vignette via fragment shader

### AI System
- **Rule-based with heuristic adaptation**: 10 capabilities that scale per opponent (aggression, reaction, whiffPunish, antiAir, pressure, mixup, adaptive, rage, perfection)
- **Habit tracking**: Counts player's punches/kicks/jumps/blocks; adapts strategy (e.g. if you block >40%, AI opens with heavy attacks)
- **8 opponents** with escalating difficulty from forgiving (Lynx) to punishing (Titan)

### Story & Cinematics
- **2:22 intro cutscene** synced to "Steel on the Riverbank" — 10 acts, each a distinct painted scene with a virtual camera (different zoom/pan/tilt per shot)
- **Villain narrative**: "The Shadow's Ascension" — you are the ancient evil, the opponents are the last heroes
- **Destruction ending**: When you defeat all 8 heroes, an animated apocalypse plays — burning villages, crumbling mountains, blood-red sky, 12-line epilogue, "THE WORLD BURNS" title
- **Boss intros**: Opponent name + title flash dramatically on round 1

### Game Modes
- **Tournament**: Progress through all 8 heroes sequentially
- **2-Player Versus**: Local multiplayer — P1 (WASD+JKI+QE) vs P2 (arrows+,./;'[])
- **Free Select**: Choose any opponent + any arena
- **AI vs AI Attract Mode**: Auto-plays after 15s idle on menu

### Audio
- **Procedural Chinese-inspired soundtrack**: Erhu lead, guzheng ostinato, dizi flute, temple block, frame drum, big drum — all synthesized via Web Audio API
- **Dynamic music**: Low-HP shifts erhu to minor + adds drone; rage-full adds driving percussion
- **Impact stingers**: Per-hit-type audio SFX (punch/kick/roundhouse/block/KO)

### Environmental Hazards
- **Volcano**: Standing near edges burns you (2 HP/0.5s), embers fall from sky
- **Snow**: Reduced traction — fighters slide more
- **Temple**: Falling debris from ceiling

### Arenas (7 themed backgrounds)
Sunset, Desert, Temple, Bamboo, Moonlit, Volcano, Snow — each with unique sky gradients, silhouettes, and ambient particles

## 🕹️ Controls

### Player 1
| Action | Keys |
|--------|------|
| Move | `W` `A` `S` `D` or `←` `→` `↑` `↓` |
| Flip-Jump | `W` / `Space` (hold = higher) |
| Crouch | `S` / `↓` |
| Roll | `E` |
| Punch | `J` / `Z` |
| Kick | `K` / `X` |
| Roundhouse | `I` / `U` |
| Super (rage full) | `Q` |
| Block | `L` / `Shift` |
| Pause | `ESC` / `P` |

### Player 2 (2-Player mode)
| Action | Keys |
|--------|------|
| Move | `←` `→` `↑` `↓` |
| Punch | `,` (comma) |
| Kick | `.` (period) |
| Roundhouse | `/` (slash) |
| Roll | `;` (semicolon) |
| Block | `'` (quote) |
| Super | `]` (right bracket) |

## 🏗️ Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5
- **Rendering**: Canvas2D (game) + WebGL (post-processing)
- **Audio**: Web Audio API (procedural synthesis)
- **Styling**: Tailwind CSS 4
- **Physics**: Custom momentum-based engine
- **AI**: Rule-based state machine with habit tracking

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Story intro → Game
├── components/
│   └── game/
│       ├── ShadowFight.tsx      # Main game component
│       ├── StoryIntro.tsx       # 2:22 cinematic intro
│       └── DestructionEnding.tsx # World-burns ending
├── lib/
│   └── game/
│       ├── engine.ts       # Game engine (match flow, collisions, VFX)
│       ├── fighter.ts      # Fighter class (physics, state machine)
│       ├── ai.ts           # Enemy AI (rule-based + adaptive)
│       ├── poses.ts        # Skeletal animation keyframes
│       ├── render.ts       # Canvas rendering (fighters, backgrounds)
│       ├── audio.ts        # Procedural music + SFX
│       ├── postfx.ts       # WebGL post-processing
│       ├── story.ts        # Story beats + scene definitions
│       ├── types.ts        # TypeScript types
│       └── rl.ts           # RL agent (PPO, not active in game)
└── public/
    └── audio/
        └── steel_on_the_riverbank.mp3  # Story soundtrack
```

## 🚀 Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Open http://localhost:3000
```

## 🎯 How to Win

1. Watch the 2:22 story intro (or skip it)
2. Click **BEGIN THE HUNT** to start the tournament
3. Defeat all 8 heroes in best-of-3 rounds
4. Watch the world burn as you claim victory

## 🏆 Opponents

| # | Name | Title | Body Type | Arena |
|---|------|-------|-----------|-------|
| 1 | Lynx | The Last Apprentice | Lean | Sunset |
| 2 | Bandit | The Defector | Lean | Desert |
| 3 | Crane | The Temple Guard | Tall | Temple |
| 4 | Hermit | The Hermit | Hunched | Bamboo |
| 5 | Widow | The Nightblade | Lean | Moonlit |
| 6 | Butcher | The Colossus | Bulky | Volcano |
| 7 | Shogun | The Shogun | Tall | Snow |
| 8 | Titan | The World's Last Hope | Bulky | Moonlit |

## 📜 License

Built for a hackathon. All code is original.

---

*"No hero remains. No seal holds. No dawn comes. The world is yours — and it is ash."*
