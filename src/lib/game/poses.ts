// Pose definitions and keyframe animation for shadow fighters.
// All angles in radians. Convention: 0 = straight down, positive = toward
// the fighter's front. Local space always faces right (mirrored at draw).

import type { Pose } from "./types";

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// Base fighting guard (hands up, slight stance).
export const BASE: Pose = {
  torsoLean: 0.07,
  headTilt: 0.05,
  hipDrop: 0,
  bArm: -0.38,
  bFore: 2.45,
  fArm: 0.5,
  fFore: 2.3,
  bThigh: -0.17,
  bShin: -0.12,
  fThigh: 0.17,
  fShin: 0.12,
};

function withBase(partial: Partial<Pose>): Pose {
  return { ...BASE, ...partial };
}

function interp(a: Pose, b: Partial<Pose>, t: number): Pose {
  const out: Pose = { ...a };
  for (const k in b) {
    const key = k as keyof Pose;
    out[key] = lerp(a[key], (b as Pose)[key], t);
  }
  return out;
}

// Keyframe interpolation over a list of [progress, partialPose].
function kf(
  frames: [number, Partial<Pose>][],
  p: number,
  base: Pose = BASE,
): Pose {
  if (p <= frames[0][0]) return withBase(frames[0][1]);
  for (let i = 0; i < frames.length - 1; i++) {
    const [p0, f0] = frames[i];
    const [p1, f1] = frames[i + 1];
    if (p <= p1) {
      const t = (p - p0) / (p1 - p0 || 1);
      const poseA = withBase(f0);
      const poseB = withBase(f1);
      const out: Pose = { ...poseA };
      (Object.keys(poseB) as (keyof Pose)[]).forEach((k) => {
        out[k] = lerp(poseA[k], poseB[k], t);
      });
      return out;
    }
  }
  return withBase(frames[frames.length - 1][1]);
}

export interface PoseCtx {
  state: string;
  p: number; // normalized progress 0..1 for finite states
  time: number; // seconds in state (for procedural loops)
  walkPhase: number;
  crouchAmt: number; // 0..1 how crouched
}

