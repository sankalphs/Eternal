# SHADOW FIGHT — Technical Report

> **Project**: *The Shadow's Ascension* — a cinematic 2D shadow-fighting game
> **Stack**: Next.js 16 · TypeScript 5 · Canvas2D · WebGL · Web Audio API
> **Codebase**: ~6,900 lines of game logic, fully client-side, serverless-deployable
> **Status**: Feature-complete; RL module present but inactive in gameplay

---

## 1. Executive Summary

*The Shadow's Ascension* is a browser-native fighting game that reproduces the silhouette-art aesthetic and feel of *Shadow Fight 2* while inverting the narrative: the player **is** the villain. The game ships with a 2:22 cinematic intro synced to a musical score, eight opponents with escalating rule-based AI, a procedural Chinese-inspired soundtrack, a world-destruction ending, momentum-based physics, a skeletal animation system rendering solid filled shadow silhouettes, and a WebGL post-processing pipeline (bloom, chromatic aberration, vignette).

All gameplay, physics, AI, audio synthesis, and rendering execute client-side. The Next.js server serves only static bundles, making the game deployable to any CDN with no backend runtime cost.

---

## 2. System Architecture

### 2.1 High-Level Data Flow

```
Keyboard Input ─┐
                ├─► ShadowFight.tsx (React component)
WebGL Canvas  ──┤      │
                │      │ requestAnimationFrame(loop)
Game Canvas  ───┤      │
                │      ▼
                │   GameEngine.update(dt)
                │      ├─► Fighter.update(dt, input, opp)   (physics + state machine)
                │      ├─► EnemyAI.update(dt, self, opp)     (rule-based FSM)
                │      ├─► collision resolution (body + hitboxes)
                │      ├─► hazards (volcano/snow/temple)
                │      ├─► particles / shockwaves / floating text
                │      └─► phase FSM (menu → intro → fight → round_end → match_end)
                │      │
                │      ▼
                │   render(ctx, engine)
                │      ├─► drawScene (7 themed backgrounds)
                │      ├─► drawGroundShadow / drawAura
                │      ├─► drawFighter × 2  (computeJoints → taperedLimb → joint caps)
                │      ├─► drawShockwaves / drawParticles / drawFloatingText
                │      └─► drawVignette
                │      │
                │      ▼
                └──► PostFX.render(gameCanvas, bloom, chromAb, vignette)
                       WebGL fragment shader → overlay canvas
```

### 2.2 Frame Loop Timing
The loop runs at display refresh rate via `requestAnimationFrame`. Per frame:
1. Compute `dt` from `performance.now()`, clamped to `1/30s` (33.3ms) to survive tab-switch hitches.
2. If `hitstop > 0`, decrement and skip simulation (freeze the action for impact emphasis).
3. If `slowmo > 0`, `simDt = dt * 0.3` (KO cinematic slow-motion).
4. `engine.update(simDt)` — all sim logic.
5. `render(ctx, engine)` — 2D canvas pass.
6. `postfx.render(gameCanvas, …)` — WebGL pass.
7. React HUD state is updated at most every 50ms (HP, rage, timer, phase) via a snapshot diff, so React reconciliation never blocks the 60fps canvas.

### 2.3 Module Dependency Graph

```
types.ts ──────────────► (all modules import shared types)
poses.ts ◄── fighter.ts ◄── engine.ts ◄── ShadowFight.tsx
   ▲            ▲              ▲
   │            │              ├── ai.ts
   │            │              ├── render.ts
   │            │              ├── audio.ts
   │            │              └── postfx.ts
   │            │
   └────────────┴── story.ts ──► StoryIntro.tsx, DestructionEnding.tsx
rl.ts (standalone, not imported by the active game)
```

---

## 3. Fighter Physics & State Machine

### 3.1 State Machine (`FighterState`)
16 states with guarded transitions:

```
        ┌─────────────────────────────────────────────┐
        │                                             │
        ▼                                             │
     idle ──► walk_fwd / walk_back ──► idle           │
       │                                             │
       ├──► crouch ──► idle                           │
       ├──► jump ──► idle (on land)                   │
       ├──► roll ──► idle                             │
       ├──► block ──► idle                            │
       ├──► punch / kick / roundhouse / super ──► idle│
       ├──► hit ──► idle (after hitstun)              │
       ├──► knockdown ──► getup ──► idle              │
       ├──► knockdown ──► defeated (if lethal)        │
       └──► victory / defeated (terminal)             │
```

`canAct()` gates input acceptance: false while airborne, in hit/knockdown/getup/roll/attack/victory/defeated. Auto-facing toward the opponent is locked during committed states (attacks, roll, hit, knockdown).

