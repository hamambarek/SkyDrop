export const WORLD_SEED = 20260611

// World layout — four inner district quadrants around a central plaza,
// plus four outer expansion bands (N/E/S/W) unlocked through the story.
export const CITY_HALF = 340 // inner city spans roughly [-CITY_HALF, CITY_HALF]
export const BAND_GAP = 26 // gap between inner city and expansion bands
export const BAND_DEPTH = 180 // depth of each expansion band
export const WORLD_HALF = CITY_HALF + BAND_GAP + BAND_DEPTH // full playable extent
export const BLOCK = 44 // city block size
export const ROAD = 14 // road width between blocks

export const DRONE_RADIUS = 1.1
export const MAX_ALTITUDE = 190
export const CRASH_SPEED = 21 // impact speed (m/s) into a building that destroys the drone

// Base flight tuning (before upgrades / drone stats)
export const BASE_THRUST = 26 // horizontal acceleration m/s^2
export const BASE_LIFT = 22 // vertical acceleration
export const BASE_MAX_SPEED = 24
export const BASE_YAW_RATE = 2.1 // rad/s
export const DRAG = 1.35 // velocity damping per second

export const BOOST_THRUST_MULT = 1.65
export const BOOST_SPEED_MULT = 1.5
export const BOOST_DRAIN = 1.6 // extra %/s while boosting
export const BRAKE_DAMPING = 3.2 // extra damping per second while braking

export const BASE_BATTERY = 100 // seconds-ish of aggressive flight
export const BATTERY_IDLE_DRAIN = 0.22 // %/s hovering
export const BATTERY_THRUST_DRAIN = 0.85 // %/s at full throttle
export const PAD_RECHARGE_RATE = 12 // %/s while landed on a pad

export const PICKUP_RADIUS = 6.5
export const PICKUP_CHANNEL_TIME = 1.6 // seconds hovering in the beacon to grab/drop

export const RESPAWN_DELAY = 1.6

export const RING_BOOST = 14 // m/s impulse from a speed ring
export const DETECTION_RATE = 0.45 // detection meter fill per second inside a scan
export const DETECTION_DECAY = 0.25

export type DistrictId =
  | 'residential'
  | 'downtown'
  | 'industrial'
  | 'harbor'
  | 'businesscore'
  | 'skybridges'
  | 'underground'
  | 'security'

export type DistrictZone =
  | { kind: 'quadrant'; qx: 1 | -1; qz: 1 | -1 }
  | { kind: 'band'; side: 'N' | 'E' | 'S' | 'W' }

export interface DistrictDef {
  id: DistrictId
  name: string
  blurb: string
  zone: DistrictZone
  minH: number
  maxH: number
  density: number // 0..1 chance a slot gets a building
  palette: string[]
  neon: string
  difficulty: number // mission reward multiplier
}

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  residential: {
    id: 'residential',
    name: 'Solace Heights',
    blurb: 'Low-rise homes and corner shops. Where every courier starts.',
    zone: { kind: 'quadrant', qx: 1, qz: 1 },
    minH: 7, maxH: 24, density: 0.78,
    palette: ['#2a3550', '#23304a', '#314066', '#1f2a42'],
    neon: '#39c2ff',
    difficulty: 1,
  },
  downtown: {
    id: 'downtown',
    name: 'Axiom Core',
    blurb: 'Corporate megatowers, tight canyons, strict no-fly grids.',
    zone: { kind: 'quadrant', qx: -1, qz: 1 },
    minH: 38, maxH: 122, density: 0.85,
    palette: ['#1b2440', '#202b4d', '#27345c', '#161e36'],
    neon: '#b96bff',
    difficulty: 1.6,
  },
  industrial: {
    id: 'industrial',
    name: 'Ferrum Works',
    blurb: 'Refineries, cranes and smog. Heavy cargo, heavier pay.',
    zone: { kind: 'quadrant', qx: -1, qz: -1 },
    minH: 12, maxH: 42, density: 0.6,
    palette: ['#33312f', '#3a3530', '#2c2a28', '#403a32'],
    neon: '#ffb13d',
    difficulty: 1.35,
  },
  harbor: {
    id: 'harbor',
    name: 'Neon Harbor',
    blurb: 'Docks, freighters and sea wind. The edge of the megacity.',
    zone: { kind: 'quadrant', qx: 1, qz: -1 },
    minH: 8, maxH: 30, density: 0.45,
    palette: ['#1d3a3f', '#1a3236', '#234a50', '#152a2e'],
    neon: '#2bffc8',
    difficulty: 1.8,
  },
  businesscore: {
    id: 'businesscore',
    name: 'Vela Business Core',
    blurb: 'High-speed delivery corridors threaded with boost rings. Time is money.',
    zone: { kind: 'band', side: 'N' },
    minH: 30, maxH: 90, density: 0.7,
    palette: ['#1a2a4d', '#16224a', '#223560', '#121c3a'],
    neon: '#41d9ff',
    difficulty: 2.0,
  },
  skybridges: {
    id: 'skybridges',
    name: 'Spire Bridges',
    blurb: 'Twin-tower spires laced with sky bridges. Pure vertical navigation.',
    zone: { kind: 'band', side: 'E' },
    minH: 60, maxH: 150, density: 0.5,
    palette: ['#241c44', '#2c2254', '#1c1638', '#332a60'],
    neon: '#ff6bd5',
    difficulty: 2.3,
  },
  underground: {
    id: 'underground',
    name: 'Subgrid Logistics',
    blurb: 'Covered freight corridors under the megastructure. Tight, dark, fast — risky.',
    zone: { kind: 'band', side: 'S' },
    minH: 10, maxH: 34, density: 0.65,
    palette: ['#262220', '#2e2824', '#1e1b18', '#36302a'],
    neon: '#7dff3d',
    difficulty: 2.5,
  },
  security: {
    id: 'security',
    name: 'Halcyon Secure Zone',
    blurb: 'Government blacksite. Patrol scans everywhere. Couriers enter at their own risk.',
    zone: { kind: 'band', side: 'W' },
    minH: 18, maxH: 70, density: 0.55,
    palette: ['#3a1d28', '#2e1820', '#451f2e', '#241318'],
    neon: '#ff3d5e',
    difficulty: 3.0,
  },
}

