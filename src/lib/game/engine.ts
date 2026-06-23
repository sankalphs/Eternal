// Game engine: match/round flow, collision resolution, particles, effects.

import { Fighter, GROUND_Y, STAGE_LEFT, STAGE_RIGHT } from "./fighter";
import { EnemyAI } from "./ai";
import { RLController, rlTrainer } from "./rl";
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
    title: "The Last Apprentice",
    rim: "#f59e0b",
    hp: 70,
    damageMul: 0.55,
    speedMul: 0.85,
    aggression: 0.34,
    blockChance: 0.08,
    reaction: 0.55,
    combo: 1,
    bg: "sunset",
    bodyType: "lean",
    weapon: "fists",
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
    title: "The Defector",
    rim: "#fbbf24",
    hp: 84,
    damageMul: 0.68,
    speedMul: 0.95,
    aggression: 0.44,
    blockChance: 0.14,
    reaction: 0.44,
    combo: 2,
    bg: "desert",
    bodyType: "lean",
    weapon: "sword",
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
    title: "The Temple Guard",
    rim: "#2dd4bf",
    hp: 100,
    damageMul: 0.82,
    speedMul: 1.0,
    aggression: 0.54,
    blockChance: 0.26,
    reaction: 0.32,
    combo: 2,
    bg: "temple",
    bodyType: "tall",
    weapon: "spear",
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
    title: "The Hermit",
    rim: "#84cc16",
    hp: 114,
    damageMul: 0.94,
    speedMul: 1.06,
    aggression: 0.62,
    blockChance: 0.32,
    reaction: 0.26,
    combo: 3,
    bg: "bamboo",
    bodyType: "hunched",
    weapon: "dual",
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
    title: "The Nightblade",
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
    bodyType: "lean",
    weapon: "chain",
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
    title: "The Colossus",
    rim: "#fb7185",
    hp: 144,
    damageMul: 1.18,
    speedMul: 0.98,
    aggression: 0.74,
    blockChance: 0.34,
    reaction: 0.22,
    combo: 3,
    bg: "volcano",
    bodyType: "bulky",
    weapon: "fists",
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
    title: "The Shogun",
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
    bodyType: "bulky",
    weapon: "sword",
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
    title: "The World's Last Hope",
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
    bodyType: "tall",
    weapon: "sword",
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

// The RL Ghost — a hidden 9th opponent driven by the trained PPO policy.
// Not part of the story tournament; only accessible via the menu's
// "Fight RL Ghost" button. Its stats mirror Titan so the fight is fair
// regardless of how well-trained the policy is.
export const RL_GHOST: OpponentDef = {
  name: "The Ghost",
  title: "The Learned Shadow",
  rim: "#a78bfa",
  hp: 160,
  damageMul: 1.1,
  speedMul: 1.05,
  aggression: 0.8,
  blockChance: 0.5,
  reaction: 0.15,
  combo: 3,
  bg: "moon",
  bodyType: "lean",
  weapon: "fists",
  story:
    "A shadow born of a thousand self-play battles. It has learned what you will do before you do it.",
};

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
  hitType: "punch" | "kick" | "roundhouse" | "super" | null;
}

export class GameEngine {
  player: Fighter;
  enemy: Fighter;
  ai: EnemyAI;

  opponentIndex = 0;
  sceneOverride: BackgroundId | null = null;
  // When true, the enemy is driven by the trained RL policy (RLController)
  // instead of the rule-based EnemyAI. Set by startRLGhost().
  rlMode = false;
  rlController: RLController | null = null;
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

  // second-player input (used when twoPlayer mode is active)
  p2Input: InputState = {
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

  // when true, `enemy` is human-controlled via p2Input instead of by the AI
  twoPlayer = false;

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
      bodyType: def.bodyType,
      weapon: def.weapon,
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
    this.twoPlayer = false;
    this.rlMode = false;
    this.ai = new EnemyAI(OPPONENTS[this.opponentIndex]);
    this.enemy = this.makeEnemy(this.opponentIndex);
    this.playerWins = 0;
    this.enemyWins = 0;
    this.roundNo = 1;
    this.maxCombo = 0;
    this.startRound();
  }

  // Two-player versus: spawn a second human-controlled shadow fighter
  // (mirrored stats) instead of an AI opponent. Plays on the current scene.
  startTwoPlayer() {
    this.twoPlayer = true;
    this.rlMode = false;
    this.sceneOverride = this.sceneOverride ?? "sunset";
    this.enemy = new Fighter({
      x: 600,
      isPlayer: false,
      facing: -1,
      maxHp: this.player.maxHp,
      rim: "#f87171",
      name: "Player 2",
      damageMul: 1.15,
      blade: true,
      bodyType: "lean",
      weapon: "sword",
    });
    this.playerWins = 0;
    this.enemyWins = 0;
    this.roundNo = 1;
    this.maxCombo = 0;
    this.startRound();
  }