### 3.2 Momentum-Based Movement
Movement is **not** instant velocity assignment. It uses acceleration toward a target velocity and friction-based deceleration:

```ts
// Ground movement
target = move * WALK_SPEED * speedMul;          // ±182 px/s
dv = target - vx;
maxStep = ACCEL * dt;                            // 1400 px/s²
if (|dv| <= maxStep) vx = target;                // snap when close
else vx += sign(dv) * maxStep;                   // accelerate

// Stopping (no input)
maxStep = FRICTION * dt;                         // 1600 px/s²
if (|vx| <= maxStep) vx = 0;
else vx -= sign(vx) * maxStep;

// Air control (less authority)
target = move * WALK_SPEED * 0.85 * speedMul;   // 85% ground speed
maxStep = AIR_ACCEL * dt;                        // 700 px/s²
// no input → momentum preserved (ballistic arc)
```

This produces realistic weight: fighters can't reverse direction instantly, they slide on stops, and air momentum carries through jumps.

### 3.3 Variable Jump Height
```ts
// Launch
vy = -JUMP_VEL;                 // -640 px/s
jumpHeld = true;

// Per-frame: if up released while still rising, cut velocity
if (!input.up && jumpHeld && !onGround && vy < 0)
  vy *= JUMP_CUT;               // 0.35 → short hop
```
Kinematics:
- Hold jump: apex height = `JUMP_VEL² / (2·GRAVITY)` = `640² / (2·1180)` ≈ **154 px**
- Tap jump (cut immediately): apex ≈ `154 · 0.35²` ≈ **19 px** above cut point ≈ **67 px** total

### 3.4 Roll Dodge
```ts
vx = rollDir * ROLL_SPEED * speedMul;            // 400 px/s
invuln = STATE_DUR.roll = 0.5;                   // full i-frames
arc = sin(progress * π) * 22;                    // 22px dive-roll lift
y = GROUND_Y - arc;
spin = progress * 2π * rollDir;                  // one full revolution
```
The roll is i-framed for its entire 0.5s duration, making it a reliable evasion tool. The 22px arc lifts the fighter off the ground mid-roll (a dive-roll), and the body rotates exactly one revolution — resetting to upright the instant the state ends.

### 3.5 Physics Constants
| Constant | Value | Unit |
|----------|-------|------|
| `GROUND_Y` | 470 | px (virtual space 960×540) |
| `WALK_SPEED` | 182 | px/s |
| `JUMP_VEL` | 640 | px/s |
| `GRAVITY` | 1180 | px/s² |
| `ROLL_SPEED` | 400 | px/s |
| `ACCEL` | 1400 | px/s² |
| `AIR_ACCEL` | 700 | px/s² |
| `FRICTION` | 1600 | px/s² |
| `JUMP_CUT` | 0.35 | (ratio) |
| `STAGE_LEFT` | 80 | px |
| `STAGE_RIGHT` | 880 | px |

---

## 4. Combat System

### 4.1 Attack Specifications
Each attack is defined by a duration, a startup/active/recovery split, damage, range, hitbox geometry, knockback, and hitstun:

| Attack | Total | Startup | Active | Recovery | Dmg | Range | HitH | KB | Hitstun | KD% |
|--------|-------|---------|--------|----------|-----|-------|------|----|---------|-----|
| Punch | 0.34s | 10% | 30% | 60% | 8 | 66 | 30 | 170 | 0.30s | 0% |
| Kick | 0.56s | 30% | 28% | 42% | 15 | 86 | 44 | 310 | 0.44s | 22% |
| Roundhouse | 0.82s | 42% | 20% | 38% | 16 | 94 | 48 | 370 | 0.50s | 50% |
| Super | 1.20s | 28% | 24% | 48% | 30 | 110 | 80 | 500 | 0.80s | — |

### 4.2 Active-Frame Windows
A hitbox exists only during a progress slice of the attack state:
```
punch:      [0.15, 0.45]   — fast, early
kick:       [0.32, 0.60]   — mid-swing
roundhouse: [0.42, 0.62]   — late, telegraphed
super:      [0.28, 0.52]   — uppercut apex
```

