// Procedural Shadow-Fight-style soundtrack synthesized with the Web Audio API.
// Oriental / tribal-electronic feel: low drone, taiko drums, koto arpeggios
// and a slow flute lead, all in A minor pentatonic. Looping with a lookahead
// scheduler. No external assets. Client-side only.

type Wave = OscillatorType;

const A_PENTA = [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]; // A minor pentatonic across octaves

function penta(degree: number): number {
  const n = ((degree % A_PENTA.length) + A_PENTA.length) % A_PENTA.length;
  return A_PENTA[n];
}

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
  private running = false;
  private _volume = 0.5;

  // 16-step bar patterns
  private kickSteps = [0, 6, 8, 14];
  private snareSteps = [4, 12];
  // koto arpeggio phrases (scale degrees, -1 = rest); 16 steps each
  private kotoPhrases: number[][] = [
    [0, -1, 2, -1, 3, -1, 2, -1, 4, -1, 3, -1, 2, -1, 1, -1],
    [0, -1, -1, 2, 3, -1, -1, 4, 3, -1, -1, 2, 1, -1, -1, 0],
    [4, -1, 3, 2, -1, 3, -1, 4, 5, -1, 4, 3, -1, 2, -1, 0],
  ];
  private kotoPhrase = 0;
  // flute: [startStep, lengthSteps, degree] per bar, cycling
  private flutePhrase: [number, number, number][] = [
    [0, 8, 7],
    [0, 8, 9],
    [8, 8, 6],
    [0, 16, 8],
  ];
  private fluteIdx = 0;
  private lastFluteStep = -1;

  private tempo = 92; // BPM
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
      // gentle lowpass for warmth
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 5200;
      lp.Q.value = 0.4;
      this.master.connect(lp);
      lp.connect(this.ctx.destination);

      // music bus -> master, plus a delay send for space
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.9;
      this.delay = this.ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.38;
      this.delayFb = this.ctx.createGain();
      this.delayFb.gain.value = 0.32;
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
    this.lastFluteStep = -1;
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
    if (this.running) {
      this.stop();
    } else {
      void this.start();
    }
    return this.running;
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  // --- drone ---
  private startDrone() {
    if (!this.ctx || !this.musicBus) return;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.0;
    this.droneGain.gain.setTargetAtTime(0.18, this.ctx.currentTime, 1.2);
    this.droneGain.connect(this.musicBus);

    const freqs = [55, 82.41]; // A1 + E2
    for (const f of freqs) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(this.droneGain);
      o.start();
      this.droneNodes.push(o);
    }
    // slow tremolo LFO on drone
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = 0.18;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.06;
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
    const t = this.ctx?.currentTime ?? 0;
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
        // advance phrases each bar
        this.kotoPhrase = (this.kotoPhrase + 1) % this.kotoPhrases.length;
        this.fluteIdx = (this.fluteIdx + 1) % this.flutePhrase.length;
        this.lastFluteStep = -1;
      }
    }
  }

  private scheduleStep(step: number, time: number) {
    if (this.kickSteps.includes(step)) this.kick(time, step === 0 ? 1 : 0.8);
    if (this.snareSteps.includes(step)) this.snare(time);

    // koto
    const phrase = this.kotoPhrases[this.kotoPhrase];
    const deg = phrase[step];
    if (deg >= 0) {
      this.pluck(penta(deg + 2), time, 0.22, "triangle", 0.16);
      // octave shimmer occasionally
      if (step % 4 === 0) this.pluck(penta(deg + 5), time, 0.14, "sine", 0.08);
    }

    // flute (long note)
    const [startStep, lenSteps, fdeg] = this.flutePhrase[this.fluteIdx];
    if (step === startStep) {
      this.flute(penta(fdeg + 4), time, lenSteps * this.stepDur);
      this.lastFluteStep = step;
    }
  }

  // --- voices ---
  private kick(time: number, vel: number) {
    if (!this.ctx || !this.musicBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.9 * vel, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + 0.34);
    // click
    const n = this.noiseBurst(time, 0.02, 0.25, 3000);
    if (n) n.connect(this.musicBus);
  }

  private snare(time: number) {
    if (!this.ctx || !this.musicBus) return;
    const n = this.noiseBurst(time, 0.16, 0.5, 2200);
    if (n) n.connect(this.musicBus);
    // body tone
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, time);
    o.frequency.exponentialRampToValueAtTime(140, time + 0.1);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.22, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + 0.16);
  }

  private pluck(
    freq: number,
    time: number,
    dur: number,
    type: Wave,
    gain: number,
  ) {
    if (!this.ctx || !this.musicBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    // slight detune upper partial for a shamisen-ish bite
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq * 2.2;
    f.Q.value = 0.7;
    o.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  private flute(freq: number, time: number, dur: number) {
    if (!this.ctx || !this.musicBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    // vibrato
    const vib = this.ctx.createOscillator();
    const vibGain = this.ctx.createGain();
    vib.frequency.value = 5.2;
    vibGain.gain.value = freq * 0.006;
    vib.connect(vibGain);
    vibGain.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.12, time + 0.12);
    g.gain.setValueAtTime(0.12, time + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + dur + 0.05);
    vib.start(time);
    vib.stop(time + dur + 0.05);
  }

  private noiseBurst(
    time: number,
    dur: number,
    gain: number,
    cutoff: number,
  ): AudioNode | null {
    if (!this.ctx) return null;
    const frames = Math.floor(this.ctx.sampleRate * dur);
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
