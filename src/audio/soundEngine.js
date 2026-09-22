/**
 * Procedural Web Audio API Sound Synthesizer
 * Zero external audio files required - works 100% offline & reliably
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.7;
    this.blowerNode = null;
    this.blowerGain = null;
    this.blowerFilter = null;
    this.isBlowerRunning = false;
    this.lastClackTime = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.blowerGain && this.isBlowerRunning) {
      this.blowerGain.gain.setValueAtTime(this.volume * 0.18, this.ctx.currentTime);
    }
  }

  setEnabled(val) {
    this.enabled = !!val;
    if (!this.enabled && this.isBlowerRunning) {
      this.stopBlower();
    }
  }

  // Tactile button click
  playClick() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    gain.gain.setValueAtTime(this.volume * 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
  }

  // Lottery ball bounce / impact clack
  playBallClack(velocity = 1) {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    // Throttle clacks so they don't overpower CPU/ears during heavy mixing
    if (t - this.lastClackTime < 0.025) return;
    this.lastClackTime = t;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Randomize pitch slightly around 1800Hz for realistic plastic clack
    const baseFreq = 1600 + Math.random() * 800;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.35, t + 0.035);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq, t);
    filter.Q.setValueAtTime(4.0, t);

    const hitVol = Math.min(1, Math.max(0.1, velocity * 0.3)) * this.volume * 0.35;
    gain.gain.setValueAtTime(hitVol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  // Air blower continuous swirling noise
  startBlower() {
    if (!this.enabled || this.isBlowerRunning) return;
    this.init();
    const t = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Generate pink noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, t);
    filter.Q.setValueAtTime(1.8, t);

    // LFO to modulate air vortex resonance
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.8, t); // 0.8 Hz swirl
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(120, t);
    lfo.connect(filter.frequency);
    lfo.start(t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(this.volume * 0.18, t + 0.6);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);

    this.blowerNode = noise;
    this.blowerGain = gain;
    this.blowerFilter = filter;
    this.isBlowerRunning = true;
  }

  stopBlower() {
    if (!this.isBlowerRunning || !this.blowerGain) return;
    const t = this.ctx.currentTime;
    this.blowerGain.gain.setValueAtTime(this.blowerGain.gain.value, t);
    this.blowerGain.gain.linearRampToValueAtTime(0.0001, t + 0.5);
    setTimeout(() => {
      if (this.blowerNode) {
        try { this.blowerNode.stop(); } catch (e) {}
        this.blowerNode.disconnect();
      }
      this.isBlowerRunning = false;
      this.blowerNode = null;
      this.blowerGain = null;
    }, 550);
  }

  // Motor servo whir for wire scoop dipping & lifting
  playServoMotor(duration = 1.2) {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.linearRampToValueAtTime(220, t + duration * 0.4);
    osc.frequency.linearRampToValueAtTime(140, t + duration);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(this.volume * 0.12, t + 0.1);
    gain.gain.setValueAtTime(this.volume * 0.12, t + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0.0001, t + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  // Rapid countdown telemetry ticks on LED display
  playDigitTick() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.02);

    gain.gain.setValueAtTime(this.volume * 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.02);
  }

  // Dramatic suspense rising hum
  playSuspenseRise(duration = 3.0) {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + duration);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(this.volume * 0.18, t + duration * 0.5);
    gain.gain.linearRampToValueAtTime(this.volume * 0.28, t + duration - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  // Triumphant victory fanfare & jackpot chime
  playJackpotChime() {
    if (!this.enabled) return;
    this.init();
    const notes = [
      { f: 523.25, time: 0, dur: 0.18 },    // C5
      { f: 659.25, time: 0.12, dur: 0.18 },  // E5
      { f: 783.99, time: 0.24, dur: 0.22 },  // G5
      { f: 1046.50, time: 0.38, dur: 0.8 }   // C6
    ];

    notes.forEach(n => {
      const t = this.ctx.currentTime + n.time;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(n.f * 2, t);

      gain.gain.setValueAtTime(this.volume * 0.26, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc2.start(t);
      osc.stop(t + n.dur);
      osc2.stop(t + n.dur);
    });
  }
}

export const soundEngine = new SoundEngine();