### 4.3 Hit Resolution Algorithm (`takeHit`)
```
1. if invuln > 0 → MISS (roll i-frames, recovery frames)
2. if state in {knockdown, defeated, getup, roll} → MISS
3. blocked = isBlocking() && facing === -fromFacing && onGround
4. dmg = round(spec.damage * attacker.damageMul)
   if blocked: dmg *= 0.18                  // 82% reduction
5. rage accrual:
   defender.rage += blocked ? dmg*0.3 : dmg*0.8
   attacker.rage  += dmg*0.4
6. if blocked:
     vx = -fromFacing * knockback * 0.25
     hitstun = 0.12
     return BLOCKED
7. if defender.attackBox() is live:         // active-frame trade
     invuln = 0.12 (armor)
     return TRADED (both connect)
8. heavy = lethal || (kick && rand<0.22) || (roundhouse && rand<0.5) || dmg>=22
   if heavy:
     vx = -fromFacing * knockback
     state = knockdown (0.65s)
     downTimer = lethal ? 99 : 0.9
     if launch: vy = -launch
     invuln = 1.4                            // through knockdown + getup
   else:
     vx = -fromFacing * knockback * 0.7
     state = hit (0.26s)
     invuln = 0.46                           // recovery window
```

### 4.4 Rage Meter
- `RAGE_MAX = 100`
- Defender gains `dmg * 0.8` (clean) or `dmg * 0.3` (blocked)
- Attacker gains `dmg * 0.4` (offense builds rage too)
- Super move (`Q`) requires `rageMeter >= 100` and drains it to 0

### 4.5 Body Collision & Separation
```ts
separateFrom(opp):
  minDist = 40
  if |dx| < minDist && both grounded:
    push = (minDist - |dx|) / 2
    move each fighter `push` px apart, clamped to [STAGE_LEFT, STAGE_RIGHT]
```

---

## 5. Fighter Rendering Pipeline

The shadow fighters are **solid filled silhouettes** — the defining visual requirement. The pipeline guarantees one seamless black body per fighter.

### 5.1 Joint Computation (`computeJoints`)
Given a `Pose` (12 angles) and a `BodyType`, 13 world-space joints are computed via polar coordinates. Convention: angle 0 = straight down, positive rotates toward the fighter's front; local space faces right (mirrored at draw time for left-facing fighters).

```ts
polar(len, a) = [len * sin(a), len * cos(a)]

hip    = [0, y - (thigh + shin) + hipDrop]
chest  = hip + polar(torso, π - lean)          // lean = torsoLean + extraLean
head   = chest + polar(neck + headR, π - lean - headTilt)
bShoulder = chest + [-6·wTorso, +2]
fShoulder = chest + [+6·wTorso, +2]
bElbow = bShoulder + polar(uarm, bArm)
bHand  = bElbow + polar(farm, bFore)
fElbow = fShoulder + polar(uarm, fArm)
fHand  = fElbow + polar(farm, fFore)
bKnee  = hip + polar(thigh, bThigh)
bFoot  = bKnee + polar(shin, bShin)
fKnee  = hip + polar(thigh, fThigh)
fFoot  = fKnee + polar(shin, fShin)
```

### 5.2 Body-Type Proportion Scaling (`getBodyProps`)
Base Da Vinci proportions, scaled per body type:

| Type | headR | torso | thigh | shin | uarm | farm | wTorso | wArm | wLeg | extraLean |
|------|-------|-------|-------|------|------|------|--------|------|------|-----------|
| lean | 12.5 | 46 | 40 | 38 | 27 | 25 | 1.00 | 1.00 | 1.00 | 0.00 |
| bulky | 14.4 | 41.4 | 34 | 32.3 | 27 | 25 | 1.35 | 1.30 | 1.25 | 0.05 |
| tall | 11.9 | 51.5 | 48 | 44.8 | 29.7 | 27.5 | 0.85 | 0.85 | 0.90 | 0.00 |
| hunched | 12.5 | 40.5 | 36.8 | 34.2 | 27 | 25 | 1.10 | 0.95 | 0.95 | 0.20 |

### 5.3 Tapered Limb — the Core Shadow Primitive
Each limb is a **filled capsule** (trapezoid body + two full-circle end-caps), thicker at the proximal joint and thinner at the distal end:

```ts
const taperedLimb = (a, b, wa, wb) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;          // perpendicular unit
  ctx.fillStyle = "#060606";
  ctx.beginPath();
  ctx.moveTo(a[0] + nx*wa, a[1] + ny*wa);       // side of a
  ctx.lineTo(b[0] + nx*wb, b[1] + ny*wb);       // side of b
  ctx.arc(b[0], b[1], wb, atan2(ny,nx), atan2(-ny,-nx), false);  // b end-cap
  ctx.lineTo(a[0] - nx*wa, a[1] - ny*wa);       // other side of a
  ctx.arc(a[0], a[1], wa, atan2(-ny,-nx), atan2(ny,nx), false);  // a end-cap
  ctx.closePath();
  ctx.fill();                                     // SOLID FILL
};
```

