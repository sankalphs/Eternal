// Game engine: match/round flow, collision resolution, particles, effects.

import { Fighter, GROUND_Y } from "./fighter";
import { EnemyAI } from "./ai";
import type {
  BackgroundId,
  FloatingText,
  InputState,
  OpponentDef,
  Particle,
  Phase,
} from "./types";

export const ROUND_TIME = 60;
export const ROUNDS_TO_WIN = 2;

export const OPPONENTS: OpponentDef[] = [
  {
    // Level 1 — forgiving tutorial opponent. Telegraphs, recovers slowly,
    // rarely blocks. A new player should win comfortably.
    name: "Lynx",
    title: "The First Sealer",
    rim: "#f59e0b",
    hp: 70,
    damageMul: 0.55,
    speedMul: 0.85,
    aggression: 0.34,
    blockChance: 0.08,
    reaction: 0.55,
    combo: 1,
    bg: "sunset",
    story: "The youngest of the order. He does not yet know the hero he hunts is already dead.",
    whiffPunish: 0.05,
    antiAir: 0.04,
    pressure: 0.1,
    mixup: 0.05,
    adaptive: 0.05,
    rage: 0.1,
    perfection: 0.0,
  },
  {
    // Level 2 — slightly faster, throws 2-hit strings, occasional block.
    name: "Bandit",
    title: "The Turncoat",
    rim: "#fbbf24",
    hp: 84,
    damageMul: 0.68,
    speedMul: 0.95,
    aggression: 0.44,
    blockChance: 0.14,
    reaction: 0.44,
    combo: 2,
    bg: "desert",
    story: "Once a shadow-touched blade, now turned sealer. He remembers what you are.",
    whiffPunish: 0.15,
    antiAir: 0.12,
    pressure: 0.2,
    mixup: 0.12,
    adaptive: 0.12,
    rage: 0.15,
    perfection: 0.0,
  },
  {
    // Level 3 — competent: blocks reactively, punishes whiffs, zones.
    name: "Crane",
    title: "The Iron Monk",
    rim: "#2dd4bf",
    hp: 100,
    damageMul: 0.82,
    speedMul: 1.0,
    aggression: 0.54,
    blockChance: 0.26,
    reaction: 0.32,
    combo: 2,
    bg: "temple",
    story: "He forged the first chains that bound your kind. His guard is absolute.",
    whiffPunish: 0.3,
    antiAir: 0.25,
    pressure: 0.32,
    mixup: 0.22,
    adaptive: 0.25,
    rage: 0.22,
    perfection: 0.05,
  },
  {
    // Level 4 — aggressive pressure, 3-hit combos, mixups begin.
    name: "Hermit",
    title: "The Mountain Sage",
    rim: "#84cc16",
    hp: 114,
    damageMul: 0.94,
    speedMul: 1.06,
    aggression: 0.62,
    blockChance: 0.32,
    reaction: 0.26,
    combo: 3,
    bg: "bamboo",
    story: "He taught the dead swordsman everything. Now he teaches you fear.",
    whiffPunish: 0.45,
    antiAir: 0.4,
    pressure: 0.45,
    mixup: 0.35,
    adaptive: 0.4,
    rage: 0.3,
    perfection: 0.12,
  },
  {
    // Level 5 — fast, blade-armed, whiff-punishes hard, adapts to patterns.
    name: "Widow",
    title: "The Silent Blade",
    rim: "#e879f9",
    hp: 118,
    damageMul: 1.05,
    speedMul: 1.13,
    aggression: 0.68,
    blockChance: 0.4,
    reaction: 0.2,
    combo: 3,
    blade: true,
    bg: "moon",
    story: "She was the swordsman's lover. She sees his face on you — and weeps as she strikes.",
    whiffPunish: 0.6,
    antiAir: 0.55,
    pressure: 0.55,
    mixup: 0.5,
    adaptive: 0.55,
    rage: 0.38,
    perfection: 0.2,
  },
  {
    // Level 6 — relentless bruiser: huge HP, high pressure, frame traps.
    name: "Butcher",
    title: "The Brute",
    rim: "#fb7185",
    hp: 144,
    damageMul: 1.18,
    speedMul: 0.98,
    aggression: 0.74,
    blockChance: 0.34,
    reaction: 0.22,
    combo: 3,
    bg: "volcano",
    story: "A sealer who gave up finesse for fury. He will not stop until you are caged.",
    whiffPunish: 0.65,
    antiAir: 0.5,
    pressure: 0.68,
    mixup: 0.45,
    adaptive: 0.5,
    rage: 0.5,
    perfection: 0.25,
  },
  {
    // Level 7 — elite warlord: near-perfect defense, long combos, reads habits.
    name: "Shogun",
    title: "The Warlord",
    rim: "#ef4444",
    hp: 156,
    damageMul: 1.24,
    speedMul: 1.1,
    aggression: 0.78,
    blockChance: 0.5,
    reaction: 0.16,
    combo: 4,
    blade: true,
    bg: "snow",
    story: "He commanded the original sealing. He has waited centuries for this rematch.",
    whiffPunish: 0.78,
    antiAir: 0.7,
    pressure: 0.72,
    mixup: 0.65,
    adaptive: 0.7,
    rage: 0.55,
    perfection: 0.4,
  },
  {
    // Level 8 — final boss: punishing, adaptive, rages when low, frame-perfect.
    name: "Titan",
    title: "The Gatekeeper",
    rim: "#a78bfa",
    hp: 190,
    damageMul: 1.4,
    speedMul: 1.08,
    aggression: 0.84,
    blockChance: 0.56,
    reaction: 0.13,
    combo: 4,
    blade: true,
    bg: "moon",
    story: "The last sealer. Defeat him, and the gates are yours to open — forever.",
    whiffPunish: 0.88,
    antiAir: 0.82,
    pressure: 0.82,
    mixup: 0.78,
    adaptive: 0.85,
    rage: 0.7,
    perfection: 0.55,
  },
];

