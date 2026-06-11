export type FactionId = 'union' | 'axiom' | 'syndicate' | 'civic'

export interface FactionDef {
  id: FactionId
  name: string
  desc: string
  icon: string
  color: string
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  union: {
    id: 'union',
    name: 'Couriers Union',
    desc: 'The honest backbone of city logistics. Steady pay, steady friends.',
    icon: '🛵',
    color: '#39c2ff',
  },
  axiom: {
    id: 'axiom',
    name: 'Axiom Corp',
    desc: 'Megacorp contracts: high standards, higher payouts, zero patience.',
    icon: '🏢',
    color: '#b96bff',
  },
  syndicate: {
    id: 'syndicate',
    name: 'The Syndicate',
    desc: 'Black-market freight. They pay double and remember favors.',
    icon: '🌑',
    color: '#ffb13d',
  },
  civic: {
    id: 'civic',
    name: 'Civic Authority',
    desc: 'Government clearances and classified runs. Rep here opens locked doors.',
    icon: '🏛',
    color: '#ff3d5e',
  },
}

export const FACTION_LIST = Object.values(FACTIONS)

export interface RepTier {
  name: string
  at: number
}

export const REP_TIERS: RepTier[] = [
  { name: 'Neutral', at: 0 },
  { name: 'Known', at: 200 },
  { name: 'Trusted', at: 600 },
  { name: 'Partner', at: 1500 },
  { name: 'Legend', at: 3000 },
]

export function repTier(rep: number): { tier: RepTier; index: number; next: RepTier | null; progress: number } {
  let index = 0
  for (let i = REP_TIERS.length - 1; i >= 0; i--) {
    if (rep >= REP_TIERS[i].at) {
      index = i
      break
    }
  }
  const tier = REP_TIERS[index]
  const next = REP_TIERS[index + 1] ?? null
  const progress = next ? (rep - tier.at) / (next.at - tier.at) : 1
  return { tier, index, next, progress }
}

/** Rep tier gives a small payout bonus with that faction — earned, never bought. */
export function repPayBonus(rep: number): number {
  return 1 + repTier(rep).index * 0.05
}
