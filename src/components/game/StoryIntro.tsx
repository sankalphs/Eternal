"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { STORY_BEATS, STORY_DURATION, TITLE } from "@/lib/game/story";

type Mood = "dawn" | "march" | "battle" | "gate" | "twist" | "reveal" | "climax" | "end";

interface SceneState {
  mood: Mood;
  time: number; // song time in seconds
  mist: number; // 0..1 mist density
  waterRed: number; // 0..1 how red the river is
  figureVisible: boolean;
  gateOpen: number; // 0..1 how open the gate is
  figureIsDemon: boolean; // flip the silhouette's hue
}

export default function StoryIntro({ onFinish }: { onFinish: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [beatIdx, setBeatIdx] = useState(0);

  // current beat from time
  const beat = STORY_BEATS[beatIdx] ?? STORY_BEATS[0];
  const progress = Math.min(1, time / STORY_DURATION);

  // ---- audio element (only created once) ----
  useEffect(() => {
    const a = new Audio("/audio/steel_on_the_riverbank.mp3");
    a.preload = "auto";
    a.addEventListener("ended", () => {
      setPlaying(false);
      // small delay then finish
      window.setTimeout(onFinish, 600);
    });
    audioRef.current = a;
    return () => {
      a.pause();
      a.src = "";
    };
  }, [onFinish]);

  // ---- typed-line derivation: reveal lines progressively within the beat ----
  const typed = useMemo(() => {
    const local = beat;
    const span = local.end - local.t;
    const elapsed = time - local.t;
    const per = span / local.lines.length; // time per line
    const visible = Math.min(
      local.lines.length,
      Math.floor(elapsed / per) + 1,
    );
    const shown: string[] = [];
    for (let i = 0; i < visible; i++) {
      if (i < visible - 1) {
        shown.push(local.lines[i]);
      } else {
        const lineElapsed = elapsed - i * per;
        const chars = Math.max(
          0,
          Math.min(
            local.lines[i].length,
            Math.floor((lineElapsed / per) * local.lines[i].length),
          ),
        );
        shown.push(local.lines[i].slice(0, chars));
      }
    }
    return shown;
  }, [time, beat]);

  // ---- main render loop: drive canvas + sync time ----
  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const W = 960;
    const H = 540;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.max(vw / W, vh / H);
      const w = W * scale;
      const h = H * scale;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.style.position = "absolute";
      canvas.style.left = (vw - w) / 2 + "px";
      canvas.style.top = (vh - h) / 2 + "px";
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      const t = audioRef.current?.currentTime ?? 0;
      setTime(t);
      // update beat index
      let bi = 0;
      for (let i = 0; i < STORY_BEATS.length; i++) {
        if (t >= STORY_BEATS[i].t) bi = i;
      }
      setBeatIdx(bi);

      // build scene state from mood + time
      const sc = sceneFor(t, STORY_BEATS[bi]);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const sx = canvas.width / W;
      ctx.setTransform(sx, 0, 0, sx, 0, 0);
      drawScene(ctx, sc, t, W, H);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [started]);

  // ---- controls ----
  const start = useCallback(() => {
    const a = audioRef.current!;
    a.currentTime = 0;
    void a.play();
    setPlaying(true);
    setStarted(true);
  }, []);

  const skip = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPlaying(false);
    onFinish();
  }, [onFinish]);

  const togglePause = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      <canvas ref={canvasRef} className="block" />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Act label (top-left) */}
      {started && (
        <div className="absolute top-4 left-5 z-20 text-amber-200/70 font-mono text-xs sm:text-sm tracking-[0.25em]">
          {beat.act}
        </div>
      )}

      {/* Narration panel (bottom) */}
      {started && (
        <div className="absolute left-0 right-0 bottom-0 z-20 px-6 sm:px-16 pb-20 sm:pb-24 pointer-events-none">
          <div
            className="max-w-3xl mx-auto text-center min-h-[5.5em]"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.95)" }}
          >
            {typed.map((line, i) => (
              <p
                key={i}
                className="text-white/90 text-lg sm:text-2xl font-light leading-relaxed tracking-wide"
                style={{
                  opacity: i === typed.length - 1 ? 1 : 0.55,
                  transition: "opacity 0.6s",
                }}
              >
                {line}
                <span className="text-amber-300/80">
                  {i === typed.length - 1 && line.length < (beat.lines[i]?.length ?? 0) ? "▍" : ""}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Title card on the final beat */}
      {started && beat.mood === "end" && time > 138 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div
            className="text-center animate-[sfpop_0.8s_ease-out]"
            style={{ textShadow: "0 0 30px rgba(220,60,40,0.8), 0 4px 16px #000" }}
          >
            <div className="text-amber-300/70 tracking-[0.4em] text-xs sm:text-sm mb-2">
              SHADOW FIGHT
            </div>
            <div className="text-white text-4xl sm:text-7xl font-black tracking-tight">
              {TITLE}
            </div>
          </div>
        </div>
      )}

      {/* Pre-start overlay */}
      {!started && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-center px-6">
          <div className="text-amber-300/70 tracking-[0.4em] text-xs sm:text-sm mb-3">
            SHADOW FIGHT PRESENTS
          </div>
          <h1
            className="text-white text-4xl sm:text-6xl font-black tracking-tight mb-3"
            style={{ textShadow: "0 0 28px rgba(220,60,40,0.6)" }}
          >
            {TITLE}
          </h1>
          <p className="text-zinc-400 text-sm max-w-md mb-8">
            A tale in eight acts. Best experienced with sound on.
            <br />
            <span className="text-zinc-500">2:22 · scored to “Steel on the Riverbank”</span>
          </p>
          <button
            onClick={start}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black tracking-widest text-lg hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-rose-900/50"
          >
            ▶ BEGIN THE TALE
          </button>
          <button
            onClick={onFinish}
            className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            skip the story →
          </button>
        </div>
      )}

      {/* In-story controls */}
      {started && (
        <>
          {/* progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-black/40 z-30">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-[width]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {/* controls */}
          <div className="absolute top-3 right-3 z-40 flex gap-2">
            <button
              onClick={togglePause}
              aria-label={playing ? "Pause" : "Play"}
              className="w-9 h-9 rounded-full border border-white/20 bg-black/50 backdrop-blur text-white/80 hover:bg-white/15 active:scale-95 transition flex items-center justify-center"
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              onClick={skip}
              aria-label="Skip"
              className="w-9 h-9 rounded-full border border-white/20 bg-black/50 backdrop-blur text-white/80 hover:bg-white/15 active:scale-95 transition flex items-center justify-center text-xs"
            >
              ✕
            </button>
          </div>
          {/* time */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 text-[11px] text-white/40 font-mono tabular-nums pointer-events-none">
            {fmt(time)} / 2:22
          </div>
        </>
      )}

      <style>{`
        @keyframes sfpop { 0% { transform: scale(0.7); opacity: 0 } 60% { transform: scale(1.05); opacity: 1 } 100% { transform: scale(1) } }
      `}</style>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------- scene logic

function sceneFor(t: number, beat: { mood: Mood; t: number; end: number }): SceneState {
  // global progression of the river turning red + mist clearing
  const p = t / STORY_DURATION;
  const mist = clamp(1 - p * 0.8, 0.15, 1);
  // river turns red sharply during the twist/reveal
  let waterRed = 0;
  if (t > 83) waterRed = clamp((t - 83) / 30, 0, 0.85);
  if (t > 121) waterRed = clamp(0.85 + (t - 121) / 21 * 0.15, 0.85, 1);
  const figureVisible = t > 4;
  const gateOpen = t > 51 ? clamp((t - 51) / 20, 0, 1) : 0;
  const figureIsDemon = t > 103;
  return { mood: beat.mood, time: t, mist, waterRed, figureVisible, gateOpen, figureIsDemon };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------- rendering

function drawScene(
  ctx: CanvasRenderingContext2D,
  sc: SceneState,
  t: number,
  W: number,
  H: number,
) {
  drawSky(ctx, sc, W, H);
  drawSun(ctx, sc, W, H);
  drawDistantHills(ctx, sc, W, H);
  drawGate(ctx, sc, W, H);
  drawRiverbank(ctx, sc, W, H);
  drawWater(ctx, sc, t, W, H);
  drawFigure(ctx, sc, t, W, H);
  drawMist(ctx, sc, t, W, H);
  drawEmbers(ctx, sc, t, W, H);
}

function drawSky(ctx: CanvasRenderingContext2D, sc: SceneState, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  // mood tints the sky
  if (sc.mood === "dawn") {
    g.addColorStop(0, "#1a1530");
    g.addColorStop(0.5, "#4a2350");
    g.addColorStop(1, "#c0563a");
  } else if (sc.mood === "march" || sc.mood === "battle") {
    g.addColorStop(0, "#181225");
    g.addColorStop(0.5, "#3a1f3e");
    g.addColorStop(1, "#8a3a3a");
  } else if (sc.mood === "gate") {
    g.addColorStop(0, "#0e0a18");
    g.addColorStop(0.5, "#241634");
    g.addColorStop(1, "#5a2a44");
  } else if (sc.mood === "twist") {
    g.addColorStop(0, "#120a12");
    g.addColorStop(0.5, "#3a1020");
    g.addColorStop(1, "#7a1820");
  } else if (sc.mood === "reveal" || sc.mood === "climax") {
    g.addColorStop(0, "#0a0608");
    g.addColorStop(0.5, "#2a0a10");
    g.addColorStop(1, "#6a0e14");
  } else {
    // end
    g.addColorStop(0, "#080608");
    g.addColorStop(0.5, "#1f0810");
    g.addColorStop(1, "#4a0a10");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawSun(ctx: CanvasRenderingContext2D, sc: SceneState, W: number, H: number) {
  // a low sun on the horizon, turning blood-red as the river does
  const sx = W * 0.5;
  const sy = H * 0.62;
  const glow = ctx.createRadialGradient(sx, sy, 6, sx, sy, 260);
  const baseR = sc.waterRed > 0.4 ? "180,30,30" : "255,180,90";
  glow.addColorStop(0, `rgba(${baseR},0.95)`);
  glow.addColorStop(0.35, `rgba(${baseR},0.35)`);
  glow.addColorStop(1, `rgba(${baseR},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = sc.waterRed > 0.4 ? "rgba(255,80,60,0.95)" : "rgba(255,235,180,0.95)";
  ctx.beginPath();
  ctx.arc(sx, sy, 40, 0, Math.PI * 2);
  ctx.fill();
}

function drawDistantHills(ctx: CanvasRenderingContext2D, sc: SceneState, W: number, H: number) {
  const baseY = H * 0.66;
  ctx.fillStyle = "rgba(20,10,24,0.7)";
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  const pts = [0, 30, 120, 80, 240, 40, 380, 90, 520, 50, 660, 100, 800, 55, 960, 80];
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], baseY - pts[i + 1]);
  ctx.lineTo(W, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(8,4,10,0.85)";
  ctx.beginPath();
  ctx.moveTo(0, baseY + 8);
  const pts2 = [0, 18, 150, 45, 320, 22, 480, 55, 640, 28, 820, 60, 960, 35];
  for (let i = 0; i < pts2.length; i += 2) ctx.lineTo(pts2[i], baseY + 8 - pts2[i + 1]);
  ctx.lineTo(W, baseY + 8);
  ctx.closePath();
  ctx.fill();
}

function drawGate(
  ctx: CanvasRenderingContext2D,
  sc: SceneState,
  W: number,
  H: number,
) {
  if (sc.mood !== "gate" && sc.mood !== "twist" && sc.mood !== "reveal" && sc.mood !== "climax" && sc.mood !== "end")
    return;
  // a towering gate silhouette that opens (light pours through) then cracks
  const cx = W * 0.5;
  const baseY = H * 0.66;
  const open = sc.gateOpen;
  ctx.save();
  // gate frame
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.fillRect(cx - 80, baseY - 180, 14, 180);
  ctx.fillRect(cx + 66, baseY - 180, 14, 180);
  ctx.fillRect(cx - 80, baseY - 194, 160, 14);
  // doors (part open)
  const doorW = 66 - open * 30;
  ctx.fillStyle = "rgba(6,3,8,0.95)";
  ctx.fillRect(cx - doorW, baseY - 176, doorW - 2, 176);
  ctx.fillRect(cx + 2, baseY - 176, doorW - 2, 176);
  // light pouring through the opening
  if (open > 0) {
    const lightW = open * 56;
    const lg = ctx.createLinearGradient(0, baseY - 176, 0, baseY);
    const col = sc.waterRed > 0.5 ? "255,40,30" : "255,200,120";
    lg.addColorStop(0, `rgba(${col},${open * 0.9})`);
    lg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(cx - lightW / 2, baseY - 176);
    ctx.lineTo(cx + lightW / 2, baseY - 176);
    ctx.lineTo(cx + lightW, baseY);
    ctx.lineTo(cx - lightW, baseY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRiverbank(ctx: CanvasRenderingContext2D, sc: SceneState, W: number, H: number) {
  // the strip of land the figure stands on
  const bankY = H * 0.78;
  const g = ctx.createLinearGradient(0, bankY, 0, H);
  g.addColorStop(0, "#0c0608");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, bankY, W, H - bankY);
  // reeds
  ctx.strokeStyle = "rgba(10,6,8,0.9)";
  ctx.lineWidth = 1.5;
  for (let x = 20; x < W; x += 14) {
    const h = 8 + ((x * 7) % 14);
    ctx.beginPath();
    ctx.moveTo(x, bankY);
    ctx.lineTo(x + Math.sin(x + sc.time) * 2, bankY - h);
    ctx.stroke();
  }
}

function drawWater(
  ctx: CanvasRenderingContext2D,
  sc: SceneState,
  t: number,
  W: number,
  H: number,
) {
  const bankY = H * 0.78;
  // water below the bank reflects the sky; turns red with waterRed
  const g = ctx.createLinearGradient(0, bankY, 0, H);
  const r = sc.waterRed;
  const top = lerpColor([12, 16, 28], [60, 8, 12], r);
  const bot = lerpColor([0, 0, 4], [30, 0, 4], r);
  g.addColorStop(0, `rgb(${top.join(",")})`);
  g.addColorStop(1, `rgb(${bot.join(",")})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, bankY, W, H - bankY);
  // shimmer lines
  ctx.strokeStyle = `rgba(255,${r > 0.5 ? 60 : 200},${r > 0.5 ? 50 : 140},${0.18 + r * 0.2})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const y = bankY + 6 + i * 4;
    const off = Math.sin(t * (1 + i * 0.1) + i) * 14;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + t * 2 + i) * 1.5 + off * 0.05);
    }
    ctx.stroke();
  }
  // reflection of the sun (stretched, rippling)
  const sx = W * 0.5;
  const refR = r > 0.4 ? "255,40,30" : "255,210,150";
  for (let i = 0; i < 12; i++) {
    const y = bankY + 4 + i * 5;
    const w = 60 - i * 3 + Math.sin(t * 3 + i) * 6;
    ctx.fillStyle = `rgba(${refR},${0.5 - i * 0.035})`;
    ctx.fillRect(sx - w / 2, y, w, 2);
  }
}

function drawFigure(
  ctx: CanvasRenderingContext2D,
  sc: SceneState,
  t: number,
  W: number,
  H: number,
) {
  if (!sc.figureVisible) return;
  // lone swordsman silhouette on the bank, facing the gate/water
  const fx = W * 0.3 + Math.sin(t * 0.4) * 4;
  const fy = H * 0.78;
  ctx.save();
  ctx.translate(fx, fy);
  // subtle bob
  const bob = Math.sin(t * 1.5) * 1;
  ctx.translate(0, bob);
  // hue flips to demon-red after the reveal
  const col = sc.figureIsDemon ? "#3a0608" : "#050505";
  const rim = sc.figureIsDemon ? "#ef4444" : "#e2e8f0";
  ctx.shadowColor = rim;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = col;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // legs
  ctx.lineWidth = 5;
  line(ctx, 0, -38, -6, 0);
  line(ctx, 0, -38, 6, 0);
  // torso
  ctx.lineWidth = 7;
  line(ctx, 0, -38, 0, -70);
  // head
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(0, -78, 6, 0, Math.PI * 2);
  ctx.fill();
  // arms — one holding a sword down
  ctx.lineWidth = 4;
  line(ctx, 0, -64, 8, -50);
  line(ctx, 8, -50, 12, -34);
  line(ctx, 0, -64, -8, -52);
  line(ctx, -8, -52, -6, -38);
  // sword in front hand
  ctx.strokeStyle = sc.figureIsDemon ? "rgba(255,80,60,0.9)" : "rgba(220,230,255,0.8)";
  ctx.lineWidth = 1.6;
  line(ctx, 12, -34, 18, -2);
  ctx.shadowBlur = 0;
  // reflection in water (flipped, faded, red if demon)
  ctx.save();
  ctx.scale(1, -1);
  ctx.translate(0, -2);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = col;
  ctx.lineWidth = 5;
  line(ctx, 0, 0, -6, 38);
  line(ctx, 0, 0, 6, 38);
  ctx.lineWidth = 7;
  line(ctx, 0, 0, 0, 70);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(0, 78, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawMist(
  ctx: CanvasRenderingContext2D,
  sc: SceneState,
  t: number,
  W: number,
  H: number,
) {
  const a = sc.mist * 0.5;
  ctx.save();
  ctx.globalAlpha = a;
  // layered drifting mist bands
  for (let i = 0; i < 4; i++) {
    const y = H * (0.6 + i * 0.06);
    const off = (t * (8 + i * 4)) % (W + 200);
    const g = ctx.createLinearGradient(0, y - 20, 0, y + 30);
    g.addColorStop(0, "rgba(200,200,220,0)");
    g.addColorStop(0.5, `rgba(200,200,220,${0.25 - i * 0.04})`);
    g.addColorStop(1, "rgba(200,200,220,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-200 + off, y - 20, W + 400, 50);
    ctx.fillRect(-200 + off - W, y - 20, W + 400, 50);
  }
  ctx.restore();
}

function drawEmbers(
  ctx: CanvasRenderingContext2D,
  sc: SceneState,
  t: number,
  W: number,
  H: number,
) {
  // drifting embers/sparks; more + redder after the twist
  const n = sc.waterRed > 0.4 ? 40 : 16;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const seed = i * 41.3;
    const x = (seed * 1.7 + t * (10 + (i % 5) * 4)) % W;
    const y = (H - ((seed * 0.6) % H) - t * (8 + (i % 4) * 3)) % H;
    const yy = (y + H) % H;
    const red = sc.waterRed > 0.4;
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 1.5 + i));
    ctx.fillStyle = red ? "rgba(255,90,40,0.9)" : "rgba(255,200,120,0.8)";
    ctx.fillRect(x, yy, 2, 2);
  }
  ctx.restore();
}

// helpers
function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function lerpColor(a: number[], b: number[], t: number): number[] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
