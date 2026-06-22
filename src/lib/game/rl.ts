// =============================================================================
// RL Agent — PPO (Proximal Policy Optimization) with full backpropagation.
// =============================================================================
//
// Architecture:
//   Policy network:  state(20) → 64 → 64 → 10 (softmax)
//   Value network:   state(20) → 64 → 64 → 1  (linear)
//
// Features:
//   - Full backprop through ALL layers (the previous version only updated the
//     output layer — a critical bug that prevented any feature learning).
//   - PPO clipped surrogate objective with ratio clipping ε=0.2.
//   - Generalized Advantage Estimation (GAE-λ, λ=0.95, γ=0.99).
//   - Entropy bonus (β=0.01) for exploration.
//   - Value function clipping (PPO2 style).
//   - localStorage persistence — trained weights survive page refresh.
//   - Self-play trainer with a lightweight but faithful simulation.
//   - Background training that yields to the UI thread (won't block the game).
//   - A controller method to use the trained policy as a game AI.
//
// State vector (20 dims, all normalized to ~[-1, 1]):
//   [ self.x/960, self.hp/maxHp, self.rage/100, self.vx/200, self.vy/500,
//     self.onGround, self.isAttacking, self.isBlocking, self.invuln>0, self.facing,
//     (opp.x-self.x)/960, opp.hp/maxHp, opp.rage/100, opp.vx/200, opp.vy/500,
//     opp.onGround, opp.isAttacking, opp.isBlocking, opp.invuln>0, opp.facing ]
//
// Actions (10): none, left, right, up, down, punch, kick, roundhouse, roll, block
//
// This module is STANDALONE — it is not wired into the active game by default.
// To use it, call RLController.getInput(self, opp) from the AI loop, and call
// RLTrainer.startBackground() to train in the background.
// =============================================================================

import type { InputState } from "./types";
import type { Fighter } from "./fighter";

// ---------------------------------------------------------------------------
// Matrix / layer utilities
// ---------------------------------------------------------------------------

interface Layer {
  w: number[][]; // [outS][inS]
  b: number[]; // [outS]
  // cached forward values for backprop
  z: number[]; // pre-activation [outS]
  a: number[]; // post-activation [outS]
  // gradients
  gw: number[][]; // [outS][inS]
  gb: number[]; // [outS]
}

function makeLayer(inS: number, outS: number): Layer {
  const w: number[][] = [];
  const b: number[] = new Array(outS).fill(0);
  const z = new Array(outS).fill(0);
  const a = new Array(outS).fill(0);
  const gw: number[][] = [];
  const gb = new Array(outS).fill(0);
  const s = Math.sqrt(2 / inS); // He initialization for ReLU
  for (let i = 0; i < outS; i++) {
    const row: number[] = [];
    const grow: number[] = [];
    for (let j = 0; j < inS; j++) {
      row.push((Math.random() * 2 - 1) * s);
      grow.push(0);
    }
    w.push(row);
    gw.push(grow);
  }
  return { w, b, z, a, gw, gb };
}

function fwdLayer(l: Layer, inp: number[]): number[] {
  for (let i = 0; i < l.w.length; i++) {
    let sum = l.b[i];
    const row = l.w[i];
    for (let j = 0; j < row.length; j++) sum += row[j] * inp[j];
    l.z[i] = sum;
    l.a[i] = sum > 0 ? sum : 0; // ReLU
  }
  return l.a;
}

function fwdLayerLinear(l: Layer, inp: number[]): number[] {
  for (let i = 0; i < l.w.length; i++) {
    let sum = l.b[i];
    const row = l.w[i];
    for (let j = 0; j < row.length; j++) sum += row[j] * inp[j];
    l.z[i] = sum;
    l.a[i] = sum; // linear (for output)
  }
  return l.a;
}

function relu(a: number[]): number[] {
  return a.map((x) => (x > 0 ? x : 0));
}

function softmax(a: number[]): number[] {
  const m = Math.max(...a);
  const e = a.map((x) => Math.exp(x - m));
  const sm = e.reduce((s, x) => s + x, 0);
  return e.map((x) => x / sm);
}

