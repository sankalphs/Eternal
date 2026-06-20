"use client";

import ShadowFight from "@/components/game/ShadowFight";

export default function Home() {
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <ShadowFight />
    </div>
  );
}
