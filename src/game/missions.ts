import { CITY, type Pad } from './city'
import { DISTRICTS, type DistrictId } from './constants'
import type { FactionId } from './factions'
import { CHAPTERS, type StoryMissionDef } from './story'
import { hashString, mulberry32, pick, rand, type RNG } from './rng'

export type MissionType = 'standard' | 'express' | 'fragile' | 'heavy' | 'story' | 'daily' | 'stealth' | 'storm' | 'chain' | 'trial'

export interface Mission {
  id: string
  type: MissionType
  title: string
  brief: string
  district: DistrictId
  pickup: [number, number, number]
  /** Delivery stops after pickup (1 for normal missions, 2-3 for chains). */
  stops: [number, number, number][]
  /** Last stop — kept for compatibility with older code/UI. */
  dropoff: [number, number, number]
  cargoWeight: number
  reward: number
  xp: number
  timeLimit?: number
  fragile?: boolean
  stealth?: boolean // detection meter active; full detection fails the run
  storm?: boolean // weather locked to ion storm for the mission
  chapterId?: number
  storyId?: string
  daily?: boolean
  faction?: FactionId
  trialId?: string // competitive time trial — best completion time is the score
  batteryStart?: number // trial handicap: starting charge percentage
}

const SENDERS = ['Lumen Cafe', 'Dr. Okafor', 'Vexel Labs', 'Night Market stall 7', 'Hana Florist', 'Kuro Ramen', 'Apex Pharmacy', 'Mr. Castellanos', 'The Print Shop', 'Zira Boutique', 'Dock Office 12', 'Foundry Crew B', 'Vela Exchange', 'Spire Concierge', 'Subgrid Broker', 'Halcyon Desk 0']
const CARGO = ['hot dinner', 'medical kit', 'circuit boards', 'mystery box', 'fresh flowers', 'spare drone parts', 'legal documents', 'vinyl records', 'lab samples', 'birthday gift', 'tool crate', 'coffee beans', 'market data drive', 'sealed evidence', 'unmarked crate', 'prototype optics']

const DISTRICT_FACTION: Record<DistrictId, FactionId> = {
  residential: 'union',
  downtown: 'axiom',
  industrial: 'syndicate',
  harbor: 'civic',
  businesscore: 'axiom',
  skybridges: 'union',
  underground: 'syndicate',
  security: 'civic',
}

function distance(a: Pad, b: Pad) {
  return Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y)
}

function padsIn(district: DistrictId): Pad[] {
  return CITY.pads.filter(p => p.district === district)
}

/**
 * Build a route: pickup in `district`, drops in `destDistrict` (same district
 * unless this is a cross-district haul). The pickup/first-drop PAIR is sampled
 * together and the longest candidates win, so routes are guaranteed to be real
 * journeys — never a hop across the street.
 */
function pickRoute(
  rng: RNG,
  district: DistrictId,
  stops: number,
  minLeg = 300,
  destDistrict: DistrictId = district
): { pickup: Pad; drops: Pad[] } {
  const pads = padsIn(district)
  const destPads = padsIn(destDistrict)

  // sample pairs, keep every pair over the minimum, otherwise track the longest
  const goodPairs: { a: Pad; b: Pad; d: number }[] = []
  let longest: { a: Pad; b: Pad; d: number } | null = null
  for (let i = 0; i < 50; i++) {
    const a = pick(rng, pads)
    const b = pick(rng, destPads)
    if (a.id === b.id) continue
    const d = distance(a, b)
    if (!longest || d > longest.d) longest = { a, b, d }
    if (d >= minLeg) goodPairs.push({ a, b, d })
  }
  const pair = goodPairs.length ? goodPairs[Math.floor(rng() * goodPairs.length)] : longest!
  const pickup = pair.a
  const drops: Pad[] = [pair.b]

  // extra chain stops: pick the farthest of a few samples from the previous stop
  let prev = pair.b
  for (let s = 1; s < stops; s++) {
    let best: Pad | null = null
    for (let i = 0; i < 24; i++) {
      const next = pick(rng, destPads)
      if (next.id === prev.id || next.id === pickup.id || drops.some(x => x.id === next.id)) continue
      if (!best || distance(prev, next) > distance(prev, best)) best = next
      if (best && distance(prev, best) >= Math.max(160, minLeg * 0.5) && i > 8) break
    }
    drops.push(best ?? destPads[0])
    prev = drops[drops.length - 1]
  }
  return { pickup, drops }
}

function routeLength(pickup: Pad, drops: Pad[]): number {
  let len = 0
  let prev = pickup
  for (const d of drops) {
    len += distance(prev, d)
    prev = d
  }
  return len
}

