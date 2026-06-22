// RL Agent — PPO (Proximal Policy Optimization) with a small policy network.
// 2 hidden layers, 64 units each. Trained via self-play in a lightweight
// simulation. The agent observes game state and outputs action probabilities.

import type { InputState } from "./types";
import type { Fighter } from "./fighter";

interface Layer { w: number[][]; b: number[]; }

function makeLayer(inS: number, outS: number): Layer {
  const w: number[][] = []; const b: number[] = [];
  const s = Math.sqrt(2 / inS);
  for (let i = 0; i < outS; i++) {
    w.push([]); b.push(0);
    for (let j = 0; j < inS; j++) w[i].push((Math.random() * 2 - 1) * s);
  }
  return { w, b };
}
function fwd(l: Layer, inp: number[]): number[] {
  return l.w.map((row, i) => row.reduce((s, w, j) => s + w * inp[j], l.b[i]));
}
function relu(a: number[]): number[] { return a.map(x => Math.max(0, x)); }
function softmax(a: number[]): number[] {
  const m = Math.max(...a); const e = a.map(x => Math.exp(x - m));
  const sm = e.reduce((s, x) => s + x, 0); return e.map(x => x / sm);
}

const NUM_ACTIONS = 10;
const ACTIONS: (keyof InputState | "none")[] = ["none","left","right","up","down","punch","kick","roundhouse","roll","block"];
const PENTA = [146.83,164.81,185.0,220.0,246.94,293.66,329.63,369.99,440.0,493.88,587.33,659.25,739.99,880.0];
function note(d: number): number { const n = ((d % PENTA.length) + PENTA.length) % PENTA.length; return PENTA[n]; }

export class RLAgent {
  private pL1: Layer; private pL2: Layer; private pOut: Layer;
  private vL1: Layer; private vL2: Layer; private vOut: Layer;
  private buf: { s: number[]; a: number; r: number; lp: number; v: number; d: boolean }[] = [];
  private gamma = 0.99; private lambda = 0.95; private clip = 0.2; private lr = 1e-3;
  episodes = 0; totalReward = 0; avgReward = 0;

  constructor() {
    const ss = 20; const h = 64;
    this.pL1 = makeLayer(ss, h); this.pL2 = makeLayer(h, h); this.pOut = makeLayer(h, NUM_ACTIONS);
    this.vL1 = makeLayer(ss, h); this.vL2 = makeLayer(h, h); this.vOut = makeLayer(h, 1);
  }

  getState(self: Fighter, opp: Fighter): number[] {
    return [self.x/960, self.hp/self.maxHp, self.rageMeter/100, self.vx/200, self.vy/500,
      self.onGround?1:0, self.isAttacking()?1:0, self.isBlocking()?1:0, self.invuln>0?1:0, self.facing,
      (opp.x-self.x)/960, opp.hp/opp.maxHp, opp.rageMeter/100, opp.vx/200, opp.vy/500,
      opp.onGround?1:0, opp.isAttacking()?1:0, opp.isBlocking()?1:0, opp.invuln>0?1:0, opp.facing];
  }

  getProbs(s: number[]): number[] {
    let h1 = relu(fwd(this.pL1, s)); let h2 = relu(fwd(this.pL2, h1));
    return softmax(fwd(this.pOut, h2));
  }
  getValue(s: number[]): number {
    let h1 = relu(fwd(this.vL1, s)); let h2 = relu(fwd(this.vL2, h1));
    return fwd(this.vOut, h2)[0];
  }

  act(s: number[], stoch = true): { action: number; input: InputState; logProb: number; value: number } {
    const probs = this.getProbs(s); const value = this.getValue(s);
    let action = 0;
    if (stoch) { const r = Math.random(); let c = 0;
      for (let i = 0; i < probs.length; i++) { c += probs[i]; if (r < c) { action = i; break; } }
    } else { action = probs.indexOf(Math.max(...probs)); }
    const lp = Math.log(probs[action] + 1e-8);
    const input: InputState = { left:false,right:false,up:false,down:false,punch:false,kick:false,roundhouse:false,roll:false,block:false,super:false };
    if (action > 0) { const k = ACTIONS[action]; if (k !== "none") input[k] = true; }
    return { action, input, logProb: lp, value };
  }

  store(s: number[], a: number, r: number, lp: number, v: number, d: boolean) {
    this.buf.push({ s, a, r, lp, v, d });
  }

