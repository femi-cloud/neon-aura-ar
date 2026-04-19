// Pure reactive SFX engine using Web Audio API
export class AuraAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private auraNodes: { osc: OscillatorNode; gain: GainNode } | null = null;
  private orbNodes: { osc: OscillatorNode; gain: GainNode } | null = null;

  async init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
  }

  setVolume(v: number) {
    if (this.master) this.master.gain.value = v;
  }

  // Shockwave whoosh
  playShockwave(intensity = 1) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4 * intensity, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  // Lightning crackle
  playLightning(intensity = 1) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1500;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.35 * intensity;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(t);
  }

  // Continuous airy aura pad (for open palm)
  setAuraActive(active: boolean, hue = 0.5) {
    if (!this.ctx || !this.master) return;
    if (active && !this.auraNodes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 220 + hue * 220;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      gain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.2);
      this.auraNodes = { osc, gain };
    } else if (!active && this.auraNodes) {
      const { osc, gain } = this.auraNodes;
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
      osc.stop(this.ctx.currentTime + 0.2);
      this.auraNodes = null;
    } else if (active && this.auraNodes) {
      this.auraNodes.osc.frequency.setTargetAtTime(220 + hue * 220, this.ctx.currentTime, 0.1);
    }
  }

  // Low orb hum (for fist)
  setOrbActive(active: boolean, depth = 0.5) {
    if (!this.ctx || !this.master) return;
    if (active && !this.orbNodes) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 60 + depth * 40;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.15);
      this.orbNodes = { osc, gain };
    } else if (!active && this.orbNodes) {
      const { osc, gain } = this.orbNodes;
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
      osc.stop(this.ctx.currentTime + 0.2);
      this.orbNodes = null;
    } else if (active && this.orbNodes) {
      this.orbNodes.osc.frequency.setTargetAtTime(60 + depth * 40, this.ctx.currentTime, 0.1);
    }
  }

  dispose() {
    this.setAuraActive(false);
    this.setOrbActive(false);
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
