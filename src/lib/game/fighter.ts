// Fighter entity: physics, state machine, actions, hitboxes, damage.

import type { AttackSpec, Facing, InputState, Pose, Rect } from "./types";
import {
  ATTACK_SPECS,
  ACTIVE_WINDOW,
  BASE,
  STATE_DUR,
  clamp,
  poseFor,
} from "./poses";

export const GROUND_Y = 470; // virtual ground (canvas is scaled to fit)
export const WALK_SPEED = 182;
export const JUMP_VEL = 460;
export const GRAVITY = 1500;
export const STAGE_LEFT = 70;
export const STAGE_RIGHT = 890;

export interface FighterOpts {
  x: number;
  isPlayer: boolean;
  facing: Facing;
  maxHp: number;
  rim: string;
  name: string;
  damageMul?: number;
  speedMul?: number;
}

export class Fighter {
  x: number;
  y = GROUND_Y;
  vx = 0;
  vy = 0;
  facing: Facing;
  isPlayer: boolean;
  maxHp: number;
  hp: number;
  rim: string;
  name: string;
  damageMul: number;
  speedMul: number;

  state: import("./types").FighterState = "idle";
  stateTime = 0;
  walkPhase = 0;
  crouchAmt = 0;
  onGround = true;

  attackHasHit = false;
  currentAttack: "punch" | "kick" | null = null;
  hitstun = 0;
  blockHeld = false;
  invuln = 0;

  // buffered input edge
  private prevPunch = false;
  private prevKick = false;

  // knockdown get-up
  downTimer = 0;

  constructor(o: FighterOpts) {
    this.x = o.x;
    this.facing = o.facing;
    this.isPlayer = o.isPlayer;
    this.maxHp = o.maxHp;
    this.hp = o.maxHp;
    this.rim = o.rim;
    this.name = o.name;
    this.damageMul = o.damageMul ?? 1;
    this.speedMul = o.speedMul ?? 1;
  }

  reset(x: number, facing: Facing) {
    this.x = x;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.state = "idle";
    this.stateTime = 0;
    this.walkPhase = 0;
    this.crouchAmt = 0;
    this.onGround = true;
    this.attackHasHit = false;
    this.currentAttack = null;
    this.hitstun = 0;
    this.blockHeld = false;
    this.invuln = 0;
    this.downTimer = 0;
    this.hp = this.maxHp;
  }

  get dur(): number {
    return STATE_DUR[this.state] ?? 0;
  }

  get progress(): number {
    return this.dur > 0 ? clamp(this.stateTime / this.dur, 0, 1) : 0;
  }

  canAct(): boolean {
    if (!this.onGround) return false;
    if (this.state === "hit" || this.state === "knockdown") return false;
    if (this.state === "getup") return false;
    if (this.state === "victory" || this.state === "defeated") return false;
    return true;
  }

  canCancel(): boolean {
    // attacks can be cancelled into block only during recovery
    return false;
  }

  isAttacking(): boolean {
    return this.state === "punch" || this.state === "kick";
  }

  isBlocking(): boolean {
    return this.state === "block";
  }

  private setState(s: import("./types").FighterState) {
    if (this.state !== s) {
      this.state = s;
      this.stateTime = 0;
      if (s === "punch" || s === "kick") {
        this.attackHasHit = false;
        this.currentAttack = s;
      } else if (s !== "hit") {
        this.currentAttack = null;
      }
    }
  }

  startAttack(type: "punch" | "kick") {
    if (!this.canAct()) return;
    if (this.crouchAmt > 0.5) return; // can't attack while crouching low
    this.setState(type);
  }

  startBlock() {
    if (!this.canAct()) return;
    if (this.state !== "block") this.setState("block");
  }

  jump() {
    if (!this.canAct()) return;
    if (!this.onGround) return;
    this.vy = -JUMP_VEL;
    this.onGround = false;
    this.setState("jump");
  }

