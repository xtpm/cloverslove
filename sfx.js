/*
  UI sound effects.

  Every sound is synthesized with the Web Audio API, so nothing needs to be
  downloaded. To use your own sounds instead, drop files into
  public/assets/sfx/ named after the sound, e.g.

    public/assets/sfx/hover.wav
    public/assets/sfx/select.mp3

  Names: hover, select, open, back, toggle, catch, lucky
  (.mp3, .wav or .ogg). Any file found replaces that synthesized sound.
*/
const NAMES = ["hover", "select", "open", "back", "toggle", "catch", "lucky"];
const EXTS = ["mp3", "wav", "ogg"];

let ctx = null;
let master = null;
let enabled = true;
const files = {};
let lastHover = 0;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    // a little air on top so the blips feel "glassy"
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    loadFiles();
  }
  if (ctx.state === "suspended") ctx.resume();
  return true;
}

async function loadFiles() {
  await Promise.all(
    NAMES.map(async (name) => {
      for (const ext of EXTS) {
        try {
          const r = await fetch(`/assets/sfx/${name}.${ext}`);
          // dev servers answer missing files with index.html, so check the type
          if (!r.ok || !(r.headers.get("content-type") || "").startsWith("audio")) continue;
          files[name] = await ctx.decodeAudioData(await r.arrayBuffer());
          return;
        } catch {}
      }
    })
  );
}

function tone({ f = 880, f2, type = "sine", t = 0, dur = 0.08, vol = 0.1, attack = 0.003, pan = 0 }) {
  const now = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  o.type = type;
  o.frequency.setValueAtTime(f, now);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(master); }
  else o.connect(g).connect(master);
  o.start(now);
  o.stop(now + dur + 0.03);
}

function tick(vol = 0.05, t = 0, hp = 4000) {
  const now = ctx.currentTime + t;
  const len = Math.floor(ctx.sampleRate * 0.02);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ctx.createBufferSource();
  const filt = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buf;
  filt.type = "highpass";
  filt.frequency.value = hp;
  g.gain.value = vol;
  src.connect(filt).connect(g).connect(master);
  src.start(now);
}

/* clean, minimal menu sounds: a soft tick + a pure tone */
const synth = {
  hover() {
    tick(0.035, 0, 5000);
    tone({ f: 2350, type: "sine", dur: 0.05, vol: 0.045 });
  },
  select() {
    tick(0.05, 0, 3500);
    tone({ f: 1480, type: "triangle", dur: 0.08, vol: 0.07 });
    tone({ f: 2220, type: "sine", t: 0.045, dur: 0.12, vol: 0.05 });
  },
  open() {
    tick(0.06, 0, 3000);
    tone({ f: 740, f2: 1110, type: "sine", dur: 0.16, vol: 0.06 });
    tone({ f: 1480, type: "triangle", t: 0.07, dur: 0.18, vol: 0.05, pan: -0.2 });
    tone({ f: 2220, type: "sine", t: 0.13, dur: 0.3, vol: 0.035, pan: 0.2 });
  },
  back() {
    tick(0.05, 0, 3000);
    tone({ f: 1480, f2: 990, type: "triangle", dur: 0.12, vol: 0.06 });
    tone({ f: 740, type: "sine", t: 0.06, dur: 0.16, vol: 0.05 });
  },
  toggle() {
    tick(0.05, 0, 4500);
    tone({ f: 1760, type: "square", dur: 0.03, vol: 0.02 });
  },
  catch() {
    [1568, 2093].forEach((f, i) => tone({ f, type: "sine", t: i * 0.05, dur: 0.14, vol: 0.05 }));
  },
  lucky() {
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone({ f, type: "triangle", t: i * 0.06, dur: 0.32, vol: 0.045, pan: (i - 2) * 0.2 }));
  },
};

export const sfx = {
  set enabled(v) { enabled = v; },
  get enabled() { return enabled; },
  /** call from any user gesture so the browser lets audio start */
  unlock() { if (enabled) ensure(); },
  play(name) {
    // no context until the first click/keypress, so the browser never blocks it
    if (!enabled || !ctx || !ensure() || ctx.state !== "running") return;
    if (name === "hover") {
      const now = performance.now();
      if (now - lastHover < 35) return; // don't machine-gun when sweeping the mouse
      lastHover = now;
    }
    if (files[name]) {
      const s = ctx.createBufferSource();
      s.buffer = files[name];
      s.connect(master);
      s.start();
    } else synth[name]?.();
  },
};
