import type { DistrictId } from './constants'
import type { FactionId } from './factions'

export type StoryKind = 'standard' | 'express' | 'fragile' | 'heavy' | 'stealth' | 'storm' | 'chain'

export interface StoryMissionDef {
  id: string
  title: string
  brief: string
  district: DistrictId
  cargoWeight: number
  reward: number
  xp: number
  timeLimit?: number
  fragile?: boolean
  kind?: StoryKind
  stops?: number // delivery stops for chain missions (default 1)
  faction?: FactionId
}

export interface Chapter {
  id: number
  title: string
  tagline: string
  intro: string[]
  unlocks: DistrictId
  rewardCredits: number
  missions: StoryMissionDef[]
}

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: 'Local Deliveries',
    tagline: 'Everyone starts somewhere.',
    intro: [
      'MIRA (dispatch AI): "Welcome to SkyDrop, pilot. One refurbished drone, one district license, and a city that never sleeps."',
      '"Solace Heights is yours to learn. Keep packages intact, keep the battery charged, and the credits will follow."',
    ],
    unlocks: 'residential',
    rewardCredits: 500,
    missions: [
      { id: 'st-1-1', title: 'First Flight', brief: 'A noodle order for old Mr. Tan. Easy route, no pressure — feel out the controls.', district: 'residential', cargoWeight: 2, reward: 120, xp: 80, faction: 'union' },
      { id: 'st-1-2', title: 'Pharmacy Run', brief: 'Insulin for a night-shift nurse. She is timing you — politely.', district: 'residential', cargoWeight: 3, reward: 180, xp: 110, timeLimit: 150, kind: 'express', faction: 'union' },
      { id: 'st-1-3', title: 'The Birthday Cake', brief: 'Three-tier cake, zero tolerance for crashes. Land it gently and Solace Heights will remember your callsign.', district: 'residential', cargoWeight: 6, reward: 260, xp: 150, fragile: true, faction: 'union' },
    ],
  },
  {
    id: 2,
    title: 'Corporate Contracts',
    tagline: 'Axiom Core opens its towers.',
    intro: [
      'MIRA: "Axiom Corp noticed your delivery record. Corporate contracts pay triple — and forgive nothing."',
      '"Downtown is a maze of glass canyons and no-fly grids. Watch the red zones; their lawyers are faster than their drones."',
    ],
    unlocks: 'downtown',
    rewardCredits: 1200,
    missions: [
      { id: 'st-2-1', title: 'NDA in a Briefcase', brief: 'Sealed legal documents to the 40th-floor pad. Rooftop landing, corporate smiles.', district: 'downtown', cargoWeight: 3, reward: 420, xp: 220, faction: 'axiom' },
      { id: 'st-2-2', title: 'Server Blades', brief: 'Hot-swap servers for a trading floor that loses millions per minute of downtime.', district: 'downtown', cargoWeight: 9, reward: 560, xp: 280, timeLimit: 180, kind: 'express', faction: 'axiom' },
      { id: 'st-2-3', title: 'The Prototype', brief: 'An unmarked Axiom prototype. Fragile. Insured for more than your apartment block.', district: 'downtown', cargoWeight: 5, reward: 720, xp: 340, fragile: true, faction: 'axiom' },
    ],
  },
  {
    id: 3,
    title: 'Black-Market Cargo',
    tagline: 'Ferrum Works asks no questions.',
    intro: [
      'UNKNOWN CALLER: "Heard you can fly. Ferrum Works has cargo that doesn\'t go through customs. Pay is double. Questions are zero."',
      'MIRA: "I am legally required to disapprove of this chapter. ...Routing you anyway."',
    ],
    unlocks: 'industrial',
    rewardCredits: 2500,
    missions: [
      { id: 'st-3-1', title: 'Crate of "Spare Parts"', brief: 'It rattles. You were paid not to ask. Heavy lift through crane country.', district: 'industrial', cargoWeight: 14, reward: 900, xp: 420, kind: 'heavy', faction: 'syndicate' },
      { id: 'st-3-2', title: 'Cold Chain', brief: 'A refrigerated bio-crate. The buyer counts seconds, the storm counts louder.', district: 'industrial', cargoWeight: 10, reward: 1100, xp: 500, timeLimit: 200, kind: 'storm', faction: 'syndicate' },
      { id: 'st-3-3', title: 'The Whistleblower\'s Drive', brief: 'One data drive that three corporations want buried. Fragile cargo, brave route.', district: 'industrial', cargoWeight: 2, reward: 1400, xp: 600, fragile: true, faction: 'syndicate' },
    ],
  },
  {
    id: 4,
    title: 'Harbor Expansion',
    tagline: 'Neon Harbor — the empire goes tidal.',
    intro: [
      'MIRA: "You did it, pilot. SkyDrop is now a name people know — and Neon Harbor just granted us sea-lane rights."',
      '"Freighters, sea wind, and contracts the size of container ships. Build your empire, one delivery at a time."',
    ],
    unlocks: 'harbor',
    rewardCredits: 5000,
    missions: [
      { id: 'st-4-1', title: 'Customs Clearance', brief: 'The harbor master\'s seal, delivered to the dockyard tower through open sea wind.', district: 'harbor', cargoWeight: 4, reward: 1600, xp: 700, faction: 'civic' },
      { id: 'st-4-2', title: 'Container Manifest', brief: 'Manifests for a 40,000-ton freighter. The captain does not wait for couriers.', district: 'harbor', cargoWeight: 8, reward: 2000, xp: 850, timeLimit: 220, kind: 'express', faction: 'union' },
      { id: 'st-4-3', title: 'The Lighthouse Deal', brief: 'The final signature on the sea-lane charter. Land it, and the outer city opens.', district: 'harbor', cargoWeight: 5, reward: 3000, xp: 1200, fragile: true, faction: 'civic' },
    ],
  },
  {
    id: 5,
    title: 'The Speed Wars',
    tagline: 'Vela Business Core — time is literally money.',
    intro: [
      'MIRA: "Vela Business Core just opened its corridors to us. Boost rings, express lanes, and clients who tip by the second."',
      '"Velocity is the product here, pilot. Hit the rings, skip the scenery."',
    ],
    unlocks: 'businesscore',
    rewardCredits: 6000,
    missions: [
      { id: 'st-5-1', title: 'Ring Runner', brief: 'A market feed drive for the Vela exchange. Use the boost corridor — the deadline is brutal on purpose.', district: 'businesscore', cargoWeight: 3, reward: 2200, xp: 950, timeLimit: 110, kind: 'express', faction: 'axiom' },
      { id: 'st-5-2', title: 'Three Desks, One Hour', brief: 'Signed contracts to three Vela offices in a single run. Chain delivery — keep the rhythm.', district: 'businesscore', cargoWeight: 4, reward: 2600, xp: 1100, kind: 'chain', stops: 3, faction: 'axiom' },
      { id: 'st-5-3', title: 'The Hostile Takeover', brief: 'A tender offer that must beat the closing bell. Fragile, timed, and worth a fortune.', district: 'businesscore', cargoWeight: 5, reward: 3200, xp: 1300, timeLimit: 160, fragile: true, faction: 'axiom' },
    ],
  },
  {
    id: 6,
    title: 'Vertical Limits',
    tagline: 'Spire Bridges — the city grows upward.',
    intro: [
      'MIRA: "Spire Bridges: twin towers, sky walkways, landing pads three hundred meters up. Most couriers refuse the contracts."',
      '"You are not most couriers. Mind the bridges — they do not mind you."',
    ],
    unlocks: 'skybridges',
    rewardCredits: 8000,
    missions: [
      { id: 'st-6-1', title: 'Penthouse Provisions', brief: 'Dinner service for the spire penthouses. The pads are small and the wind is rude.', district: 'skybridges', cargoWeight: 5, reward: 2800, xp: 1200, faction: 'union' },
      { id: 'st-6-2', title: 'Bridge Maintenance Kit', brief: 'Repair gear to a crew stranded mid-bridge. Thread the towers, land on the walkway.', district: 'skybridges', cargoWeight: 12, reward: 3400, xp: 1400, kind: 'heavy', faction: 'union' },
      { id: 'st-6-3', title: 'The Glass Garden', brief: 'A crate of impossibly rare orchids for the highest greenhouse in the city. One bump and they are compost.', district: 'skybridges', cargoWeight: 6, reward: 4200, xp: 1700, fragile: true, faction: 'axiom' },
    ],
  },
  {
    id: 7,
    title: 'Beneath the Grid',
    tagline: 'Subgrid Logistics — what the city ships in the dark.',
    intro: [
      'SYNDICATE CONTACT: "The Subgrid moves what the surface won\'t. Patrol scanners sweep the tunnels — stay out of their cones or the run is over."',
      'MIRA: "Stealth protocol available. I will display scanner ranges. Please do not make me file another incident report."',
    ],
    unlocks: 'underground',
    rewardCredits: 10000,
    missions: [
      { id: 'st-7-1', title: 'Quiet Freight', brief: 'An unregistered crate through the freight tunnels. Avoid every scanner cone — detection voids the contract.', district: 'underground', cargoWeight: 6, reward: 3600, xp: 1500, kind: 'stealth', faction: 'syndicate' },
      { id: 'st-7-2', title: 'The Tunnel Rat\'s Map', brief: 'A hand-drawn map of the Subgrid, wanted by three buyers. Deliver it to two drop points without being scanned.', district: 'underground', cargoWeight: 2, reward: 4200, xp: 1700, kind: 'chain', stops: 2, faction: 'syndicate' },
      { id: 'st-7-3', title: 'Ghost Cargo', brief: 'You will not be told what is in the box. Storm overhead, scanners below, and the longest tunnel in the city ahead.', district: 'underground', cargoWeight: 9, reward: 5200, xp: 2000, kind: 'storm', faction: 'syndicate' },
    ],
  },
  {
    id: 8,
    title: 'The Final Clearance',
    tagline: 'Halcyon Secure Zone — the last locked door.',
    intro: [
      'CIVIC AUTHORITY: "Pilot. Your record has been... reviewed. Halcyon Secure Zone requires a courier with clearance we cannot officially grant."',
      'MIRA: "Patrol density in Halcyon is the highest in the city. Fly clean, fly quiet, and SkyDrop becomes the empire we always said it would be."',
    ],
    unlocks: 'security',
    rewardCredits: 20000,
    missions: [
      { id: 'st-8-1', title: 'Credentials', brief: 'Forged-or-are-they credentials into the secure zone. Scanners everywhere. Do not be seen.', district: 'security', cargoWeight: 3, reward: 5500, xp: 2200, kind: 'stealth', faction: 'civic' },
      { id: 'st-8-2', title: 'Evidence Chain', brief: 'Three sealed evidence crates to three vaults, in order, against the clock.', district: 'security', cargoWeight: 8, reward: 6500, xp: 2500, kind: 'chain', stops: 3, timeLimit: 320, faction: 'civic' },
      { id: 'st-8-3', title: 'The Halcyon Accord', brief: 'The treaty that legalizes every courier in the city — including you. Fragile. Guarded. Historic.', district: 'security', cargoWeight: 5, reward: 9000, xp: 3500, fragile: true, kind: 'stealth', faction: 'civic' },
    ],
  },
]

export function chapterForMission(missionId: string): Chapter | undefined {
  return CHAPTERS.find(c => c.missions.some(m => m.id === missionId))
}
