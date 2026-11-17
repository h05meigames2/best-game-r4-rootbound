// DEEPROOT — synthesized sound, no audio assets.
// One job: every sound the game makes, built from WebAudio oscillators, plus mute.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let droneNodes = null;
  let lastTick = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ensure() || muted) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, lowFreq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = lowFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0);
  }

  return {
    get muted() { return muted; },
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') void ctx.resume(); this.startDrone(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    startDrone() {
      if (!ensure() || droneNodes || muted) return;
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = 55;
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle'; osc2.frequency.value = 82.5;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        const g = ctx.createGain(); g.gain.value = 0.05;
        osc.connect(g); osc2.connect(g); g.connect(master);
        osc.start(); osc2.start(); lfo.start();
        droneNodes = { osc, osc2, lfo, g };
      } catch { /* drone is ambience, never fatal */ }
    },
    // Soft tick while a root grows; throttled by the caller through tryTick.
    tryTick(nowMs) {
      if (nowMs - lastTick < 110) return;
      lastTick = nowMs;
      tone(190 + Math.random() * 60, 0.07, 'sine', 0.10, 140);
    },
    water() { tone(660, 0.16, 'sine', 0.22, 990); tone(990, 0.22, 'sine', 0.16, 1320, 0.07); },
    dew() { tone(880, 0.1, 'sine', 0.12, 1100); },
    nutrient() { tone(523, 0.1, 'triangle', 0.16); tone(784, 0.12, 'triangle', 0.16, null, 0.06); tone(1046, 0.16, 'triangle', 0.14, null, 0.12); },
    rock() { tone(110, 0.16, 'sine', 0.28, 55); noiseBurst(0.08, 0.12, 400); },
    squash() { tone(300, 0.09, 'square', 0.14, 90); noiseBurst(0.06, 0.10, 900); },
    branch() { tone(392, 0.12, 'triangle', 0.18, 523); tone(523, 0.14, 'triangle', 0.14, 659, 0.08); },
    boon() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.16, null, i * 0.07)); },
    grubSpawn() { tone(220, 0.2, 'sawtooth', 0.05, 160); },
    wither() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.14, null, i * 0.14)); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.34, 'triangle', 0.18, null, i * 0.11)); },
    click() { tone(700, 0.05, 'sine', 0.10, 900); },
  };
}