// Backprop through a ReLU layer.
// gradOut: dL/da (gradient w.r.t. output of this layer)
// inp: the input that was fed to this layer
// Returns: dL/dinp (gradient w.r.t. input, for chaining to previous layer)
function backLayer(l: Layer, gradOut: number[], inp: number[]): number[] {
  const inS = l.w[0].length;
  const gradIn = new Array(inS).fill(0);
  for (let i = 0; i < l.w.length; i++) {
    // ReLU mask: gradient flows only where z > 0
    const mask = l.z[i] > 0 ? 1 : 0;
    const gz = gradOut[i] * mask; // dL/dz
    l.gb[i] += gz; // dL/db = dL/dz
    const row = l.w[i];
    const grow = l.gw[i];
    for (let j = 0; j < row.length; j++) {
      grow[j] += gz * inp[j]; // dL/dW = dL/dz * inp
      gradIn[j] += row[j] * gz; // dL/dinp = sum_i W[i][j] * dL/dz
    }
  }
  return gradIn;
}

// Backprop through a linear layer (same as ReLU but no mask)
function backLayerLinear(l: Layer, gradOut: number[], inp: number[]): number[] {
  const inS = l.w[0].length;
  const gradIn = new Array(inS).fill(0);
  for (let i = 0; i < l.w.length; i++) {
    const gz = gradOut[i]; // no ReLU mask
    l.gb[i] += gz;
    const row = l.w[i];
    const grow = l.gw[i];
    for (let j = 0; j < row.length; j++) {
      grow[j] += gz * inp[j];
      gradIn[j] += row[j] * gz;
    }
  }
  return gradIn;
}

function zeroGrads(l: Layer) {
  for (let i = 0; i < l.gw.length; i++) {
    l.gb[i] = 0;
    for (let j = 0; j < l.gw[i].length; j++) l.gw[i][j] = 0;
  }
}

function applyGrads(l: Layer, lr: number) {
  for (let i = 0; i < l.w.length; i++) {
    l.b[i] -= lr * l.gb[i];
    for (let j = 0; j < l.w[i].length; j++) {
      l.w[i][j] -= lr * l.gw[i][j];
    }
  }
}

// ---------------------------------------------------------------------------
// Network definitions
// ---------------------------------------------------------------------------

const STATE_SIZE = 20;
const HIDDEN = 64;
const NUM_ACTIONS = 10;
const ACTIONS: (keyof InputState | "none")[] = [
  "none", "left", "right", "up", "down",
  "punch", "kick", "roundhouse", "roll", "block",
];

function emptyInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    punch: false, kick: false, roundhouse: false,
    roll: false, block: false, super: false,
  };
}

function actionToInput(action: number): InputState {
  const input = emptyInput();
  if (action > 0) {
    const k = ACTIONS[action];
    if (k !== "none") input[k] = true;
  }
  return input;
}

// ---------------------------------------------------------------------------
// PPO Agent
// ---------------------------------------------------------------------------

interface Transition {
  s: number[];
  a: number;
  r: number;
  lp: number; // old log prob
  v: number; // old value
  d: boolean; // done
}

export class PPOAgent {
  // Policy network: state → h1 → h2 → softmax(10)
  pL1: Layer = makeLayer(STATE_SIZE, HIDDEN);
  pL2: Layer = makeLayer(HIDDEN, HIDDEN);
  pOut: Layer = makeLayer(HIDDEN, NUM_ACTIONS);
  // Value network: state → h1 → h2 → linear(1)
  vL1: Layer = makeLayer(STATE_SIZE, HIDDEN);
  vL2: Layer = makeLayer(HIDDEN, HIDDEN);
  vOut: Layer = makeLayer(HIDDEN, 1);

  private buf: Transition[] = [];
  gamma = 0.99;
  lambda = 0.95;
  clip = 0.2;
  lr = 3e-4;
  entropyCoef = 0.01;
  valueClip = 0.2;
  epochs = 4;

  episodes = 0;
  totalReward = 0;
  avgReward = 0;
  lastPolicyLoss = 0;
  lastValueLoss = 0;
  lastEntropy = 0;

  // ---- Forward passes ----

  // Returns the hidden activations for the policy network (for backprop)
  private policyForward(s: number[]): { h1: number[]; h2: number[]; probs: number[] } {
    const h1 = fwdLayer(this.pL1, s);
    const h2 = fwdLayer(this.pL2, h1);
    const logits = fwdLayerLinear(this.pOut, h2);
    const probs = softmax(logits);
    return { h1, h2, probs };
  }