export interface Announcement {
  main: string;
  sub?: string;
  timer: number;
  big?: boolean;
}

export interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export type VFXEventKind = "hit" | "heavy" | "block" | "ko";
export interface VFXEvent {
  kind: VFXEventKind;
  x: number;
  y: number;
  hitType: "punch" | "kick" | "roundhouse" | null;
}

export class GameEngine {
  player: Fighter;
  enemy: Fighter;
  ai: EnemyAI;

  opponentIndex = 0;
  sceneOverride: BackgroundId | null = null;
  rlAgent: unknown = null; // set by the component when RL training completes
  phase: Phase = "menu";
  roundNo = 1;
  playerWins = 0;
  enemyWins = 0;
  roundTimer = ROUND_TIME;

  particles: Particle[] = [];
  texts: FloatingText[] = [];
  shockwaves: Shockwave[] = [];
  shake = 0;
  hitstop = 0;
  time = 0; // global elapsed (for bg effects)
  flash = 0;
  flashColor = "#ffffff";
  slowmo = 0;
  zoom = 0; // punch-zoom impulse (0..1)
  chromAb = 0;

  playerCombo = 0;
  playerComboTimer = 0;
  maxCombo = 0;

  announce: Announcement | null = null;
  phaseTimer = 0;

  // VFX/audio events drained by the component each frame
  events: VFXEvent[] = [];