### 5.4 Joint Caps (gap elimination)
To eliminate any notch at the seam between two tapered limbs, a full circle is drawn at each joint:
```ts
const joint = (p, r) => {
  ctx.fillStyle = "#060606";
  ctx.beginPath();
  ctx.arc(p[0], p[1], r, 0, 2π);
  ctx.fill();
};
```
Joints drawn: both knees (13·wl), both elbows (4), hip (20·wt), chest (14·wt), front hand (3).

### 5.5 Draw Order (back-to-front, `shadowBlur = 0`)
The critical detail: **all body parts use `fillStyle = "#060606"` with `shadowBlur = 0`** so adjacent fills blend into one continuous silhouette with no visible segment boundaries.

```
ctx.shadowBlur = 0;

// BACK leg + arm
taperedLimb(hip→bKnee, 16·wl, 13·wl)
taperedLimb(bKnee→bFoot, 13·wl, 9·wl)
joint(bKnee, 13·wl);  foot(bFoot, 10·wl)
taperedLimb(bShoulder→bElbow, 11·wa, 8·wa)
taperedLimb(bElbow→bHand, 8·wa, 5·wa)
joint(bElbow, 4)

// TORSO + neck + head
taperedLimb(hip→chest, 20·wt, 14·wt)
joint(hip, 20·wt);  joint(chest, 14·wt)
taperedLimb(chest→neckBase, 9, 7)
arc(head, headR)                              // full circle

// [motion blur fan if attacking]

// FRONT leg + arm
taperedLimb(hip→fKnee, 16·wl, 13·wl)
taperedLimb(fKnee→fFoot, 13·wl, 9·wl)
joint(fKnee, 13·wl);  foot(fFoot, 10·wl)
taperedLimb(fShoulder→fElbow, 11·wa, 8·wa)
taperedLimb(fElbow→fHand, 8·wa, 5·wa)
joint(fElbow, 4);  joint(fHand, 3)

// [blade glint if armed + active frames]
```

### 5.6 Motion Blur
During active frames, a translucent "fan" of the striking limb is drawn behind the real limb:
```ts
if (inActive && (atk === "kick" || atk === "roundhouse"))
  motionFan(ctx, fKnee, fFoot, 12, rim);
if (inActive && atk === "punch")
  motionFan(ctx, fElbow, fHand, 8, rim);
```

