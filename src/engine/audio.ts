export type SurfaceType = 'stone' | 'earth' | 'wood';

export class TorosAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private windGain: GainNode | null = null;
  private streamGain: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private musicCalmGain: GainNode | null = null;
  private musicCombatGain: GainNode | null = null;

  private isInitialized = false;
  private isMuted = false;
  private combatBlend = 0;
  private lastNoteTime = 0;
  private melodyStep = 0;
  private drumStep = 0;
  private lastFireCrackle = 0;

  // D Hüseyni / Hicaz Anatolian modal scale frequencies (Hz)
  private readonly baglamaScale = [146.83, 164.81, 174.61, 196.0, 220.0, 233.08, 261.63, 293.66];
  private readonly neyNotes = [293.66, 329.63, 349.23, 392.0, 440.0];

  public init(): void {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.72;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Generate 2-second pink/white noise buffer for wind, stream, fire, steam, whooshes
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
    this.noiseBuffer = buffer;

    this.setupAmbience();
    this.setupMusicBuses();
    this.isInitialized = true;
    this.lastNoteTime = ctx.currentTime + 0.3;
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.08);
    }
  }

  private setupAmbience(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const ctx = this.ctx;

    // 1. Mountain Wind (Dağ rüzgarının uğultusu)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 2.6;

    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.12;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 140;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const windGain = ctx.createGain();
    windGain.gain.value = 0.16;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);
    windSrc.start();
    this.windGain = windGain;

    // 2. Mountain Stream (Dere suyunun akışı)
    const streamSrc = ctx.createBufferSource();
    streamSrc.buffer = this.noiseBuffer;
    streamSrc.loop = true;
    const streamBp = ctx.createBiquadFilter();
    streamBp.type = 'bandpass';
    streamBp.frequency.value = 1350;
    streamBp.Q.value = 0.75;
    const streamHp = ctx.createBiquadFilter();
    streamHp.type = 'highpass';
    streamHp.frequency.value = 500;
    const streamGain = ctx.createGain();
    streamGain.gain.value = 0.015;
    streamSrc.connect(streamHp);
    streamHp.connect(streamBp);
    streamBp.connect(streamGain);
    streamGain.connect(this.masterGain);
    streamSrc.start();
    this.streamGain = streamGain;

    // 3. Forge Hearth Fire Rumble (Ocak ateşi)
    const fireSrc = ctx.createBufferSource();
    fireSrc.buffer = this.noiseBuffer;
    fireSrc.loop = true;
    const fireLp = ctx.createBiquadFilter();
    fireLp.type = 'lowpass';
    fireLp.frequency.value = 280;
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0.14;
    fireSrc.connect(fireLp);
    fireLp.connect(fireGain);
    fireGain.connect(this.masterGain);
    fireSrc.start();
    this.fireGain = fireGain;
  }

  private setupMusicBuses(): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    this.musicCalmGain = ctx.createGain();
    this.musicCalmGain.gain.value = 0.34;
    this.musicCalmGain.connect(this.masterGain);

    this.musicCombatGain = ctx.createGain();
    this.musicCombatGain.gain.value = 0.0;
    this.musicCombatGain.connect(this.masterGain);
  }

  public update(
    dt: number,
    distToForge: number,
    distToStream: number,
    isOutdoor: boolean,
    isCombatActive: boolean
  ): void {
    if (!this.isInitialized || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Spatial ambient mix
    const fireProx = Math.max(0, 1 - distToForge / 18);
    if (this.fireGain) {
      this.fireGain.gain.setTargetAtTime(0.02 + fireProx * 0.18, now, 0.2);
    }

    const streamProx = Math.max(0, 1 - distToStream / 36);
    if (this.streamGain) {
      this.streamGain.gain.setTargetAtTime(streamProx * 0.22, now, 0.2);
    }

    if (this.windGain) {
      const targetWind = isOutdoor ? 0.22 : 0.08;
      this.windGain.gain.setTargetAtTime(targetWind, now, 0.35);
    }

    // Randomized ember crackles near forge
    if (fireProx > 0.2 && now - this.lastFireCrackle > 0.18 + Math.random() * 0.45) {
      this.lastFireCrackle = now;
      this.triggerEmberCrackle(fireProx);
    }

    // Crossfade calm Anatolian music vs epic war drums & strings
    const targetCombat = isCombatActive ? 1 : 0;
    this.combatBlend += (targetCombat - this.combatBlend) * Math.min(1, dt * 1.4);
    if (this.musicCalmGain && this.musicCombatGain) {
      this.musicCalmGain.gain.setTargetAtTime(0.36 * (1 - this.combatBlend * 0.55), now, 0.25);
      this.musicCombatGain.gain.setTargetAtTime(0.42 * this.combatBlend, now, 0.25);
    }

    // Sequencer tick for Anatolian bağlama/kopuz + ney and combat drums/strings
    if (now >= this.lastNoteTime) {
      const stepDur = isCombatActive ? 0.32 : 0.55;
      this.scheduleMusicStep(now, isCombatActive);
      this.lastNoteTime = now + stepDur;
    }
  }

  private triggerEmberCrackle(intensity: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600 + Math.random() * 2400;
    bp.Q.value = 4.5;
    const g = this.ctx.createGain();
    const vol = (0.04 + Math.random() * 0.06) * intensity;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 1.2, 0.05);
  }

  private scheduleMusicStep(now: number, combat: boolean): void {
    if (!this.ctx || !this.musicCalmGain || !this.musicCombatGain) return;

    // Bağlama / Kopuz plucked pattern
    const pattern = [0, 2, 4, 3, 5, 4, 2, 1, 0, 4, 7, 5, 4, 3, 2, 0];
    const shouldPluck = this.melodyStep % 2 === 0 || Math.random() > 0.35;
    if (shouldPluck) {
      const noteIdx = pattern[this.melodyStep % pattern.length];
      const freq = this.baglamaScale[noteIdx];
      this.playBaglamaPluck(now, freq, combat ? 0.16 : 0.24);
      // Drone fifth/root occasionally
      if (this.melodyStep % 8 === 0) {
        this.playBaglamaPluck(now, 73.42, 0.18); // Low D drone string
      }
    }

    // Breathy Ney flute phrase every 8 steps in calm exploration/forging
    if (!combat && this.melodyStep % 8 === 0) {
      const neyFreq = this.neyNotes[(this.melodyStep / 8) % this.neyNotes.length];
      this.playNeyTone(now, neyFreq, 3.2);
    }

    // Combat war drums & strings
    if (this.combatBlend > 0.08) {
      const beat = this.drumStep % 8;
      if (beat === 0 || beat === 3 || beat === 6) {
        this.playWarDrum(now, beat === 0 ? 1.0 : 0.72);
      } else if (beat === 4 || beat === 7) {
        this.playWarDrumRim(now);
      }
      if (this.drumStep % 8 === 0) {
        this.playEpicStringSwell(now, beat === 0 ? 146.83 : 174.61);
      }
      this.drumStep++;
    }

    this.melodyStep++;
  }

  private playBaglamaPluck(time: number, freq: number, volume: number): void {
    if (!this.ctx || !this.musicCalmGain) return;
    const ctx = this.ctx;

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, time);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 2.0, time); // Metallic double-course string shimmer

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6.5, time);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.6, time + 0.9);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(volume, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 1.45);

    const g2 = ctx.createGain();
    g2.gain.value = 0.28;

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);
    filter.connect(g);
    g.connect(this.musicCalmGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 1.5);
    osc2.stop(time + 1.5);
  }

  private playNeyTone(time: number, freq: number, dur: number): void {
    if (!this.ctx || !this.musicCalmGain || !this.noiseBuffer) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.985, time);
    osc.frequency.linearRampToValueAtTime(freq, time + 0.25);

    const vib = ctx.createOscillator();
    vib.frequency.value = 4.6;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 3.2;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const breath = ctx.createBufferSource();
    breath.buffer = this.noiseBuffer;
    const breathBp = ctx.createBiquadFilter();
    breathBp.type = 'bandpass';
    breathBp.frequency.value = freq * 2.1;
    breathBp.Q.value = 3.5;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.035;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.11, time + 0.55);
    env.gain.setValueAtTime(0.095, time + dur - 0.8);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(env);
    breath.connect(breathBp);
    breathBp.connect(breathGain);
    breathGain.connect(env);
    env.connect(this.musicCalmGain);

    osc.start(time);
    vib.start(time);
    breath.start(time, 0, dur);
    osc.stop(time + dur + 0.05);
    vib.stop(time + dur + 0.05);
  }

  private playWarDrum(time: number, accent: number): void {
    if (!this.ctx || !this.musicCombatGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(98, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.22);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45 * accent, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.42);

    osc.connect(g);
    g.connect(this.musicCombatGain);
    osc.start(time);
    osc.stop(time + 0.45);
  }

  private playWarDrumRim(time: number): void {
    if (!this.ctx || !this.musicCombatGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 650;
    bp.Q.value = 2.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.musicCombatGain);
    src.start(time, 0.2, 0.14);
  }

  private playEpicStringSwell(time: number, freq: number): void {
    if (!this.ctx || !this.musicCombatGain) return;
    const ctx = this.ctx;
    [1, 1.498].forEach((ratio) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * ratio, time);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 920;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.09, time + 0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 2.4);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.musicCombatGain!);
      osc.start(time);
      osc.stop(time + 2.5);
    });
  }

  // --- FOLEY SFX ---

  public playHammerAnvil(heatRatio = 0.8): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const baseFreq = 690 + (1 - heatRatio) * 180 + (Math.random() - 0.5) * 28;
    const partials = [1, 2.756, 4.12, 5.4];

    partials.forEach((p, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq * p, now);
      const g = this.ctx!.createGain();
      const amp = 0.28 / (idx + 1);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (idx === 0 ? 1.15 : 0.75 / (idx + 0.5)));
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 1.25);
    });

    // Crisp hammer impact transient
    const hit = this.ctx.createBufferSource();
    hit.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1800;
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.35, now);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    hit.connect(hp);
    hp.connect(hg);
    hg.connect(this.masterGain);
    hit.start(now, 0.1, 0.06);
  }

  public playForgeBellows(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(240, now);
    lp.frequency.linearRampToValueAtTime(920, now + 0.35);
    lp.frequency.exponentialRampToValueAtTime(260, now + 0.9);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.32, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0, 1.0);
  }

  public playWaterQuench(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Sharp steam hiss (tıssss!)
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(4200, now);
    bp.frequency.exponentialRampToValueAtTime(1600, now + 1.8);
    bp.Q.value = 0.85;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.9);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0, 1.95);

    // Bubbling water pops
    for (let i = 0; i < 6; i++) {
      const t = now + 0.1 + i * 0.18 + Math.random() * 0.08;
      const bOsc = this.ctx.createOscillator();
      bOsc.type = 'sine';
      const f0 = 280 + Math.random() * 260;
      bOsc.frequency.setValueAtTime(f0, t);
      bOsc.frequency.exponentialRampToValueAtTime(f0 * 2.1, t + 0.08);
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.08, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      bOsc.connect(bg);
      bg.connect(this.masterGain);
      bOsc.start(t);
      bOsc.stop(t + 0.1);
    }
  }

  public playSwordUnsheathe(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, now);
    bp.frequency.exponentialRampToValueAtTime(4800, now + 0.28);
    bp.Q.value = 6.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.02, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.3, 0.36);
  }

  public playWeaponSwing(heavy = false): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(heavy ? 320 : 520, now);
    bp.frequency.exponentialRampToValueAtTime(heavy ? 180 : 280, now + 0.22);
    bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(heavy ? 0.38 : 0.28, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.3 : 0.22));
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.4, 0.32);
  }

  public playShieldBlock(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    [420, 910, 1480].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.24 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.48);
    });
  }

  public playArmorHit(heavy = false): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(heavy ? 140 : 185, now);
    thud.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(heavy ? 0.42 : 0.3, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.18);

    const clank = this.ctx.createOscillator();
    clank.type = 'sine';
    clank.frequency.setValueAtTime(1120 + Math.random() * 240, now);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.14, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    clank.connect(cg);
    cg.connect(this.masterGain);
    clank.start(now);
    clank.stop(now + 0.24);
  }

  public playFootstep(surface: SurfaceType): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = surface === 'stone' ? 920 : surface === 'wood' ? 420 : 580;
    bp.Q.value = surface === 'stone' ? 2.2 : 1.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 1.1, 0.095);

    // Authentic wooden bridge plank creak (Ahşap köprü gıcırtıları)
    if (surface === 'wood' && Math.random() < 0.55) {
      const creak = this.ctx.createOscillator();
      creak.type = 'sawtooth';
      const f = 140 + Math.random() * 60;
      creak.frequency.setValueAtTime(f, now);
      creak.frequency.linearRampToValueAtTime(f * 0.82, now + 0.14);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.05, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      creak.connect(lp);
      lp.connect(cg);
      cg.connect(this.masterGain);
      creak.start(now);
      creak.stop(now + 0.18);
    }
  }

  public playCatapultLaunch(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Gear ratchet ticks
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(260 + i * 25, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.04);
    }

    // Heavy timber arm snap & boom
    const boomTime = now + 0.3;
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(115, boomTime);
    boom.frequency.exponentialRampToValueAtTime(34, boomTime + 0.38);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.45, boomTime);
    bg.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.42);
    boom.connect(bg);
    bg.connect(this.masterGain);
    boom.start(boomTime);
    boom.stop(boomTime + 0.45);
  }

  public playBoulderImpact(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0, 0.7);
  }

  public playCrossbowSnap(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, now);
    bp.frequency.exponentialRampToValueAtTime(900, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.2, 0.16);
  }

  public playBarricadeBuild(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    [0, 0.12].forEach((delay) => {
      const t = now + delay;
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.09);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}