  // Apply a hit from an attacker. Returns true if it landed.
  takeHit(
    spec: AttackSpec,
    fromFacing: Facing,
    attacker: Fighter,
    onSpark: (x: number, y: number, blocked: boolean) => void,
  ): { hit: boolean; blocked: boolean; dmg: number } {
    if (this.invuln > 0) return { hit: false, blocked: false, dmg: 0 };
    if (
      this.state === "knockdown" ||
      this.state === "defeated" ||
      this.state === "getup"
    )
      return { hit: false, blocked: false, dmg: 0 };

    const blocked =
      this.isBlocking() && this.facing === -fromFacing && this.onGround;

    let dmg = spec.damage * attacker.damageMul;
    if (blocked) dmg *= 0.18;
    dmg = Math.round(dmg);

    this.hp = Math.max(0, this.hp - dmg);

    const hitX = this.x - fromFacing * 10;
    const hitY = GROUND_Y + spec.height;
    onSpark(hitX, hitY, blocked);

    if (blocked) {
      // small pushback, stay in block
      this.vx = -fromFacing * spec.knockback * 0.25;
      this.hitstun = Math.max(this.hitstun, 0.12);
      return { hit: true, blocked: true, dmg };
    }

    // Active-frame trade: if the defender is in the active frames of their own
    // attack, they "armor through" — take the damage but keep attacking so the
    // blow still lands. This prevents attacks from being stuffed during active
    // frames and makes trades resolve cleanly (both fighters connect).
    if (this.attackBox()) {
      this.invuln = 0.12;
      return { hit: true, blocked: false, dmg };
    }

    // heavy hit / low hp -> knockdown. Lethal blows always knock down;
    // kicks have a chance to sweep the opponent; very heavy hits too.
    const lethal = this.hp <= 0;
    const heavy =
      lethal ||
      (spec.type === "kick" && Math.random() < 0.22) ||
      dmg >= 20;
    if (heavy) {
      this.vx = -fromFacing * spec.knockback;
      this.setState("knockdown");
      this.downTimer = lethal ? 99 : 0.9;
      if (spec.launch) this.vy = -spec.launch;
      this.hitstun = 0.9;
      // invulnerable through knockdown + getup so they always recover
      this.invuln = 1.4;
    } else {
      this.vx = -fromFacing * spec.knockback * 0.7;
      this.setState("hit");
      this.hitstun = spec.hitstun;
      // Recovery window: invulnerable long enough to act after hitstun ends,
      // preventing lock-down loops while still allowing short strings.
      this.invuln = 0.46;
    }
    return { hit: true, blocked: false, dmg };
  }

  // Compute current pose.
  pose(): Pose {
    return poseFor({
      state: this.state,
      p: this.progress,
      time: this.stateTime,
      walkPhase: this.walkPhase,
      crouchAmt: this.crouchAmt,
    });
  }

  // Body collision box (world space).
  bodyBox(): Rect {
    const p = this.pose();
    const hipY = this.y - 70 + p.hipDrop;
    const shoulderY = hipY - 48;
    const headTop = shoulderY - 30;
    const top = this.state === "knockdown" || this.state === "defeated"
      ? this.y - 40
      : headTop;
    const bottom = this.y;
    return { x: this.x - 15, y: top, w: 30, h: bottom - top };
  }

  // Active attack hitbox (world space), or null if not in active frames.
  attackBox(): { rect: Rect; spec: AttackSpec } | null {
    if (!this.isAttacking() || !this.currentAttack) return null;
    const spec = ATTACK_SPECS[this.currentAttack];
    const [a0, a1] = ACTIVE_WINDOW[this.currentAttack];
    const p = this.progress;
    if (p < a0 || p > a1) return null;
    const frontX = this.x + this.facing * 14;
    const cy = GROUND_Y + spec.height;
    const rx =
      this.facing === 1 ? frontX : frontX - this.facing * spec.range;
    // facing left -> range extends left
    const x = this.facing === 1 ? frontX : frontX - spec.range;
    return {
      rect: { x, y: cy - spec.hitH / 2, w: spec.range, h: spec.hitH },
      spec,
    };
  }

  update(dt: number, input: InputState | null, opp: Fighter) {
    this.stateTime += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitstun > 0) this.hitstun -= dt;

