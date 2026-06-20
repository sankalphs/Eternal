"use client";

import ShadowFight from "@/components/game/ShadowFight";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0610] text-foreground">
      {/* ambient backdrop */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(224,103,58,0.18), transparent 60%), radial-gradient(900px 500px at 50% 110%, rgba(139,30,74,0.22), transparent 60%), #0a0610",
        }}
      />

      <header className="px-4 pt-6 sm:pt-8 pb-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg,#f59e0b,#ef4444)",
                boxShadow: "0 0 18px rgba(245,158,11,0.5)",
              }}
            >
              <span className="text-black font-black text-sm">SF</span>
            </div>
            <div className="leading-tight">
              <div className="text-white font-black tracking-wide text-sm sm:text-base">
                SHADOW FIGHT
              </div>
              <div className="text-[10px] text-amber-300/70 tracking-[0.25em]">
                SHADOWS OF THE ARENA
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Arena online
          </div>
        </div>
      </header>

      <main className="flex-1 px-2 sm:px-4 py-4 flex flex-col justify-center">
        <ShadowFight />
      </main>

      <footer className="mt-auto border-t border-white/10 bg-black/40 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            Shadow Fight clone — a canvas fighting game built with Next.js.
          </span>
          <span className="flex items-center gap-3 flex-wrap justify-center">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px] text-zinc-300">WASD</kbd>
              <span className="ml-1">Move</span>
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px] text-zinc-300">J</kbd>
              <span className="ml-1">Punch</span>
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px] text-zinc-300">K</kbd>
              <span className="ml-1">Kick</span>
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px] text-zinc-300">I</kbd>
              <span className="ml-1">Roundhouse</span>
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px] text-zinc-300">E</kbd>
              <span className="ml-1">Roll</span>
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px] text-zinc-300">L</kbd>
              <span className="ml-1">Block</span>
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