export const DISTRICT_LIST = Object.values(DISTRICTS)

export type WeatherId = 'clear' | 'windy' | 'rain' | 'storm'

export interface WeatherDef {
  id: WeatherId
  name: string
  wind: number // max sustained wind m/s
  gust: number // gust amplitude
  rain: number // 0..1 particle density
  payBonus: number // multiplier on rewards while active
  icon: string
}

export const WEATHERS: Record<WeatherId, WeatherDef> = {
  clear: { id: 'clear', name: 'Clear Night', wind: 0.8, gust: 0.6, rain: 0, payBonus: 1, icon: '🌙' },
  windy: { id: 'windy', name: 'High Winds', wind: 4.5, gust: 3.5, rain: 0, payBonus: 1.15, icon: '💨' },
  rain: { id: 'rain', name: 'Neon Rain', wind: 2.5, gust: 2, rain: 0.6, payBonus: 1.25, icon: '🌧' },
  storm: { id: 'storm', name: 'Ion Storm', wind: 7, gust: 6, rain: 1, payBonus: 1.6, icon: '⛈' },
}

export const XP_PER_LEVEL = (level: number) => Math.round(120 * Math.pow(level, 1.35))

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1
  let rest = xp
  for (;;) {
    const need = XP_PER_LEVEL(level)
    if (rest < need) return { level, into: rest, need }
    rest -= need
    level++
    if (level > 60) return { level: 60, into: 0, need: 1 }
  }
}

export type UpgradeId = 'battery' | 'motor' | 'handling' | 'cargo' | 'stability' | 'weather'

export interface UpgradeDef {
  id: UpgradeId
  name: string
  desc: string
  icon: string
  maxLevel: number
  cost: (lvl: number) => number
  effect: string
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'battery', name: 'Cell Array', desc: 'Bigger battery, longer flights.', icon: '🔋', maxLevel: 4, cost: l => 350 * (l + 1) * (l + 1), effect: '+25% capacity / level' },
  { id: 'motor', name: 'Thrust Coils', desc: 'More speed and acceleration.', icon: '⚡', maxLevel: 4, cost: l => 420 * (l + 1) * (l + 1), effect: '+12% speed / level' },
  { id: 'handling', name: 'Gyro Suite', desc: 'Sharper turns, stronger braking.', icon: '🌀', maxLevel: 4, cost: l => 300 * (l + 1) * (l + 1), effect: '+15% agility / level' },
  { id: 'cargo', name: 'Lift Frame', desc: 'Heavy cargo slows you less.', icon: '📦', maxLevel: 4, cost: l => 380 * (l + 1) * (l + 1), effect: '-15% weight penalty / level' },
  { id: 'stability', name: 'Stability Core', desc: 'Active gyros fight wind shear.', icon: '🧭', maxLevel: 4, cost: l => 400 * (l + 1) * (l + 1), effect: '-18% wind effect / level' },
  { id: 'weather', name: 'Storm Plating', desc: 'Sealed housing resists storms and jamming.', icon: '🛡', maxLevel: 4, cost: l => 450 * (l + 1) * (l + 1), effect: '-15% storm & jam drain / level' },
]