    // Auto-face opponent when free on ground.
    if (
      this.onGround &&
      this.state !== "punch" &&
      this.state !== "kick" &&
      this.state !== "hit" &&
      this.state !== "knockdown" &&
      this.state !== "getup" &&
      this.state !== "victory" &&
      this.state !== "defeated"
    ) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }

    // Knockdown / getup handling.
    if (this.state === "knockdown") {
      if (this.progress >= 1) {
        // Lethal blow -> stay down (defeated). Otherwise get back up.
        if (this.hp <= 0) {
          this.state = "defeated";
          this.stateTime = 0;
        } else {
          this.setState("getup");
        }
      }
      this.applyPhysics(dt);
      return;
    }
    if (this.state === "defeated") {
      this.downTimer -= dt;
      // stays down
      this.applyPhysics(dt);
      return;
    }

    // Hit state: no input, physics applies, returns to idle after dur.
    if (this.state === "hit") {
      if (this.progress >= 1 && this.hitstun <= 0) {
        this.setState("idle");
      }
      this.applyPhysics(dt);
      return;
    }
    if (this.state === "getup") {
      if (this.progress >= 1) this.setState("idle");
      this.applyPhysics(dt);
      return;
    }

    // Victory / defeated freeze.
    if (this.state === "victory") {
      this.applyPhysics(dt);
      return;
    }

    // Player or AI input handling.
    if (input) {
      this.handleInput(dt, input, opp);
    }
    this.applyPhysics(dt);
  }

  private handleInput(dt: number, input: InputState, opp: Fighter) {
    this.blockHeld = input.block;

    // If currently attacking, let it play out (no cancel), but still physics.
    if (this.isAttacking()) {
      if (this.progress >= 1) this.setState("idle");
      return;
    }

    // Block (hold). Cancels movement.
    if (input.block && this.onGround) {
      this.startBlock();
      this.vx *= 0.6;
      this.crouchAmt = lerpTo(this.crouchAmt, 0, dt, 8);
      return;
    }
    if (this.state === "block") this.setState("idle");

    // Attacks (edge-triggered).
    const punchEdge = input.punch && !this.prevPunch;
    const kickEdge = input.kick && !this.prevKick;
    this.prevPunch = input.punch;
    this.prevKick = input.kick;

    if (punchEdge) {
      this.startAttack("punch");
      return;
    }
    if (kickEdge) {
      this.startAttack("kick");
      return;
    }

    // Jump.
    if (input.up && this.onGround) {
      this.jump();
      return;
    }

    // Crouch.
    if (input.down && this.onGround) {
      this.crouchAmt = lerpTo(this.crouchAmt, 1, dt, 10);
      if (this.state !== "crouch") this.setState("crouch");
      this.vx *= 0.5;
      return;
    } else {
      this.crouchAmt = lerpTo(this.crouchAmt, 0, dt, 10);
      if (this.state === "crouch" && this.crouchAmt < 0.1)
        this.setState("idle");
    }

    // Movement.
    if (this.onGround) {
      let move = 0;
      if (input.left) move -= 1;
      if (input.right) move += 1;
      if (move !== 0) {
        const speed = WALK_SPEED * this.speedMul;
        // walking toward opponent = walk_fwd, away = walk_back (for anim flavor)
        this.vx = move * speed;
        const toward = Math.sign(opp.x - this.x) === move ? 1 : -1;
        this.setState(toward === 1 ? "walk_fwd" : "walk_back");
        this.walkPhase += dt * 9 * Math.abs(move);
      } else {
        this.vx *= 0.6;
        if (this.state === "walk_fwd" || this.state === "walk_back")
          this.setState("idle");
      }
    } else {
      // air control
      let move = 0;
      if (input.left) move -= 1;
      if (input.right) move += 1;
      this.vx = move * WALK_SPEED * 0.8 * this.speedMul;
      if (this.state === "jump") {
        // keep jump state until landing
      }
    }

    if (this.state === "idle") this.walkPhase += dt * 1.5;
  }

  private applyPhysics(dt: number) {
    // gravity
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // ground
    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      if (!this.onGround) {
        this.onGround = true;
        this.vy = 0;
        if (this.state === "jump") {
          this.setState("idle");
          // dust
        }
      }
    } else {
      this.onGround = false;
    }

    // friction when grounded & not walking
    if (this.onGround && !this.isWalkingInput()) {
      this.vx *= 0.8;
    }

    // stage bounds
    this.x = clamp(this.x, STAGE_LEFT, STAGE_RIGHT);
  }

  private isWalkingInput(): boolean {
    return this.state === "walk_fwd" || this.state === "walk_back";
  }

  // Called by engine to resolve overlap with opponent.
  separateFrom(opp: Fighter) {
    const minDist = 34;
    const dx = this.x - opp.x;
    const dist = Math.abs(dx);
    if (dist < minDist && this.onGround && opp.onGround) {
      const push = (minDist - dist) / 2;
      const dir = dx >= 0 ? 1 : -1;
      this.x += dir * push;
      opp.x -= dir * push;
      this.x = clamp(this.x, STAGE_LEFT, STAGE_RIGHT);
      opp.x = clamp(opp.x, STAGE_LEFT, STAGE_RIGHT);
    }
  }
}

function lerpTo(cur: number, target: number, dt: number, rate: number) {
  const t = Math.min(1, dt * rate);
  return cur + (target - cur) * t;
}
