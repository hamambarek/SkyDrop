// TIME TRIALS — fixed competitive courses. Same route for every player,
// a required drone frame, brutal modifiers, and one metric: the clock.

import { TRIAL_ROUTES } from '../../shared/trial-routes.mjs'
import { type DistrictId } from './constants'
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

/**
 * Fixed courses from the shared route table — the SAME coordinates the server
 * uses to validate submitted runs, so client and anti-cheat can never drift.
 */
export function trialToMission(def: TrialDef): Mission {
  const route = TRIAL_ROUTES[def.id as keyof typeof TRIAL_ROUTES]
  const pickup = route.pickup as [number, number, number]
  const stops = route.stops as [number, number, number][]
  const dist = stops.reduce((acc, p, i) => {
    const q = i === 0 ? pickup : stops[i - 1]
    return acc + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
  }, 0)

  return {
    id: def.id,
    trialId: def.id,
    type: 'trial',
    title: `TRIAL: ${def.name}`,
    brief: def.desc,
    district: def.district,
    pickup,
    stops,
    dropoff: stops[stops.length - 1],
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
