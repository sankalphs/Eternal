// Procedural Shadow-Fight-2-inspired fighting soundtrack, synthesized with the
// Web Audio API. Dark, epic, tribal-electronic: D Phrygian-dominant drone,
// heavy dhol/taiko drums with a galloping drive, a haunting duduk-style lead,
// aggressive brass stabs, risers, and combat-intensity layering + impact
// stingers fired on hits. No external assets. Client-side only.

type Wave = OscillatorType;

// D Phrygian dominant (the "exotic/oriental" fighting scale) across octaves.
const SCALE = [
  73.42, 77.78, 87.31, 98.0, 110.0, 116.54, 130.81, // D2..C3
  146.83, 155.56, 174.61, 196.0, 220.0, 233.08, 261.63, // D3..C4
  293.66, 311.13, 349.23, 392.0, 440.0, 466.16, 523.25, // D4..C5
  587.33, 622.25, 698.46, 783.99, 880.0, // D5..A5
];
function note(degree: number): number {
  const n = ((degree % SCALE.length) + SCALE.length) % SCALE.length;
  return SCALE[n];
}

export type HitKind = "punch" | "kick" | "roundhouse" | "block" | "ko";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private delay: DelayNode | null = null;
  private delayFb: GainNode | null = null;
  private droneNodes: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private schedulerId: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private bar = 0;
  private running = false;
  private _volume = 0.55;
  private intensity = 0; // 0..1 combat intensity

  // 16-step patterns (per bar)
  private kickSteps = [0, 3, 6, 8, 11, 14];
  private snareSteps = [4, 12];
  private hatEvery = 2; // 16th hats
  // duduk lead motifs (scale degrees; -1 = rest); 16 steps, one per bar, cycling
  private leadBars: number[][] = [
    [9, -1, 11, -1, 9, -1, 7, 8, 6, -1, 4, -1, 6, 7, 8, -1],
    [11, -1, 13, 12, 11, -1, 9, -1, 8, -1, 6, -1, 4, -1, -1, -1],
    [9, -1, -1, 8, 7, -1, 6, -1, 4, -1, 6, 7, 8, -1, 9, -1],
    [13, -1, 12, 11, -1, 9, -1, 8, 7, -1, 6, -1, 4, -1, 3, -1],
  ];
  // brass stab chords (scale degrees) per downbeat area
  private stabBars: number[][][] = [
    [[0, 3, 7], [-1], [-1], [0, 3, 7]],
    [[5, 8, 12], [-1], [-1], [5, 8, 12]],
    [[3, 7, 10], [-1], [-1], [3, 7, 10]],
    [[0, 3, 7], [-1], [-1], [5, 8, 12]],
  ];

  private tempo = 104; // BPM
  private get stepDur() {
    return 60 / this.tempo / 4; // 16th note
  }

  get playing(): boolean {
    return this.running;
  }

  get volume(): number {
    return this._volume;
  }

  setVolume(v: number) {
    this._volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  async start() {
    if (this.running) return;
    if (typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 6200;
      lp.Q.value = 0.4;
      this.master.connect(lp);
      lp.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.85;
      this.delay = this.ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.36;
      this.delayFb = this.ctx.createGain();
      this.delayFb.gain.value = 0.3;
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.delay);
      this.delay.connect(this.delayFb);
      this.delayFb.connect(this.delay);
      this.delayFb.connect(this.master);
    }
    try {
      await this.ctx.resume();
    } catch {
      /* ignore */
    }
    this.running = true;
    this.startDrone();
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.step = 0;
    this.bar = 0;
    this.schedulerId = window.setInterval(() => this.scheduler(), 25);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    this.stopDrone();
  }

  toggle(): boolean {
    if (this.running) this.stop();
    else void this.start();
    return this.running;
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  // --- impact stingers (called from component on hits) ---
  hit(kind: HitKind) {
    if (!this.ctx || !this.master || !this.running) return;
    const t = this.ctx.currentTime + 0.001;
    switch (kind) {
      case "punch":
        this.impactBoom(t, 90, 0.16, 0.5);
        this.metallicClang(t, 0.1, 0.12);
        break;
      case "kick":
        this.impactBoom(t, 70, 0.22, 0.7);
        this.metallicClang(t, 0.14, 0.16);
        break;
      case "roundhouse":
        this.whoosh(t, 0.18);
        this.impactBoom(t, 55, 0.32, 0.95);
        this.metallicClang(t, 0.2, 0.22);
        break;
      case "block":
        this.metallicClang(t, 0.16, 0.18);
        this.impactBoom(t, 120, 0.08, 0.3);
        break;
      case "ko":
        this.whoosh(t - 0.05, 0.3);
        this.impactBoom(t, 42, 0.5, 1.0);
        this.metallicClang(t, 0.28, 0.3);
        this.impactBoom(t + 0.06, 38, 0.4, 0.8);
        break;
    }
  }

  // --- drone ---
  private startDrone() {
    if (!this.ctx || !this.musicBus) return;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.0;
    this.droneGain.gain.setTargetAtTime(0.16, this.ctx.currentTime, 1.2);
    this.droneGain.connect(this.musicBus);

    // D2 + A2 + faint Eb3 (the Phrygian color tone)
    const freqs: [number, number][] = [
      [73.42, 1.0],
      [110.0, 0.7],
      [155.56, 0.22],
    ];
    for (const [f, g] of freqs) {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 240;
      lp.Q.value = 0.6;
      const og = this.ctx.createGain();
      og.gain.value = g;
      o.connect(og);
      og.connect(lp);
      lp.connect(this.droneGain);
      o.start();
      this.droneNodes.push(o);
    }
    // slow tremolo LFO on drone
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = 0.16;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.05;
    this.lfo.connect(lfoGain);
    lfoGain.connect(this.droneGain.gain);
    this.lfo.start();
  }

  private stopDrone() {
    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    }
    const nodes = this.droneNodes;
    const lfo = this.lfo;
    window.setTimeout(() => {
      nodes.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* ignore */
        }
      });
      try {
        lfo?.stop();
      } catch {
        /* ignore */
      }
    }, 700);
    this.droneNodes = [];
    this.lfo = null;
    this.droneGain = null;
  }

  // --- scheduler ---
  private scheduler() {
    if (!this.ctx || !this.running) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.scheduleStep(this.step, this.nextNoteTime);
      this.nextNoteTime += this.stepDur;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) {
        this.bar = (this.bar + 1) % 4;
      }
    }
  }

  private scheduleStep(step: number, time: number) {
    // driving hats (more dense at high intensity)
    if (step % this.hatEvery === 0) {
      const density = this.intensity > 0.4 ? 1 : 0.6;
      if (Math.random() < density) this.hat(time, step % 4 === 0 ? 0.18 : 0.1);
    }
    if (this.kickSteps.includes(step)) this.kick(time, step === 0 ? 1 : 0.82);
    if (this.snareSteps.includes(step)) this.snare(time);

    // galloping extra kick at high intensity
    if (this.intensity > 0.5 && (step === 7 || step === 15)) {
      this.kick(time, 0.5);
    }

    // brass stabs on beats (every 4 steps)
    if (step % 4 === 0) {
      const beat = step / 4;
      const chord = this.stabBars[this.bar][beat];
      if (chord[0] >= 0) {
        chord.forEach((d) => this.stab(note(d), time, 0.22));
      }
    }

    // duduk lead
    const lead = this.leadBars[this.bar][step];
    if (lead >= 0) {
      this.duduk(note(lead + 2), time, this.stepDur * 3.2);
    }

    // sub bass pulse on the root each beat
    if (step % 4 === 0) {
      this.subBass(time);
    }

    // riser at end of bar 4 (the drop)
    if (this.bar === 3 && step === 12) {
      this.riser(time, this.stepDur * 4);
    }
  }

  // --- voices ---
  private kick(time: number, vel: number) {
    if (!this.ctx || !this.musicBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(190, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(1.0 * vel, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    // click transient
    const click = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    click.type = "square";
    click.frequency.value = 1400;
    cg.gain.setValueAtTime(0.3 * vel, time);
    cg.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
    click.connect(cg);
    cg.connect(this.musicBus);
    click.start(time);
    click.stop(time + 0.03);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + 0.36);
  }

  private snare(time: number) {
    if (!this.ctx || !this.musicBus) return;
    const n = this.noiseBurst(time, 0.18, 0.55, 1800);
    if (n) n.connect(this.musicBus);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(240, time);
    o.frequency.exponentialRampToValueAtTime(150, time + 0.1);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.28, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + 0.16);
  }

  private hat(time: number, gain: number) {
    if (!this.ctx || !this.musicBus) return;
    const n = this.noiseBurst(time, 0.04, gain * 0.6, 7000);
    if (n) {
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;
      n.disconnect();
      n.connect(hp);
      hp.connect(this.musicBus);
    }
  }

  private stab(freq: number, time: number, dur: number) {
    if (!this.ctx || !this.musicBus) return;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(1800, time);
    f.frequency.exponentialRampToValueAtTime(500, time + dur);
    o.type = "sawtooth";
    o2.type = "sawtooth";
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.005; // slight detune for thickness
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.12, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o2.start(time);
    o.stop(time + dur + 0.02);
    o2.stop(time + dur + 0.02);
  }

  private duduk(freq: number, time: number, dur: number) {
    if (!this.ctx || !this.musicBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq * 4;
    f.Q.value = 6;
    o.type = "sawtooth";
    o.frequency.value = freq;
    // vibrato
    const vib = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vib.frequency.value = 5.5;
    vibGain.gain.value = freq * 0.008;
    vib.connect(vibGain);
    vibGain.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.14, time + 0.06);
    g.gain.setValueAtTime(0.14, time + dur - 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + dur + 0.05);
    vib.start(time);
    vib.stop(time + dur + 0.05);
  }

  private subBass(time: number) {
    if (!this.ctx || !this.musicBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = 36.71; // D1
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.22, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + 0.36);
  }

  private riser(time: number, dur: number) {
    if (!this.ctx || !this.musicBus) return;
    const n = this.noiseBurst(time, dur, 0.0001, 200);
    if (!n) return;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, time);
    f.frequency.exponentialRampToValueAtTime(6000, time + dur);
    n.disconnect();
    n.connect(f);
    f.connect(this.musicBus);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.25, time + dur);
    f.connect(g);
    g.connect(this.musicBus);
  }

  // --- impact stinger voices ---
  private impactBoom(time: number, baseFreq: number, dur: number, gain: number) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(baseFreq * 2.4, time);
    o.frequency.exponentialRampToValueAtTime(baseFreq, time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  private metallicClang(time: number, dur: number, gain: number) {
    if (!this.ctx || !this.master) return;
    // inharmonic partials = metallic
    const partials = [1, 1.84, 2.41, 3.2, 4.3];
    const base = 880;
    partials.forEach((p, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = "triangle";
      o.frequency.value = base * p;
      const a = (gain * (1 - i * 0.15)) / partials.length;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(a, time + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(g);
      g.connect(this.master!);
      o.start(time);
      o.stop(time + dur + 0.02);
    });
  }

  private whoosh(time: number, dur: number) {
    if (!this.ctx || !this.master) return;
    const n = this.noiseBurst(time, dur, 0.0001, 400);
    if (!n) return;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(400, time);
    f.frequency.exponentialRampToValueAtTime(5000, time + dur * 0.6);
    f.frequency.exponentialRampToValueAtTime(800, time + dur);
    n.disconnect();
    n.connect(f);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.3, time + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    f.connect(g);
    g.connect(this.master);
  }

  private noiseBurst(
    time: number,
    dur: number,
    gain: number,
    cutoff: number,
  ): AudioNode | null {
    if (!this.ctx) return null;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f);
    f.connect(g);
    src.start(time);
    src.stop(time + dur + 0.02);
    return g;
  }
}