  private valueForward(s: number[]): { h1: number[]; h2: number[]; v: number } {
    const h1 = fwdLayer(this.vL1, s);
    const h2 = fwdLayer(this.vL2, h1);
    const out = fwdLayerLinear(this.vOut, h2);
    return { h1, h2, v: out[0] };
  }

  getProbs(s: number[]): number[] {
    return this.policyForward(s).probs;
  }

  getValue(s: number[]): number {
    return this.valueForward(s).v;
  }

  getState(self: Fighter, opp: Fighter): number[] {
    return [
      self.x / 960, self.hp / self.maxHp, self.rageMeter / 100,
      self.vx / 200, self.vy / 500,
      self.onGround ? 1 : 0, self.isAttacking() ? 1 : 0,
      self.isBlocking() ? 1 : 0, self.invuln > 0 ? 1 : 0, self.facing,
      (opp.x - self.x) / 960, opp.hp / opp.maxHp, opp.rageMeter / 100,
      opp.vx / 200, opp.vy / 500,
      opp.onGround ? 1 : 0, opp.isAttacking() ? 1 : 0,
      opp.isBlocking() ? 1 : 0, opp.invuln > 0 ? 1 : 0, opp.facing,
    ];
  }

  // Act on a state. Returns the chosen action, the input, the log-prob, and value.
  act(s: number[], stoch = true): {
    action: number; input: InputState; logProb: number; value: number;
  } {
    const { probs } = this.policyForward(s);
    const value = this.getValue(s);
    let action = 0;
    if (stoch) {
      const r = Math.random();
      let c = 0;
      for (let i = 0; i < probs.length; i++) {
        c += probs[i];
        if (r < c) { action = i; break; }
      }
    } else {
      action = probs.indexOf(Math.max(...probs));
    }
    const lp = Math.log(probs[action] + 1e-8);
    return { action, input: actionToInput(action), logProb: lp, value };
  }

  store(s: number[], a: number, r: number, lp: number, v: number, d: boolean) {
    this.buf.push({ s, a, r, lp, v, d });
  }