// Returns the pose for the current state. Procedural for idle/walk/crouch;
// keyframed for attacks/block/hit/knockdown.
export function poseFor(c: PoseCtx): Pose {
  switch (c.state) {
    case "idle": {
      const breathe = Math.sin(c.time * 2.2) * 0.5;
      return {
        ...BASE,
        hipDrop: breathe * 0.6,
        fFore: BASE.fFore + breathe * 0.03,
        bFore: BASE.bFore + breathe * 0.03,
        torsoLean: BASE.torsoLean + breathe * 0.004,
      };
    }
    case "walk_fwd":
    case "walk_back": {
      const ph = c.walkPhase;
      const swing = 0.42;
      const bob = Math.abs(Math.sin(ph)) * 2.5;
      return {
        ...BASE,
        hipDrop: bob,
        bThigh: -0.17 + Math.sin(ph) * swing,
        fThigh: 0.17 + Math.sin(ph + Math.PI) * swing,
        bShin: -0.12 + Math.max(0, Math.sin(ph)) * 0.5,
        fShin: 0.12 + Math.max(0, Math.sin(ph + Math.PI)) * 0.5,
        fArm: BASE.fArm + Math.sin(ph + Math.PI) * 0.35,
        bArm: BASE.bArm + Math.sin(ph) * 0.35,
        fFore: 2.0,
        bFore: 2.0,
      };
    }
    case "crouch": {
      const amt = c.crouchAmt;
      const target: Partial<Pose> = {
        hipDrop: 34 * amt,
        bThigh: lerp(-0.17, 1.15, amt),
        bShin: lerp(-0.12, -0.85, amt),
        fThigh: lerp(0.17, 1.25, amt),
        fShin: lerp(0.12, -0.7, amt),
        torsoLean: lerp(BASE.torsoLean, 0.28, amt),
        fArm: lerp(BASE.fArm, 0.7, amt),
        fFore: lerp(BASE.fFore, 1.9, amt),
        bArm: lerp(BASE.bArm, 0.3, amt),
        bFore: lerp(BASE.bFore, 1.95, amt),
      };
      return withBase(target);
    }
    case "jump": {
      // Acrobatic forward flip: tuck hard (knees to chest, arms in). The body
      // rotation (spin) is applied by the renderer, so the pose just tucks.
      const jp = c.p;
      // tuck peaks mid-flight
      const tuck = Math.sin(Math.min(jp, 1) * Math.PI);
      return {
        ...BASE,
        hipDrop: -4 - 6 * tuck,
        torsoLean: 0.15 + 0.3 * tuck,
        headTilt: 0.25 * tuck,
        bThigh: -0.1 + 1.55 * tuck,
        bShin: -0.1 + 1.9 * tuck,
        fThigh: 0.2 + 1.65 * tuck,
        fShin: 0.2 + 2.0 * tuck,
        fArm: BASE.fArm - 1.1 * tuck,
        bArm: BASE.bArm - 1.1 * tuck,
        fFore: 1.5 + 0.3 * tuck,
        bFore: 1.6 + 0.3 * tuck,
      };
    }
    case "roll": {
      // Tucked ball: everything curled tight. Spin (renderer) does the roll.
      const tuck = Math.sin(Math.min(c.p, 1) * Math.PI);
      return {
        ...BASE,
        hipDrop: 26 - 6 * tuck,
        torsoLean: 0.5 + 0.4 * tuck,
        headTilt: 0.4 + 0.3 * tuck,
        bThigh: 1.5 + 0.2 * tuck,
        bShin: 2.4,
        fThigh: 1.7 + 0.2 * tuck,
        fShin: 2.5,
        fArm: 1.3,
        fFore: 1.2,
        bArm: 1.0,
        bFore: 1.1,
      };
    }
    case "punch": {
      // Lead-hand straight. Quick jab — extends very early so it lands before
      // a retreating opponent can back out of range.
      return kf(
        [
          [
            0,
            {
              torsoLean: 0.1,
              fArm: 0.9,
              fFore: 1.3,
              bArm: -0.5,
              bFore: 2.6,
              hipDrop: 1,
            },
          ],
          [
            0.14,
            {
              torsoLean: 0.16,
              fArm: 1.55,
              fFore: 1.55,
              bArm: -0.6,
              bFore: 2.7,
              hipDrop: 0,
            },
          ],
          [
            0.34,
            {
              torsoLean: 0.16,
              fArm: 1.55,
              fFore: 1.55,
              bArm: -0.6,
              bFore: 2.7,
              hipDrop: 0,
            },
          ],
          [
            1,
            {
              torsoLean: BASE.torsoLean,
              fArm: BASE.fArm,
              fFore: BASE.fFore,
              bArm: BASE.bArm,
              bFore: BASE.bFore,
              hipDrop: 0,
            },
          ],
        ],
        c.p,
      );
    }
    case "kick": {
      // Lead-leg front kick. Chamber -> extend -> recover.
      return kf(
        [
          [
            0,
            {
              torsoLean: -0.02,
              fThigh: 1.25,
              fShin: 2.55,
              bThigh: -0.3,
              bShin: -0.05,
              hipDrop: 4,
              fArm: 0.6,
              bArm: -0.9,
              bFore: 1.4,
            },
          ],
          [
            0.4,
            {
              torsoLean: 0.2,
              fThigh: 1.5,
              fShin: 1.5,
              bThigh: -0.35,
              bShin: -0.05,
              hipDrop: 0,
              fArm: 0.9,
              bArm: -1.1,
              bFore: 1.2,
            },
          ],
          [
            0.58,
            {
              torsoLean: 0.2,
              fThigh: 1.5,
              fShin: 1.5,
              bThigh: -0.35,
              bShin: -0.05,
              hipDrop: 0,
              fArm: 0.9,
              bArm: -1.1,
              bFore: 1.2,
            },
          ],
          [
            1,
            {
              torsoLean: BASE.torsoLean,
              fThigh: BASE.fThigh,
              fShin: BASE.fShin,
              bThigh: BASE.bThigh,
              bShin: BASE.bShin,
              hipDrop: 0,
              fArm: BASE.fArm,
              bArm: BASE.bArm,
              bFore: BASE.bFore,
            },
          ],
        ],
        c.p,
      );
    }
    case "roundhouse": {
      // Spinning heel kick: chamber high, then sweep the lead leg out
      // horizontally at torso/head height with full body rotation.
      return kf(
        [
          [
            0,
            {
              torsoLean: -0.1,
              headTilt: -0.12,
              fThigh: 1.6,
              fShin: 2.45,
              bThigh: -0.42,
              bShin: -0.1,
              hipDrop: 6,
              fArm: 0.35,
              fFore: 1.5,
              bArm: -1.0,
              bFore: 1.2,
            },
          ],
          [
            0.42,
            {
              torsoLean: 0.3,
              headTilt: 0.18,
              fThigh: 1.5,
              fShin: 1.5,
              bThigh: -0.5,
              bShin: -0.05,
              hipDrop: 0,
              fArm: 1.25,
              fFore: 1.1,
              bArm: -1.45,
              bFore: 0.9,
            },
          ],
          [
            0.62,
            {
              torsoLean: 0.3,
              headTilt: 0.18,
              fThigh: 1.5,
              fShin: 1.5,
              bThigh: -0.5,
              bShin: -0.05,
              hipDrop: 0,
              fArm: 1.25,
              fFore: 1.1,
              bArm: -1.45,
              bFore: 0.9,
            },
          ],
          [
            1,
            {
              torsoLean: BASE.torsoLean,
              headTilt: BASE.headTilt,
              fThigh: BASE.fThigh,
              fShin: BASE.fShin,
              bThigh: BASE.bThigh,
              bShin: BASE.bShin,
              hipDrop: 0,
              fArm: BASE.fArm,
              fFore: BASE.fFore,
              bArm: BASE.bArm,
              bFore: BASE.bFore,
            },
          ],
        ],
        c.p,
      );
    }
    case "block": {
      // Both forearms up in front, slight crouch.
      return {
        ...BASE,
        torsoLean: 0.12,
        hipDrop: 8,
        fArm: 0.85,
        fFore: 1.75,
        bArm: 0.55,
        bFore: 1.85,
        bThigh: -0.05,
        fThigh: 0.1,
      };
    }
    case "hit": {
      // Recoil backward, head back, arms flail.
      return kf(
        [
          [
            0,
            {
              torsoLean: -0.28,
              headTilt: -0.25,
              fArm: -0.9,
              fFore: 1.0,
              bArm: -1.1,
              bFore: -0.4,
              bThigh: -0.3,
              fThigh: 0.3,
              hipDrop: 2,
            },
          ],
          [
            1,
            {
              torsoLean: BASE.torsoLean,
              headTilt: BASE.headTilt,
              fArm: BASE.fArm,
              fFore: BASE.fFore,
              bArm: BASE.bArm,
              bFore: BASE.bFore,
              bThigh: BASE.bThigh,
              fThigh: BASE.fThigh,
              hipDrop: 0,
            },
          ],
        ],
        c.p,
      );
    }
    case "knockdown": {
      // Fall onto back: torso leans far back, hip drops near ground, limbs splay.
      return kf(
        [
          [
            0,
            {
              torsoLean: -0.3,
              hipDrop: 6,
              bThigh: -0.4,
              fThigh: 0.5,
              bShin: 0.2,
              fShin: 0.3,
              fArm: -1.0,
              bArm: -1.2,
              headTilt: -0.3,
            },
          ],
          [
            1,
            {
              torsoLean: -1.45,
              hipDrop: 44,
              bThigh: -0.9,
              fThigh: 0.9,
              bShin: 1.1,
              fShin: 1.2,
              fArm: -1.7,
              fFore: -1.6,
              bArm: -2.2,
              bFore: -2.0,
              headTilt: -0.5,
            },
          ],
        ],
        c.p,
      );
    }
    case "getup": {
      return kf(
        [
          [
            0,
            {
              torsoLean: -1.45,
              hipDrop: 44,
              bThigh: -0.9,
              fThigh: 0.9,
              bShin: 1.1,
              fShin: 1.2,
              fArm: -1.7,
              fFore: -1.6,
              bArm: -2.2,
              bFore: -2.0,
            },
          ],
          [
            1,
            {
              torsoLean: BASE.torsoLean,
              hipDrop: 0,
              bThigh: BASE.bThigh,
              fThigh: BASE.fThigh,
              bShin: BASE.bShin,
              fShin: BASE.fShin,
              fArm: BASE.fArm,
              fFore: BASE.fFore,
              bArm: BASE.bArm,
              bFore: BASE.bFore,
            },
          ],
        ],
        c.p,
      );
    }
    case "victory": {
      const w = Math.sin(c.time * 6) * 0.5 + 0.5;
      return {
        ...BASE,
        torsoLean: -0.05,
        hipDrop: -Math.abs(Math.sin(c.time * 4)) * 4,
        bArm: -2.4 - w * 0.2,
        bFore: -2.7,
        fArm: 2.4 + w * 0.2,
        fFore: 2.7,
        bThigh: -0.05,
        fThigh: 0.05,
      };
    }
    case "defeated": {
      return poseFor({ ...c, state: "knockdown", p: 1 });
    }
    default:
      return BASE;
  }
}

