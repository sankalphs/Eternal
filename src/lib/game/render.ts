// Rendering: sunset arena background, articulated shadow fighters,
// particles, and floating combat text. Draws in a virtual 960x540 space;
// the component sets the canvas transform to fit.

import { Fighter, GROUND_Y, STAGE_LEFT, STAGE_RIGHT } from "./fighter";
import type { GameEngine } from "./engine";

export const VIRTUAL_W = 960;
export const VIRTUAL_H = 540;

// limb dimensions
const THIGH = 36;
const SHIN = 34;
const TORSO = 50;
const NECK = 8;
const HEAD_R = 11;
const UARM = 28;
const FARM = 26;

// polar: angle 0 = straight down (+y), positive rotates toward +x (front).
function polar(len: number, a: number): [number, number] {
  return [len * Math.sin(a), len * Math.cos(a)];
}

interface Joints {
  hip: [number, number];
  chest: [number, number];
  head: [number, number];
  bShoulder: [number, number];
  fShoulder: [number, number];
  bElbow: [number, number];
  bHand: [number, number];
  fElbow: [number, number];
  fHand: [number, number];
  bKnee: [number, number];
  bFoot: [number, number];
  fKnee: [number, number];
  fFoot: [number, number];
}

function computeJoints(f: Fighter): Joints {
  const p = f.pose();
  const hipY = f.y - 70 + p.hipDrop;
  const hip: [number, number] = [0, 0];
  const chest = polar(TORSO, Math.PI - p.torsoLean);
  const headAng = Math.PI - p.torsoLean - p.headTilt;
  const head = [
    chest[0] + polar(NECK + HEAD_R, headAng)[0],
    chest[1] + polar(NECK + HEAD_R, headAng)[1],
  ];
  const bShoulder: [number, number] = [chest[0] - 5, chest[1] + 3];
  const fShoulder: [number, number] = [chest[0] + 5, chest[1] + 3];
  const bElbow = [bShoulder[0] + polar(UARM, p.bArm)[0], bShoulder[1] + polar(UARM, p.bArm)[1]];
  const bHand = [bElbow[0] + polar(FARM, p.bFore)[0], bElbow[1] + polar(FARM, p.bFore)[1]];
  const fElbow = [fShoulder[0] + polar(UARM, p.fArm)[0], fShoulder[1] + polar(UARM, p.fArm)[1]];
  const fHand = [fElbow[0] + polar(FARM, p.fFore)[0], fElbow[1] + polar(FARM, p.fFore)[1]];
  const bKnee = [hip[0] + polar(THIGH, p.bThigh)[0], hip[1] + polar(THIGH, p.bThigh)[1]];
  const bFoot = [bKnee[0] + polar(SHIN, p.bShin)[0], bKnee[1] + polar(SHIN, p.bShin)[1]];
  const fKnee = [hip[0] + polar(THIGH, p.fThigh)[0], hip[1] + polar(THIGH, p.fThigh)[1]];
  const fFoot = [fKnee[0] + polar(SHIN, p.fShin)[0], fKnee[1] + polar(SHIN, p.fShin)[1]];
  return { hip, chest, head, bShoulder, fShoulder, bElbow, bHand, fElbow, fHand, bKnee, bFoot, fKnee, fFoot };
}

export function render(ctx: CanvasRenderingContext2D, eng: GameEngine) {
  drawBackground(ctx, eng);
  drawGround(ctx);

  // draw fighters back-to-front
  const order = [eng.player, eng.enemy].sort((a, b) => a.x - b.x);
  for (const f of order) drawFighter(ctx, f);

  drawParticles(ctx, eng);
  drawFloatingText(ctx, eng);
  drawVignette(ctx);
}

