# Eternal

**Legends Fade. Eternal Remains.**

A Shadow Fight 2-inspired browser fighting game built with Next.js and TypeScript. Battle through a tournament of Sealers as the Shadow — a silhouette warrior fighting to break free from chains and open the gate.

## Features

- **Shadow-style combat** — Articulated silhouette fighters with punches, kicks, roundhouses, rolls, blocks, and supers
- **Dynamic soundtrack** — Procedurally generated Chinese-inspired music that intensifies with combat
- **7 unique opponents** — Each Sealer has distinct AI, stats, and fighting styles
- **7 arenas** — Sunset, Desert, Temple, Bamboo, Moonlit, Volcano, Snow
- **2-Player Versus** — Local multiplayer with split keyboard controls
- **RL Ghost** — An opponent driven by a trained PPO reinforcement learning agent
- **WebGL post-processing** — Bloom, chromatic aberration, screen shake, and impact flashes
- **Mobile touch controls** — Play on your phone with on-screen buttons
- **Combo system** — Chain hits for bonus damage and track your best combo

## Controls

| Key | Action |
|-----|--------|
| WASD / ←→ | Move |
| W / ↑ / Space | Flip-Jump |
| S / ↓ | Crouch |
| E / O | Roll |
| J / Z | Punch |
| K / X | Kick |
| I / U | Roundhouse |
| L / C / Shift | Block |
| Q | Super (when rage full) |
| ESC / P | Pause |

## Getting Started

```bash
git clone https://github.com/sankalphs/Eternal.git
cd Eternal
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## Tech Stack

- **Framework:** Next.js
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Rendering:** Canvas 2D + WebGL post-processing
- **Audio:** Web Audio API (procedural music)
- **AI:** Custom state machine + PPO reinforcement learning

## License

[MIT](LICENSE)