// State durations (seconds) for finite states.
export const STATE_DUR: Record<string, number> = {
  punch: 0.34,
  kick: 0.56,
  roundhouse: 0.82,
  hit: 0.26,
  knockdown: 0.65,
  getup: 0.5,
  roll: 0.5,
};

// Attack active-frame windows (progress within the attack state).
export const ACTIVE_WINDOW: Record<"punch" | "kick" | "roundhouse", [number, number]> = {
  punch: [0.15, 0.45],
  kick: [0.32, 0.6],
  roundhouse: [0.42, 0.62],
};

export const ATTACK_SPECS = {
  punch: {
    type: "punch" as const,
    startup: 0.34 * 0.1,
    active: 0.34 * 0.3,
    recovery: 0.34 * 0.6,
    damage: 8,
    range: 62,
    height: -132,
    hitH: 28,
    knockback: 170,
    hitstun: 0.3,
    launch: 0,
  },
  kick: {
    type: "kick" as const,
    startup: 0.56 * 0.3,
    active: 0.56 * 0.28,
    recovery: 0.56 * 0.42,
    damage: 15,
    range: 82,
    height: -66,
    hitH: 42,
    knockback: 310,
    hitstun: 0.44,
    launch: 0,
  },
  roundhouse: {
    type: "roundhouse" as const,
    startup: 0.82 * 0.42,
    active: 0.82 * 0.2,
    recovery: 0.82 * 0.38,
    damage: 16,
    range: 90,
    height: -104,
    hitH: 46,
    knockback: 370,
    hitstun: 0.5,
    launch: 0,
  },
};
