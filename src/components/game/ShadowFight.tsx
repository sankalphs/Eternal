"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine, OPPONENTS, ROUNDS_TO_WIN } from "@/lib/game/engine";
import { render, VIRTUAL_H, VIRTUAL_W } from "@/lib/game/render";
import { GameAudio } from "@/lib/game/audio";
import type { BackgroundId, InputState, Phase } from "@/lib/game/types";

interface Snapshot {
  phase: Phase;
  php: number;
  pmax: number;
  ehp: number;
  emax: number;
  pWins: number;
  eWins: number;
  roundNo: number;
  roundTimer: number;
  oppIndex: number;
  announce: { main: string; sub?: string; big?: boolean } | null;
  combo: number;
  maxCombo: number;
}

function snapFrom(e: GameEngine): Snapshot {
  return {
    phase: e.phase,
    php: e.player.hp,
    pmax: e.player.maxHp,
    ehp: e.enemy.hp,
    emax: e.enemy.maxHp,
    pWins: e.playerWins,
    eWins: e.enemyWins,
    roundNo: e.roundNo,
    roundTimer: e.roundTimer,
    oppIndex: e.opponentIndex,
    announce: e.announce
      ? { main: e.announce.main, sub: e.announce.sub, big: e.announce.big }
      : null,
    combo: e.playerCombo,
    maxCombo: e.maxCombo,
  };
}

const KEY_MAP: Record<string, keyof InputState> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  Space: "up",
  ArrowDown: "down",
  KeyS: "down",
  KeyJ: "punch",
  KeyZ: "punch",
  KeyK: "kick",
  KeyX: "kick",
  KeyI: "roundhouse",
  KeyU: "roundhouse",
  KeyE: "roll",
  KeyO: "roll",
  KeyL: "block",
  KeyC: "block",
  ShiftLeft: "block",
  ShiftRight: "block",
};