  train(): { policyLoss: number; valueLoss: number } {
    if (this.buf.length < 16) return { policyLoss: 0, valueLoss: 0 };
    const n = this.buf.length;
    const adv: number[] = new Array(n).fill(0); const ret: number[] = new Array(n).fill(0);
    let gae = 0; let lastV = 0;
    for (let t = n - 1; t >= 0; t--) {
      const tr = this.buf[t];
      const delta = tr.r + this.gamma * lastV * (tr.d ? 0 : 1) - tr.v;
      gae = delta + this.gamma * this.lambda * (tr.d ? 0 : 1) * gae;
      adv[t] = gae; ret[t] = gae + tr.v; lastV = tr.v;
    }
    const mean = adv.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(adv.reduce((a, b) => a + (b - mean) ** 2, 0) / n) + 1e-8;
    for (let i = 0; i < n; i++) adv[i] = (adv[i] - mean) / std;

    let tpl = 0; let tvl = 0; const epochs = 4;
    for (let ep = 0; ep < epochs; ep++) {
      for (let i = 0; i < n; i++) {
        const tr = this.buf[i]; const a = adv[i]; const rt = ret[i];
        const probs = this.getProbs(tr.s);
        const nlp = Math.log(probs[tr.a] + 1e-8); const nv = this.getValue(tr.s);
        const ratio = Math.exp(nlp - tr.lp);
        const cr = Math.max(1 - this.clip, Math.min(1 + this.clip, ratio));
        const pl = -Math.min(ratio * a, cr * a); const vl = (rt - nv) ** 2;
        const glp = -(cr * a) * (1 - probs[tr.a]); const gv = -2 * (rt - nv);
        let h1 = relu(fwd(this.pL1, tr.s)); let h2 = relu(fwd(this.pL2, h1));
        for (let j = 0; j < NUM_ACTIONS; j++) {
          const g = j === tr.a ? glp : 0;
          for (let k = 0; k < h2.length; k++) this.pOut.w[j][k] -= this.lr * g * h2[k];
          this.pOut.b[j] -= this.lr * g;
        }
        let vh1 = relu(fwd(this.vL1, tr.s)); let vh2 = relu(fwd(this.vL2, vh1));
        for (let k = 0; k < vh2.length; k++) this.vOut.w[0][k] -= this.lr * gv * vh2[k];
        this.vOut.b[0] -= this.lr * gv;
        tpl += pl; tvl += vl;
      }
    }
    this.episodes++; this.totalReward += this.buf.reduce((s, t) => s + t.r, 0);
    this.avgReward = this.totalReward / this.episodes; this.buf = [];
    return { policyLoss: tpl / (n * epochs), valueLoss: tvl / (n * epochs) };
  }

  get isTrained(): boolean { return this.episodes > 0; }
}

export class SelfPlayTrainer {
  agent: RLAgent; opponent: RLAgent; isTraining = false;

  constructor() { this.agent = new RLAgent(); this.opponent = new RLAgent(); }

  runEpisode(): { reward: number; steps: number } {
    let p1X = 360, p2X = 600, p1Hp = 100, p2Hp = 100, p1Rage = 0, p2Rage = 0;
    let p1S = 0, p2S = 0; let totalR = 0; const maxS = 300;
    for (let step = 0; step < maxS; step++) {
      const s1 = [p1X/960,p1Hp/100,p1Rage/100,0,0,1,p1S===1?1:0,p1S===2?1:0,0,1,(p2X-p1X)/960,p2Hp/100,p2Rage/100,0,0,1,p2S===1?1:0,p2S===2?1:0,0,-1];
      const s2 = [p2X/960,p2Hp/100,p2Rage/100,0,0,1,p2S===1?1:0,p2S===2?1:0,0,-1,(p1X-p2X)/960,p1Hp/100,p1Rage/100,0,0,1,p1S===1?1:0,p1S===2?1:0,0,1];
      const a1 = this.agent.act(s1, true); const a2 = this.opponent.act(s2, true);
      const dist = Math.abs(p2X - p1X); let r1 = 0, r2 = 0;
      if (a1.input.left) p1X = Math.max(80, p1X - 3);
      if (a1.input.right) p1X = Math.min(880, p1X + 3);
      if (a2.input.left) p2X = Math.max(80, p2X - 3);
      if (a2.input.right) p2X = Math.min(880, p2X + 3);
      if (a1.input.punch && p1S === 0 && dist < 70) { const b = a2.input.block; const d = b ? 1 : 7; p2Hp = Math.max(0, p2Hp - d); r1 += d; r2 -= d; p1Rage = Math.min(100, p1Rage + d * 0.4); }
      if (a1.input.kick && p1S === 0 && dist < 100) { const b = a2.input.block; const d = b ? 2 : 13; p2Hp = Math.max(0, p2Hp - d); r1 += d; r2 -= d; p1Rage = Math.min(100, p1Rage + d * 0.4); }
      if (a2.input.punch && p2S === 0 && dist < 70) { const b = a1.input.block; const d = b ? 1 : 7; p1Hp = Math.max(0, p1Hp - d); r2 += d; r1 -= d; p2Rage = Math.min(100, p2Rage + d * 0.4); }
      if (a2.input.kick && p2S === 0 && dist < 100) { const b = a1.input.block; const d = b ? 2 : 13; p1Hp = Math.max(0, p1Hp - d); r2 += d; r1 -= d; p2Rage = Math.min(100, p2Rage + d * 0.4); }
      if (dist > 100) { if (a1.input.right && p2X > p1X) r1 += 0.05; if (a2.input.left && p1X < p2X) r2 += 0.05; }
      this.agent.store(s1, a1.action, r1, a1.logProb, a1.value, p2Hp <= 0 || p1Hp <= 0 || step === maxS - 1);
      this.opponent.store(s2, a2.action, r2, a2.logProb, a2.value, p1Hp <= 0 || p2Hp <= 0 || step === maxS - 1);
      totalR += r1;
      if (p1Hp <= 0 || p2Hp <= 0) break;
    }
    this.agent.train(); this.opponent.train();
    return { reward: totalR, steps: maxS };
  }
}