  // Fight the RL Ghost — an opponent driven by the trained PPO policy.
  // If no policy is trained yet, falls back to a strong rule-based AI so the
  // mode is always playable. Uses the shared rlTrainer singleton's agent.
  startRLGhost() {
    this.twoPlayer = false;
    this.rlMode = false;
    this.rlMode = true;
    this.sceneOverride = RL_GHOST.bg;
    this.enemy = new Fighter({
      x: 600,
      isPlayer: false,
      facing: -1,
      maxHp: RL_GHOST.hp,
      rim: RL_GHOST.rim,
      name: RL_GHOST.name,
      damageMul: RL_GHOST.damageMul,
      speedMul: RL_GHOST.speedMul,
      blade: false,
      bodyType: RL_GHOST.bodyType,
      weapon: RL_GHOST.weapon,
    });
    // Always create a controller backed by the shared (possibly-trained) agent.
    // If the agent has no training yet, the policy is random — but still playable.
    this.rlController = new RLController(rlTrainer.agent);
    this.rlController.reset();
    // Keep a rule-based AI as fallback for the announce/intro text
    this.ai = new EnemyAI(RL_GHOST);
    this.playerWins = 0;
    this.enemyWins = 0;
    this.roundNo = 1;
    this.maxCombo = 0;
    this.startRound();
  }

  // Whether the RL Ghost is ready to fight with a trained policy.
  get rlReady(): boolean {
    return rlTrainer.agent.isTrained;
  }

  // Skip straight to the destruction ending: jump to the final opponent,
  // then immediately advance to the champion phase (bypasses the tournament).
  skipToChampion() {
    this.opponentIndex = OPPONENTS.length - 1;
    this.nextOpponent();
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
    this.twoPlayer = false;
    this.rlMode = false;
    this.ai = new EnemyAI(OPPONENTS[this.opponentIndex]);
    this.enemy = this.makeEnemy(this.opponentIndex);
    this.playerWins = 0;
    this.enemyWins = 0;
    this.roundNo = 1;
    this.startRound();
  }