function proceduralMission(
  rng: RNG,
  district: DistrictId,
  idSuffix: string,
  level: number,
  daily = false,
  destDistrict: DistrictId = district
): Mission {
  const d = DISTRICTS[district]
  const dest = DISTRICTS[destDistrict]
  const crossDistrict = destDistrict !== district

  // mission type pool depends on the district's character
  const roll = rng()
  let type: MissionType
  if (daily) type = 'daily'
  else if (district === 'underground' || district === 'security') {
    type = roll < 0.4 ? 'stealth' : roll < 0.6 ? 'standard' : roll < 0.8 ? 'chain' : 'fragile'
  } else if (district === 'businesscore') {
    type = roll < 0.45 ? 'express' : roll < 0.7 ? 'chain' : roll < 0.85 ? 'standard' : 'fragile'
  } else {
    type = roll < 0.4 ? 'standard' : roll < 0.6 ? 'express' : roll < 0.75 ? 'heavy' : roll < 0.9 ? 'fragile' : 'storm'
  }

  const stops = type === 'chain' ? (rng() < 0.5 ? 2 : 3) : 1
  // adaptive difficulty: routes stretch out as the pilot levels up
  const minLeg = 260 + Math.min(level, 20) * 8
  const { pickup, drops } = pickRoute(rng, district, stops, minLeg, destDistrict)
  const dist = routeLength(pickup, drops)

  const cargoWeight = type === 'heavy' ? Math.round(rand(rng, 10, 18)) : Math.round(rand(rng, 1, 8))
  const levelBonus = 1 + Math.min(level, 20) * 0.03 // adaptive: pay scales with pilot level
  const difficulty = Math.max(d.difficulty, dest.difficulty) * (crossDistrict ? 1.15 : 1)
  const base = (40 + dist * 0.55 + cargoWeight * 9) * difficulty * levelBonus
  const mult =
    type === 'express' ? 1.35
    : type === 'fragile' ? 1.5
    : type === 'heavy' ? 1.25
    : type === 'stealth' ? 1.7
    : type === 'storm' ? 1.6
    : type === 'chain' ? 1.45
    : daily ? 1.8
    : 1

  const sender = pick(rng, SENDERS)
  const cargo = pick(rng, CARGO)
  const titles: Record<MissionType, string> = {
    standard: `Delivery: ${cargo}`,
    express: `RUSH: ${cargo}`,
    heavy: `Heavy lift: ${cargo}`,
    fragile: `Fragile: ${cargo}`,
    stealth: `Quiet run: ${cargo}`,
    storm: `Storm run: ${cargo}`,
    chain: `${stops}-stop chain: ${cargo}`,
    daily: `Daily contract: ${cargo}`,
    story: '',
    trial: '',
  }
  const briefBits: string[] = [
    crossDistrict
      ? `${sender} needs ${cargo} hauled ${Math.round(dist)}m from ${d.name} to ${dest.name}.`
      : `${sender} needs ${cargo} moved ${Math.round(dist)}m across ${d.name}.`,
  ]
  if (type === 'express') briefBits.push('Clock is ticking.')
  if (type === 'fragile') briefBits.push('One crash and it is gone.')
  if (type === 'stealth') briefBits.push('Avoid the patrol scans — full detection voids the contract.')
  if (type === 'storm') briefBits.push('An ion storm is locked over the route. Hazard pay included.')
  if (type === 'chain') briefBits.push(`${stops} drop points, in order.`)

  return {
    id: `proc-${district}-${idSuffix}`,
    type,
    title: titles[type],
    brief: briefBits.join(' '),
    district,
    pickup: [pickup.x, pickup.y, pickup.z],
    stops: drops.map(p => [p.x, p.y, p.z] as [number, number, number]),
    dropoff: [drops[drops.length - 1].x, drops[drops.length - 1].y, drops[drops.length - 1].z],
    cargoWeight,
    reward: Math.round(base * mult),
    xp: Math.round(base * mult * 0.45),
    // tight clocks: you must actually fly fast, route well and skip detours
    timeLimit: type === 'express' || daily ? Math.round(12 + dist / 10) : type === 'chain' ? Math.round(24 + dist / 8.5) : undefined,
    fragile: type === 'fragile',
    stealth: type === 'stealth',
    storm: type === 'storm',
    daily,
    faction: DISTRICT_FACTION[crossDistrict ? destDistrict : district],
  }
}

/** Rotating offer board — reseeds every few minutes so the board feels alive. */
export function generateOffers(unlocked: DistrictId[], level: number, epoch: number): Mission[] {
  const rng = mulberry32(hashString(`offers-${epoch}`))
  const offers: Mission[] = []
  const count = Math.min(10, 4 + unlocked.length)
  for (let i = 0; i < count; i++) {
    const district = unlocked[Math.floor(rng() * unlocked.length)]
    // ~35% of contracts are long cross-district hauls once more districts open up
    let dest = district
    if (unlocked.length > 1 && rng() < 0.35) {
      let guard = 0
      while (dest === district && guard++ < 8) dest = unlocked[Math.floor(rng() * unlocked.length)]
    }
    offers.push(proceduralMission(rng, district, `${epoch}-${i}`, level, false, dest))
  }
  return offers
}

