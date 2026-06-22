# Shadow Fight — Project Report

## Overview
A cinematic 2D shadow fighting game where you play as the villain. Built with Next.js 16, TypeScript, Canvas2D, and WebGL. The game features a 2:22 story intro synced to music, 8 unique opponents with escalating AI difficulty, procedural Chinese-inspired music, and a world-destruction ending.

## Architecture

### Game Engine (`src/lib/game/`)
The engine is a custom TypeScript game loop running at 60fps via `requestAnimationFrame`. It handles:
- **Physics**: Momentum-based movement with acceleration (1400 px/s²), friction (1600 px/s²), variable jump height (hold = full, release = 35% velocity cut), gravity (1180 px/s²)
- **State machine**: 16 fighter states (idle, walk, jump, roll, crouch, punch, kick, roundhouse, super, block, hit, knockdown, getup, victory, defeated)
- **Combat**: Hitbox/active-frame system with 4 attack types, block (82% reduction), roll i-frames, active-frame armor on trades
- **VFX**: Shockwaves, streak bursts, sparks, dust, floating damage numbers, screen shake, hitstop, slow-motion, chromatic aberration, bloom

### Fighter Rendering (`render.ts`)
Fighters are articulated shadow silhouettes with:
- **Skeletal animation**: 13 joints (hip, chest, head, 2 shoulders, 2 elbows, 2 hands, 2 knees, 2 feet) computed from pose angles
- **Tapered limbs**: Filled capsule paths (trapezoid + end-cap circles) that are thicker at proximal joints and thinner at extremities
- **Body types**: 4 types (lean/bulky/tall/hunched) with proportionally scaled limb dimensions and widths
- **Smooth motion**: Keyframe interpolation with smoothstep easing for organic acceleration/deceleration
- **No gaps**: Body drawn with `shadowBlur=0` so segments blend into one solid silhouette; joint circles fill seams

### AI System (`ai.ts`)
Rule-based finite state machine with 10 capability fields scaling per opponent:
- **Reactive rules**: Whiff-punish (detects missed player attacks), anti-air (detects jumps), block/dodge (reacts to player attacks)
- **Proactive rules**: Approach/zone, pressure strings with frame-tight gaps, mixup (alternates fast/slow attacks)
- **Adaptation**: HabitTracker counts player's punch/kick/jump/block usage; if player blocks >40%, AI opens with heavy attacks; if player jumps >30%, AI pre-empts with kicks
- **Rage**: When HP < 30%, aggression and speed increase (scaled by `rage` field)
- **Perfection**: Frame-perfect blocking chance for high-level opponents

### Story & Cinematics (`story.ts`, `StoryIntro.tsx`)
- **10-act intro** timed to "Steel on the Riverbank" (141.98s ≈ 2:22)
- Each act is a **distinct painted scene** (dawn riverbank, marching hunt, glowing seals, cheering village, gate meeting, sword fight, demonic reflection, demon reveal, screaming crowd, final riverbank)
- **Virtual camera system**: Each scene has a different shot (wide/medium/close-up/extreme close-up) with animated zoom, pan, and dutch tilt
- **Cinematic UI**: Letterbox bars, film grain, vignette, clean centered subtitles (no web chrome)
- **Crossfade transitions** between scenes

### Audio (`audio.ts`)
Fully procedural synthesis via Web Audio API — no audio files except the story soundtrack:
- **Instruments**: Erhu (bowed 2-string fiddle with vibrato + portamento), Guzheng (plucked zither with octave harmonics), Dizi (bamboo flute with breath noise + flutter), Temple Block (muyu), Frame Drum (bo), Big Drum (da-gu)
- **Scale**: D major pentatonic
- **Dynamic intensity**: Combat intensity scales percussion density; low-HP shifts erhu down a scale degree + adds drone; rage-full adds double-time drums
- **Impact stingers**: Per-hit-type SFX (impactBoom + metallicClang + whoosh)

### WebGL Post-Processing (`postfx.ts`)
Custom GLSL fragment shader on a separate WebGL canvas:
- **Bloom**: 3-tap Gaussian blur on bright areas, intensity scales with combat
- **Chromatic aberration**: RGB channel split on heavy hits
- **Vignette**: Edge darkening for cinematic framing
- **Y-flip**: `UNPACK_FLIP_Y_WEBGL` corrects canvas-to-texture orientation