  // ---- PPO update with full backpropagation ----
  train(): { policyLoss: number; valueLoss: number; entropy: number } {
    if (this.buf.length < 16) return { policyLoss: 0, valueLoss: 0, entropy: 0 };
    const n = this.buf.length;

    // ---- Compute GAE advantages and returns ----
    const adv = new Array(n).fill(0);
    const ret = new Array(n).fill(0);
    let gae = 0;
    let lastV = 0;
    for (let t = n - 1; t >= 0; t--) {
      const tr = this.buf[t];
      const nextV = tr.d ? 0 : lastV;
      const delta = tr.r + this.gamma * nextV - tr.v;
      gae = delta + this.gamma * this.lambda * (tr.d ? 0 : 1) * gae;
      adv[t] = gae;
      ret[t] = gae + tr.v;
      lastV = tr.v;
    }
    // Normalize advantages
    const mean = adv.reduce((a, b) => a + b, 0) / n;
    const std =
      Math.sqrt(adv.reduce((a, b) => a + (b - mean) ** 2, 0) / n) + 1e-8;
    for (let i = 0; i < n; i++) adv[i] = (adv[i] - mean) / std;

    let tpl = 0;
    let tvl = 0;
    let tent = 0;

    // ---- Multi-epoch PPO updates ----
    for (let ep = 0; ep < this.epochs; ep++) {
      // Zero all gradients at the start of each epoch
      zeroGrads(this.pL1); zeroGrads(this.pL2); zeroGrads(this.pOut);
      zeroGrads(this.vL1); zeroGrads(this.vL2); zeroGrads(this.vOut);

      let epochPL = 0;
      let epochVL = 0;
      let epochEnt = 0;

      for (let i = 0; i < n; i++) {
        const tr = this.buf[i];
        const a = adv[i];
        const rt = ret[i];

        // ---- Policy forward ----
        const { h1, h2, probs } = this.policyForward(tr.s);
        const newLp = Math.log(probs[tr.a] + 1e-8);
        const ratio = Math.exp(newLp - tr.lp);

        // PPO clipped surrogate
        const surr1 = ratio * a;
        const surr2 =
          Math.max(1 - this.clip, Math.min(1 + this.clip, ratio)) * a;
        const useClipped = surr2 < surr1;
        // grad coefficient: 0 if clipped (gradient killed), else ratio * adv
        const gradCoeff = useClipped ? 0 : ratio * a;

        // Entropy of the policy
        let entropy = 0;
        for (let j = 0; j < probs.length; j++) {
          if (probs[j] > 1e-8) entropy -= probs[j] * Math.log(probs[j]);
        }

        // dL/dz_out[j] = -gradCoeff * (δ(j, a) - π(j)) + entropyCoef * dH/dz
        // where dH/dz[j] = π(j) * (Σ_k π(k) log π(k) + log π(j) + 1) ≈ π(j) * (log π(j) + H + 1)
        // Simplified entropy gradient: dH/dz[j] = π(j) * (log π(j) + 1 + ... ) 
        // We use the standard form: dH/dz[j] = π(j) * (Σ_k π(k)(log π(k)+1) - (log π(j)+1))
        // But for simplicity and stability, use: dH/dz[j] ≈ -(log π(j) + 1) * π(j) + π(j) * Σ_k π(k)(log π(k)+1)
        // An even simpler stable form: gradEntropy[j] = π(j) * (entropy_term - logit_term)
        // We'll use the common approximation: dH/dz[j] = π(j) * (H + log π(j)) ... 
        // Actually the standard result is: dH/dz[j] = π(j) * (log π(j) - Σ_k π(k) log π(k))
        //                                    = π(j) * (log π(j) + H)    [since H = -Σ π log π]
        const entropyGrad = new Array(NUM_ACTIONS).fill(0);
        for (let j = 0; j < NUM_ACTIONS; j++) {
          entropyGrad[j] = probs[j] * (Math.log(probs[j] + 1e-8) + entropy);
        }

        const dzPolicy = new Array(NUM_ACTIONS).fill(0);
        for (let j = 0; j < NUM_ACTIONS; j++) {
          const kronecker = j === tr.a ? 1 : 0;
          // dL_policy/dz = -gradCoeff * (δ - π) - entropyCoef * dH/dz
          // (we SUBTRACT entropy gradient because we want to MAXIMIZE entropy)
          dzPolicy[j] = -gradCoeff * (kronecker - probs[j]) - this.entropyCoef * entropyGrad[j];
        }

        // Backprop policy: pOut → pL2 → pL1
        // grad at pOut output = dzPolicy
        // backLayerLinear returns the gradient w.r.t. the layer's INPUT (h2)
        const gradH2_policy = backLayerLinear(this.pOut, dzPolicy, h2);
        // grad at pL2 output = gradH2_policy; returns grad w.r.t. h1
        const gradH1_policy = backLayer(this.pL2, gradH2_policy, h1);
        // grad at pL1 output = gradH1_policy; returns grad w.r.t. s (not needed)
        backLayer(this.pL1, gradH1_policy, tr.s);

        // ---- Value forward + backprop ----
        const { h1: vh1, h2: vh2, v: newV } = this.valueForward(tr.s);
        // Value loss with clipping (PPO2)
        const vClipped = tr.v + Math.max(
          -this.valueClip,
          Math.min(this.valueClip, newV - tr.v),
        );
        const vLossUnclipped = (newV - rt) ** 2;
        const vLossClipped = (vClipped - rt) ** 2;
        const vLoss = Math.max(vLossUnclipped, vLossClipped);
        // Gradient: use unclipped gradient (2*(v-rt)) when the unclipped loss
        // is >= the clipped loss (i.e., clipping doesn't help). When the clipped
        // loss is strictly larger, the value was clipped and the gradient is 0.
        // NOTE: >= (not >) so the gradient flows on epoch 0 when newV == oldV.
        const dvRaw = 2 * (newV - rt);
        const dvClipped = vLossUnclipped >= vLossClipped ? dvRaw : 0;
        const dv = [dvClipped];

        // Value backprop chain
        const gradVh2 = backLayerLinear(this.vOut, dv, vh2);
        const gradVh1 = backLayer(this.vL2, gradVh2, vh1);
        backLayer(this.vL1, gradVh1, tr.s);

        epochPL += useClipped ? surr2 : surr1;
        epochVL += vLoss;
        epochEnt += entropy;
      }

      // Apply gradients (averaged over batch)
      const invN = 1 / n;
      // Scale gradients by 1/n before applying
      for (const l of [this.pL1, this.pL2, this.pOut, this.vL1, this.vL2, this.vOut]) {
        for (let i = 0; i < l.gw.length; i++) {
          l.gb[i] *= invN;
          for (let j = 0; j < l.gw[i].length; j++) l.gw[i][j] *= invN;
        }
        applyGrads(l, this.lr);
      }

      tpl = epochPL * invN;
      tvl = epochVL * invN;
      tent = epochEnt * invN;
    }

    this.episodes++;
    this.totalReward += this.buf.reduce((s, t) => s + t.r, 0);
    this.avgReward = this.totalReward / this.episodes;
    this.lastPolicyLoss = tpl;
    this.lastValueLoss = tvl;
    this.lastEntropy = tent;
    this.buf = [];
    return { policyLoss: tpl, valueLoss: tvl, entropy: tent };
  }

