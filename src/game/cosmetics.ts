export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb2c8',
  rare: '#39c2ff',
  epic: '#b96bff',
  legendary: '#ffc83d',
  mythic: '#ff4d6d',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
}

export type Currency = 'credits' | 'gems'

/** Visual flourishes a skin can add — actual geometry, not just color swaps. */
export type SkinFlair = 'wings' | 'halo' | 'aura'

export interface Skin {
  id: string
  name: string
  rarity: Rarity
  body: string // main hull color
  accent: string // emissive accent color
  glow: number // emissive intensity
  metal: number
  price: number
  currency: Currency
  animated?: boolean // accent hue-shifts over time
  flair?: SkinFlair
}

export interface TrailFx {
  id: string
  name: string
  rarity: Rarity
  color: string
  width: number
  length: number
  price: number
  currency: Currency
  rainbow?: boolean
}

// ---------------------------------------------------------------------------
// DRONES — gameplay frames. Earned with credits + pilot level ONLY (never gems):
// performance is progression, cosmetics are monetization. Stats are honest
// trade-offs, not strict upgrades.

export type DroneClass = 'starter' | 'speed' | 'cargo' | 'stealth' | 'experimental'

export const CLASS_LABEL: Record<DroneClass, string> = {
  starter: 'Starter',
  speed: 'Speed',
  cargo: 'Heavy Cargo',
  stealth: 'Stealth',
  experimental: 'Experimental',
}

export const CLASS_ICON: Record<DroneClass, string> = {
  starter: '🛸',
  speed: '🏎',
  cargo: '🚛',
  stealth: '🦇',
  experimental: '🧪',
}

export interface DroneStats {
  speed: number // max speed / thrust multiplier
  agility: number // yaw + braking multiplier
  cargo: number // weight penalty divisor (higher = carries better)
  stability: number // wind resistance multiplier (higher = steadier)
  battery: number // capacity multiplier
  detection: number // stealth scan fill multiplier (lower = harder to detect)
}

export interface DroneModel {
  id: string
  name: string
  rarity: Rarity
  cls: DroneClass
  desc: string
  perk?: string // one-line special ability description
  stats: DroneStats
  // visual proportions
  bodyScale: [number, number, number]
  armLength: number
  rotorSize: number
  price: number
  requiresLevel: number
}

const S = (speed = 1, agility = 1, cargo = 1, stability = 1, battery = 1, detection = 1): DroneStats => ({
  speed, agility, cargo, stability, battery, detection,
})

