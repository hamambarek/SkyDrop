export interface Stats {
  deliveries: number
  perfectDeliveries: number // no crash during mission
  expressDeliveries: number
  fragileDeliveries: number
  stealthDeliveries: number
  chainDeliveries: number
  crashes: number
  distanceFlown: number // meters
  creditsEarned: number
  stormDeliveries: number
  dailiesDone: number
  ringsHit: number
}

export const EMPTY_STATS: Stats = {
  deliveries: 0,
  perfectDeliveries: 0,
  expressDeliveries: 0,
  fragileDeliveries: 0,
  stealthDeliveries: 0,
  chainDeliveries: 0,
  crashes: 0,
  distanceFlown: 0,
  creditsEarned: 0,
  stormDeliveries: 0,
  dailiesDone: 0,
  ringsHit: 0,
}

export interface AchievementContext {
  chaptersDone: number
  level: number
  maxRep: number
  trialsFlown: number
}

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  check: (s: Stats, extra: AchievementContext) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-drop', name: 'First Drop', desc: 'Complete your first delivery.', icon: '📦', check: s => s.deliveries >= 1 },
  { id: 'ten-drop', name: 'Regular Route', desc: 'Complete 10 deliveries.', icon: '🛵', check: s => s.deliveries >= 10 },
  { id: 'fifty-drop', name: 'Sky Veteran', desc: 'Complete 50 deliveries.', icon: '🎖', check: s => s.deliveries >= 50 },
  { id: 'perfect-5', name: 'Gentle Hands', desc: '5 deliveries without a single crash.', icon: '🕊', check: s => s.perfectDeliveries >= 5 },
  { id: 'express-5', name: 'Speed Demon', desc: 'Complete 5 express deliveries.', icon: '⚡', check: s => s.expressDeliveries >= 5 },
  { id: 'fragile-5', name: 'Glass Courier', desc: 'Deliver 5 fragile packages intact.', icon: '🫧', check: s => s.fragileDeliveries >= 5 },
  { id: 'stealth-1', name: 'Ghost Run', desc: 'Complete a stealth contract undetected.', icon: '🦇', check: s => s.stealthDeliveries >= 1 },
  { id: 'stealth-5', name: 'Subgrid Legend', desc: 'Complete 5 stealth contracts.', icon: '👻', check: s => s.stealthDeliveries >= 5 },
  { id: 'chain-3', name: 'Route Optimizer', desc: 'Complete 3 multi-stop chains.', icon: '🔗', check: s => s.chainDeliveries >= 3 },
  { id: 'storm-rider', name: 'Storm Rider', desc: 'Deliver during an ion storm.', icon: '⛈', check: s => s.stormDeliveries >= 1 },
  { id: 'rings-25', name: 'Corridor King', desc: 'Pass through 25 boost rings.', icon: '💍', check: s => s.ringsHit >= 25 },
  { id: 'marathon', name: 'Marathon Wings', desc: 'Fly a total of 10 km.', icon: '🛫', check: s => s.distanceFlown >= 10_000 },
  { id: 'marathon-50', name: 'Continental', desc: 'Fly a total of 50 km.', icon: '🌐', check: s => s.distanceFlown >= 50_000 },
  { id: 'tycoon', name: 'Courier Tycoon', desc: 'Earn 25,000 credits in total.', icon: '💰', check: s => s.creditsEarned >= 25_000 },
  { id: 'magnate', name: 'Logistics Magnate', desc: 'Earn 150,000 credits in total.', icon: '🏦', check: s => s.creditsEarned >= 150_000 },
  { id: 'daily-3', name: 'Reliable', desc: 'Complete 3 daily contracts.', icon: '📅', check: s => s.dailiesDone >= 3 },
  { id: 'crash-test', name: 'Crash Test Pilot', desc: 'Crash 10 times. We respect the commitment.', icon: '💥', check: s => s.crashes >= 10 },
  { id: 'trial-1', name: 'On the Clock', desc: 'Complete your first time trial.', icon: '⏱', check: (_s, e) => e.trialsFlown >= 1 },
  { id: 'trial-all', name: 'Course Master', desc: 'Set a time on all 8 trials.', icon: '🏁', check: (_s, e) => e.trialsFlown >= 8 },
  { id: 'rep-trusted', name: 'Name in the Wire', desc: 'Reach Trusted with any faction.', icon: '🤝', check: (_s, e) => e.maxRep >= 600 },
  { id: 'rep-legend', name: 'Faction Legend', desc: 'Reach Legend with any faction.', icon: '🌟', check: (_s, e) => e.maxRep >= 3000 },
  { id: 'ch2', name: 'Corporate Ladder', desc: 'Finish Chapter 1.', icon: '🏢', check: (_s, e) => e.chaptersDone >= 1 },
  { id: 'ch3', name: 'Shadow Routes', desc: 'Finish Chapter 2.', icon: '🌑', check: (_s, e) => e.chaptersDone >= 2 },
  { id: 'ch5', name: 'Outer City', desc: 'Finish Chapter 4 and reach the expansion bands.', icon: '🌆', check: (_s, e) => e.chaptersDone >= 4 },
  { id: 'empire', name: 'Delivery Empire', desc: 'Finish all eight chapters.', icon: '👑', check: (_s, e) => e.chaptersDone >= 8 },
  { id: 'level-10', name: 'Ace Pilot', desc: 'Reach level 10.', icon: '🌟', check: (_s, e) => e.level >= 10 },
  { id: 'level-20', name: 'Sky Marshal', desc: 'Reach level 20.', icon: '🎯', check: (_s, e) => e.level >= 20 },
]
