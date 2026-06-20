// Game engine: match/round flow, collision resolution, particles, effects.

import { Fighter, GROUND_Y } from "./fighter";
import { EnemyAI } from "./ai";
import type {
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
    name: "Lynx",
    title: "The Initiate",
    rim: "#f59e0b",
    hp: 70,
    damageMul: 0.6,
    speedMul: 0.88,
    aggression: 0.38,
    blockChance: 0.1,
    reaction: 0.5,
    combo: 1,
    bg: "sunset",
  },
  {
    name: "Bandit",
    title: "The Outlaw",
    rim: "#fbbf24",
    hp: 82,
    damageMul: 0.72,
    speedMul: 0.96,
    aggression: 0.46,
    blockChance: 0.12,
    reaction: 0.42,
    combo: 2,
    bg: "desert",
  },
  {
    name: "Crane",
    title: "The Iron Monk",
    rim: "#2dd4bf",
    hp: 100,
    damageMul: 0.85,
    speedMul: 1.0,
    aggression: 0.55,
    blockChance: 0.26,
    reaction: 0.32,
    combo: 2,
    bg: "temple",
  },
  {
    name: "Hermit",
    title: "The Mountain Sage",
    rim: "#84cc16",
    hp: 112,
    damageMul: 0.95,
    speedMul: 1.05,
    aggression: 0.6,
    blockChance: 0.3,
    reaction: 0.26,
    combo: 3,
    bg: "bamboo",
  },
  {
    name: "Widow",
    title: "The Silent Blade",
    rim: "#e879f9",
    hp: 116,
    damageMul: 1.05,
    speedMul: 1.12,
    aggression: 0.66,
    blockChance: 0.36,
    reaction: 0.22,
    combo: 3,
    blade: true,
    bg: "moon",
  },
  {
    name: "Butcher",
    title: "The Brute",
    rim: "#fb7185",
    hp: 140,
    damageMul: 1.15,
    speedMul: 0.96,
    aggression: 0.7,
    blockChance: 0.3,
    reaction: 0.24,
    combo: 3,
    bg: "volcano",
  },
  {
    name: "Shogun",
    title: "The Warlord",
    rim: "#ef4444",
    hp: 152,
    damageMul: 1.2,
    speedMul: 1.08,
    aggression: 0.74,
    blockChance: 0.46,
    reaction: 0.18,
    combo: 4,
    blade: true,
    bg: "snow",
  },
  {
    name: "Titan",
    title: "The Shadow Lord",
    rim: "#a78bfa",
    hp: 184,
    damageMul: 1.35,
    speedMul: 1.05,
    aggression: 0.8,
    blockChance: 0.5,
    reaction: 0.15,
    combo: 4,
    blade: true,
    bg: "moon",
  },
];

export interface Announcement {
  main: string;
  sub?: string;
  timer: number;
  big?: boolean;
}

export class GameEngine {
  player: Fighter;
  enemy: Fighter;
  ai: EnemyAI;

  opponentIndex = 0;
  phase: Phase = "menu";
  roundNo = 1;
  playerWins = 0;
  enemyWins = 0;
  roundTimer = ROUND_TIME;

  particles: Particle[] = [];
  texts: FloatingText[] = [];
  shake = 0;
  hitstop = 0;
  time = 0; // global elapsed (for bg effects)
  flash = 0;

  playerCombo = 0;
  playerComboTimer = 0;
  maxCombo = 0;

  announce: Announcement | null = null;
  phaseTimer = 0;

  input: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    block: false,
  };

  // for edge-triggered player attacks we mirror into fighter; fighter handles edges.
  constructor() {
    this.player = new Fighter({
      x: 360,
      isPlayer: true,
      facing: 1,
      maxHp: 120,
      rim: "#e2e8f0",
      name: "You",
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

  // ---- Flow control ----
  startMatch() {
    this.opponentIndex = 0;
    this.ai = new EnemyAI(OPPONENTS[0]);
    this.enemy = this.makeEnemy(0);
    this.playerWins = 0;
    this.enemyWins = 0;
    this.roundNo = 1;
    this.startRound();
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
    this.shake = 0;
    this.hitstop = 0;
    this.phase = "intro";
    this.phaseTimer = 2.2;
    this.setAnnounce(`ROUND ${this.roundNo}`, this.vsText(), 2.2, true);
  }

  private vsText() {
    return `${this.player.name} vs ${this.opponent.name}`;
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
    if (this.flash > 0) this.flash -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    if (this.announce) {
      this.announce.timer -= dt;
      if (this.announce.timer <= 0) this.announce = null;
    }

    this.updateParticles(dt);
    this.updateTexts(dt);

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

    switch (this.phase) {
      case "menu":
        // idle pose on menu
        this.player.update(dt, null, this.enemy);
        this.enemy.update(dt, null, this.player);
        break;
      case "intro":
        this.player.update(dt, null, this.enemy);
        this.enemy.update(dt, null, this.player);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = "fight";
          this.setAnnounce("FIGHT!", undefined, 0.9, true);
        }
        break;
      case "fight":
        this.updateFight(dt);
        break;
      case "round_end":
        this.player.update(dt, null, this.enemy);
        this.enemy.update(dt, null, this.player);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.afterRoundEnd();
        break;
      case "match_end":
        this.player.update(dt, null, this.enemy);
        this.enemy.update(dt, null, this.player);
        break;
      case "game_over":
      case "champion":
        this.player.update(dt, null, this.enemy);
        this.enemy.update(dt, null, this.player);
        break;
    }
  }

  private updateFight(dt: number) {
    const enemyInput = this.ai.update(dt, this.enemy, this.player);
    this.player.update(dt, this.input, this.enemy);
    this.enemy.update(dt, enemyInput, this.player);

    this.player.separateFrom(this.enemy);

    this.resolveAttack(this.player, this.enemy);
    this.resolveAttack(this.enemy, this.player);

    // round timer
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
    const result = defender.takeHit(ab.spec, attacker.facing, attacker, (x, y, blocked) =>
      this.spawnSpark(x, y, blocked, ab.spec.type),
    );
    if (result.hit) {
      attacker.attackHasHit = true;
      this.hitstop = result.blocked ? 0.05 : 0.09;
      this.shake = Math.max(this.shake, result.blocked ? 5 : 11);
      this.flash = result.blocked ? 0.04 : 0.08;
      this.spawnDamageText(
        defender.x,
        bb.y - 10,
        result.blocked ? "BLOCK" : `-${result.dmg}`,
        result.blocked ? "#93c5fd" : "#fca5a5",
      );
      if (!result.blocked) this.spawnRing(defender.x - attacker.facing * 6, GROUND_Y + ab.spec.height);
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

  // ---- Particles ----
  private spawnSpark(x: number, y: number, blocked: boolean, type: string) {
    const n = blocked ? 8 : type === "kick" ? 18 : 12;
    const color = blocked ? "#93c5fd" : "#fef08a";
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * (blocked ? 120 : 260);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 2 + Math.random() * 3,
        color,
        kind: "spark",
        grav: 600,
      });
    }
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

  private spawnDamageText(x: number, y: number, text: string, color: string) {
    this.texts.push({
      x,
      y,
      vy: -70,
      life: 0.9,
      maxLife: 0.9,
      text,
      color,
      size: text.startsWith("-") ? 22 : 16,
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
      }
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