function drawBackground(ctx: CanvasRenderingContext2D, eng: GameEngine) {
  // sunset sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#1a1030");
  sky.addColorStop(0.4, "#3b1d4f");
  sky.addColorStop(0.7, "#8a2f4a");
  sky.addColorStop(0.88, "#e0673a");
  sky.addColorStop(1, "#f5b942");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

  // sun glow
  const sunX = VIRTUAL_W * 0.5;
  const sunY = GROUND_Y - 36;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 220);
  glow.addColorStop(0, "rgba(255,236,170,0.95)");
  glow.addColorStop(0.3, "rgba(255,180,90,0.55)");
  glow.addColorStop(1, "rgba(255,120,60,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

  ctx.fillStyle = "rgba(255,247,214,0.98)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
  ctx.fill();

  // distant mountains (silhouette layer 1)
  ctx.fillStyle = "rgba(40,20,50,0.55)";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  const pts1 = [0, 70, 150, 110, 300, 70, 460, 120, 620, 80, 780, 120, 960, 90];
  for (let i = 0; i < pts1.length; i += 2) {
    ctx.lineTo(pts1[i], GROUND_Y - pts1[i + 1]);
  }
  ctx.lineTo(VIRTUAL_W, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // closer hills (silhouette layer 2)
  ctx.fillStyle = "rgba(20,10,28,0.78)";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  const pts2 = [0, 40, 120, 80, 260, 45, 420, 90, 560, 50, 720, 95, 880, 55, 960, 70];
  for (let i = 0; i < pts2.length; i += 2) {
    ctx.lineTo(pts2[i], GROUND_Y - pts2[i + 1]);
  }
  ctx.lineTo(VIRTUAL_W, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // drifting embers
  ctx.fillStyle = "rgba(255,200,120,0.5)";
  for (let i = 0; i < 24; i++) {
    const seed = i * 37.7;
    const x = (seed * 1.3 + eng.time * (10 + (i % 5) * 4)) % VIRTUAL_W;
    const y = (GROUND_Y - ((seed * 0.7) % 320) - (eng.time * (8 + (i % 4) * 3)) % 60);
    const yy = ((y % 380) + 380) % 380;
    ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(eng.time * 1.5 + i));
    ctx.fillRect(x, yy, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawGround(ctx: CanvasRenderingContext2D) {
  // ground platform
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_H);
  g.addColorStop(0, "#0a0608");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y, VIRTUAL_W, VIRTUAL_H - GROUND_Y);

  // bright horizon line
  ctx.strokeStyle = "rgba(255,160,90,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(VIRTUAL_W, GROUND_Y);
  ctx.stroke();

  // stage edge marks
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = STAGE_LEFT; x <= STAGE_RIGHT; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 2);
    ctx.lineTo(x, GROUND_Y + 8);
    ctx.stroke();
  }
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
  const j = computeJoints(f);
  ctx.save();
  ctx.translate(f.x, f.y - 70 + f.pose().hipDrop);
  if (f.facing === -1) ctx.scale(-1, 1);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const fill = "#080808";
  const rim = f.rim;

  // soft outer glow
  ctx.shadowColor = rim;
  ctx.shadowBlur = 14;

  const limb = (
    a: [number, number],
    b: [number, number],
    w: number,
  ) => {
    ctx.strokeStyle = fill;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };

  // back leg
  limb(j.hip, j.bKnee, 13);
  limb(j.bKnee, j.bFoot, 10);
  drawFoot(ctx, j.bFoot, 10);
  // back arm
  limb(j.bShoulder, j.bElbow, 9);
  limb(j.bElbow, j.bHand, 7);
  // torso
  limb(j.hip, j.chest, 16);
  // neck
  limb(j.chest, [j.head[0], j.head[1] + HEAD_R - 2], 8);
  // head
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(j.head[0], j.head[1], HEAD_R, 0, Math.PI * 2);
  ctx.fill();
  // front leg
  limb(j.hip, j.fKnee, 13);
  limb(j.fKnee, j.fFoot, 10);
  drawFoot(ctx, j.fFoot, 11);
  // front arm
  limb(j.fShoulder, j.fElbow, 9);
  limb(j.fElbow, j.fHand, 7);

  // rim light pass (thin, offset toward back/light)
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  const rimLimb = (a: [number, number], b: [number, number]) => {
    ctx.beginPath();
    ctx.moveTo(a[0] - 1.5, a[1] - 1.5);
    ctx.lineTo(b[0] - 1.5, b[1] - 1.5);
    ctx.stroke();
  };
  rimLimb(j.hip, j.chest);
  rimLimb(j.fShoulder, j.fElbow);
  rimLimb(j.fElbow, j.fHand);
  rimLimb(j.hip, j.fKnee);
  rimLimb(j.fKnee, j.fFoot);
  ctx.beginPath();
  ctx.arc(j.head[0] - 1, j.head[1] - 1, HEAD_R - 1.5, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();

  // debug hitboxes (off by default)
}

function drawFoot(ctx: CanvasRenderingContext2D, foot: [number, number], w: number) {
  ctx.fillStyle = "#080808";
  ctx.beginPath();
  ctx.ellipse(foot[0] + 4, foot[1] - 1, w * 0.6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles(ctx: CanvasRenderingContext2D, eng: GameEngine) {
  for (const p of eng.particles) {
    const t = p.life / p.maxLife;
    if (p.kind === "ring") {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = t;
      ctx.lineWidth = 3 * t + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - t) * 40 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.kind === "dust") {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = t;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // spark
      ctx.fillStyle = p.color;
      ctx.globalAlpha = t;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
}

function drawFloatingText(ctx: CanvasRenderingContext2D, eng: GameEngine) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of eng.texts) {
    const a = Math.min(1, t.life / 0.3);
    ctx.globalAlpha = a;
    ctx.font = `900 ${t.size}px Geist, system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx: CanvasRenderingContext2D) {
  const v = ctx.createRadialGradient(
    VIRTUAL_W / 2,
    VIRTUAL_H / 2,
    200,
    VIRTUAL_W / 2,
    VIRTUAL_H / 2,
    620,
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
}