export const DRONES: DroneModel[] = [
  {
    id: 'model-quad', name: 'SD-1 Quad', rarity: 'common', cls: 'starter',
    desc: 'The trusty starter frame. Honest, stable, forgiving.',
    stats: S(), bodyScale: [1, 0.45, 1.3], armLength: 1.1, rotorSize: 0.55,
    price: 0, requiresLevel: 1,
  },
  {
    id: 'model-wasp', name: 'Wasp R3', rarity: 'rare', cls: 'speed',
    desc: 'Slim racer. Fast and twitchy — feels the wind more.',
    stats: S(1.18, 1.15, 0.9, 0.85, 0.95, 1.1), bodyScale: [0.7, 0.35, 1.7], armLength: 0.95, rotorSize: 0.48,
    price: 2800, requiresLevel: 4,
  },
  {
    id: 'model-falcon', name: 'Falcon GT', rarity: 'epic', cls: 'speed',
    desc: 'Tournament-grade racing frame. Built for the boost corridors.',
    perk: 'Boost drains 25% less battery.',
    stats: S(1.3, 1.2, 0.85, 0.9, 0.95, 1.15), bodyScale: [0.6, 0.3, 1.9], armLength: 0.9, rotorSize: 0.45,
    price: 9500, requiresLevel: 10,
  },
  {
    id: 'model-atlas', name: 'Atlas Hauler', rarity: 'rare', cls: 'cargo',
    desc: 'Chunky workhorse. Heavy crates barely slow it down.',
    stats: S(0.9, 0.85, 1.5, 1.15, 1.1, 1.1), bodyScale: [1.5, 0.65, 1.5], armLength: 1.35, rotorSize: 0.68,
    price: 3200, requiresLevel: 5,
  },
  {
    id: 'model-titan', name: 'Titan Freight', rarity: 'epic', cls: 'cargo',
    desc: 'A flying container. Slow, unshakeable, hauls anything.',
    perk: 'Crash threshold +20% — built like a tank.',
    stats: S(0.8, 0.75, 2.0, 1.35, 1.25, 1.2), bodyScale: [1.9, 0.8, 1.9], armLength: 1.6, rotorSize: 0.8,
    price: 11000, requiresLevel: 12,
  },
  {
    id: 'model-manta', name: 'Manta X', rarity: 'epic', cls: 'stealth',
    desc: 'Wide-wing stealth profile. Scanners struggle to lock it.',
    perk: 'Patrol detection fills 40% slower.',
    stats: S(1.05, 1.05, 0.95, 1, 1, 0.6), bodyScale: [2.1, 0.3, 1.1], armLength: 1.2, rotorSize: 0.5,
    price: 8000, requiresLevel: 8,
  },
  {
    id: 'model-umbra', name: 'Umbra Veil', rarity: 'legendary', cls: 'stealth',
    desc: 'Matte-black whisper. The Subgrid\'s favorite frame.',
    perk: 'Detection fills 60% slower and decays twice as fast.',
    stats: S(1.1, 1.1, 1, 1.05, 1.05, 0.4), bodyScale: [1.6, 0.28, 1.5], armLength: 1.1, rotorSize: 0.48,
    price: 18000, requiresLevel: 16,
  },
  {
    id: 'model-spectre', name: 'Spectre Zero', rarity: 'legendary', cls: 'experimental',
    desc: 'Prototype frame from Axiom labs. Ignores half the rules.',
    perk: 'No-fly jamming drains 50% less. Trickle-charges in flight.',
    stats: S(1.12, 1.1, 1.1, 1.1, 1.15, 0.85), bodyScale: [0.9, 0.4, 2.0], armLength: 1.3, rotorSize: 0.6,
    price: 16000, requiresLevel: 14,
  },
  {
    id: 'model-aether', name: 'Aether Prime', rarity: 'mythic', cls: 'experimental',
    desc: 'The frame Axiom denies building. Hums at frequencies that should not exist.',
    perk: 'All-rounder supreme + storm immunity to battery drain.',
    stats: S(1.2, 1.18, 1.4, 1.3, 1.3, 0.7), bodyScale: [1.1, 0.42, 1.8], armLength: 1.25, rotorSize: 0.58,
    price: 40000, requiresLevel: 22,
  },
]

// ---------------------------------------------------------------------------
// SKINS & TRAILS — pure cosmetics (credits or gems)