/** Three deterministic daily contracts, same for everyone on a given date. */
export function generateDailies(unlocked: DistrictId[], level: number, dateKey: string): Mission[] {
  const rng = mulberry32(hashString(`daily-${dateKey}`))
  return [0, 1, 2].map(i => {
    const district = unlocked[Math.floor(rng() * unlocked.length)]
    const m = proceduralMission(rng, district, `${dateKey}-${i}`, level, true)
    m.id = `daily-${dateKey}-${i}`
    return m
  })
}

export function storyToMission(def: StoryMissionDef, chapterId: number): Mission {
  const rng = mulberry32(hashString(def.id))
  const stops = def.stops ?? 1
  const { pickup, drops } = pickRoute(rng, def.district, stops)
  const kind = def.kind
  return {
    id: def.id,
    storyId: def.id,
    type: 'story',
    title: def.title,
    brief: def.brief,
    district: def.district,
    pickup: [pickup.x, pickup.y, pickup.z],
    stops: drops.map(p => [p.x, p.y, p.z] as [number, number, number]),
    dropoff: [drops[drops.length - 1].x, drops[drops.length - 1].y, drops[drops.length - 1].z],
    cargoWeight: def.cargoWeight,
    reward: def.reward,
    xp: def.xp,
    timeLimit: def.timeLimit,
    fragile: def.fragile,
    stealth: kind === 'stealth',
    storm: kind === 'storm',
    chapterId,
    faction: def.faction,
  }
}

export function nextStoryMission(completedStory: string[], unlockedChapters: number): Mission | null {
  for (const ch of CHAPTERS) {
    if (ch.id > unlockedChapters) break
    for (const m of ch.missions) {
      if (!completedStory.includes(m.id)) return storyToMission(m, ch.id)
    }
  }
  return null
}

export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function weekKey(): string {
  const d = new Date()
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-w${week}`
}

const ELITE_NAMES = ['The Long Haul', 'Midnight Convoy', 'Razor Run', 'The Gauntlet', 'Silent Mile', 'Storm Chaser', 'Triple Threat', 'Dead Drop']

/** Three brutal weekly contracts — long cross-district routes, double pay, real stakes. */
export function generateElites(unlocked: DistrictId[], level: number, wk: string): Mission[] {
  const rng = mulberry32(hashString(`elite-${wk}`))
  const kinds: MissionType[] = ['chain', 'stealth', 'storm']
  return kinds.map((kind, i) => {
    const from = unlocked[Math.floor(rng() * unlocked.length)]
    let to = from
    if (unlocked.length > 1) {
      let guard = 0
      while (to === from && guard++ < 10) to = unlocked[Math.floor(rng() * unlocked.length)]
    }
    // stealth needs patrolled airspace to mean anything
    const dest = kind === 'stealth' && unlocked.includes('underground') ? 'underground' : to
    const stops = kind === 'chain' ? 3 : 1
    const { pickup, drops } = pickRoute(rng, from, stops, 420 + Math.min(level, 20) * 6, dest)
    const dist = drops.reduce((acc, p, j) => acc + distance(j === 0 ? pickup : drops[j - 1], p), 0)
    const base = (80 + dist * 0.7 + 12 * 9) * 2.2 * (1 + Math.min(level, 20) * 0.03)
    return {
      id: `elite-${wk}-${i}`,
      type: kind,
      title: `ELITE: ${ELITE_NAMES[Math.floor(rng() * ELITE_NAMES.length)]}`,
      brief: `${DISTRICTS[from].name} → ${DISTRICTS[dest].name}, ${Math.round(dist)}m. ${
        kind === 'chain' ? 'Three drops, one clock, no mistakes.' : kind === 'stealth' ? 'Scanners everywhere. Be nobody.' : 'Flown inside a locked ion storm.'
      } Elite pay, weekly rotation.`,
      district: from,
      pickup: [pickup.x, pickup.y, pickup.z],
      stops: drops.map(p => [p.x, p.y, p.z] as [number, number, number]),
      dropoff: [drops[drops.length - 1].x, drops[drops.length - 1].y, drops[drops.length - 1].z],
      cargoWeight: Math.round(rand(rng, 6, 14)),
      reward: Math.round(base),
      xp: Math.round(base * 0.5),
      timeLimit: kind === 'storm' ? undefined : Math.round(16 + dist / 9),
      stealth: kind === 'stealth',
      storm: kind === 'storm',
      daily: true, // once per rotation, tracked via dailyDone
      faction: DISTRICT_FACTION[dest],
    } satisfies Mission
  })
}
