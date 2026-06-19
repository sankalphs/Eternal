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
