# SHADOW FIGHT — The Shadow's Ascension

> A cinematic 2D shadow-fighting game built with **Next.js 16**, **TypeScript 5**, **Canvas2D**, and **WebGL**. You are the **villain** — an ancient evil unsealed after a thousand years — hunting down the last eight heroes of a dying world until nothing remains but ash.

![Shadow Fight](https://z-cdn.chatglm.cn/z-ai/static/logo.svg)

---

## Table of Contents
1. [Features](#-features)
2. [Controls](#-controls)
3. [Tech Stack](#-tech-stack)
4. [Architecture](#-architecture)
5. [Combat System — Deep Dive](#-combat-system--deep-dive)
6. [Fighter Rendering Pipeline](#-fighter-rendering-pipeline)
7. [AI System — Deep Dive](#-ai-system--deep-dive)
8. [Physics & Movement Model](#-physics--movement-model)
9. [Skeletal Animation System](#-skeletal-animation-system)
10. [WebGL Post-Processing](#-webgl-post-processing)
11. [Procedural Audio Engine](#-procedural-audio-engine)
12. [Story & Cinematics](#-story--cinematics)
13. [Environmental Hazards](#-environmental-hazards)
14. [Opponents](#-opponents)
15. [Project Structure](#-project-structure)
16. [Getting Started](#-getting-started)
17. [Performance & Deployment](#-performance--deployment)
18. [License](#-license)

---

## 🎮 Features

### Combat System
- **4 attack types** — Punch (`J`), Kick (`K`), Roundhouse (`I`), and a screen-shaking **Super** uppercut (`Q`) unlocked when the rage meter is full
- **Rage meter** — fills as you deal damage (+40% of damage dealt) and take damage (+80% clean / +30% blocked); unlocks the 30-damage super move
- **Block** — held guard that reduces damage by **82%** (`dmg *= 0.18`); requires correct facing
- **Roll dodge** — 0.5s tucked dive-roll with **full i-frames** for the entire animation, with a 22px vertical arc so the fighter lifts off the ground
- **Flip jump** — acrobatic forward flip with **variable height** (tap = short ~67px, hold = tall ~154px) driven by a velocity cut on key release (`vy *= 0.35`)
- **Momentum physics** — acceleration-based movement (`ACCEL = 1400 px/s²`, `FRICTION = 1600 px/s²`), not instant velocity set; preserves realistic weight and slide
- **Active-frame armor trades** — if you're hit during your own attack's active frames, you take damage but your blow still lands
- **Knockdown / getup** — heavy hits, sweeps, and lethal blows send the fighter down; invulnerable through knockdown + getup (1.4s) to prevent lockdown loops

### Fighter Rendering
- **Solid filled silhouettes** — every limb, joint, and the head are drawn with `ctx.fill()` using `#060606` (near-black) with `shadowBlur = 0` so adjacent segments blend into **one seamless shadow body** (no stick-figure outlines)
- **Tapered limb anatomy** — filled capsule paths (trapezoid body + full-circle end-caps) that are thicker at proximal joints and thinner at extremities, giving anatomically correct limbs
- **4 body types** — Lean (player), Bulky (Butcher/Titan), Tall (Crane/Shogun), Hunched (Hermit) — each scales head radius, torso/limb lengths, and limb widths
- **Da Vinci proportions** — ~7.6 heads tall, with correct segment ratios (head 12.5px, neck 9px, torso 46px, upper-arm 27px, forearm 25px, thigh 40px, shin 38px)
- **13-joint skeleton** — hip, chest, head, 2 shoulders, 2 elbows, 2 hands, 2 knees, 2 feet, all computed from pose angles via polar coordinates
- **12 animation principles** — anticipation (attack windups), follow-through (recovery frames), ease-in/out (smoothstep), weight shift (idle breathing), hip sway
- **Motion blur** — translucent fan copies on the striking limb during active frames
- **WebGL post-processing** — bloom, chromatic aberration, vignette via a custom GLSL fragment shader on a separate overlay canvas

### AI System
- **Rule-based finite state machine** with 10 capability fields that scale per opponent (aggression, blockChance, reaction, combo, whiffPunish, antiAir, pressure, mixup, adaptive, rage, perfection)
- **Habit tracking** — counts the player's punch/kick/jump/block openings; if the player blocks >40% of openings, the AI opens with heavy attacks; if the player jumps >30%, the AI pre-empts with anti-air kicks
- **Whiff-punish** — detects when a player's attack ends without connecting and dashes in to counter
- **Anti-air** — detects jump startup and meets the airborne player with a jump-kick
- **Pressure strings** — frame-tight follow-up attacks with gaps scaled by the `pressure` field
- **Mixup** — alternates fast/slow attacks (punch↔kick↔roundhouse) to break blocking
- **Rage** — when HP < 30%, aggression +0.25 and speed +0.12 (scaled by the `rage` field)
- **Perfection** — frame-perfect blocking chance for the highest-level opponents (zero reaction delay)
- **8 opponents** with escalating difficulty from forgiving (Lynx) to punishing (Titan)

### Story & Cinematics
- **2:22 intro cutscene** synced to "Steel on the Riverbank" — 10 acts, each a distinct painted scene with a **virtual camera system** (different zoom/pan/tilt per shot)
- **Villain narrative** — "The Shadow's Ascension": you are the ancient evil; the opponents are the last Sealers trying to cage you again
- **The twist** — the "hero" you appear to be died at the first gate; you're a demon wearing his memories
- **Destruction ending** — when you defeat all 8 heroes, an animated apocalypse plays: burning villages, crumbling mountains, blood-red sky, 12-line epilogue, "THE WORLD BURNS" title
- **Boss intros** — opponent name + title flash dramatically on round 1
- **Skip-to-ending** — a menu option jumps straight to the world-burns ending for demo purposes

### Game Modes
- **Tournament** — progress through all 8 heroes sequentially, best-of-3 rounds each
- **2-Player Versus** — local multiplayer: P1 (WASD + JKI + QE) vs P2 (arrows + `,./;'[]`)
- **Free Select** — choose any opponent + any arena
- **AI vs AI Attract Mode** — auto-plays after 15s idle on the menu

### Audio
- **Procedural Chinese-inspired soundtrack** — Erhu (bowed 2-string fiddle with vibrato + portamento), Guzheng (plucked zither with octave harmonics), Dizi (bamboo flute with breath noise + flutter), Temple Block (muyu), Frame Drum (bo), Big Drum (da-gu) — all synthesized via Web Audio API, no audio files
- **D major pentatonic** throughout (D E F# A B), 4-octave range (D3–B6)
- **Dynamic music** — combat intensity scales percussion density; low-HP shifts the erhu down a scale degree + adds a drone pulse; rage-full adds double-time driving percussion
- **Impact stingers** — per-hit-type audio SFX (impactBoom + metallicClang + whoosh) layered for punch/kick/roundhouse/block/KO

### Environmental Hazards
- **Volcano** — standing near the stage edges (within 36px) burns you for 6 HP/s; ember sparks rise at the feet
- **Snow** — reduced traction: horizontal velocity decays at only `1 - 0.4·dt` instead of full friction, so fighters slide further on stops and turns
- **Temple** — falling debris from the ceiling (0.55 spawns/sec) deals 4 HP chip damage + flinch on landing contact

### Arenas (7 themed backgrounds)
Sunset, Desert, Temple, Bamboo, Moonlit, Volcano, Snow — each with unique sky gradients, layered silhouettes, ambient particles, and ground colors.

---

## 🕹️ Controls

### Player 1
| Action | Keys | Notes |
|--------|------|-------|
| Move Left / Right | `A` / `D` or `←` / `→` | Momentum-based |
| Flip-Jump | `W` / `Space` / `↑` | Hold = higher (variable height) |
| Crouch | `S` / `↓` | Lowers hitbox, can't attack while fully crouched |
| Roll | `E` | Full i-frames, rolls toward opponent; `down + dir` rolls that way |
| Punch | `J` / `Z` | Fast, 8 dmg, 66 range |
| Kick | `K` / `X` | 15 dmg, 86 range, 22% knockdown |
| Roundhouse | `I` / `U` | 16 dmg, 94 range, 50% knockdown |
| Super (rage full) | `Q` | 30 dmg, 110 range, drains rage meter |
| Block | `L` / `Shift` | Hold; 82% damage reduction |
| Pause | `ESC` / `P` | Freezes the match |

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

---

## 🏗️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router, Turbopack) | ^16.1.1 |
| Language | TypeScript | ^5 |
| Rendering | Canvas2D (game) + WebGL (post-processing) | native |
| Audio | Web Audio API (procedural synthesis) | native |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) | ^4 |
| UI Components | Radix UI primitives + Lucide icons | latest |
| State | React 19 + refs (canvas-driven, not React state) | ^19 |
| Physics | Custom momentum-based engine | in-house |
| AI | Rule-based FSM with habit tracking | in-house |
| RL (inactive) | PPO 2×64, self-play trainer | in-house (`rl.ts`) |
| Package Manager | Bun | ^1.3 |

---

## 📐 Architecture

The game is a **client-side-only** application. The Next.js server serves static HTML/JS bundles; all game logic, physics, AI, audio, and rendering run in the browser. There is no backend database dependency for gameplay.

```
┌─────────────────────────────────────────────────────────┐
│  React Component Layer (ShadowFight.tsx)                │
│  ─ canvas + WebGL overlay                               │
│  ─ keyboard input capture (P1 + P2)                     │
│  ─ requestAnimationFrame loop → engine.update() → render│
│  ─ HUD overlays (HP bars, rage meter, round timer)       │
│  ─ pause / menu / mode selection                        │
└───────────────┬─────────────────────────────────────────┘
                │ drives
┌───────────────▼─────────────────────────────────────────┐
│  GameEngine (engine.ts)                                  │
│  ─ phase FSM: menu → intro → fight → round_end → match  │
│  ─ owns player + enemy Fighter, EnemyAI                 │
│  ─ collision resolution (body separation + hitboxes)    │
│  ─ particles, shockwaves, floating text                 │
│  ─ screen shake, hitstop, slow-motion VFX               │
│  ─ environmental hazards (volcano/snow/temple)          │
│  ─ KO cinematic orchestration                           │
└───────┬───────────────────────┬─────────────────────────┘
        │                       │
┌───────▼───────┐       ┌───────▼─────────────────────────┐
│  Fighter      │       │  EnemyAI (ai.ts)                │
│  (fighter.ts) │       │  ─ rule-based FSM               │
│  ─ physics    │◄──────┤  ─ habit tracker                │
│  ─ state FSM  │ input │  ─ whiff-punish / anti-air      │
│  ─ attacks    │       │  ─ pressure / mixup / adaptive  │
│  ─ hitboxes   │       │  ─ rage / perfection            │
└───────┬───────┘       └─────────────────────────────────┘
        │ pose()
┌───────▼─────────────────────────────────────────────────┐
│  Poses (poses.ts) — keyframe animation                  │
│  ─ BASE stance + per-state pose functions               │
│  ─ smoothstep easing between keyframes                  │
│  ─ ATTACK_SPECS / ACTIVE_WINDOW / STATE_DUR tables      │
└───────┬─────────────────────────────────────────────────┘
        │ Pose
┌───────▼─────────────────────────────────────────────────┐
│  Render (render.ts)                                      │
│  ─ computeJoints() → 13-joint skeleton                  │
│  ─ taperedLimb() → filled capsule shadows               │
│  ─ 7 themed backgrounds                                 │
│  ─ auras, shadows, particles, vignette                  │
└───────┬─────────────────────────────────────────────────┘
        │ canvas → texture
┌───────▼─────────────────────────────────────────────────┐
│  PostFX (postfx.ts) — WebGL fragment shader             │
│  ─ bloom (3-tap Gaussian) + chromatic aberration + vignette │
└─────────────────────────────────────────────────────────┘
```

### Frame Loop
The game runs at the display refresh rate via `requestAnimationFrame`. Each frame:

1. Compute `dt` (clamped to `1/30s` max to survive tab-switch hitches)
2. Apply **hitstop** (freeze sim while `hitstop > 0`) and **slow-motion** (`simDt = dt * 0.3`)
3. `engine.update(dt)` → physics, AI, collisions, hazards, particles, phase FSM
4. `render(ctx, engine)` → backgrounds, shadows, auras, fighters, shockwaves, particles, text, vignette
5. `postfx.render(gameCanvas, bloom, chromAb, vignette)` → WebGL overlay

React state updates are **throttled to 50ms snapshots** (HP, rage, round timer, phase) so the canvas can render at 60fps independently of React reconciliation.

---

## ⚔️ Combat System — Deep Dive

### Attack Specifications (`ATTACK_SPECS`)
Each attack has a startup/active/recovery breakdown, damage, range, hitbox height, knockback, and hitstun:

| Attack | Duration | Startup | Active | Recovery | Damage | Range | HitH | Knockback | Hitstun | KD% |
|--------|----------|---------|--------|----------|--------|-------|------|-----------|---------|-----|
| Punch | 0.34s | 10% | 30% | 60% | 8 | 66px | 30px | 170 | 0.30s | 0% |
| Kick | 0.56s | 30% | 28% | 42% | 15 | 86px | 44px | 310 | 0.44s | 22% |
| Roundhouse | 0.82s | 42% | 20% | 38% | 16 | 94px | 48px | 370 | 0.50s | 50% |
| Super | 1.20s | 28% | 24% | 48% | 30 | 110px | 80px | 500 | 0.80s | — |

### Active-Frame Windows (`ACTIVE_WINDOW`)
The hitbox only exists during a progress slice of the attack state:
- Punch: `[0.15, 0.45]` — fast, early
- Kick: `[0.32, 0.60]` — mid-swing
- Roundhouse: `[0.42, 0.62]` — late, telegraphed
- Super: `[0.28, 0.52]` — the uppercut apex

### Damage & Rage Math
```
dmg = round(spec.damage * attacker.damageMul)
if (blocked) dmg *= 0.18                       // 82% reduction

// rage meter (0..100, RAGE_MAX = 100)
defender.rage += blocked ? dmg * 0.3 : dmg * 0.8
attacker.rage += dmg * 0.4                     // offense builds rage too
```
Super move requires `rageMeter >= 100` and drains it to 0 on use.

### Hit Resolution (`takeHit`)
1. If `invuln > 0` → miss (roll i-frames, recovery frames)
2. If in `knockdown`/`defeated`/`getup`/`roll` → miss
3. Block check: `isBlocking() && facing === -fromFacing && onGround` → blocked (82% reduction, small pushback, 0.12s hitstun)
4. **Active-frame trade**: if defender's own `attackBox()` is live → take damage but keep attacking (0.12s armor i-frames)
5. **Heavy hit** (lethal, kick 22%, roundhouse 50%, or `dmg ≥ 22`) → knockdown state, 0.9s down + 0.5s getup, 1.4s invuln, launch velocity if specified
6. **Light hit** → hit state (`hitstun`), 0.46s invuln recovery window to prevent lockdown loops

### Knockdown Logic
```
lethal = hp <= 0
heavy  = lethal || (kick && rand<0.22) || (roundhouse && rand<0.5) || dmg>=22
if (heavy):
  vx = -fromFacing * knockback
  state = knockdown (0.65s)
  downTimer = lethal ? 99 : 0.9
  if (launch) vy = -launch
  invuln = 1.4                                  // through knockdown + getup
else:
  vx = -fromFacing * knockback * 0.7
  state = hit (0.26s)
  invuln = 0.46
```

---

## 🎨 Fighter Rendering Pipeline

The shadow fighters are **solid filled silhouettes** — not stick figures, not outlines. Here is the exact pipeline:

### 1. Joint Computation (`computeJoints`)
Given a `Pose` (12 angle values) and a `BodyType`, compute 13 world-space joints via polar coordinates:
```ts
polar(len, a) = [len * sin(a), len * cos(a)]   // angle 0 = straight down
hip   = [0, y - (thigh + shin) + hipDrop]
chest = hip + polar(torso, π - lean)
head  = chest + polar(neck + headR, π - lean - headTilt)
shoulders = chest ± (6 * wTorso, 2)
elbows/hands/knees/feet = parent + polar(segmentLen, segmentAngle)
```

### 2. Body-Type Scaling (`getBodyProps`)
| Type | headR | torso | thigh | shin | wTorso | wArm | wLeg | extraLean |
|------|-------|-------|-------|------|--------|------|------|-----------|
| lean | 12.5 | 46 | 40 | 38 | 1.00 | 1.00 | 1.00 | 0.00 |
| bulky | 14.4 | 41 | 34 | 32 | 1.35 | 1.30 | 1.25 | 0.05 |
| tall | 11.9 | 52 | 48 | 45 | 0.85 | 0.85 | 0.90 | 0.00 |
| hunched | 12.5 | 40 | 37 | 34 | 1.10 | 0.95 | 0.95 | 0.20 |

### 3. Tapered Limb (`taperedLimb`) — the core shadow primitive
Each limb is a **filled capsule** with a thick proximal end (radius `wa`) and a thin distal end (radius `wb`):

```ts
const taperedLimb = (a, b, wa, wb) => {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const len = hypot(dx, dy) || 1;
  const [nx, ny] = [-dy/len, dx/len];          // perpendicular
  ctx.fillStyle = "#060606";
  ctx.beginPath();
  ctx.moveTo(a.x + nx*wa, a.y + ny*wa);        // side of a
  ctx.lineTo(b.x + nx*wb, b.y + ny*wb);        // side of b
  ctx.arc(b, wb, atan2(ny,nx), atan2(-ny,-nx), false);  // b's end-cap
  ctx.lineTo(a.x - nx*wa, a.y - ny*wa);        // other side of a
  ctx.arc(a, wa, atan2(-ny,-nx), atan2(ny,nx), false);  // a's end-cap
  ctx.closePath();
  ctx.fill();                                   // SOLID FILL, not stroke
};
```

### 4. Joint Circles
To eliminate any notch at the seam between two tapered limbs, a full circle is drawn at each joint (knees, elbows, hips, chest) with the joint's radius:
```ts
const joint = (p, r) => { ctx.fillStyle = "#060606"; ctx.arc(p.x, p.y, r, 0, 2π); ctx.fill(); };
```

### 5. Draw Order (back-to-front, no `shadowBlur`)
```
ctx.shadowBlur = 0;                  // critical: segments blend seamlessly
taperedLimb(hip → bKnee, 16·wl, 13·wl)     // back thigh
taperedLimb(bKnee → bFoot, 13·wl, 9·wl)    // back shin
joint(bKnee, 13·wl); foot(bFoot)           // back knee cap + foot
taperedLimb(bShoulder → bElbow, 11·wa, 8·wa)  // back upper arm
taperedLimb(bElbow → bHand, 8·wa, 5·wa)       // back forearm
joint(bElbow, 4)
taperedLimb(hip → chest, 20·wt, 14·wt)      // torso (tapered)
joint(hip, 20·wt); joint(chest, 14·wt)
taperedLimb(chest → neckBase, 9, 7)         // neck
arc(head, headR)                             // head (full circle)
[motion blur fan if attacking]
taperedLimb(hip → fKnee, 16·wl, 13·wl)      // front thigh
taperedLimb(fKnee → fFoot, 13·wl, 9·wl)     // front shin
joint(fKnee, 13·wl); foot(fFoot)
taperedLimb(fShoulder → fElbow, 11·wa, 8·wa)
taperedLimb(fElbow → fHand, 8·wa, 5·wa)
joint(fElbow, 4); joint(fHand, 3)
[blade glint if armed + active]
```
All with `fillStyle = "#060606"` and `shadowBlur = 0` → the result is **one continuous solid black silhouette** with no visible segment boundaries.

### 6. Rim Light + Energy Aura
A thin colored rim (the opponent's `rim` color, e.g. `#f59e0b` for Lynx) is drawn as a `shadowBlur` glow around the head/torso only, plus an additive radial aura when attacking or at low HP — so each fighter reads as a distinct colored shadow.

---

## 🧠 AI System — Deep Dive

The AI is a **rule-based finite state machine** with **heuristic habit tracking** — not reinforcement learning (an RL/PPO module exists in `rl.ts` for research but is not active in gameplay). Each opponent has a 10-field capability profile that scales its behavior.

### Capability Profile (per opponent)
| Field | Range | Meaning |
|-------|-------|---------|
| `aggression` | 0..1 | Base probability of opening an attack string when in range |
| `blockChance` | 0..1 | Probability of blocking or roll-dodging a player attack |
| `reaction` | seconds | Delay before reacting to a player attack (0.13s = Titan, 0.55s = Lynx) |
| `combo` | int | Max consecutive attacks in a string (1 = Lynx, 3 = Hermit) |
| `whiffPunish` | 0..1 | Chance to dash in and counter a missed player attack |
| `antiAir` | 0..1 | Chance to jump-kick a jumping player |
| `pressure` | 0..1 | Tendency to maintain offense; shortens recovery gaps |
| `mixup` | 0..1 | Tendency to alternate fast/slow attacks to break blocking |
| `adaptive` | 0..1 | How strongly the AI shifts strategy based on tracked habits |
| `rage` | 0..1 | Aggression/speed boost magnitude when HP < 30% |
| `perfection` | 0..1 | Chance to frame-perfectly block (zero reaction delay) |

### Decision Loop (per frame)
```
if (!canAct) return;                          // committed — wait
if (rageMeter full && in range) → super move
if (whiff-punish window active && rand < whiffPunish && dist<130):
    dash in / kick                            // punish the whiff
if (player just jumped && rand < antiAir && dist<150):
    schedule jump-kick after reaction*0.6s    // anti-air
if (player just attacked && dist<170):
    if (rand < perfection) → frame-perfect block (0 delay)
    else if (rand < blockChance*0.5) → block after `reaction` s
    else if (rand < blockChance) → roll-dodge away after `reaction` s
if (blocking) → hold block (release early to counter if high-pressure)
if (retreating) → walk away (kiting)
if (combo in progress) → next hit (with mixup choice)
if (decision timer expired):
    if (in range && recoverTimer<=0):
        if (rand < aggression) open combo string (1..combo hits)
        else if (rand < aggr + (1-pressure)*0.2) back-step
        else stand & maybe bait with guard
    else approach (or jump-in if aggressive & far)
default: zone to optimal spacing (60px or 92px for mixup AIs)
```

### Habit Tracker (adaptive memory)
The AI counts every player "opening" (a new attack, jump, or block):
```ts
interface HabitTracker {
  punchCount, kickCount, rhCount, jumpCount, blockCount: number;
  lastMove: AttackKind | "jump" | "block" | null;
  openings: Record<string, number>;   // per-move frequency
  totalOpens: number;
}
```
**Adaptive reads** (used by `pickOpener`, scaled by the `adaptive` field):
- If the player blocks >40% of openings → AI opens with a slow heavy (kick/roundhouse) to break the guard
- If the player jumps >30% of openings → AI pre-empts with a kick (anti-air-ish opener)

### Rage Mode
When `selfHpFrac < 0.3`:
```
aggression += rage * 0.25   (capped at 0.98)
speedMul   += rage * 0.12
```
So Titan (rage=0.5) at low HP jumps from 0.84 → 0.97 aggression and gets +6% speed.

### Difficulty Curve
| Lvl | Opponent | Aggr | Block | React | Combo | Whiff | AntiAir | Pressure | Mixup | Adapt | Rage | Perf |
|-----|----------|------|-------|-------|-------|-------|---------|----------|-------|-------|------|------|
| 1 | Lynx | 0.34 | 0.08 | 0.55s | 1 | 0.05 | 0.04 | 0.10 | 0.05 | 0.05 | 0.10 | 0.00 |
| 2 | Bandit | 0.44 | 0.14 | 0.44s | 2 | 0.15 | 0.12 | 0.20 | 0.12 | 0.12 | 0.15 | 0.00 |
| 3 | Crane | 0.54 | 0.26 | 0.32s | 2 | 0.30 | 0.25 | 0.32 | 0.22 | 0.25 | 0.22 | 0.05 |
| 4 | Hermit | 0.62 | 0.32 | 0.26s | 3 | 0.45 | 0.40 | 0.45 | 0.35 | 0.40 | 0.30 | 0.12 |
| 5 | Widow | 0.68 | 0.40 | 0.20s | 3 | 0.55 | 0.50 | 0.55 | 0.45 | 0.55 | 0.35 | 0.20 |
| 6 | Butcher | 0.74 | 0.34 | 0.22s | 3 | 0.50 | 0.45 | 0.70 | 0.40 | 0.45 | 0.40 | 0.25 |
| 7 | Shogun | 0.78 | 0.50 | 0.16s | 3 | 0.65 | 0.55 | 0.65 | 0.55 | 0.60 | 0.45 | 0.40 |
| 8 | Titan | 0.84 | 0.56 | 0.13s | 3 | 0.75 | 0.65 | 0.80 | 0.60 | 0.70 | 0.50 | 0.55 |

---

## 🌍 Physics & Movement Model

The fighter physics are **momentum-based** (acceleration → target velocity → friction), not instant velocity sets. This produces realistic weight, slide, and air control.

### Constants (`fighter.ts`)
```ts
GROUND_Y     = 470          // ground line (virtual 960×540 space)
WALK_SPEED   = 182          // px/s target walk velocity
JUMP_VEL     = 640          // px/s initial upward velocity
GRAVITY      = 1180         // px/s²
ROLL_SPEED   = 400          // px/s roll dash velocity
ACCEL        = 1400         // px/s² ground acceleration
AIR_ACCEL    = 700          // px/s² air steering acceleration
FRICTION     = 1600         // px/s² ground deceleration when stopping
JUMP_CUT     = 0.35         // vy multiplier on early jump-key release
STAGE_LEFT   = 80
STAGE_RIGHT  = 880
```

### Ground Movement
```ts
target = move * WALK_SPEED * speedMul
dv = target - vx
maxStep = ACCEL * dt
if (|dv| <= maxStep) vx = target              // snap to target
else vx += sign(dv) * maxStep                  // accelerate toward target
// stopping:
maxStep = FRICTION * dt
if (|vx| <= maxStep) vx = 0 else vx -= sign(vx) * maxStep
```

### Air Control
```ts
target = move * WALK_SPEED * 0.85 * speedMul   // slightly less air authority
dv = target - vx
maxStep = AIR_ACCEL * dt
// if no direction held → keep horizontal momentum (ballistic arc)
```

### Variable Jump Height
```ts
// on jump:
vy = -JUMP_VEL; jumpHeld = true
// while rising, if up released early:
if (!up && jumpHeld && !onGround && vy < 0) vy *= JUMP_CUT   // 0.35 → short hop
```
This yields a tap-jump of ~67px and a hold-jump of ~154px.

### Roll Dodge
```ts
vx = rollDir * ROLL_SPEED * speedMul
invuln = STATE_DUR.roll = 0.5s                 // full i-frames
arc = sin(progress * π) * 22                   // dive-roll lifts 22px at mid-roll
y = GROUND_Y - arc
spin = progress * 2π * rollDir                 // exactly one revolution
```

### Body Separation
Fighters push each other apart to prevent overlap:
```ts
minDist = 40
if (|dx| < minDist && both grounded):
  push = (minDist - |dx|) / 2
  each fighter moves push px apart, clamped to stage bounds
```

### Frame-Rate Independence
`dt` is clamped to `1/30s` max so a tab-switch hitch doesn't catapult fighters across the stage. All physics integrate with `pos += vel * dt`.

---

## 🦴 Skeletal Animation System

### Pose Definition (`Pose`)
A pose is 12 angle values (radians) + a hip-drop offset:
```ts
interface Pose {
  torsoLean, headTilt: number;   // lean from vertical, + = forward
  hipDrop: number;               // px (crouch lowers the hip)
  bArm, bFore, fArm, fFore: number;  // arm angles (0 = down, + = front)
  bThigh, bShin, fThigh, fShin: number;
}
```
Convention: angle 0 = straight down, positive rotates toward the fighter's front. Local space always faces right; left-facing fighters are mirrored at draw time via `ctx.scale(-1, 1)`.

### Base Guard Stance
A realistic martial-arts guard — weight slightly back, hands up guarding the face, knees bent, staggered feet:
```ts
BASE = {
  torsoLean: 0.11, headTilt: 0.06, hipDrop: 4,
  bArm: -0.42, bFore: 2.35, fArm: 0.46, fFore: 2.25,
  bThigh: -0.20, bShin: -0.14, fThigh: 0.20, fShin: 0.14,
}
```

### Keyframe Interpolation (`kf`)
Attacks and states use multi-keyframe animation with **smoothstep easing** for organic acceleration/deceleration:
```ts
ease(t) = t * t * (3 - 2t)                    // smoothstep
// between keyframes [p0, pose0] and [p1, pose1]:
t = ease((p - p0) / (p1 - p0))
out[k] = lerp(pose0[k], pose1[k], t)
```

### Procedural Idle & Walk
Idle and walk are **procedural** (not keyframed) for endless organic variation:
- **Idle**: breathing (`sin(time*2)` bobs the hips, counter-rotates shoulders) + slow weight shift (`sin(time*0.7)`)
- **Walk**: legs swing via `sin(walkPhase)`, arms counter-swing, torso bobs, `walkPhase += dt * 9 * |move|`

### Acrobatic Spin
Jump and roll apply a body rotation around the hip, driven by progress so it always resets to 0 the instant the state ends (no stale "bent" pose):
```ts
jump: spin = airProgress * 2π * facing        // one clean forward flip
roll: spin = progress * 2π * rollDir          // one revolution
airProgress = (JUMP_VEL + vy) / (2 * JUMP_VEL)   // 0 at launch, 0.5 apex, 1 land
```

### State Durations (`STATE_DUR`)
| State | Duration |
|-------|----------|
| punch | 0.34s |
| kick | 0.56s |
| roundhouse | 0.82s |
| super | 1.20s |
| hit | 0.26s |
| knockdown | 0.65s |
| getup | 0.50s |
| roll | 0.50s |

---

## ✨ WebGL Post-Processing

A separate WebGL canvas overlays the game canvas with a custom GLSL fragment shader. The 2D canvas is uploaded as a texture each frame and rendered through a full-screen quad.

### Fragment Shader
```glsl
// chromatic aberration: offset RGB channels
float ca = uChromAb * 0.004;
float r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
float g = texture2D(uTex, uv).g;
float b = texture2D(uTex, uv - vec2(ca, 0.0)).b;
vec3 color = vec3(r, g, b);

// bloom: 3-tap Gaussian blur on bright areas (luminance > 0.6)
if (uBloom > 0.0) {
  vec3 bright = max(color - 0.6, 0.0);
  vec3 bloomH = blur(uv, vec2(uTexel.x, 0.0));   // 8-tap horizontal
  vec3 bloomV = blur(uv, vec2(0.0, uTexel.y));   // 8-tap vertical
  color += (bloomH + bloomV) * 0.5 * uBloom * 0.8;
}

// vignette: darken edges
vec2 d = uv - 0.5;
color *= 1.0 - dot(d, d) * uVignette * 1.2;
```

### Texture Upload
```ts
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // correct canvas→texture orientation
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
```
The `UNPACK_FLIP_Y_WEBGL` flag is critical — without it the post-processed image renders upside-down.

### Uniforms Driven by Gameplay
| Uniform | Value | Trigger |
|---------|-------|---------|
| `uBloom` | 0.15 → 0.8 | scales with combat intensity / super move |
| `uChromAb` | 0 → 0.8 | spikes on heavy hits / KO |
| `uVignette` | 0.35 → 0.9 | darkens during low-HP / cinematic |

---

## 🎵 Procedural Audio Engine

All music and SFX are **synthesized in real time** via the Web Audio API — no audio files except the story soundtrack (`steel_on_the_riverbank.mp3`).

### Scale & Tempo
- **D major pentatonic** (D E F# A B), 4 octaves (D3=146.83Hz → B6=1975.53Hz)
- **Tempo**: 84 BPM (moderate, contemplative)
- **Step**: 16th note = `60/84/4 = 0.1786s`

### Instruments (synthesis techniques)
| Instrument | Synthesis |
|-----------|-----------|
| **Erhu** (lead) | Sawtooth oscillator + vibrato (LFO on gain) + portamento (frequency ramp between notes) |
| **Guzheng** (ostinato) | Triangle wave plucks with octave harmonics, 8-note arp per bar: `[0,2,4,5,4,2,0,2]` |
| **Dizi** (flute) | Sine + breath noise (filtered white noise) + flutter (amplitude LFO) |
| **Temple Block** (muyu) | Short percussive click (square wave + fast decay envelope) |
| **Frame Drum** (bo) | Sine boom with pitch drop + noise transient |
| **Big Drum** (da-gu) | Low sine (60–90Hz) with long decay |

### Song Structure
- **4-bar vamp**, bass roots: D, A, B, A (root, fifth, sixth, fifth)
- **Erhu melody**: 4 bars of 8 eighth-notes, a gentle pentatonic descent that peaks high in bar 2 then resolves down
- **Dizi flourishes**: quick high ornaments `[12, 11, 9]` between erhu phrases

### Dynamic Music
The game loop sets two flags each frame:
- `lowHp = true` (player HP < 30%) → erhu shifts down a scale degree + a low drone pulse is added
- `rageFull = true` (rage meter full) → extra percussion weight (double-time big drum)

### Impact Stingers (`playHit`)
Each hit type layers three synthesized components:
- **impactBoom**: low sine (80–140Hz) with fast decay — the "thud"
- **metallicClang**: detuned square waves + bandpass noise — the "clang" (heavier for blades)
- **whoosh**: filtered white noise sweep — the "air"

---

## 🎬 Story & Cinematics

### The Shadow's Ascension — 10 Acts (timed to "Steel on the Riverbank", 141.98s ≈ 2:22)
| Act | Time | Scene | Beat |
|-----|------|-------|------|
| I | 0–12s | dawn_oath | The Gates of Shadow crack at dawn; you step free |
| II | 12–25s | march_hunt | The last heroes mass to cage you |
| III | 25–34s | seals | You claim each hero's seal; your shadow stretches |
| IV | 34–51s | village | Villages burn; cheers turn to ash and silence |
| V | 51–62s | gate_meet | The last master waits at the final temple |
| VI | 62–83s | gate_fight | Steel rings on shadow at the gate |
| VII | 83–103s | reflection_twist | The blood-red water reveals your true face |
| VIII | 103–121s | demon_reveal | Wings of darkness, crown of ash; the Gates swing wide |
| IX | 121–134s | screaming | The heroes lie broken; battle-cries become silence |
| Coda | 134–142s | final_riverbank | You stand atop the ruined gate; the world is yours to end |

### Cinematic Techniques
- **Virtual camera**: each scene has a distinct shot (wide / medium / close-up / extreme close-up) with animated zoom, pan, and dutch tilt
- **Letterbox bars** (top + bottom) for a 2.39:1 cinematic aspect
- **Film grain** (per-frame noise overlay) + **vignette**
- **Crossfade transitions** between scenes
- **Typed subtitles**: clean centered text, no web chrome, paced to the narration
- **Per-scene painted backgrounds**: each act is a distinct visual, not subtitles over a static backdrop

### Destruction Ending
When all 8 heroes are defeated, an animated apocalypse plays:
- Burning villages (animated flame particles)
- Crumbling mountains (falling debris)
- Blood-red sky (gradient shift)
- 12-line epilogue narration
- "THE WORLD BURNS" title card

---

## 🌋 Environmental Hazards

### Volcano Arena
- Fighters within 36px of `STAGE_LEFT` or `STAGE_RIGHT` take **6 HP/s** chip damage
- Ember sparks rise at the feet (orange/yellow particles, gravity 220 px/s²)

### Snow Arena
- Reduced traction: horizontal velocity decays at `vx *= 1 - 0.4·dt` (instead of full `FRICTION`)
- Fighters slide further on stops and turns
- Gentle snow dust kicks up at the feet

### Temple Arena
- Falling debris spawns at 0.55/sec from the ceiling
- Each debris falls (gravity 460 px/s²) and deals **4 HP** + 0.18s hitstun if it lands on a fighter within 32px

---

## 🏆 Opponents

| # | Name | Title | Body Type | Weapon | Arena | HP | Dmg Mul | Spd Mul |
|---|------|-------|-----------|--------|-------|-----|---------|---------|
| 1 | Lynx | The Last Apprentice | Lean | Fists | Sunset | 70 | 0.55 | 0.85 |
| 2 | Bandit | The Defector | Lean | Sword | Desert | 84 | 0.68 | 0.95 |
| 3 | Crane | The Temple Guard | Tall | Spear | Temple | 100 | 0.82 | 1.00 |
| 4 | Hermit | The Hermit | Hunched | Dual | Bamboo | 114 | 0.94 | 1.06 |
| 5 | Widow | The Nightblade | Lean | Chain | Moonlit | 118 | 1.00 | 1.12 |
| 6 | Butcher | The Colossus | Bulky | Cleaver | Volcano | 140 | 1.10 | 0.92 |
| 7 | Shogun | The Shogun | Tall | Spear | Snow | 130 | 1.05 | 1.00 |
| 8 | Titan | The World's Last Hope | Bulky | Fists | Moonlit | 160 | 1.20 | 1.05 |

Each opponent has a narrative `story` beat shown when facing them, e.g.:
> **Hermit**: "He taught the dead swordsman everything. Now he teaches you fear."

---

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Story intro → Game flow
├── components/
│   └── game/
│       ├── ShadowFight.tsx     # Main game component (canvas loop, input, HUD)
│       ├── StoryIntro.tsx      # 2:22 cinematic intro (10 scenes + virtual camera)
│       └── DestructionEnding.tsx # World-burns ending animation
├── lib/
│   └── game/
│       ├── engine.ts           # GameEngine (match flow, collisions, VFX, hazards)
│       ├── fighter.ts          # Fighter class (physics, state machine, attacks)
│       ├── ai.ts               # EnemyAI (rule-based FSM + habit tracker)
│       ├── poses.ts            # Skeletal animation (BASE stance, keyframes, specs)
│       ├── render.ts           # Canvas rendering (fighters, 7 backgrounds, particles)
│       ├── audio.ts            # Procedural music + SFX (Web Audio API)
│       ├── postfx.ts           # WebGL post-processing (bloom/CA/vignette shader)
│       ├── story.ts            # Story beats + scene definitions (10 acts)
│       ├── types.ts            # TypeScript types (Pose, FighterState, OpponentDef)
│       └── rl.ts               # PPO RL agent (2×64, self-play) — INACTIVE
└── public/
    └── audio/
        └── steel_on_the_riverbank.mp3  # Story soundtrack
```

### File Sizes (approximate lines of code)
| File | Lines | Role |
|------|-------|------|
| `ShadowFight.tsx` | ~1080 | Main component, input, HUD, canvas loop |
| `StoryIntro.tsx` | ~950 | Cinematic intro (10 scenes + camera) |
| `render.ts` | ~860 | Fighter rendering + 7 backgrounds |
| `engine.ts` | ~850 | Match flow, collisions, VFX, hazards |
| `poses.ts` | ~710 | Skeletal animation keyframes |
| `fighter.ts` | ~640 | Physics + state machine |
| `audio.ts` | ~620 | Procedural music + SFX |
| `DestructionEnding.tsx` | ~400 | Apocalypse ending |
| `ai.ts` | ~440 | Rule-based AI |
| `postfx.ts` | ~185 | WebGL shader |
| `rl.ts` | ~154 | PPO agent (inactive) |
| `story.ts` | ~145 | Story beats |
| `types.ts` | ~150 | TypeScript types |
| **Total game code** | **~6,900** | |

---

## 🚀 Getting Started

```bash
# Install dependencies
bun install

# Start the dev server (http://localhost:3000)
bun run dev

# Lint
bun run lint
```

### How to Play
1. Watch the 2:22 story intro (or click **skip the story**)
2. Click **BEGIN THE HUNT** to start the tournament
3. Defeat all 8 heroes in best-of-3 rounds
4. Watch the world burn as you claim victory

Or use **skip to ending** on the menu to jump straight to the apocalypse.

---

## ⚡ Performance & Deployment

### Performance
- **60fps** game loop via `requestAnimationFrame`
- `dt` clamped to `1/30s` to survive tab-switch hitches
- React state updates throttled to 50ms snapshots — the canvas renders independently of React reconciliation
- WebGL post-processing runs on a **separate canvas** (doesn't block 2D rendering)
- Particle system is capped and reuses objects to avoid GC pressure

### Deployment
The game is **serverless** — all computation runs client-side. The Next.js server only serves static HTML/JS/CSS bundles. Deploy to any CDN:
- **Vercel** (recommended — native Next.js support)
- **Netlify**
- **Cloudflare Pages**

```bash
# Production build
bun run build

# The output is a static bundle — no server runtime required for gameplay
```

---

## 📜 License

Built for a hackathon. All code is original. The soundtrack "Steel on the Riverbank" is included for the story intro.

---

*"No hero remains. No seal holds. No dawn comes. The world is yours — and it is ash."*
