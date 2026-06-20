// Enemy AI controller. Produces an InputState each frame for the enemy
// fighter based on the player's position and state.

import type { InputState, OpponentDef } from "./types";
import type { Fighter } from "./fighter";

type Mode = "approach" | "retreat" | "block" | "wait";

export class EnemyAI {
  decision = 0;
  mode: Mode = "approach";
  retreatTimer = 0;
  blockTimer = 0;
  comboLeft = 0;
  nextAttack: "punch" | "kick" | "roundhouse" | null = null;
  recoverTimer = 0;

  oppWasAttacking = false;
  pendingBlock = false;
  pendingRoll = false;
  pendingRollDir: 1 | -1 = 1;
  reactTimer = 0;

  jumpCooldown = 1.5;

  constructor(private def: OpponentDef) {}

  reset() {
    this.decision = 0.5 + Math.random() * 0.3; // initial telegraph pause
    this.mode = "approach";
    this.retreatTimer = 0;
    this.blockTimer = 0;
    this.comboLeft = 0;
    this.nextAttack = null;
    this.recoverTimer = 0;
    this.oppWasAttacking = false;
    this.pendingBlock = false;
    this.pendingRoll = false;
    this.reactTimer = 0;
  }

  update(dt: number, self: Fighter, opp: Fighter): InputState {
    const input: InputState = {
      left: false,
      right: false,
      up: false,
      down: false,
      punch: false,
      kick: false,
      roundhouse: false,
      roll: false,
      block: false,
    };

    // Can't do anything while committed.
    if (!self.canAct()) {
      this.oppWasAttacking = opp.isAttacking();
      return input;
    }

    const dist = opp.x - self.x;
    const adist = Math.abs(dist);
    const dirToOpp = dist >= 0 ? 1 : -1;

    // ---- Defensive reaction: detect a new player attack and either block or
    // roll-dodge away (SF2-style evasion).
    const oppAttacking = opp.isAttacking();
    if (oppAttacking && !this.oppWasAttacking) {
      if (adist < 160) {
        const dodgeRoll = Math.random() < this.def.blockChance * 0.7;
        if (dodgeRoll) {
          // roll away from the player
          const away = dirToOpp === 1 ? -1 : 1;
          this.pendingRollDir = away;
          this.pendingRoll = true;
          this.reactTimer = this.def.reaction;
        } else if (Math.random() < this.def.blockChance) {
          this.pendingBlock = true;
          this.reactTimer = this.def.reaction;
        }
      }
    }
    this.oppWasAttacking = oppAttacking;
    if (this.pendingRoll) {
      this.reactTimer -= dt;
      if (this.reactTimer <= 0) {
        // set the roll input briefly (edge-triggered)
        input.roll = true;
        if (this.pendingRollDir === 1) input.right = true;
        else input.left = true;
        this.pendingRoll = false;
        this.recoverTimer = 0.3;
        return input;
      }
    }
    if (this.pendingBlock) {
      this.reactTimer -= dt;
      if (this.reactTimer <= 0) {
        this.mode = "block";
        this.blockTimer = 0.4;
        this.pendingBlock = false;
      }
    }

    // ---- Active block.
    if (this.blockTimer > 0) {
      this.blockTimer -= dt;
      input.block = true;
      return input;
    }
    if (this.mode === "block" && this.blockTimer <= 0) this.mode = "approach";

    // ---- Retreat.
    this.retreatTimer -= dt;
    if (this.retreatTimer > 0) {
      if (dirToOpp === 1) input.left = true;
      else input.right = true;
      return input;
    }

    // ---- Continue an in-progress combo (spaced by attack duration via canAct).
    const inPunch = adist < 64;
    const inKick = adist < 98;
    const inRound = adist < 104;
    if (this.comboLeft > 0 && (inPunch || inKick)) {
      const choice = this.nextAttack ?? (inPunch ? "punch" : "kick");
      if (choice === "punch") input.punch = true;
      else if (choice === "kick") input.kick = true;
      else input.roundhouse = true;
      this.comboLeft -= 1;
      this.nextAttack = null;
      // long recovery pause after a combo so the player has openings to punish
      this.decision = 0.75 + Math.random() * 0.55;
      this.recoverTimer = 0.6 + Math.random() * 0.5;
      return input;
    }

    this.decision -= dt;
    this.jumpCooldown -= dt;
    if (this.recoverTimer > 0) this.recoverTimer -= dt;

    if (this.decision <= 0) {
      this.decision = 0.4 + Math.random() * 0.4;

      if ((inKick || inPunch) && this.recoverTimer <= 0) {
        // In range & not recovering: attack, retreat, or wait/defend.
        const r = Math.random();
        if (r < this.def.aggression) {
          this.comboLeft = 1 + Math.floor(Math.random() * this.def.combo);
          // Strong opponents sometimes throw a roundhouse (big, slow, punishable).
          const canRh =
            inRound &&
            this.def.aggression > 0.58 &&
            Math.random() < 0.16;
          if (canRh) this.nextAttack = "roundhouse";
          else if (inPunch && Math.random() < 0.7) this.nextAttack = "punch";
          else this.nextAttack = "kick";
          return input;
        } else if (r < this.def.aggression + 0.16) {
          // short back-step
          this.retreatTimer = 0.2 + Math.random() * 0.3;
          return input;
        } else {
          // stand; occasionally raise guard
          if (Math.random() < this.def.blockChance * 1.5) {
            this.mode = "block";
            this.blockTimer = 0.3 + Math.random() * 0.3;
          }
          this.decision = 0.3 + Math.random() * 0.3;
          return input;
        }
      } else {
        // Out of range (or recovering): approach (sometimes jump-in).
        this.mode = "approach";
        if (adist > 230 && this.jumpCooldown <= 0 && Math.random() < 0.35) {
          input.up = true;
          this.jumpCooldown = 1.4 + Math.random();
        }
      }
    }

    // ---- Default: approach the player.
    if (this.mode === "approach" && this.recoverTimer <= 0 && adist > 66) {
      if (dirToOpp === 1) input.right = true;
      else input.left = true;
    }
    return input;
  }
}