export default function ShadowFight() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [eng] = useState(() => new GameEngine());
  const [audio] = useState(() => new GameAudio());
  const [muted, setMuted] = useState(false);
  const intensityRef = useRef(0.12);
  const [view, setView] = useState<"menu" | "select">("menu");
  const [selOpp, setSelOpp] = useState(0);
  const [selScene, setSelScene] = useState<BackgroundId | "auto">("auto");

  const keysRef = useRef<InputState>({
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    roundhouse: false,
    roll: false,
    block: false,
  });

  const [snap, setSnap] = useState<Snapshot>(() => snapFrom(eng));
  const [started, setStarted] = useState(false);

  // ---- main loop ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let snapAcc = 0;

    const resize = () => {
      const wrap = wrapRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = Math.round((w * VIRTUAL_H) / VIRTUAL_W);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      // feed input
      eng.input = { ...keysRef.current };

      eng.update(dt);

      // drain VFX events -> fire audio stingers + combat intensity
      let bump = 0;
      for (const ev of eng.events) {
        if (ev.kind === "ko") {
          audio.hit("ko");
          bump = Math.max(bump, 1);
        } else if (ev.kind === "heavy") {
          audio.hit(ev.hitType === "roundhouse" ? "roundhouse" : "kick");
          bump = Math.max(bump, 0.75);
        } else if (ev.kind === "hit") {
          audio.hit(ev.hitType ?? "punch");
          bump = Math.max(bump, 0.45);
        } else if (ev.kind === "block") {
          audio.hit("block");
          bump = Math.max(bump, 0.2);
        }
      }
      if (eng.events.length) eng.events.length = 0;
      // combat intensity: bump on hits, decay toward ambient
      intensityRef.current = Math.max(
        intensityRef.current * 0.92 - 0.08 * dt,
        0.12,
      );
      if (bump > 0) intensityRef.current = Math.min(1, Math.max(intensityRef.current, bump));
      audio.setIntensity(intensityRef.current);

      // render
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const sx = canvas.width / VIRTUAL_W;
      // punch-zoom around center
      const z = 1 + eng.zoom * 0.07;
      const tx = sx * (VIRTUAL_W * (1 - z)) / 2;
      const ty = sx * (VIRTUAL_H * (1 - z)) / 2;
      ctx.setTransform(sx * z, 0, 0, sx * z, tx, ty);
      // screen shake
      if (eng.shake > 0) {
        const s = eng.shake;
        ctx.translate(
          (Math.random() - 0.5) * s,
          (Math.random() - 0.5) * s,
        );
      }
      ctx.save();
      render(ctx, eng);
      ctx.restore();

      // colored impact flash
      if (eng.flash > 0) {
        ctx.globalAlpha = Math.min(1, eng.flash * 1.6);
        ctx.fillStyle = eng.flashColor || "#ffffff";
        ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
        ctx.globalAlpha = 1;
      }

      // throttle snapshot
      snapAcc += dt;
      if (snapAcc >= 0.05) {
        snapAcc = 0;
        setSnap(snapFrom(eng));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [eng, audio]);

  // ---- keyboard ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = KEY_MAP[e.code];
      if (k) {
        e.preventDefault();
        keysRef.current[k] = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = KEY_MAP[e.code];
      if (k) {
        e.preventDefault();
        keysRef.current[k] = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const blur = () => {
      keysRef.current = {
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
    };
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // ---- touch controls ----
  const setKey = (k: keyof InputState, v: boolean) => {
    keysRef.current[k] = v;
  };

  const start = useCallback(() => {
    eng.startMatch();
    setStarted(true);
    setSnap(snapFrom(eng));
    if (!muted) void audio.start();
  }, [eng, audio, muted]);
  const startSelect = useCallback(() => {
    eng.startMatchWith(
      selOpp,
      selScene === "auto" ? null : selScene,
    );
    setStarted(true);
    setSnap(snapFrom(eng));
    if (!muted) void audio.start();
  }, [eng, audio, muted, selOpp, selScene]);
  const backToMenu = useCallback(() => {
    eng.toMenu();
    setStarted(false);
    setView("menu");
    setSnap(snapFrom(eng));
  }, [eng]);
  const nextOpp = useCallback(() => {
    eng.nextOpponent();
    setSnap(snapFrom(eng));
    if (!muted) void audio.start();
  }, [eng, audio, muted]);
  const retry = useCallback(() => {
    eng.retryMatch();
    setSnap(snapFrom(eng));
    if (!muted) void audio.start();
  }, [eng, audio, muted]);
  const restart = useCallback(() => {
    eng.startMatch();
    setSnap(snapFrom(eng));
    if (!muted) void audio.start();
  }, [eng, audio, muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const nm = !m;
      if (nm) audio.stop();
      else if (started) void audio.start();
      return nm;
    });
  }, [audio, started]);

  // stop audio when the component unmounts
  useEffect(() => {
    return () => audio.dispose();
  }, [audio]);

  const opp = OPPONENTS[snap.oppIndex];
  const phpPct = Math.max(0, (snap.php / snap.pmax) * 100);
  const ehpPct = Math.max(0, (snap.ehp / snap.emax) * 100);
  const showMenu = !started;
  const showMatchEnd = started && snap.phase === "match_end";
  const showGameOver = started && snap.phase === "game_over";
  const showChampion = started && snap.phase === "champion";

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4">
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-black">
        {/* mute toggle */}
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute music" : "Mute music"}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 w-9 h-9 rounded-full border border-white/20 bg-black/50 backdrop-blur text-white/80 hover:bg-white/15 active:scale-95 transition flex items-center justify-center"
        >
          {muted ? <MuteIcon /> : <SoundIcon />}
        </button>

        {/* HUD top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-2 sm:p-3 pointer-events-none">
          <div className="flex items-start gap-2 sm:gap-4">
            {/* player */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs font-bold tracking-widest text-slate-100 truncate">
                  SHADOW
                </span>
                <Pips n={snap.pWins} color="#e2e8f0" />
              </div>
              <HealthBar pct={phpPct} align="left" color="from-rose-600 to-amber-400" />
            </div>
            {/* timer */}
            <div className="flex flex-col items-center px-1">
              <span className="text-xl sm:text-3xl font-black tabular-nums text-white leading-none drop-shadow">
                {Math.ceil(snap.roundTimer)}
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-widest text-white/60">
                ROUND {snap.roundNo}
              </span>
            </div>
            {/* enemy */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <Pips n={snap.eWins} color={opp.rim} />
                <span
                  className="text-[10px] sm:text-xs font-bold tracking-widest truncate text-right"
                  style={{ color: opp.rim }}
                >
                  {opp.name.toUpperCase()}
                </span>
              </div>
              <HealthBar pct={ehpPct} align="right" color="from-rose-700 to-fuchsia-500" />
              <span className="block text-[9px] sm:text-[10px] text-white/50 text-right mt-0.5 truncate">
                {opp.title}
              </span>
            </div>
          </div>
        </div>

        {/* Combo */}
        {snap.combo > 1 && (snap.phase === "fight" || snap.phase === "intro") && (
          <div className="absolute left-3 sm:left-6 top-20 sm:top-24 z-20 pointer-events-none">
            <div
              className="text-2xl sm:text-4xl font-black text-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
              style={{ textShadow: "0 0 12px rgba(245,158,11,0.7)" }}
            >
              {snap.combo} HIT
            </div>
          </div>
        )}

        {/* Announcement */}
        {snap.announce && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="text-center animate-[sfpop_0.3s_ease-out]">
              <div
                className="font-black tracking-tight text-white px-4"
                style={{
                  fontSize: snap.announce.big ? "clamp(2.5rem,9vw,6rem)" : "clamp(1.5rem,5vw,3rem)",
                  textShadow: "0 0 24px rgba(255,120,60,0.8), 0 4px 12px rgba(0,0,0,0.9)",
                }}
              >
                {snap.announce.main}
              </div>
              {snap.announce.sub && (
                <div className="mt-1 text-sm sm:text-base text-amber-200/90 font-semibold tracking-wide">
                  {snap.announce.sub}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div ref={wrapRef} className="relative w-full aspect-[16/9] bg-black">
          <canvas ref={canvasRef} className="block w-full h-full" />
        </div>

        {/* Touch controls (mobile) */}
        <TouchControls
          visible={started && snap.phase === "fight"}
          onKey={setKey}
        />

        {/* Desktop controls hint */}
        {started && snap.phase === "fight" && (
          <div className="hidden md:flex absolute bottom-2 left-1/2 -translate-x-1/2 z-20 gap-2 text-[10px] text-white/40 pointer-events-none flex-wrap justify-center px-2">
            <Key>WASD</Key>/<Key>←→</Key> Move <Key>W/Space</Key> Flip-Jump <Key>S/↓</Key> Crouch
            <Key>E</Key> Roll <Key>J</Key> Punch <Key>K</Key> Kick <Key>I</Key> Roundhouse <Key>L</Key> Block
          </div>
        )}
      </div>

      {/* Phase panels */}
      {showMenu && view === "menu" && (
        <MenuPanel onStart={start} onSelect={() => setView("select")} />
      )}
      {showMenu && view === "select" && (
        <SelectPanel
          selOpp={selOpp}
          selScene={selScene}
          onOpp={setSelOpp}
          onScene={setSelScene}
          onBack={() => setView("menu")}
          onFight={startSelect}
        />
      )}
      {showMatchEnd && (
        <EndPanel
          title="VICTORY"
          subtitle={`${opp.name} has fallen`}
          accent="#fbbf24"
          info={`Best combo: ${snap.maxCombo} hits`}
          primary={{ label: "Next Opponent", onClick: nextOpp }}
          secondary={{ label: "Main Menu", onClick: backToMenu }}
        />
      )}
      {showGameOver && (
        <EndPanel
          title="DEFEATED"
          subtitle={`${opp.name} proved too strong`}
          accent="#f87171"
          info={`Best combo: ${snap.maxCombo} hits`}
          primary={{ label: "Try Again", onClick: retry }}
          secondary={{ label: "Main Menu", onClick: backToMenu }}
        />
      )}
      {showChampion && (
        <EndPanel
          title="SHADOW LORD"
          subtitle="You have conquered all challengers"
          accent="#fbbf24"
          info={`Largest combo: ${snap.maxCombo} hits`}
          primary={{ label: "Play Again", onClick: restart }}
          secondary={{ label: "Main Menu", onClick: backToMenu }}
        />
      )}

      <style>{`
        @keyframes sfpop { 0% { transform: scale(0.6); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
      `}</style>
    </div>
  );
}

function HealthBar({
  pct,
  align,
  color,
}: {
  pct: number;
  align: "left" | "right";
  color: string;
}) {
  return (
    <div className="h-3 sm:h-4 w-full bg-black/60 border border-white/20 rounded-sm overflow-hidden relative">
      <div
        className={`h-full bg-gradient-to-r ${color} transition-[width] duration-200 ease-out ${
          align === "right" ? "ml-auto" : ""
        }`}
        style={{ width: `${pct}%` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
    </div>
  );
}

function Pips({ n, color }: { n: number; color: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: ROUNDS_TO_WIN }).map((_, i) => (
        <span
          key={i}
          className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border"
          style={{
            background: i < n ? color : "transparent",
            borderColor: color,
            boxShadow: i < n ? `0 0 6px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function SoundIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white/70 font-mono">
      {children}
    </kbd>
  );
}

function TouchControls({
  visible,
  onKey,
}: {
  visible: boolean;
  onKey: (k: keyof InputState, v: boolean) => void;
}) {
  const mk = (k: keyof InputState, label: string, cls: string) => (
    <button
      type="button"
      className={`pointer-events-auto select-none rounded-full border border-white/25 backdrop-blur-sm bg-white/5 active:bg-white/25 text-white font-bold flex items-center justify-center ${cls}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onKey(k, true);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onKey(k, false);
      }}
      onPointerLeave={() => onKey(k, false)}
      onPointerCancel={() => onKey(k, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
  if (!visible) return null;
  return (
    <div className="md:hidden absolute inset-x-0 bottom-0 z-20 p-2 sm:p-3 flex items-end justify-between pointer-events-none">
      <div className="grid grid-cols-3 gap-1.5 w-28">
        <div />
        {mk("up", "↑", "h-9")}
        <div />
        {mk("left", "←", "h-9")}
        {mk("down", "↓", "h-9")}
        {mk("right", "→", "h-9")}
      </div>
      <div className="grid grid-cols-3 gap-1.5 w-36">
        {mk("punch", "P", "h-12 bg-amber-500/20 border-amber-400/40 text-xs")}
        {mk("kick", "K", "h-12 bg-fuchsia-500/20 border-fuchsia-400/40 text-xs")}
        {mk("roundhouse", "RH", "h-12 bg-rose-500/20 border-rose-400/40 text-[10px]")}
        {mk("roll", "ROLL", "h-9 bg-emerald-500/20 border-emerald-400/40 text-[10px]")}
        <div className="col-span-2">{mk("block", "BLOCK", "h-9 bg-sky-500/20 border-sky-400/40 text-xs")}</div>
      </div>
    </div>
  );
}

function MenuPanel({
  onStart,
  onSelect,
}: {
  onStart: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur p-5 sm:p-8">
      <div className="text-center mb-5">
        <h1
          className="text-4xl sm:text-6xl font-black tracking-tight text-white"
          style={{ textShadow: "0 0 30px rgba(255,120,60,0.6)" }}
        >
          SHADOW FIGHT
        </h1>
        <p className="text-amber-300/80 tracking-[0.3em] text-xs sm:text-sm mt-1">
          S H A D O W S &nbsp; O F &nbsp; T H E &nbsp; A R E N A
        </p>
      </div>
      <p className="text-center text-zinc-400 text-sm max-w-xl mx-auto mb-6">
        Master the shadow arts. Punch, kick, roundhouse, and block your way past
        eight deadly opponents across eight arenas. Only the greatest warrior
        earns the title of Shadow Lord.
      </p>

      <div className="text-center flex flex-wrap gap-3 justify-center mb-6">
        <button
          onClick={onStart}
          className="px-8 py-3 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black tracking-widest text-lg hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-rose-900/50"
        >
          ENTER THE ARENA
        </button>
        <button
          onClick={onSelect}
          className="px-6 py-3 rounded-full border border-white/20 text-white font-bold tracking-wide hover:bg-white/10 active:scale-95 transition"
        >
          Choose Opponent &amp; Arena
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-400 max-w-3xl mx-auto">
        <Control keys="WASD / ←→" label="Move" />
        <Control keys="W / ↑ / Space" label="Flip-Jump" />
        <Control keys="S / ↓" label="Crouch (duck)" />
        <Control keys="E / O" label="Roll (dodge)" />
        <Control keys="J / Z" label="Punch" />
        <Control keys="K / X" label="Kick" />
        <Control keys="I / U" label="Roundhouse" />
        <Control keys="L / C / Shift" label="Block" />
      </div>
    </div>
  );
}

const SCENES: { id: BackgroundId; label: string }[] = [
  { id: "sunset", label: "Sunset" },
  { id: "desert", label: "Desert" },
  { id: "temple", label: "Temple" },
  { id: "bamboo", label: "Bamboo" },
  { id: "moon", label: "Moonlit" },
  { id: "volcano", label: "Volcano" },
  { id: "snow", label: "Snow" },
];

function SelectPanel({
  selOpp,
  selScene,
  onOpp,
  onScene,
  onBack,
  onFight,
}: {
  selOpp: number;
  selScene: BackgroundId | "auto";
  onOpp: (i: number) => void;
  onScene: (s: BackgroundId | "auto") => void;
  onBack: () => void;
  onFight: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/85 backdrop-blur p-5 sm:p-7">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
          SELECT BATTLE
        </h2>
        <button
          onClick={onBack}
          className="text-xs sm:text-sm text-zinc-400 hover:text-white border border-white/15 rounded-full px-3 py-1.5"
        >
          ← Back
        </button>
      </div>

      {/* Opponent picker */}
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
          Opponent
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {OPPONENTS.map((o, i) => {
            const active = selOpp === i;
            return (
              <button
                key={o.name}
                onClick={() => onOpp(i)}
                className={`rounded-xl border p-2.5 text-center transition ${
                  active
                    ? "bg-white/10 border-white/60"
                    : "bg-black/40 border-white/10 hover:border-white/30"
                }`}
                style={
                  active
                    ? { boxShadow: `0 0 18px ${o.rim}66, inset 0 0 16px ${o.rim}22` }
                    : undefined
                }
              >
                <div
                  className="w-7 h-7 mx-auto mb-1 rounded-full"
                  style={{ background: o.rim, boxShadow: `0 0 12px ${o.rim}` }}
                />
                <div className="text-xs font-bold text-white">{o.name}</div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {o.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scene picker */}
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
          Arena
        </div>
        <div className="flex flex-wrap gap-2">
          <SceneChip
            active={selScene === "auto"}
            onClick={() => onScene("auto")}
            label={`Auto (${OPPONENTS[selOpp].bg})`}
          />
          {SCENES.map((s) => (
            <SceneChip
              key={s.id}
              active={selScene === s.id}
              onClick={() => onScene(s.id)}
              label={s.label}
            />
          ))}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onFight}
          className="px-8 py-3 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black tracking-widest text-lg hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-rose-900/50"
        >
          FIGHT {OPPONENTS[selOpp].name.toUpperCase()}
        </button>
      </div>
    </div>
  );
}

function SceneChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
        active
          ? "bg-white/15 border-white/60 text-white"
          : "bg-black/40 border-white/10 text-zinc-400 hover:text-white hover:border-white/30"
      }`}
    >
      {label}
    </button>
  );
}

function Control({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 border border-white/10">
      <kbd className="text-[10px] font-mono text-amber-300 whitespace-nowrap">{keys}</kbd>
      <span className="text-zinc-400">{label}</span>
    </div>
  );
}

function EndPanel({
  title,
  subtitle,
  accent,
  info,
  primary,
  secondary,
}: {
  title: string;
  subtitle: string;
  accent: string;
  info?: string;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/85 backdrop-blur p-6 sm:p-10 text-center">
      <h2
        className="text-4xl sm:text-6xl font-black tracking-tight"
        style={{ color: accent, textShadow: `0 0 28px ${accent}88` }}
      >
        {title}
      </h2>
      <p className="text-zinc-300 mt-2">{subtitle}</p>
      {info && <p className="text-amber-300/80 text-sm mt-3">{info}</p>}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <button
          onClick={primary.onClick}
          className="px-7 py-3 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 text-white font-bold tracking-wide hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-rose-900/40"
        >
          {primary.label}
        </button>
        {secondary && (
          <button
            onClick={secondary.onClick}
            className="px-7 py-3 rounded-full border border-white/20 text-white font-bold tracking-wide hover:bg-white/10 active:scale-95 transition"
          >
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}