export const SKINS: Skin[] = [
  { id: 'skin-courier', name: 'Courier Gray', rarity: 'common', body: '#4a5568', accent: '#39c2ff', glow: 1.6, metal: 0.5, price: 0, currency: 'credits' },
  { id: 'skin-ember', name: 'Ember', rarity: 'common', body: '#5a3030', accent: '#ff6b4a', glow: 1.8, metal: 0.5, price: 600, currency: 'credits' },
  { id: 'skin-jade', name: 'Jade Runner', rarity: 'common', body: '#2f4a3a', accent: '#2bffc8', glow: 1.8, metal: 0.5, price: 600, currency: 'credits' },
  { id: 'skin-arctic', name: 'Arctic Ops', rarity: 'common', body: '#dfe7f0', accent: '#39c2ff', glow: 1.7, metal: 0.7, price: 800, currency: 'credits' },
  { id: 'skin-midnight', name: 'Midnight Oil', rarity: 'rare', body: '#11131f', accent: '#b96bff', glow: 2.4, metal: 0.8, price: 1800, currency: 'credits' },
  { id: 'skin-magma', name: 'Magma Core', rarity: 'rare', body: '#321414', accent: '#ff9d2b', glow: 2.6, metal: 0.6, price: 2200, currency: 'credits' },
  { id: 'skin-hologrid', name: 'Hologrid', rarity: 'rare', body: '#15303f', accent: '#42f5e3', glow: 2.6, metal: 0.9, price: 2400, currency: 'credits' },
  { id: 'skin-vela', name: 'Vela Corridor', rarity: 'rare', body: '#0f2238', accent: '#41d9ff', glow: 2.6, metal: 0.8, price: 2600, currency: 'credits' },
  { id: 'skin-royal', name: 'Royal Circuit', rarity: 'epic', body: '#1c1440', accent: '#8a6bff', glow: 3.2, metal: 0.9, price: 240, currency: 'gems' },
  { id: 'skin-viper', name: 'Neon Viper', rarity: 'epic', body: '#0e2a12', accent: '#7dff3d', glow: 3.2, metal: 0.7, price: 240, currency: 'gems' },
  { id: 'skin-sakura', name: 'Sakura Drift', rarity: 'epic', body: '#3a1530', accent: '#ff6bd5', glow: 3.0, metal: 0.7, price: 280, currency: 'gems' },
  { id: 'skin-subgrid', name: 'Subgrid Phantom', rarity: 'epic', body: '#141a12', accent: '#7dff3d', glow: 3.0, metal: 0.85, price: 300, currency: 'gems', flair: 'halo' },
  { id: 'skin-prism', name: 'Prism Flux', rarity: 'legendary', body: '#101522', accent: '#ffffff', glow: 3.8, metal: 1, price: 620, currency: 'gems', animated: true },
  { id: 'skin-aurora', name: 'Aurora (Founder)', rarity: 'legendary', body: '#0a1c2a', accent: '#5dffd2', glow: 4.2, metal: 1, price: -1, currency: 'gems', animated: true, flair: 'aura' },
  { id: 'skin-solar', name: 'Solar Crown', rarity: 'legendary', body: '#241a05', accent: '#ffd23d', glow: 4.2, metal: 1, price: 680, currency: 'gems', animated: true, flair: 'halo' },
  { id: 'skin-seraph', name: 'Seraph Wing', rarity: 'legendary', body: '#1a2236', accent: '#cfe4ff', glow: 4.0, metal: 1, price: 720, currency: 'gems', flair: 'wings' },
  { id: 'skin-singularity', name: 'Singularity', rarity: 'mythic', body: '#05060f', accent: '#ff4d6d', glow: 4.8, metal: 1, price: 1500, currency: 'gems', animated: true, flair: 'aura' },
  { id: 'skin-dragonfire', name: 'Dragonfire', rarity: 'mythic', body: '#1f0a05', accent: '#ff7b1f', glow: 4.8, metal: 1, price: 1500, currency: 'gems', animated: true, flair: 'wings' },
]

export const TRAILS: TrailFx[] = [
  { id: 'trail-ion', name: 'Ion Stream', rarity: 'common', color: '#39c2ff', width: 0.5, length: 5, price: 0, currency: 'credits' },
  { id: 'trail-amber', name: 'Amber Wake', rarity: 'common', color: '#ffb13d', width: 0.5, length: 5, price: 500, currency: 'credits' },
  { id: 'trail-mint', name: 'Mint Vapor', rarity: 'rare', color: '#2bffc8', width: 0.7, length: 7, price: 1600, currency: 'credits' },
  { id: 'trail-violet', name: 'Violet Surge', rarity: 'rare', color: '#b96bff', width: 0.7, length: 7, price: 1600, currency: 'credits' },
  { id: 'trail-crimson', name: 'Crimson Arc', rarity: 'epic', color: '#ff3d5e', width: 0.9, length: 10, price: 180, currency: 'gems' },
  { id: 'trail-ghost', name: 'Ghost Light', rarity: 'epic', color: '#e8f4ff', width: 0.9, length: 10, price: 200, currency: 'gems' },
  { id: 'trail-gold', name: 'Gilded Comet', rarity: 'legendary', color: '#ffd23d', width: 1.2, length: 14, price: 450, currency: 'gems' },
  { id: 'trail-spectrum', name: 'Spectrum Tail', rarity: 'legendary', color: '#ff6bd5', width: 1.2, length: 14, price: 480, currency: 'gems', rainbow: true },
  { id: 'trail-event', name: 'Event Horizon', rarity: 'mythic', color: '#ff4d6d', width: 1.5, length: 18, price: 950, currency: 'gems', rainbow: true },
]

