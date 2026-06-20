# Shadow Fight 2 Clone — Worklog

---
Task ID: 1
Agent: main
Task: Design game architecture & plan the Shadow Fight 2 clone build.

Work Log:
- Explored existing Next.js 16 project structure (shadcn/ui available, dev server running on port 3000).
- Decided architecture: HTML5 Canvas game rendered inside a React client component, with a TypeScript game engine split into modules.

Stage Summary:
- Game design:
  - 2D side-view fighting. Black silhouette fighters against a sunset gradient backdrop with silhouette landscape.
  - Articulated skeletal fighter (head, torso, arms x2 with forearms, legs x2 with shins) animated via keyframe angle interpolation per state.
  - States: idle, walk_fwd, walk_back, jump, crouch, punch, kick, block, hit, knockdown, victory.
  - Combat: punch (fast/short/low dmg), kick (slow/long/high dmg), block (damage reduction + chip), jump & crouch dodge. Hitbox/active-frame system, knockback, hitstun, combo counter.
  - Enemy AI state machine: approach / attack / retreat / block / react, with difficulty scaling (reaction time, aggression, block chance) per opponent.
  - Round system: best of 3, timer, "FIGHT!" / "K.O." announcements, screen shake, hit sparks, damage numbers.
  - Multiple opponents with increasing difficulty (progression).
- File plan:
  - src/lib/game/types.ts
  - src/lib/game/fighter.ts (skeleton + physics + states)
  - src/lib/game/ai.ts (enemy AI)
  - src/lib/game/engine.ts (loop, collision, rounds, particles)
  - src/lib/game/render.ts (drawing)
  - src/components/game/ShadowFight.tsx (React wrapper + canvas + UI overlay)
  - src/app/page.tsx (page)

---
Task ID: 2-9
Agent: main
Task: Build, verify, and balance the Shadow Fight 2 clone end-to-end.

Work Log:
- Built the engine across modules: types.ts, poses.ts (skeletal keyframes + attack specs), fighter.ts (physics, state machine, hitboxes, takeHit with block/armor/knockdown), ai.ts (enemy AI with approach/attack/retreat/block/recover + telegraph), engine.ts (match/round flow, collisions, particles, combo tracking, announcements), render.ts (sunset arena + articulated shadow silhouettes + particles + vignette).
- Built the React component (ShadowFight.tsx): canvas game loop with rAF, DPR-aware scaling to a 960x540 virtual stage, throttled HUD snapshots, keyboard + on-screen touch controls, HUD overlay (health bars, round pips, timer, combo counter, announcements), and phase panels (menu / match-end VICTORY / game-over DEFEATED / champion SHADOW LORD).
- Wired page.tsx with header, centered game, and a sticky footer (mt-auto) with control hints.
- Self-verified with Agent Browser + VLM: menu renders, combat renders (shadow silhouettes, sunset, HUD), K.O. / round transitions / victory poses / announcements all work, mobile layout + touch controls + sticky footer verified.
- Debugged a critical knockdown→defeated softlock (every kick permanently floored opponents) and fixed it to recover via getup when non-lethal.
- Added active-frame armor, post-hit invuln, and getup invulnerability to prevent stunlock infinites.
- Balanced the first opponent (Lynx) to be clearly beatable: lower HP/damage/aggression, AI telegraph pause + recovery windows so the player has openings to punish.
- Confirmed via dispatched KeyboardEvents (agent-browser's keydown doesn't reach the page) that the player can win a match 2-0 and progress through opponents (Lynx → Crane). Direct engine.startAttack() and manual keydown dispatch both confirmed punches deal damage and trigger hit states.
- Removed the temporary window debug hook; updated layout metadata title.

Stage Summary:
- Fully playable Shadow Fight 2 clone at /. Lint clean, dev server healthy, browser-verified.
- Features: 4 opponents with scaling difficulty (Lynx, Crane, Widow, Shogun), best-of-3 rounds, 60s timer, punch/kick/block/jump/crouch, knockdowns & getups, combos with counter, hit sparks, damage numbers, screen shake, hit flash, sunset arena with parallax silhouettes & embers, desktop keyboard + mobile touch controls, full menu/victory/defeat/champion screens.
- Controls: ←→/AD move, ↑/W/Space jump, ↓/S crouch (ducks punches), J/Z punch, K/X kick, L/C/Shift block.

---
Task ID: 10
Agent: main
Task: Add WASD + roundhouse (I), more villains, themed backgrounds, realism, and procedural music.