### 5.7 Rim Light & Aura
- **Rim**: a thin colored glow (the fighter's `rim` hex) around head/torso only, drawn with `shadowBlur`
- **Aura**: additive radial gradient behind the fighter when attacking or at low HP

---

## 6. Skeletal Animation System

### 6.1 Pose Representation
```ts
interface Pose {
  torsoLean, headTilt: number;   // radians, + = forward
  hipDrop: number;               // px (crouch lowers hip)
  bArm, bFore, fArm, fFore: number;
  bThigh, bShin, fThigh, fShin: number;
}
```

### 6.2 Base Guard Stance
A realistic martial-arts guard — weight back, hands up, knees bent, staggered feet:
```ts
BASE = {
  torsoLean: 0.11, headTilt: 0.06, hipDrop: 4,
  bArm: -0.42, bFore: 2.35,   // back hand guarding
  fArm: 0.46,  fFore: 2.25,   // lead hand up
  bThigh: -0.20, bShin: -0.14,
  fThigh: 0.20,  fShin: 0.14,
}
```

### 6.3 Keyframe Interpolation with Smoothstep
```ts
ease(t) = t² · (3 - 2t)                        // smoothstep (C¹ continuous)
// between keyframes [p0, pose0] → [p1, pose1]:
t = ease((p - p0) / (p1 - p0))
out[k] = lerp(pose0[k], pose1[k], t)           // per-channel linear blend
```
Smoothstep gives organic ease-in/ease-out — no robotic linear motion.

### 6.4 Procedural States (idle, walk, crouch)
These loop forever and are generated procedurally for endless variation:
- **Idle**: `breathe = sin(time·2)` bobs the hips 0.8px, counter-rotates shoulders; `shift = sin(time·0.7)` slowly transfers weight between feet
- **Walk**: legs swing via `sin(walkPhase)`, arms counter-swing, torso bobs; `walkPhase += dt · 9 · |move|`
- **Crouch**: `crouchAmt` lerps 0→1 at rate 10/s; lowers hip and bends knees

### 6.5 Acrobatic Spin (jump / roll)
```ts
jump: spin = airProgress · 2π · facing        // one clean forward flip
roll: spin = progress · 2π · rollDir          // one revolution

airProgress = (JUMP_VEL + vy) / (2 · JUMP_VEL)   // 0 launch, 0.5 apex, 1 land
```
Because `spin` is a pure function of progress/velocity, it **always resets to 0** the instant the state ends — no stale "bent" pose across rounds (a bug that was fixed earlier in development).

### 6.6 State Durations
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

## 7. AI System — Rule-Based FSM with Habit Tracking

### 7.1 Design Philosophy
The AI is **rule-based**, not reinforcement-learned. An RL/PPO module (`rl.ts`) exists for research but is inactive in gameplay. The rule-based approach was chosen because:
1. **Predictable difficulty curve** — designers can tune each opponent's capabilities directly
2. **No training time** — works immediately, no convergence risk
3. **Interpretable** — every AI decision can be traced to a rule
4. **Habit tracking provides "learning"** — the AI adapts within a match without global training

### 7.2 Capability Profile
Each opponent has 11 scalar fields:

| Field | Range | Effect |
|-------|-------|--------|
| `aggression` | 0..1 | P(open attack string when in range) |
| `blockChance` | 0..1 | P(block or roll-dodge a player attack) |
| `reaction` | s | Delay before reacting to a player attack |
| `combo` | int | Max consecutive hits in a string |
| `whiffPunish` | 0..1 | P(dash in and counter a missed player attack) |
| `antiAir` | 0..1 | P(jump-kick a jumping player) |
| `pressure` | 0..1 | Offense retention; shortens recovery gaps |
| `mixup` | 0..1 | P(alternate fast/slow attacks to break blocking) |
| `adaptive` | 0..1 | Strength of habit-based strategy shifts |
| `rage` | 0..1 | Aggression/speed boost magnitude at low HP |
| `perfection` | 0..1 | P(frame-perfect block, zero reaction delay) |

### 7.3 Decision Loop (per frame)
```
if (!canAct) return;                              // committed — wait
if (rageMeter full && dist < 120) → super move

// WHIFF PUNISH
if (whiffWindow > 0):
  if (rand < whiffPunish && dist < 130):
    if (dist > 56) dash in
    else kick                                     // counter

// ANTI-AIR
if (player just jumped && rand < antiAir && dist < 150):
  schedule jump-kick after reaction·0.6s

// DEFENSIVE REACTION
if (player just attacked && dist < 170):
  if (rand < perfection) → frame-perfect block (0 delay)
  else if (rand < blockChance·0.5) → block after `reaction`s
  else if (rand < blockChance) → roll-dodge away after `reaction`s

// ACTIVE BLOCK
if (blockTimer > 0):
  hold block
  if (high-pressure && rand < pressure·0.4 && dist<100):
    interrupt block → counter punch

// RETREAT (kiting)
if (retreatTimer > 0): walk away

// COMBO CONTINUATION
if (comboLeft > 0 && in range):
  fire nextAttack (chosen via mixup)
  comboLeft--
  recovery gap = (1-pressure)·(0.55 + rand·0.5)

// DECISION TICK
if (decision timer expired):
  decision cadence = 0.45 - pressure·0.25 + rand·0.35
  if (in range && recoverTimer<=0):
    if (rand < aggression): open combo (1..combo hits)
    elif (rand < aggr + (1-pressure)·0.2): back-step
    else: stand & maybe bait with guard
  else: approach (or jump-in if aggressive & far)

// DEFAULT: zone to optimal spacing
optimal = (mixup > 0.45) ? 92 : 60                // mixup AIs zone wider
if (dist > optimal+8): approach
elif (dist < optimal-14): back off
```

### 7.4 Habit Tracker (adaptive memory)
```ts
interface HabitTracker {
  punchCount, kickCount, rhCount, jumpCount, blockCount: number;
  lastMove: AttackKind | "jump" | "block" | null;
  openings: Record<string, number>;
  totalOpens: number;
}
```
Every "opening" (a new player action) is counted. The AI uses this in `pickOpener` (scaled by `adaptive`):
- If `openings["block"] / totalOpens > 0.4` → open with a slow heavy (kick/roundhouse) to break the guard
- If `openings["jump"] / totalOpens > 0.3` → pre-empt with a kick (anti-air opener)

### 7.5 Mixup Logic (`pickMixup`)
Alternates fast/slow attacks to defeat blocking:
```
if (inRound && aggression > 0.6 && rand < mixup·0.4): roundhouse finisher
if (last was punch && inKick && rand < 0.5+mixup·0.3): kick
if (last was kick/rh && inPunch && rand < 0.5+mixup·0.3): punch
default: prefer punch (60%) else kick
```

### 7.6 Rage Mode
```
if (selfHpFrac < 0.3):
  aggression += rage · 0.25   (capped 0.98)
  speedMul   += rage · 0.12
```
Titan (rage=0.5) at low HP: aggression 0.84 → 0.97, speed +6%.

### 7.7 Difficulty Curve
The 8 opponents scale across every dimension:

| Lvl | Name | Aggr | Block | React | Combo | Whiff | AntiAir | Press | Mix | Adapt | Rage | Perf |
|-----|------|------|-------|-------|-------|-------|---------|-------|-----|-------|------|------|
| 1 | Lynx | 0.34 | 0.08 | 0.55s | 1 | 0.05 | 0.04 | 0.10 | 0.05 | 0.05 | 0.10 | 0.00 |
| 2 | Bandit | 0.44 | 0.14 | 0.44s | 2 | 0.15 | 0.12 | 0.20 | 0.12 | 0.12 | 0.15 | 0.00 |
| 3 | Crane | 0.54 | 0.26 | 0.32s | 2 | 0.30 | 0.25 | 0.32 | 0.22 | 0.25 | 0.22 | 0.05 |
| 4 | Hermit | 0.62 | 0.32 | 0.26s | 3 | 0.45 | 0.40 | 0.45 | 0.35 | 0.40 | 0.30 | 0.12 |
| 5 | Widow | 0.68 | 0.40 | 0.20s | 3 | 0.55 | 0.50 | 0.55 | 0.45 | 0.55 | 0.35 | 0.20 |
| 6 | Butcher | 0.74 | 0.34 | 0.22s | 3 | 0.50 | 0.45 | 0.70 | 0.40 | 0.45 | 0.40 | 0.25 |
| 7 | Shogun | 0.78 | 0.50 | 0.16s | 3 | 0.65 | 0.55 | 0.65 | 0.55 | 0.60 | 0.45 | 0.40 |
| 8 | Titan | 0.84 | 0.56 | 0.13s | 3 | 0.75 | 0.65 | 0.80 | 0.60 | 0.70 | 0.50 | 0.55 |

---

## 8. WebGL Post-Processing

### 8.1 Pipeline
A separate `<canvas>` with a WebGL context overlays the 2D game canvas. Each frame:
1. Resize WebGL canvas to match game canvas
2. Upload game canvas as a texture (`UNPACK_FLIP_Y_WEBGL = true`)
3. Set uniforms (`uBloom`, `uChromAb`, `uVignette`, `uTexel`)
4. Draw a full-screen quad (TRIANGLE_STRIP, 4 vertices)

### 8.2 Fragment Shader
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uBloom, uChromAb, uVignette;
uniform vec2 uTexel;

vec3 blur(vec2 uv, vec2 dir) {                  // 8-tap Gaussian
  vec3 c = vec3(0.0);
  c += texture2D(uTex, uv + dir*1.0).rgb * 0.25;
  c += texture2D(uTex, uv + dir*2.0).rgb * 0.20;
  c += texture2D(uTex, uv + dir*3.0).rgb * 0.15;
  c += texture2D(uTex, uv + dir*4.0).rgb * 0.10;
  c += texture2D(uTex, uv - dir*1.0).rgb * 0.25;
  c += texture2D(uTex, uv - dir*2.0).rgb * 0.20;
  c += texture2D(uTex, uv - dir*3.0).rgb * 0.15;
  c += texture2D(uTex, uv - dir*4.0).rgb * 0.10;
  return c;
}

void main() {
  vec2 uv = vUv;
  // Chromatic aberration
  float ca = uChromAb * 0.004;
  float r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
  float g = texture2D(uTex, uv).g;
  float b = texture2D(uTex, uv - vec2(ca, 0.0)).b;
  vec3 color = vec3(r, g, b);
  // Bloom
  if (uBloom > 0.0) {
    vec3 bright = max(color - 0.6, 0.0);
    vec3 bloomH = blur(uv, vec2(uTexel.x, 0.0));
    vec3 bloomV = blur(uv, vec2(0.0, uTexel.y));
    color += (bloomH + bloomV) * 0.5 * uBloom * 0.8;
  }
  // Vignette
  vec2 d = uv - 0.5;
  color *= 1.0 - dot(d, d) * uVignette * 1.2;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
```

### 8.3 Uniforms Driven by Gameplay
| Uniform | Range | Trigger |
|---------|-------|---------|
| `uBloom` | 0.15 → 0.8 | scales with combat intensity; spikes on super |
| `uChromAb` | 0 → 0.8 | spikes on heavy hits / KO |
| `uVignette` | 0.35 → 0.9 | darkens at low-HP / during cinematics |

### 8.4 Y-Flip Fix
`gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` is essential — without it, the canvas-to-texture upload flips the image vertically (a bug encountered and fixed during development).

---

## 9. Procedural Audio Engine

### 9.1 Synthesis Stack
All music and SFX are synthesized in real time via the Web Audio API — no audio files except the story soundtrack.

| Instrument | Technique |
|-----------|-----------|
| Erhu (bowed fiddle) | Sawtooth osc + vibrato LFO on gain + portamento (frequency ramp between notes) |
| Guzheng (zither) | Triangle wave plucks + octave harmonics, 8-note arp: `[0,2,4,5,4,2,0,2]` |
| Dizi (bamboo flute) | Sine + breath noise (filtered white noise) + flutter (amplitude LFO) |
| Temple Block (muyu) | Square wave + fast decay envelope |
| Frame Drum (bo) | Sine boom with pitch drop + noise transient |
| Big Drum (da-gu) | Low sine (60–90Hz) + long decay |

### 9.2 Scale & Harmony
- **D major pentatonic**: D E F# A B across 4 octaves (D3=146.83Hz → B6=1975.53Hz)
- **Tempo**: 84 BPM; 16th-note step = `60/84/4 = 0.1786s`
- **4-bar vamp**, bass roots: D, A, B, A (root, fifth, sixth, fifth)
- **Erhu melody**: 4 bars × 8 eighth-notes; gentle pentatonic descent peaking high in bar 2

### 9.3 Dynamic Music
The game loop sets two flags each frame:
- `lowHp` (player HP < 30%) → erhu shifts down a scale degree + a low drone pulse is added
- `rageFull` (rage meter full) → double-time big drum

### 9.4 Impact Stingers
Each hit layers three synthesized components:
- **impactBoom**: low sine (80–140Hz) + fast decay — the "thud"
- **metallicClang**: detuned square waves + bandpass noise — the "clang"
- **whoosh**: filtered white noise sweep — the "air"

---

## 10. Story & Cinematics

### 10.1 Narrative — "The Shadow's Ascension"
The player is an ancient evil unsealed after 1000 years. The 8 opponents are the last Sealers. The twist: the "hero" you appear to be died at the first gate; you're a demon wearing his memories. Defeating all 8 heroes triggers the world-destruction ending.

### 10.2 Intro Cutscene (10 acts, 2:22)
Timed to "Steel on the Riverbank" (141.98s). Each act is a **distinct painted scene** (not subtitles over a static backdrop):

| Act | Time | Scene | Beat |
|-----|------|-------|------|
| I | 0–12s | dawn_oath | Gates crack at dawn; you step free |
| II | 12–25s | march_hunt | Heroes mass to cage you |
| III | 25–34s | seals | You claim each seal; shadow stretches |
| IV | 34–51s | village | Villages burn; cheers → ash |
| V | 51–62s | gate_meet | Last master waits at the temple |
| VI | 62–83s | gate_fight | Steel on shadow at the gate |
| VII | 83–103s | reflection_twist | Blood-red water reveals your face |
| VIII | 103–121s | demon_reveal | Wings of darkness, crown of ash |
| IX | 121–134s | screaming | Heroes broken; silence |
| Coda | 134–142s | final_riverbank | You stand atop the ruined gate |

### 10.3 Cinematic Techniques
- **Virtual camera**: per-scene zoom/pan/dutch tilt (wide / medium / close-up / extreme close-up)
- **Letterbox bars** (2.39:1 cinematic aspect)
- **Film grain** (per-frame noise) + **vignette**
- **Crossfade transitions** between scenes
- **Typed subtitles**: clean centered text, paced to narration

### 10.4 Destruction Ending
Animated apocalypse: burning villages (flame particles), crumbling mountains (debris), blood-red sky (gradient shift), 12-line epilogue, "THE WORLD BURNS" title.

---

## 11. Environmental Hazards

| Arena | Hazard | Mechanic |
|-------|--------|----------|
| Volcano | Burning edges | 6 HP/s chip when within 36px of stage edge; ember sparks rise |
| Snow | Reduced traction | `vx *= 1 - 0.4·dt` (vs full friction); fighters slide further |
| Temple | Falling debris | 0.55 spawns/sec from ceiling; 4 HP + 0.18s hitstun on landing contact |

---

## 12. Game Modes & Flow

### 12.1 Phase FSM
```
menu → intro (2.2s boss intro) → fight → round_end (3.5s) → fight ...
                                 └─ after 2 round wins → match_end / champion
                                 └─ after 2 round losses → game_over
```

### 12.2 Modes
- **Tournament**: 8 sequential opponents, best-of-3 each
- **2-Player Versus**: local multiplayer (P1 vs P2)
- **Free Select**: any opponent + any arena
- **AI vs AI Attract Mode**: auto-plays after 15s idle on menu
- **Skip to Ending**: menu shortcut to the destruction ending

### 12.3 KO Cinematic
On round-ending KO:
- `hitstop = 0.6s` (freeze)
- `shake = 40` (heavy screen shake)
- `slowmo = 2.0s` (30% time scale)
- Big flash + expanding shockwave
- Zoom to 1.2× on the loser

---

## 13. RL Module (Inactive)

A PPO (Proximal Policy Optimization) agent exists in `rl.ts` for research purposes. It is **not imported by the active game**.

### 13.1 Architecture
- **Policy network**: 20 → 64 → 64 → 10 (ReLU + softmax)
- **Value network**: 20 → 64 → 64 → 1 (ReLU)
- **State (20 dims)**: normalized self/opp position, HP, rage, velocity, grounded, attacking, blocking, invuln, facing
- **Actions (10)**: none, left, right, up, down, punch, kick, roundhouse, roll, block
- **Hyperparameters**: γ=0.99, λ=0.95, clip=0.2, lr=1e-3

### 13.2 Why Inactive
The rule-based AI was preferred for:
- Predictable, tunable difficulty
- Zero training/convergence risk
- Immediate functionality
The RL module remains in the codebase for future experimentation.

---

## 14. Performance Characteristics

| Metric | Value |
|--------|-------|
| Target frame rate | 60 fps (via `requestAnimationFrame`) |
| `dt` clamp | 1/30s max (survives tab-switch) |
| React state update throttle | 50ms snapshots |
| Rendering pipeline | Canvas2D (game) + WebGL (post-fx) on separate canvases |
| Particle cap | Reused objects, no per-frame allocation |
| Bundle | Client-side only; Next.js serves static HTML/JS/CSS |

---

## 15. Deployment

The game is **serverless** — all computation runs client-side.

```bash
# Development
bun install
bun run dev          # http://localhost:3000

# Production build (static output)
bun run build
```

Deployable to any CDN: **Vercel** (recommended, native Next.js), **Netlify**, **Cloudflare Pages**. No backend runtime required for gameplay.

---

## 16. Known Limitations

1. **RL module inactive** — PPO agent exists in `rl.ts` but is not wired into gameplay; training infrastructure is present but disabled for stability.
2. **No persistence** — game state resets on page refresh (no save system).
3. **Local multiplayer only** — no networked play.
4. **Single-arena-per-match** — no mid-match transitions.

---

## 17. Codebase Metrics

| File | Lines | Role |
|------|-------|------|
| `ShadowFight.tsx` | ~1080 | Main component, input, HUD, canvas loop |
| `StoryIntro.tsx` | ~950 | Cinematic intro (10 scenes + camera) |
| `render.ts` | ~860 | Fighter rendering + 7 backgrounds |
| `engine.ts` | ~850 | Match flow, collisions, VFX, hazards |
| `poses.ts` | ~710 | Skeletal animation keyframes |
| `fighter.ts` | ~640 | Physics + state machine |
| `audio.ts` | ~620 | Procedural music + SFX |
| `ai.ts` | ~440 | Rule-based AI + habit tracker |
| `DestructionEnding.tsx` | ~400 | Apocalypse ending |
| `postfx.ts` | ~185 | WebGL shader |
| `rl.ts` | ~154 | PPO agent (inactive) |
| `types.ts` | ~150 | TypeScript types |
| `story.ts` | ~145 | Story beats |
| **Total game code** | **~6,900** | |

---

## 18. Conclusion

*The Shadow's Ascension* delivers a complete, cinematic fighting-game experience entirely in the browser. The solid-filled tapered-limb rendering produces the signature shadow-silhouette aesthetic; the momentum physics and variable-jump/roll mechanics provide weighty, responsive control; the 10-field rule-based AI with habit tracking yields a believable escalating difficulty curve; the procedural audio engine generates a dynamic Chinese-inspired score; the WebGL post-processing pipeline adds cinematic bloom and chromatic aberration; and the 10-act villain narrative with a world-destruction ending provides a complete story arc. All of this runs client-side with no backend dependency, making it trivially deployable to any CDN.

---

*"No hero remains. No seal holds. No dawn comes. The world is yours — and it is ash."*
