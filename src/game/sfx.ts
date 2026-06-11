// Tiny synthesized SFX — no audio assets needed.

let ctx: AudioContext | null = null
let muted = false

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setMuted(m: boolean) {
  muted = m
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, slide = 0) {
  const a = ac()
  if (!a || muted) return
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.value = freq
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + dur)
  g.gain.value = gain
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
  osc.connect(g).connect(a.destination)
  osc.start()
  osc.stop(a.currentTime + dur)
}

// ---------- continuous engine + wind ambience ----------

interface EngineNodes {
  osc1: OscillatorNode
  osc2: OscillatorNode
  engGain: GainNode
  noise: AudioBufferSourceNode
  windFilter: BiquadFilterNode
  windGain: GainNode
}

let engine: EngineNodes | null = null

export function startEngine() {
  const a = ac()
  if (!a || engine) return
  try {
    // twin detuned saws through a lowpass = drone motor hum
    const osc1 = a.createOscillator()
    const osc2 = a.createOscillator()
    osc1.type = 'sawtooth'
    osc2.type = 'sawtooth'
    osc1.frequency.value = 65
    osc2.frequency.value = 65.8
    const engFilter = a.createBiquadFilter()
    engFilter.type = 'lowpass'
    engFilter.frequency.value = 320
    const engGain = a.createGain()
    engGain.gain.value = 0
    osc1.connect(engFilter)
    osc2.connect(engFilter)
    engFilter.connect(engGain).connect(a.destination)
    osc1.start()
    osc2.start()

    // looping noise through a bandpass = wind
    const len = a.sampleRate * 2
    const buf = a.createBuffer(1, len, a.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const noise = a.createBufferSource()
    noise.buffer = buf
    noise.loop = true
    const windFilter = a.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 500
    windFilter.Q.value = 0.6
    const windGain = a.createGain()
    windGain.gain.value = 0
    noise.connect(windFilter).connect(windGain).connect(a.destination)
    noise.start()

    engine = { osc1, osc2, engGain, noise, windFilter, windGain }
  } catch {
    engine = null
  }
}

export function stopEngine() {
  if (!engine) return
  try {
    engine.osc1.stop()
    engine.osc2.stop()
    engine.noise.stop()
  } catch {
    // already stopped
  }
  engine = null
}

/** Called from the sim loop (~20Hz): throttle 0..1, boost flag, wind m/s. */
export function engineUpdate(throttle: number, boosting: boolean, wind: number) {
  const a = ctx
  if (!a || !engine) return
  const target = muted ? 0 : 0.018 + throttle * 0.03 + (boosting ? 0.02 : 0)
  const freq = 60 + throttle * 55 + (boosting ? 40 : 0)
  const t = a.currentTime
  engine.engGain.gain.setTargetAtTime(target, t, 0.12)
  engine.osc1.frequency.setTargetAtTime(freq, t, 0.15)
  engine.osc2.frequency.setTargetAtTime(freq * 1.012, t, 0.15)
  const windTarget = muted ? 0 : Math.min(0.05, Math.max(0, wind - 1.5) * 0.008)
  engine.windGain.gain.setTargetAtTime(windTarget, t, 0.25)
  engine.windFilter.frequency.setTargetAtTime(400 + wind * 90, t, 0.3)
}

export const sfx = {
  pickup: () => {
    tone(520, 0.12, 'sine', 0.09)
    setTimeout(() => tone(780, 0.16, 'sine', 0.09), 90)
  },
  deliver: () => {
    tone(523, 0.12, 'triangle', 0.1)
    setTimeout(() => tone(659, 0.12, 'triangle', 0.1), 100)
    setTimeout(() => tone(880, 0.25, 'triangle', 0.1), 200)
  },
  crash: () => {
    tone(160, 0.4, 'sawtooth', 0.12, -110)
  },
  click: () => tone(640, 0.05, 'square', 0.04),
  buy: () => {
    tone(700, 0.1, 'sine', 0.08)
    setTimeout(() => tone(1050, 0.18, 'sine', 0.08), 80)
  },
  warn: () => tone(330, 0.18, 'square', 0.05),
  levelup: () => {
    ;[440, 554, 659, 880].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.09), i * 110))
  },
}