  // Retry the current opponent from round 1 (after a game over).
  retryMatch() {
    this.twoPlayer = false;
    this.rlMode = false;
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
    if (!this.twoPlayer) this.ai.reset();
    if (this.rlMode && this.rlController) this.rlController.reset();
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
    // Round 1 of a fresh match: a boss-intro beat — announce the opponent
    // by name + title and snap the camera into a slow zoom-out + flash.
    if (this.roundNo === 1 && !this.twoPlayer) {
      // In RL mode, announce the Ghost; otherwise use the story opponent.
      const ann = this.rlMode ? RL_GHOST : this.opponent;
      this.setAnnounce(
        ann.name.toUpperCase(),
        ann.title,
        2.4,
        true,
      );
      this.zoom = 0.3;
      this.flash = 0.5;
      this.flashColor = this.opponent.rim;
    } else {
      this.setAnnounce(`ROUND ${this.roundNo}`, this.vsText(), 2.2, true);
    }
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
    // Enemy input source depends on mode:
    //  - two-player: second human's p2Input
    //  - rlMode: trained PPO policy via RLController
    //  - default: rule-based EnemyAI
    let enemyInput: InputState;
    if (this.twoPlayer) {
      enemyInput = this.p2Input;
    } else if (this.rlMode && this.rlController) {
      enemyInput = this.rlController.getInput(this.enemy, this.player);
    } else {
      enemyInput = this.ai.update(simDt, this.enemy, this.player);
    }
    this.player.update(simDt, this.input, this.enemy);
    this.enemy.update(simDt, enemyInput, this.player);

    this.player.separateFrom(this.enemy);

    this.resolveAttack(this.player, this.enemy);
    this.resolveAttack(this.enemy, this.player);

    // environmental hazards (volcano / snow / temple)
    this.updateHazards(dt);

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

  // Per-arena environmental hazards: volcano scorches fighters near the edges,
  // snow reduces traction (friction), temple drops debris from above.
  private updateHazards(dt: number) {
    const scene = this.scene;
    if (scene === "volcano") {
      // burning edges — chip damage when standing on the stage apron
      for (const f of [this.player, this.enemy]) {
        const nearEdge =
          f.x <= STAGE_LEFT + 36 || f.x >= STAGE_RIGHT - 36;
        if (nearEdge && f.onGround && f.invuln <= 0 && f.hp > 0) {
          f.hp = Math.max(0, f.hp - 6 * dt);
          // ember sparks at the feet
          if (Math.random() < dt * 8) {
            this.particles.push({
              x: f.x + (Math.random() - 0.5) * 18,
              y: GROUND_Y - 2,
              vx: (Math.random() - 0.5) * 50,
              vy: -60 - Math.random() * 80,
              life: 0.4,
              maxLife: 0.5,
              size: 2 + Math.random() * 2,
              color: Math.random() < 0.5 ? "#fb923c" : "#fde047",
              kind: "spark",
              grav: 220,
            });
          }
        }
      }
    } else if (scene === "snow") {
      // reduced traction: bleed off horizontal velocity more slowly so fighters
      // slide further on stops and turns (apply a soft damping instead of the
      // normal ground friction handled inside the fighter).
      for (const f of [this.player, this.enemy]) {
        if (f.onGround && Math.abs(f.vx) > 10) {
          // tiny slip — preserves a fraction of momentum each frame
          f.vx *= 1 - 0.4 * dt;
        }
      }
      // gentle snow dust at the fighters' feet
      if (Math.random() < dt * 4) {
        for (const f of [this.player, this.enemy]) {
          if (!f.onGround) continue;
          this.particles.push({
            x: f.x + (Math.random() - 0.5) * 24,
            y: GROUND_Y - 1,
            vx: (Math.random() - 0.5) * 20,
            vy: -10 - Math.random() * 20,
            life: 0.6,
            maxLife: 0.8,
            size: 2 + Math.random() * 2,
            color: "rgba(220,230,245,0.55)",
            kind: "dust",
            grav: 30,
          });
        }
      }
    } else if (scene === "temple") {
      // falling debris from the ceiling — a chip hazard for whoever it lands on
      if (Math.random() < dt * 0.55) {
        const x = 120 + Math.random() * (STAGE_RIGHT - STAGE_LEFT - 80);
        this.particles.push({
          x,
          y: 40,
          vx: (Math.random() - 0.5) * 30,
          vy: 80,
          life: 1.6,
          maxLife: 1.8,
          size: 5 + Math.random() * 5,
          color: "#7c6f5b",
          kind: "dust",
          grav: 460,
        });
        // schedule a hit check ~0.8s later when the debris reaches the floor
        const target = Math.abs(this.player.x - x) < 28 ? this.player
          : Math.abs(this.enemy.x - x) < 28 ? this.enemy
          : null;
        if (target && target.invuln <= 0 && target.hp > 0) {
          // small chip + flinch if the fighter is still there when it lands
          window.setTimeout(() => {
            if (
              this.phase !== "fight" ||
              target.hp <= 0
            )
              return;
            if (Math.abs(target.x - x) < 32 && target.onGround) {
              target.hp = Math.max(0, target.hp - 4);
              target.hitstun = Math.max(target.hitstun, 0.18);
              this.spawnSpark(x, GROUND_Y - 10, false, "roundhouse");
              this.shake = Math.max(this.shake, 8);
            }
          }, 800);
        }
      }
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
        (ab.spec.type === "kick" ||
          ab.spec.type === "roundhouse" ||
          ab.spec.type === "super" ||
          result.dmg >= 16);
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
    this.phaseTimer = 3.5;
    // enhanced dramatic KO VFX — long hitstop, hard shake, big flash,
    // punch-zoom, sustained slow-motion and chromatic aberration.
    this.hitstop = 0.6;
    this.shake = 40;
    this.flash = 0.7;
    this.flashColor = playerWon ? "#fde047" : "#f87171";
    this.zoom = 1.2;
    this.slowmo = 2.0;
    this.chromAb = 1.2;
    const koX = (this.player.x + this.enemy.x) / 2;
    // double shockwave: a fast bright ring then a slower dark follow-up
    this.spawnShockwave(koX, GROUND_Y - 90, 240, playerWon ? "#fde047" : "#f87171", 9);
    this.spawnShockwave(koX, GROUND_Y - 90, 360, playerWon ? "#fef3c7" : "#fecaca", 5);
    this.spawnStreakBurst(koX, GROUND_Y - 90, 48, playerWon ? "#fde047" : "#f87171");
    this.events.push({ kind: "ko", x: koX, y: GROUND_Y - 90, hitType: null });
    this.setAnnounce("K.O.", playerWon ? "You won the round" : "You lost the round", 3.0, true);
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
    // RL Ghost mode: the match ends after a win or loss (no next opponent).
    if (this.rlMode) {
      const ghostName = RL_GHOST.name;
      if (this.playerWins >= ROUNDS_TO_WIN) {
        this.phase = "match_end";
        this.phaseTimer = 0;
        this.setAnnounce("VICTORY", `${ghostName} defeated`, 999, true);
      } else if (this.enemyWins >= ROUNDS_TO_WIN) {
        this.phase = "game_over";
        this.phaseTimer = 0;
        this.setAnnounce("DEFEATED", `${ghostName} bested you`, 999, true);
      } else {
        this.roundNo += 1;
        this.startRound();
      }
      return;
    }
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
    const heavy = type === "kick" || type === "roundhouse" || type === "super";
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