Work Log:
- types.ts: added "roundhouse" FighterState, AttackType union, roundhouse input, BackgroundId type, bg field on OpponentDef, blade stays.
- poses.ts: added roundhouse spinning-heel-kick keyframes, STATE_DUR/ACTIVE_WINDOW/ATTACK_SPECS for roundhouse (dmg 16, range 90, slow, 50% KD).
- fighter.ts: currentAttack now AttackType; roundhouse in isAttacking/canAct/setState/auto-face; startAttack accepts roundhouse; takeHit heavy includes roundhouse (50% KD); handleInput edge-triggers roundhouse (prevRoundhouse); added blade flag.
- ai.ts: roundhouse in InputState + nextAttack; strong opponents (aggression>0.58) throw roundhouse ~16%.
- engine.ts: expanded OPPONENTS to 8 (Lynx, Bandit, Crane, Hermit, Widow, Butcher, Shogun, Titan) each with a themed bg and escalating stats; player + bladed opponents get blade flag.
- render.ts (rewritten): 7 themed arenas (sunset, desert, temple, bamboo, moon, volcano, snow) each with sky gradient, atmospheric particles (embers/sand/fireflies/petals/snow), themed silhouettes (dunes/pagodas/bamboo/pines/peaks), and themed ground. Realism: ground contact shadows, joint caps, motion-blur fans on attacking limbs during active frames, blade glints on bladed fighters during strikes, two-tone rim light.
- audio.ts (new): GameAudio — procedural Shadow-Fight-style soundtrack via Web Audio API. Layers: low A1+E2 drone with tremolo LFO, taiko kick/snare, koto pentatonic arpeggios, flute lead with vibrato, delay send for space. Lookahead scheduler at 92 BPM. start/stop/toggle/dispose + volume.
- ShadowFight.tsx: KeyI/KeyU -> roundhouse; audio instance + mute toggle button (top-right) with Sound/Mute icons; audio starts on ENTER/next/retry/restart (user gesture), disposed on unmount; roundhouse touch button (RH); controls hints updated to show WASD + I; menu shows 8 opponents with arena type + blade icon.
- page.tsx: footer hints now show WASD Move, J/K/I/L.
- Verified via Agent Browser + VLM: 8-opponent menu correct, all 6 new backgrounds render atmospherically, roundhouse deals 18 dmg + knocks down (tested via direct call and I-key dispatch), audio plays with no errors, mute button present, no runtime errors.

Stage Summary:
- Roundhouse kick on I/U (player) + AI usage; WASD confirmed working (already mapped, now emphasized in hints).
- 8 villains across 7 themed arenas (sunset/desert/temple/bamboo/moon/volcano/snow) with per-opponent difficulty.
- Realism upgrades: ground shadows, motion blur, joint caps, blade glints, richer backgrounds.
- Procedural oriental soundtrack (drone + taiko + koto + flute) with mute toggle, starts on first interaction.
- Lint clean, dev server healthy, browser-verified.

---
Task ID: 11
Agent: main
Task: Improve music (SF2 fighting theme), add opponent + scene selection, add ultra-realistic VFX.

Work Log:
- audio.ts (rewritten): D Phrygian-dominant scale (dark exotic oriental), layered drone (D2+A2+Eb3 sawtooth through lowpass + tremolo LFO), heavy dhol/taiko kick (pitch-drop sine + click transient), snare (noise + tone), galloping 16th hi-hats, brass stabs (detuned saws), haunting duduk lead (sawtooth + bandpass + vibrato), sub-bass pulse, noise riser before drops. 104 BPM, 4-bar cycling motifs. Added setIntensity(0..1) that adds galloping kicks + denser hats at high intensity, and hit(kind) impact stingers (impactBoom + metallicClang inharmonic partials + whoosh) for punch/kick/roundhouse/block/ko. KO stinger = whoosh + double boom + clang.
- engine.ts: added sceneOverride + scene getter; startMatchWith(index, bg?) for free select; toMenu() to abandon. Fixed input field to include roundhouse. Added VFX state: slowmo, zoom (punch-zoom), chromAb, flashColor, shockwaves[], events[] (VFXEvent queue). resolveAttack now classifies heavy hits (kick/roundhouse/dmg>=16) and triggers: longer hitstop, bigger shake, colored flash (attacker rim), zoom, chromAb, slowmo, shockwave + streak burst; pushes VFXEvent. endRoundByKO does dramatic VFX (hitstop 0.28, shake 34, flash 0.5, zoom 0.9, slowmo 1.0, big shockwave + 40-streak burst, ko event). slowmo scales fighter sim dt only (VFX keep real time). Added spawnStreakBurst, spawnShockwave, updateShockwaves; enriched spawnSpark (more/bigger sparks, heavy colors).
- render.ts: render() now draws energy auras behind fighters (additive radial glow: strong when attacking, pulsing red when low HP), shockwaves (additive glowing expanding rings with bright inner ring), and streak particles (additive elongated energy lines along velocity). drawParticles split into additive pass (sparks/streaks/rings with shadowBlur glow) + normal dust pass. Uses eng.scene getter.
- ShadowFight.tsx: added view/selOpp/selScene state + intensityRef. Render loop applies punch-zoom (center-scaled), colored impact flash, drains eng.events each frame -> audio.hit() stingers + combat intensity (bumps on hits, decays). MenuPanel now has "Choose Opponent & Arena" button -> SelectPanel. SelectPanel: opponent grid (8 cards, selectable, glowing when active) + arena chips (Auto + 7 scenes) + FIGHT button. End panels got "Main Menu" secondary buttons via backToMenu. startSelect starts chosen opponent/scene.
- Verified via Agent Browser + VLM: menu shows both buttons; select screen lists 8 opponents + 7 arenas + FIGHT; selected Shogun in Volcano arena renders correctly; audio plays on fight start; heavy roundhouse hit triggers shake=24, flash, zoom=0.6, slowmo=0.83, 2 shockwaves, 57 particles, intensity 0.41 (VLM confirms glowing shockwave + energy sparks + red flash + zoom); KO triggers shake=28, flash=0.28, zoom=0.72, slowmo=0.9, 89 particles (VLM confirms K.O. text + dramatic shockwaves + yellow flash + cinematic finisher feel). No runtime errors.

Stage Summary:
- Music: SF2-inspired fighting theme (Phrygian dominant, duduk lead, heavy taiko, brass stabs, risers) with combat-intensity layering + per-hit impact stingers.
- Selection: full opponent (8) + arena (7 + auto) select screen reachable from the menu; tournament mode still via ENTER THE ARENA.
- VFX: ultra-realistic — additive glowing shockwaves, energy streak bursts, colored impact flash, punch-zoom, slow-motion, hitstop, energy auras, enriched sparks; dramatic KO finisher.
- Lint clean, dev server healthy, browser-verified.