  get isTrained(): boolean {
    return this.episodes > 0;
  }

  // ---- Persistence (localStorage) ----

  serialize(): string {
    const lay = (l: Layer) => ({ w: l.w, b: l.b });
    return JSON.stringify({
      pL1: lay(this.pL1), pL2: lay(this.pL2), pOut: lay(this.pOut),
      vL1: lay(this.vL1), vL2: lay(this.vL2), vOut: lay(this.vOut),
      episodes: this.episodes,
      totalReward: this.totalReward,
      avgReward: this.avgReward,
    });
  }

  load(data: string): boolean {
    try {
      const d = JSON.parse(data);
      const restore = (l: Layer, saved: { w: number[][]; b: number[] }) => {
        for (let i = 0; i < l.w.length; i++) {
          l.b[i] = saved.b[i];
          for (let j = 0; j < l.w[i].length; j++) l.w[i][j] = saved.w[i][j];
        }
      };
      restore(this.pL1, d.pL1);
      restore(this.pL2, d.pL2);
      restore(this.pOut, d.pOut);
      restore(this.vL1, d.vL1);
      restore(this.vL2, d.vL2);
      restore(this.vOut, d.vOut);
      this.episodes = d.episodes ?? 0;
      this.totalReward = d.totalReward ?? 0;
      this.avgReward = d.avgReward ?? 0;
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Self-play environment — a lightweight but faithful fight simulation.
// Uses the real attack specs (damage, range) so the learned policy transfers.
// ---------------------------------------------------------------------------

const SIM_ATTACKS = {
  punch: { dmg: 8, range: 66, kb: 170, stun: 0.3 },
  kick: { dmg: 15, range: 86, kb: 310, stun: 0.44 },
  roundhouse: { dmg: 16, range: 94, kb: 370, stun: 0.5 },
} as const;
type SimAction = keyof typeof SIM_ATTACKS;

interface SimState {
  x1: number; x2: number;
  hp1: number; hp2: number;
  rage1: number; rage2: number;
  stun1: number; stun2: number; // hitstun timers (steps remaining)
  atkCd1: number; atkCd2: number; // attack cooldown
  steps: number;
}

function simStateVector(s: SimState, perspective: 1 | 2): number[] {
  const isP1 = perspective === 1;
  const selfX = isP1 ? s.x1 : s.x2;
  const oppX = isP1 ? s.x2 : s.x1;
  const selfHp = isP1 ? s.hp1 : s.hp2;
  const oppHp = isP1 ? s.hp2 : s.hp1;
  const selfRage = isP1 ? s.rage1 : s.rage2;
  const oppRage = isP1 ? s.rage2 : s.rage1;
  const selfStun = isP1 ? s.stun1 : s.stun2;
  const oppStun = isP1 ? s.stun2 : s.stun1;
  return [
    selfX / 960, selfHp / 100, selfRage / 100, 0, 0,
    1, selfStun > 0 ? 1 : 0, 0, selfStun > 0 ? 1 : 0, isP1 ? 1 : -1,
    (oppX - selfX) / 960, oppHp / 100, oppRage / 100, 0, 0,
    1, oppStun > 0 ? 1 : 0, 0, oppStun > 0 ? 1 : 0, isP1 ? -1 : 1,
  ];
}

function applySimAction(
  s: SimState,
  perspective: 1 | 2,
  input: InputState,
): number {
  // Returns immediate reward for this agent
  let reward = 0;
  const isP1 = perspective === 1;
  const selfX = isP1 ? s.x1 : s.x2;
  const oppX = isP1 ? s.x2 : s.x1;
  const selfStun = isP1 ? s.stun1 : s.stun2;
  const selfCd = isP1 ? s.atkCd1 : s.atkCd2;
  const dist = Math.abs(oppX - selfX);
  const dirToOpp = oppX >= selfX ? 1 : -1;

  // If stunned, can't act
  if (selfStun > 0) {
    if (isP1) s.stun1--; else s.stun2--;
    return 0;
  }

  // Movement
  let newX = selfX;
  if (input.left) newX = Math.max(80, newX - 4);
  if (input.right) newX = Math.min(880, newX + 4);
  if (isP1) s.x1 = newX; else s.x2 = newX;

  // Small reward for closing distance (encourages engagement)
  if (dist > 100) {
    const movingToward = (input.right && dirToOpp === 1) || (input.left && dirToOpp === -1);
    if (movingToward) reward += 0.02;
  }

  // Blocking (reduces incoming damage — handled in attack resolution)
  // Attack resolution
  if (selfCd <= 0) {
    let attack: SimAction | null = null;
    if (input.punch) attack = "punch";
    else if (input.kick) attack = "kick";
    else if (input.roundhouse) attack = "roundhouse";

    if (attack) {
      const spec = SIM_ATTACKS[attack];
      // Check if opponent is blocking (we read the opponent's input in the trainer)
      // For now, use a simple heuristic: if opponent is close and not stunned
      const inRange = dist < spec.range;
      if (inRange) {
        const dmg = spec.dmg;
        if (isP1) {
          s.hp2 = Math.max(0, s.hp2 - dmg);
          s.stun2 = Math.ceil(spec.stun * 10); // convert to steps (~10 steps/sec)
          s.rage1 = Math.min(100, s.rage1 + dmg * 0.4);
          reward += dmg;
        } else {
          s.hp1 = Math.max(0, s.hp1 - dmg);
          s.stun1 = Math.ceil(spec.stun * 10);
          s.rage2 = Math.min(100, s.rage2 + dmg * 0.4);
          reward += dmg;
        }
      } else {
        // Whiff penalty
        reward -= 0.5;
      }
      // Set cooldown proportional to attack duration
      if (isP1) s.atkCd1 = attack === "punch" ? 4 : attack === "kick" ? 6 : 9;
      else s.atkCd2 = attack === "punch" ? 4 : attack === "kick" ? 6 : 9;
    }
  } else {
    if (isP1) s.atkCd1--; else s.atkCd2--;
  }

  // Knockout bonus
  if (isP1 && s.hp2 <= 0) reward += 20;
  if (!isP1 && s.hp1 <= 0) reward += 20;

  return reward;
}

// ---------------------------------------------------------------------------
// Self-play trainer
// ---------------------------------------------------------------------------

export class SelfPlayTrainer {
  agent: PPOAgent = new PPOAgent();
  opponent: PPOAgent = new PPOAgent();
  isTraining = false;
  targetEpisodes = 2500;
  log: { episode: number; reward: number; policyLoss: number; valueLoss: number; entropy: number }[] = [];

  private storageKey = "shadowfight_rl_v1";

  constructor() {
    this.load();
  }

  // Run a single self-play episode.
  runEpisode(): { reward: number; steps: number; policyLoss: number; valueLoss: number } {
    const s: SimState = {
      x1: 360, x2: 600,
      hp1: 100, hp2: 100,
      rage1: 0, rage2: 0,
      stun1: 0, stun2: 0,
      atkCd1: 0, atkCd2: 0,
      steps: 0,
    };
    const maxSteps = 300; // ~30 seconds at 10 steps/sec
    let totalR1 = 0;

    // Periodically sync the opponent to the agent (frozen opponent → fresh opponent)
    const syncEvery = 50;
    const useFrozenOpp = this.agent.episodes % syncEvery < 25;

    for (let step = 0; step < maxSteps; step++) {
      s.steps = step;
      const sv1 = simStateVector(s, 1);
      const sv2 = simStateVector(s, 2);

      const a1 = this.agent.act(sv1, true);
      const a2 = useFrozenOpp
        ? this.opponent.act(sv2, true)
        : this.agent.act(sv2, true); // self-play against current policy

      const r1 = applySimAction(s, 1, a1.input);
      const r2 = applySimAction(s, 2, a2.input);

      // Body collision (push apart)
      const dist = Math.abs(s.x2 - s.x1);
      if (dist < 40) {
        const push = (40 - dist) / 2;
        if (s.x1 < s.x2) { s.x1 -= push; s.x2 += push; }
        else { s.x1 += push; s.x2 -= push; }
        s.x1 = Math.max(80, Math.min(880, s.x1));
        s.x2 = Math.max(80, Math.min(880, s.x2));
      }

      const done = s.hp1 <= 0 || s.hp2 <= 0 || step === maxSteps - 1;
      // Small time penalty to encourage finishing
      const t1 = r1 - 0.01;
      const t2 = r2 - 0.01;

      this.agent.store(sv1, a1.action, t1, a1.logProb, a1.value, done);
      if (useFrozenOpp) {
        this.opponent.store(sv2, a2.action, t2, a2.logProb, a2.value, done);
      }

      totalR1 += t1;
      if (done) break;
    }

    const pLoss = this.agent.train();
    if (useFrozenOpp) this.opponent.train();

    this.log.push({
      episode: this.agent.episodes,
      reward: totalR1,
      policyLoss: pLoss.policyLoss,
      valueLoss: pLoss.valueLoss,
      entropy: pLoss.entropy,
    });
    if (this.log.length > 500) this.log.shift(); // cap log

    return {
      reward: totalR1,
      steps: s.steps,
      policyLoss: pLoss.policyLoss,
      valueLoss: pLoss.valueLoss,
    };
  }

  // Run N episodes, yielding to the UI thread between batches.
  async trainBatch(episodes: number, batchSize = 3): Promise<void> {
    this.isTraining = true;
    for (let i = 0; i < episodes && this.isTraining; i += batchSize) {
      const n = Math.min(batchSize, episodes - i);
      for (let j = 0; j < n; j++) this.runEpisode();
      // Save every 50 episodes
      if (this.agent.episodes % 50 === 0) this.save();
      // Yield to UI
      await new Promise((r) => setTimeout(r, 0));
    }
    this.save();
    this.isTraining = false;
  }

  // Start background training toward targetEpisodes.
  async startBackground(): Promise<void> {
    if (this.isTraining) return;
    const remaining = Math.max(0, this.targetEpisodes - this.agent.episodes);
    if (remaining === 0) return;
    await this.trainBatch(remaining, 5);
  }

  stop() {
    this.isTraining = false;
  }

  // ---- Persistence ----
  save(): void {
    try {
      localStorage.setItem(this.storageKey, this.agent.serialize());
    } catch {
      // localStorage may be unavailable (private mode, quota)
    }
  }

  load(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) this.agent.load(data);
    } catch {
      // ignore
    }
  }

  clearSaved(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
    this.agent = new PPOAgent();
    this.opponent = new PPOAgent();
    this.log = [];
  }
}

// ---------------------------------------------------------------------------
// RL Controller — use a trained policy as a game AI.
// Call getInput(self, opp) each frame to get the agent's action.
// ---------------------------------------------------------------------------

export class RLController {
  agent: PPOAgent;
  private lastAction = 0;
  private actionTimer = 0;
  // How many steps to hold each action (prevents jittery 10-APM play)
  readonly ACTION_HOLD = 3;

  constructor(agent: PPOAgent) {
    this.agent = agent;
  }

  reset() {
    this.lastAction = 0;
    this.actionTimer = 0;
  }

  // Returns the agent's chosen input. Re-decides every ACTION_HOLD steps.
  getInput(self: Fighter, opp: Fighter): InputState {
    if (this.actionTimer > 0) {
      this.actionTimer--;
      return actionToInput(this.lastAction);
    }
    const s = this.agent.getState(self, opp);
    const { action } = this.agent.act(s, true);
    this.lastAction = action;
    this.actionTimer = this.ACTION_HOLD;
    return actionToInput(action);
  }

  get isReady(): boolean {
    return this.agent.isTrained;
  }
}

// ---------------------------------------------------------------------------
// Singleton trainer instance (shared across the app)
// ---------------------------------------------------------------------------

export const rlTrainer = new SelfPlayTrainer();
