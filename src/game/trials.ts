// TIME TRIALS — fixed competitive courses. Same route for every player,
// a required drone frame, brutal modifiers, and one metric: the clock.

import { type DistrictId } from './constants'
import { hashString, mulberry32 } from './rng'
import { CITY, type Pad } from './city'
import type { Mission } from './missions'

export interface TrialDef {
  id: string
  name: string
  desc: string
  district: DistrictId
  drone: string // required frame id
  cargoWeight: number
  stops: number
  minLeg: number
  stealth?: boolean
  storm?: boolean
  batteryStart?: number // handicap start charge
  modifiers: string[] // display chips
}

export const TRIALS: TrialDef[] = [
  {
    id: 'trial-maiden',
    name: 'Maiden Circuit',
    desc: 'The proving ground. One long lap over Solace Heights on the starter frame everyone owns.',
    district: 'residential', drone: 'model-quad', cargoWeight: 3, stops: 1, minLeg: 420,
    modifiers: ['Entry trial'],
  },
  {
    id: 'trial-canyon',
    name: 'Canyon Carver',
    desc: 'Thread the Axiom Core glass canyons on the twitchiest racer in the hangar.',
    district: 'downtown', drone: 'model-wasp', cargoWeight: 2, stops: 2, minLeg: 300,
    modifiers: ['2 stops', 'Tower canyons'],
  },
  {
    id: 'trial-corridor',
    name: 'Vela Corridor Sprint',
    desc: 'The boost-ring corridor, end to end. Falcon GT only — chain the rings or lose.',
    district: 'businesscore', drone: 'model-falcon', cargoWeight: 2, stops: 1, minLeg: 700,
    modifiers: ['Boost rings', 'Pure speed'],
  },
  {
    id: 'trial-heavyhaul',
    name: 'Deadweight Run',
    desc: '18kg of industrial freight across Ferrum Works in a flying container.',
    district: 'industrial', drone: 'model-titan', cargoWeight: 18, stops: 1, minLeg: 450,
    modifiers: ['18kg cargo'],
  },
  {
    id: 'trial-spire',
    name: 'Spire Dance',
    desc: 'Rooftop pad to rooftop pad, three hundred meters up. The Manta glides where others stall.',
    district: 'skybridges', drone: 'model-manta', cargoWeight: 4, stops: 2, minLeg: 280,
    modifiers: ['2 stops', 'High altitude'],
  },
  {
    id: 'trial-ghost',
    name: 'Ghost Protocol',
    desc: 'Through the Subgrid scanner tunnels, fast AND invisible. Full detection ends the run.',
    district: 'underground', drone: 'model-umbra', cargoWeight: 5, stops: 1, minLeg: 500,
    stealth: true,
    modifiers: ['Stealth', 'Scanner tunnels'],
  },
  {
    id: 'trial-storm',
    name: 'Tempest Lap',
    desc: 'Neon Harbor inside a locked ion storm with 60% charge. The Atlas shrugs at the wind.',
    district: 'harbor', drone: 'model-atlas', cargoWeight: 8, stops: 1, minLeg: 480,
    storm: true, batteryStart: 60,
    modifiers: ['Ion storm', '60% battery'],
  },
  {
    id: 'trial-halcyon',
    name: 'Halcyon Zero',
    desc: 'The ultimate run: secure-zone patrols, a locked storm, half charge. Aether Prime or nothing.',
    district: 'security', drone: 'model-aether', cargoWeight: 6, stops: 2, minLeg: 380,
    stealth: true, storm: true, batteryStart: 50,
    modifiers: ['Stealth', 'Ion storm', '50% battery', '2 stops'],
  },
]

function distance(a: Pad, b: Pad) {
  return Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y)
}

/** Deterministic course: every player flies the exact same pads in the same order. */
export function trialToMission(def: TrialDef): Mission {
  const rng = mulberry32(hashString(`trial-route-${def.id}`))
  const pads = CITY.pads.filter(p => p.district === def.district)

  // pickup + first drop: longest pair found in a fixed sample
  let best: { a: Pad; b: Pad; d: number } | null = null
  const good: { a: Pad; b: Pad; d: number }[] = []
  for (let i = 0; i < 60; i++) {
    const a = pads[Math.floor(rng() * pads.length)]
    const b = pads[Math.floor(rng() * pads.length)]
    if (a.id === b.id) continue
    const d = distance(a, b)
    if (!best || d > best.d) best = { a, b, d }
    if (d >= def.minLeg) good.push({ a, b, d })
  }
  const pair = good.length ? good[Math.floor(rng() * good.length)] : best!
  const drops: Pad[] = [pair.b]
  let prev = pair.b
  for (let s = 1; s < def.stops; s++) {
    let far: Pad | null = null
    for (let i = 0; i < 30; i++) {
      const next = pads[Math.floor(rng() * pads.length)]
      if (next.id === prev.id || next.id === pair.a.id || drops.some(x => x.id === next.id)) continue
      if (!far || distance(prev, next) > distance(prev, far)) far = next
    }
    drops.push(far ?? pads[0])
    prev = drops[drops.length - 1]
  }

  const dist = drops.reduce((acc, p, i) => acc + distance(i === 0 ? pair.a : drops[i - 1], p), 0)

  return {
    id: def.id,
    trialId: def.id,
    type: 'trial',
    title: `TRIAL: ${def.name}`,
    brief: def.desc,
    district: def.district,
    pickup: [pair.a.x, pair.a.y, pair.a.z],
    stops: drops.map(p => [p.x, p.y, p.z] as [number, number, number]),
    dropoff: [drops[drops.length - 1].x, drops[drops.length - 1].y, drops[drops.length - 1].z],
    cargoWeight: def.cargoWeight,
    reward: Math.round(150 + dist * 0.3), // modest fixed pay — the clock is the prize
    xp: Math.round(120 + dist * 0.2),
    stealth: def.stealth,
    storm: def.storm,
    batteryStart: def.batteryStart,
  }
}

export function trialById(id: string): TrialDef | undefined {
  return TRIALS.find(t => t.id === id)
}

export function fmtMs(ms: number): string {
  const s = ms / 1000
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${(s % 60).toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)}s`
}