  input: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    roundhouse: false,
    roll: false,
    block: false,
    super: false,
  };

  // for edge-triggered player attacks we mirror into fighter; fighter handles edges.
  constructor() {
    this.player = new Fighter({
      x: 360,
      isPlayer: true,
      facing: 1,
      maxHp: 120,
      rim: "#e2e8f0",
      name: "The Shadow",
      damageMul: 1.15,
      blade: true,
    });
    this.enemy = this.makeEnemy(0);
    this.ai = new EnemyAI(OPPONENTS[0]);
  }

  private makeEnemy(index: number): Fighter {
    const def = OPPONENTS[index];
    return new Fighter({
      x: 600,
      isPlayer: false,
      facing: -1,
      maxHp: def.hp,
      rim: def.rim,
      name: def.name,
      damageMul: def.damageMul,
      speedMul: def.speedMul,
      blade: def.blade,
    });
  }

  get opponent() {
    return OPPONENTS[this.opponentIndex];
  }

  get scene(): BackgroundId {
    return this.sceneOverride ?? this.opponent.bg;
  }

  // ---- Flow control ----
  // Tournament: start from the first opponent and progress through all eight.
  startMatch() {
    this.startMatchWith(0);
  }

  // Free select: jump straight to a chosen opponent (and optional scene).
  startMatchWith(index: number, bg?: BackgroundId | null) {
    this.opponentIndex = Math.max(0, Math.min(OPPONENTS.length - 1, index));
    this.sceneOverride = bg ?? null;
    this.ai = new EnemyAI(OPPONENTS[this.opponentIndex]);
    this.enemy = this.makeEnemy(this.opponentIndex);
    this.playerWins = 0;
    this.enemyWins = 0;
    this.roundNo = 1;
    this.maxCombo = 0;
    this.startRound();
  }

  // Return to the menu (abandon current match).
  toMenu() {
    this.phase = "menu";
    this.announce = null;
    this.player.reset(360, 1);
    this.enemy.reset(600, -1);
    this.particles = [];
    this.texts = [];
    this.shockwaves = [];
    this.events = [];
  }

  nextOpponent() {
    this.opponentIndex += 1;
    if (this.opponentIndex >= OPPONENTS.length) {
      this.phase = "champion";
      this.phaseTimer = 0;
      this.setAnnounce("CHAMPION", "You are the Shadow Lord", 999, true);
      return;
    }
    this.ai = new EnemyAI(OPPONENTS[this.opponentIndex]);
    this.enemy = this.makeEnemy(this.opponentIndex);
    this.playerWins = 0;
    this.enemyWins = 0;
    this.roundNo = 1;
    this.startRound();
  }

  // Retry the current opponent from round 1 (after a game over).
  retryMatch() {
    this.ai = new EnemyAI(OPPONENTS[this.opponentIndex]);
    this.enemy = this.makeEnemy(this.opponentIndex);
    this.playerWins = 0;
    this.enemyWins = 0;
    this.roundNo = 1;
    this.player.maxCombo = 0;
    this.maxCombo = 0;
    this.startRound();
  }

  startRound() {
    this.player.reset(360, 1);
    this.enemy.reset(600, -1);
    this.ai.reset();
    this.roundTimer = ROUND_TIME;
    this.particles = [];
    this.texts = [];
    this.shockwaves = [];
    this.shake = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.zoom = 0;
    this.chromAb = 0;
    this.flash = 0;
    this.phase = "intro";
    this.phaseTimer = 2.2;
    this.setAnnounce(`ROUND ${this.roundNo}`, this.vsText(), 2.2, true);
  }

  private vsText() {
    return `The Shadow vs ${this.opponent.name} — ${this.opponent.title}`;
  }

  private setAnnounce(
    main: string,
    sub?: string,
    timer = 1.4,
    big = false,
  ) {
    this.announce = { main, sub, timer, big };
  }

  // Called by component each frame.
  update(dtRaw: number) {
    const dt = Math.min(dtRaw, 1 / 30); // clamp big steps
    this.time += dt;
    if (this.flash > 0) this.flash -= dt * 2.2;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    if (this.zoom > 0) this.zoom = Math.max(0, this.zoom - dt * 1.8);
    if (this.chromAb > 0) this.chromAb = Math.max(0, this.chromAb - dt * 2.5);
    if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - dt);
    if (this.announce) {
      this.announce.timer -= dt;
      if (this.announce.timer <= 0) this.announce = null;
    }

    this.updateParticles(dt);
    this.updateTexts(dt);
    this.updateShockwaves(dt);

    // combo decay
    if (this.playerComboTimer > 0) {
      this.playerComboTimer -= dt;
      if (this.playerComboTimer <= 0) {
        this.playerCombo = 0;
      }
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return; // freeze fighters during impact
    }

    // slow-motion scales fighter simulation only (VFX keep real time)
    const simDt = this.slowmo > 0 ? dt * 0.3 : dt;

    switch (this.phase) {
      case "menu":
        // idle pose on menu
        this.player.update(simDt, null, this.enemy);
        this.enemy.update(simDt, null, this.player);
        break;
      case "intro":
        this.player.update(simDt, null, this.enemy);
        this.enemy.update(simDt, null, this.player);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = "fight";
          this.setAnnounce("FIGHT!", undefined, 0.9, true);
        }
        break;
      case "fight":
        this.updateFight(dt, simDt);
        break;
      case "round_end":
        this.player.update(simDt, null, this.enemy);
        this.enemy.update(simDt, null, this.player);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.afterRoundEnd();
        break;
      case "match_end":
        this.player.update(simDt, null, this.enemy);
        this.enemy.update(simDt, null, this.player);
        break;
      case "game_over":
      case "champion":
        this.player.update(simDt, null, this.enemy);
        this.enemy.update(simDt, null, this.player);
        break;
    }
  }

  private updateFight(dt: number, simDt: number) {
    // Use RL agent for the enemy when trained and opponent is level 5+,
    // otherwise fall back to the rule-based AI
    let enemyInput: InputState;
    const rl = this.rlAgent as { act?: (s: number[], stoch: boolean) => { input: InputState }; getState?: (s: Fighter, o: Fighter) => number[] } | null;
    if (rl && rl.act && rl.getState && this.opponentIndex >= 4) {
      const state = rl.getState(this.enemy, this.player);
      enemyInput = rl.act(state, true).input;
    } else {
      enemyInput = this.ai.update(simDt, this.enemy, this.player);
    }
    this.player.update(simDt, this.input, this.enemy);
    this.enemy.update(simDt, enemyInput, this.player);

    this.player.separateFrom(this.enemy);

    this.resolveAttack(this.player, this.enemy);
    this.resolveAttack(this.enemy, this.player);

    // round timer (real time)
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.endRoundByTime();
      return;
    }
    if (this.player.hp <= 0 || this.enemy.hp <= 0) {
      this.endRoundByKO();
    }
  }

  private resolveAttack(attacker: Fighter, defender: Fighter) {
    if (attacker.attackHasHit) return;
    const ab = attacker.attackBox();
    if (!ab) return;
    const bb = defender.bodyBox();
    if (!rectsOverlap(ab.rect, bb)) return;
    const hitX = defender.x - attacker.facing * 8;
    const hitY = GROUND_Y + ab.spec.height;
    const result = defender.takeHit(ab.spec, attacker.facing, attacker, (x, y, blocked) =>
      this.spawnSpark(x, y, blocked, ab.spec.type),
    );
    if (result.hit) {
      attacker.attackHasHit = true;
      const heavy =
        !result.blocked &&
        (ab.spec.type === "kick" || ab.spec.type === "roundhouse" || result.dmg >= 16);
      // VFX
      this.hitstop = result.blocked ? 0.05 : heavy ? 0.16 : 0.09;
      this.shake = Math.max(
        this.shake,
        result.blocked ? 5 : heavy ? 20 : 12,
      );
      this.flash = result.blocked ? 0.05 : heavy ? 0.22 : 0.1;
      this.flashColor = result.blocked
        ? "#93c5fd"
        : attacker.rim;
      if (heavy) {
        this.zoom = 0.5;
        this.chromAb = 0.8;
        this.slowmo = 0.5;
      }
      this.spawnDamageText(
        defender.x,
        bb.y - 10,
        result.blocked ? "BLOCK" : `-${result.dmg}`,
        result.blocked ? "#93c5fd" : heavy ? "#fde047" : "#fca5a5",
        heavy,
      );
      if (!result.blocked) {
        this.spawnRing(hitX, hitY);
        this.spawnShockwave(hitX, hitY, heavy ? 120 : 70, attacker.rim, heavy ? 5 : 3);
        if (heavy) this.spawnStreakBurst(hitX, hitY, 22, attacker.rim);
      }
      // audio/VFX event
      this.events.push({
        kind: result.blocked ? "block" : heavy ? "heavy" : "hit",
        x: hitX,
        y: hitY,
        hitType: ab.spec.type,
      });
      // combo tracking
      if (!result.blocked) {
        if (attacker === this.player) {
          this.playerCombo += 1;
          this.playerComboTimer = 1.6;
          this.maxCombo = Math.max(this.maxCombo, this.playerCombo);
        } else if (defender === this.player) {
          this.playerCombo = 0;
          this.playerComboTimer = 0;
        }
      }
    }
  }

  private endRoundByKO() {
    const playerWon = this.enemy.hp <= 0;
    if (playerWon) this.playerWins += 1;
    else this.enemyWins += 1;
    this.phase = "round_end";
    this.phaseTimer = 2.6;
    // dramatic KO VFX
    this.hitstop = 0.28;
    this.shake = 34;
    this.flash = 0.5;
    this.flashColor = playerWon ? "#fde047" : "#f87171";
    this.zoom = 0.9;
    this.slowmo = 1.0;
    this.chromAb = 1.0;
    const koX = (this.player.x + this.enemy.x) / 2;
    this.spawnShockwave(koX, GROUND_Y - 90, 220, playerWon ? "#fde047" : "#f87171", 8);
    this.spawnStreakBurst(koX, GROUND_Y - 90, 40, playerWon ? "#fde047" : "#f87171");
    this.events.push({ kind: "ko", x: koX, y: GROUND_Y - 90, hitType: null });
    this.setAnnounce("K.O.", playerWon ? "You won the round" : "You lost the round", 2.6, true);
    if (playerWon) this.player.setState("victory");
    else this.enemy.setState("victory");
  }

  private endRoundByTime() {
    let playerWon: boolean;
    if (this.player.hp > this.enemy.hp) playerWon = true;
    else if (this.enemy.hp > this.player.hp) playerWon = false;
    else playerWon = true; // draw -> player
    if (playerWon) this.playerWins += 1;
    else this.enemyWins += 1;
    this.phase = "round_end";
    this.phaseTimer = 2.6;
    this.setAnnounce("TIME UP", playerWon ? "You won the round" : "You lost the round", 2.6, true);
    if (playerWon) this.player.setState("victory");
    else this.enemy.setState("victory");
  }

  private afterRoundEnd() {
    if (this.playerWins >= ROUNDS_TO_WIN) {
      // player wins the match -> next opponent or champion
      if (this.opponentIndex >= OPPONENTS.length - 1) {
        this.phase = "champion";
        this.phaseTimer = 0;
        this.setAnnounce("CHAMPION", "You are the Shadow Lord", 999, true);
      } else {
        this.phase = "match_end";
        this.phaseTimer = 0;
        this.setAnnounce("VICTORY", `${this.opponent.name} defeated`, 999, true);
      }
    } else if (this.enemyWins >= ROUNDS_TO_WIN) {
      this.phase = "game_over";
      this.phaseTimer = 0;
      this.setAnnounce("DEFEATED", `${this.opponent.name} bested you`, 999, true);
    } else {
      this.roundNo += 1;
      this.startRound();
    }
  }

  // ---- Particles & VFX ----
  private spawnSpark(x: number, y: number, blocked: boolean, type: string) {
    const heavy = type === "kick" || type === "roundhouse";
    const n = blocked ? 10 : heavy ? 26 : 16;
    const color = blocked ? "#93c5fd" : heavy ? "#fde047" : "#fef08a";
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * (blocked ? 130 : heavy ? 360 : 280);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.3 + Math.random() * (heavy ? 0.4 : 0.3),
        maxLife: 0.7,
        size: 1.5 + Math.random() * (heavy ? 4 : 3),
        color,
        kind: "spark",
        grav: 560,
      });
    }
  }

  // big radial burst of elongated energy streaks (heavy hits / KO)
  private spawnStreakBurst(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 220 + Math.random() * 320;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.28 + Math.random() * 0.22,
        maxLife: 0.5,
        size: 10 + Math.random() * 14,
        color,
        kind: "streak",
        grav: 0,
      });
    }
  }

  private spawnShockwave(
    x: number,
    y: number,
    maxR: number,
    color: string,
    width: number,
  ) {
    this.shockwaves.push({
      x,
      y,
      r: 6,
      maxR,
      life: 0.45,
      maxLife: 0.45,
      color,
      width,
    });
  }

  private spawnRing(x: number, y: number) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.3,
      maxLife: 0.3,
      size: 8,
      color: "#fde68a",
      kind: "ring",
    });
  }

  spawnDust(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: -Math.random() * 60,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 3 + Math.random() * 4,
        color: "rgba(120,110,100,0.5)",
        kind: "dust",
        grav: 200,
      });
    }
  }

  private spawnDamageText(
    x: number,
    y: number,
    text: string,
    color: string,
    big = false,
  ) {
    this.texts.push({
      x,
      y,
      vy: -70,
      life: big ? 1.2 : 0.9,
      maxLife: big ? 1.2 : 0.9,
      text,
      color,
      size: text.startsWith("-") ? (big ? 30 : 22) : 16,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.kind !== "ring") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.grav) p.vy += p.grav * dt;
        // streaks fade velocity (drag) for a snap feel
        if (p.kind === "streak") {
          p.vx *= 0.9;
          p.vy *= 0.9;
        }
      }
    }
  }

  private updateShockwaves(dt: number) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const t = 1 - s.life / s.maxLife;
      s.r = 6 + (s.maxR - 6) * (1 - Math.pow(1 - t, 3));
    }
  }

  private updateTexts(dt: number) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 0.92;
    }
  }
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