## Key Features

### Combat
| Feature | Implementation |
|---------|---------------|
| Punch | 0.34s, 8 dmg, 62 range, fast startup |
| Kick | 0.56s, 15 dmg, 86 range, 22% KD chance |
| Roundhouse | 0.82s, 16 dmg, 94 range, 50% KD chance |
| Super | 1.2s, 30 dmg, 110 range, requires full rage meter |
| Block | 82% damage reduction, can be held |
| Roll | 0.5s, full i-frames, 400 px/s dash, dive-roll arc |
| Jump | Variable height (tap=67px, hold=154px), forward flip |

### AI Difficulty Curve
| Level | Opponent | Aggression | Block | Reaction | Special |
|-------|----------|-----------|-------|----------|---------|
| 1 | Lynx | 0.34 | 0.08 | 0.55s | Forgiving tutorial |
| 2 | Bandit | 0.44 | 0.14 | 0.44s | 2-hit strings |
| 3 | Crane | 0.54 | 0.26 | 0.32s | Whiff-punish begins |
| 4 | Hermit | 0.62 | 0.32 | 0.26s | 3-hit combos + mixup |
| 5 | Widow | 0.68 | 0.40 | 0.20s | Anti-air + adaptive |
| 6 | Butcher | 0.74 | 0.34 | 0.22s | Relentless pressure |
| 7 | Shogun | 0.78 | 0.50 | 0.16s | Near-perfect defense |
| 8 | Titan | 0.84 | 0.56 | 0.13s | Frame-perfect + rage |

### Story
- **Title**: "The Shadow's Ascension"
- **Premise**: You are an ancient evil unsealed after 1000 years. The 8 opponents are the last heroes trying to stop you.
- **Twist**: The "hero" you appear to be died at the first gate — you're a demon wearing his memories.
- **Ending**: When you defeat all heroes, the world burns. Animated apocalypse with 12-line epilogue.

## Technical Highlights

### Performance
- 60fps game loop with `requestAnimationFrame`
- Throttled React state updates (50ms snapshots) — canvas renders independently of React
- WebGL post-processing on separate canvas (doesn't block 2D rendering)
- RL training (when active) runs in 3-episode batches with 100ms yields

### Physics
- Frame-rate-independent: `dt` clamped to 1/30s max
- Momentum-based: acceleration → target velocity → friction (not instant set)
- Variable jump: `vy *= 0.35` on key release while ascending
- Air control: eases toward target velocity (not instant)

### Rendering Pipeline
1. Draw background (themed sky + silhouettes + ambient particles)
2. Draw ground shadows (ellipses that shrink when fighter is airborne)
3. Draw energy auras (additive glow when attacking/low-HP)
4. Draw fighters (tapered limbs + joint circles, solid fill, no per-segment strokes)
5. Draw shockwaves (additive glowing expanding rings)
6. Draw particles (additive sparks/streaks, normal-blend dust)
7. Draw floating text (damage numbers)
8. Draw vignette
9. Upload to WebGL texture → apply bloom + chromatic aberration + vignette shader

## Deployment
The game is **serverless** — all computation runs client-side. The Next.js server only serves static HTML/JS. Can be deployed to any CDN (Vercel, Netlify, Cloudflare Pages).

## Known Limitations
- RL agent (PPO 2×64) is in the codebase but not active in gameplay — training infrastructure exists but was disabled for stability
- The sandbox environment kills background processes between tool calls, requiring manual server restarts
- No persistence — game state resets on page refresh

## Lines of Code
- `engine.ts`: ~850 lines
- `fighter.ts`: ~630 lines
- `render.ts`: ~860 lines
- `ShadowFight.tsx`: ~1080 lines
- `StoryIntro.tsx`: ~950 lines
- `DestructionEnding.tsx`: ~400 lines
- `audio.ts`: ~600 lines
- `ai.ts`: ~430 lines
- `poses.ts`: ~680 lines
- `postfx.ts`: ~185 lines
- `story.ts`: ~100 lines
- `types.ts`: ~145 lines
- **Total**: ~6,910 lines of game code