// ---------------------------------------------------------------------------
// SHOP — packs, bundles, seasonal (all mocked, all cosmetic)

export interface GemPack {
  id: string
  name: string
  gems: number
  priceUsd: string
  tag?: string
}

export const GEM_PACKS: GemPack[] = [
  { id: 'gems-s', name: 'Spark Pack', gems: 160, priceUsd: '$1.99' },
  { id: 'gems-m', name: 'Surge Pack', gems: 520, priceUsd: '$4.99', tag: 'Popular' },
  { id: 'gems-l', name: 'Storm Pack', gems: 1200, priceUsd: '$9.99', tag: 'Best value' },
  { id: 'gems-xl', name: 'Tempest Vault', gems: 2800, priceUsd: '$19.99' },
]

export interface CosmeticBundle {
  id: string
  name: string
  desc: string
  priceUsd: string
  contents: string[] // cosmetic ids granted
  theme: string
}

export const BUNDLES: CosmeticBundle[] = [
  {
    id: 'pack-vela', name: 'Vela Core Pack', theme: 'Business Core',
    desc: 'The corridor-runner look: Vela Corridor skin + Ghost Light trail.',
    priceUsd: '$4.99', contents: ['skin-vela', 'trail-ghost'],
  },
  {
    id: 'pack-subgrid', name: 'Subgrid Pack', theme: 'Underground',
    desc: 'Tunnel-rat chic: Subgrid Phantom skin + Mint Vapor trail.',
    priceUsd: '$4.99', contents: ['skin-subgrid', 'trail-mint'],
  },
  {
    id: 'pack-spire', name: 'Spire Pack', theme: 'Sky Bridges',
    desc: 'High-altitude elegance: Seraph Wing skin + Gilded Comet trail.',
    priceUsd: '$7.99', contents: ['skin-seraph', 'trail-gold'],
  },
]

export interface SeasonalItem {
  id: string
  name: string
  desc: string
  rarity: Rarity
  price: number // gems
  grants: string // cosmetic id
}

/** Season 1 — concept storefront (no backend; rotation is cosmetic-only). */
export const SEASON = {
  name: 'Season 1 — Ion Tide',
  endsNote: 'Limited concept items — rotation planned with live service.',
  items: [
    { id: 'season-trail', name: 'Ion Tide Trail', desc: 'Season 1 exclusive Event Horizon variant.', rarity: 'mythic' as Rarity, price: 950, grants: 'trail-event' },
    { id: 'season-skin', name: 'Singularity', desc: 'Season 1 flagship mythic skin with particle aura.', rarity: 'mythic' as Rarity, price: 1500, grants: 'skin-singularity' },
  ] as SeasonalItem[],
}

export interface ExpansionPack {
  id: string
  name: string
  desc: string
  priceUsd: string
  status: 'coming-soon'
}

export const EXPANSIONS: ExpansionPack[] = [
  { id: 'exp-skyline', name: 'Vertigo Skyline', desc: 'A vertical district of sky-bridges and 300m towers. New missions, pure content — no power.', priceUsd: '$6.99', status: 'coming-soon' },
  { id: 'exp-frost', name: 'Frostgate Outlands', desc: 'Frozen wastes beyond the wall. Blizzard flying + side story arc.', priceUsd: '$6.99', status: 'coming-soon' },
  { id: 'arc-ghost', name: 'Side Arc: The Ghost Courier', desc: 'Optional 6-mission noir storyline. The main story stays 100% free.', priceUsd: '$3.99', status: 'coming-soon' },
]

export const FOUNDER_PACK = {
  id: 'founder',
  name: 'Founder Pack',
  priceUsd: '$9.99',
  contents: ['Aurora legendary animated skin', '600 Gems', 'Founder badge on your callsign', 'Our eternal gratitude 💙'],
}

export const skinById = (id: string) => SKINS.find(s => s.id === id) ?? SKINS[0]
export const trailById = (id: string) => TRAILS.find(t => t.id === id) ?? TRAILS[0]
export const droneById = (id: string) => DRONES.find(m => m.id === id) ?? DRONES[0]
// legacy alias (pre-overhaul name)
export const modelById = droneById
