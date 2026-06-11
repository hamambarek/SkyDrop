import {
  BAND_DEPTH, BAND_GAP, BLOCK, CITY_HALF, DISTRICTS, DISTRICT_LIST, ROAD,
  WORLD_HALF, WORLD_SEED, type DistrictId,
} from './constants'
import { mulberry32, pick, rand, randInt, type RNG } from './rng'

export interface Building {
  x: number
  z: number
  w: number
  d: number
  h: number // height of the box itself
  baseY: number // bottom of the box (0 = ground; >0 for bridges/tunnel roofs)
  color: string
  district: DistrictId
  rooftopPad?: boolean
}

export interface Pad {
  id: string
  x: number
  y: number
  z: number
  district: DistrictId
  rooftop: boolean
}

export interface NoFlyZone {
  x: number
  z: number
  radius: number
  height: number
}

export interface SpeedRing {
  id: number
  x: number
  y: number
  z: number
  yaw: number // ring plane normal direction (pass-through axis)
}

export interface Crane {
  x: number
  z: number
  height: number
  armLen: number
  speed: number
  phase: number
}

export interface Patrol {
  cx: number
  cz: number
  orbit: number // orbit radius
  speed: number // rad/s
  phase: number
  height: number
  detectR: number // scan radius
}

export interface CityData {
  buildings: Building[]
  pads: Pad[]
  noFly: NoFlyZone[]
  rings: SpeedRing[]
  cranes: Crane[]
  patrols: Patrol[]
  grid: Map<string, number[]> // spatial hash cell -> building indices
  cell: number
}

const CELL = BLOCK + ROAD
const STEP = BLOCK + ROAD

function cellKey(cx: number, cz: number) {
  return cx + ',' + cz
}

/** Patrol drone position at mission time t — shared by physics + renderer so they always agree. */
export function patrolPos(p: Patrol, t: number): { x: number; y: number; z: number } {
  const a = p.phase + t * p.speed
  return { x: p.cx + Math.cos(a) * p.orbit, y: p.height, z: p.cz + Math.sin(a) * p.orbit }
}

// ---------------------------------------------------------------------------

function genQuadrants(rng: RNG, buildings: Building[], pads: Pad[]) {
  const blocksPerSide = Math.floor(CITY_HALF / STEP)

  for (const d of DISTRICT_LIST) {
    if (d.zone.kind !== 'quadrant') continue
    const { qx, qz } = d.zone
    let padCount = 0
    for (let bx = 0; bx < blocksPerSide; bx++) {
      for (let bz = 0; bz < blocksPerSide; bz++) {
        const cx = qx * (STEP * 0.9 + bx * STEP + BLOCK / 2)
        const cz = qz * (STEP * 0.9 + bz * STEP + BLOCK / 2)

        const wantPad = padCount < 9 && rng() < 0.12
        if (wantPad) {
          padCount++
          pads.push({ id: `${d.id}-pad-${padCount}`, x: cx, y: 0, z: cz, district: d.id, rooftop: false })
          continue
        }

        if (rng() > d.density) continue

        const split = rng() < 0.55
        const slots = split
          ? [
              [-BLOCK / 4, -BLOCK / 4], [BLOCK / 4, -BLOCK / 4],
              [-BLOCK / 4, BLOCK / 4], [BLOCK / 4, BLOCK / 4],
            ]
          : [[0, 0]]
        for (const [ox, oz] of slots) {
          if (split && rng() < 0.25) continue
          const footprint = split ? BLOCK / 2 - 4 : BLOCK - 6
          const w = rand(rng, footprint * 0.6, footprint)
          const dep = rand(rng, footprint * 0.6, footprint)
          const h = rand(rng, d.minH, d.maxH) * (d.id === 'downtown' ? rand(rng, 0.7, 1.25) : 1)
          const b: Building = {
            x: cx + ox, z: cz + oz, w, d: dep, h: Math.max(d.minH, h), baseY: 0,
            color: pick(rng, d.palette), district: d.id,
          }
          if (!split && rng() < 0.16 && b.h > 10 && b.h < 100) {
            b.rooftopPad = true
            pads.push({ id: `${d.id}-roof-${buildings.length}`, x: b.x, y: b.h, z: b.z, district: d.id, rooftop: true })
          }
          buildings.push(b)
        }
      }
    }

    pads.push({
      id: `${d.id}-hub`,
      x: qx * (STEP * 0.55),
      y: 0,
      z: qz * (STEP * 0.55),
      district: d.id,
      rooftop: false,
    })
  }
}

/** Convert band-local (u along the band, v into the band) to world x/z. */
function bandToWorld(side: 'N' | 'E' | 'S' | 'W', u: number, v: number): [number, number] {
  const inner = CITY_HALF + BAND_GAP
  switch (side) {
    case 'N': return [u, inner + v]
    case 'S': return [u, -(inner + v)]
    case 'E': return [inner + v, u]
    case 'W': return [-(inner + v), u]
  }
}

function genBands(
  rng: RNG,
  buildings: Building[],
  pads: Pad[],
  rings: SpeedRing[],
  noFly: NoFlyZone[],
  patrols: Patrol[]
) {
  const uBlocks = Math.floor((WORLD_HALF * 2 - 100) / STEP)
  const vBlocks = Math.floor(BAND_DEPTH / STEP)
  let ringId = 0

  for (const d of DISTRICT_LIST) {
    if (d.zone.kind !== 'band') continue
    const side = d.zone.side
    let padCount = 0

    // tower bookkeeping for sky bridges: towers[vRow][uIdx] = height
    const towerRows: Map<number, Map<number, { x: number; z: number; h: number; w: number }>> = new Map()

    for (let ui = 0; ui < uBlocks; ui++) {
      for (let vi = 0; vi < vBlocks; vi++) {
        const u = -WORLD_HALF + 50 + ui * STEP + BLOCK / 2
        const v = vi * STEP + BLOCK / 2
        const [cx, cz] = bandToWorld(side, u, v)

        if (padCount < 8 && rng() < 0.09) {
          padCount++
          pads.push({ id: `${d.id}-pad-${padCount}`, x: cx, y: 0, z: cz, district: d.id, rooftop: false })
          continue
        }
        if (rng() > d.density) continue

        const footprint = BLOCK - 8
        const w = rand(rng, footprint * 0.55, footprint)
        const dep = rand(rng, footprint * 0.55, footprint)
        let h = rand(rng, d.minH, d.maxH)

        if (d.id === 'skybridges') {
          // sparse but very tall twin spires
          h = rand(rng, d.minH, d.maxH) * rand(rng, 0.9, 1.25)
          const b: Building = { x: cx, z: cz, w: w * 0.7, d: dep * 0.7, h, baseY: 0, color: pick(rng, d.palette), district: d.id }
          if (rng() < 0.42 && h > 70) {
            b.rooftopPad = true
            pads.push({ id: `${d.id}-roof-${buildings.length}`, x: b.x, y: h, z: b.z, district: d.id, rooftop: true })
          }
          buildings.push(b)
          let row = towerRows.get(vi)
          if (!row) towerRows.set(vi, (row = new Map()))
          row.set(ui, { x: cx, z: cz, h, w: w * 0.7 })
          continue
        }

        const b: Building = { x: cx, z: cz, w, d: dep, h, baseY: 0, color: pick(rng, d.palette), district: d.id }
        if (rng() < 0.2 && h > 12) {
          b.rooftopPad = true
          pads.push({ id: `${d.id}-roof-${buildings.length}`, x: b.x, y: h, z: b.z, district: d.id, rooftop: true })
        }
        buildings.push(b)
      }
    }

    // ---- district set-pieces ----

    if (d.id === 'businesscore') {
      // boost-ring corridor along the middle of the band
      const v = BAND_DEPTH / 2
      for (let i = 0; i < 12; i++) {
        const u = -WORLD_HALF + 90 + i * ((WORLD_HALF * 2 - 180) / 11)
        const [x, z] = bandToWorld(side, u, v - BLOCK / 2)
        rings.push({ id: ringId++, x, y: rand(rng, 18, 34), z, yaw: side === 'N' || side === 'S' ? Math.PI / 2 : 0 })
      }
    }

    if (d.id === 'skybridges') {
      // connect adjacent towers in the same row with axis-aligned bridges
      for (const [, row] of towerRows) {
        const idxs = [...row.keys()].sort((a, b) => a - b)
        for (let k = 0; k < idxs.length - 1; k++) {
          const a = row.get(idxs[k])!
          const b = row.get(idxs[k + 1])!
          const gap = Math.abs(idxs[k + 1] - idxs[k])
          if (gap > 2) continue // too far apart
          const minH = Math.min(a.h, b.h)
          const y = rand(rng, minH * 0.45, minH * 0.8)
          const midX = (a.x + b.x) / 2
          const midZ = (a.z + b.z) / 2
          const horizontal = Math.abs(a.x - b.x) > Math.abs(a.z - b.z)
          const len = (horizontal ? Math.abs(a.x - b.x) : Math.abs(a.z - b.z)) - 10
          if (len < 12) continue
          const bridge: Building = {
            x: midX, z: midZ,
            w: horizontal ? len : 5,
            d: horizontal ? 5 : len,
            h: 3.2, baseY: y,
            color: '#2c2254', district: d.id,
          }
          buildings.push(bridge)
          if (rng() < 0.35) {
            pads.push({ id: `${d.id}-bridge-${buildings.length}`, x: midX, y: y + 3.2, z: midZ, district: d.id, rooftop: true })
          }
        }
      }
    }

    if (d.id === 'underground') {
      // covered freight corridor: long tunnel roofs over the band's center line, gaps for entries
      const v = BAND_DEPTH / 2 - BLOCK / 2
      const segLen = STEP * 2
      for (let i = 0; i < uBlocks / 2; i++) {
        if (i % 3 === 2) continue // entry gap
        const u = -WORLD_HALF + 50 + i * segLen + segLen / 2
        const [x, z] = bandToWorld(side, u, v)
        const horizontal = side === 'N' || side === 'S'
        buildings.push({
          x, z,
          w: horizontal ? segLen - 4 : ROAD + 10,
          d: horizontal ? ROAD + 10 : segLen - 4,
          h: 3, baseY: 13,
          color: '#1e1b18', district: d.id,
        })
      }
    }

    if (d.id === 'security') {
      // perimeter scan towers + heavy no-fly + orbiting patrol scanners
      for (let i = 0; i < 3; i++) {
        const u = -WORLD_HALF + 140 + i * ((WORLD_HALF * 2 - 280) / 2)
        const [x, z] = bandToWorld(side, u, BAND_DEPTH / 2)
        noFly.push({ x, z, radius: rand(rng, 26, 40), height: randInt(rng, 80, 150) })
      }
      for (let i = 0; i < 6; i++) {
        const u = -WORLD_HALF + 100 + i * ((WORLD_HALF * 2 - 200) / 5)
        const [cx, cz] = bandToWorld(side, u, rand(rng, 30, BAND_DEPTH - 30))
        patrols.push({
          cx, cz,
          orbit: rand(rng, 24, 50),
          speed: rand(rng, 0.18, 0.4) * (rng() < 0.5 ? 1 : -1),
          phase: rand(rng, 0, Math.PI * 2),
          height: rand(rng, 16, 40),
          detectR: rand(rng, 16, 24),
        })
      }
    }

    if (d.id === 'underground') {
      // a couple of slow tunnel patrols make stealth runs spicy
      for (let i = 0; i < 3; i++) {
        const u = -WORLD_HALF + 160 + i * ((WORLD_HALF * 2 - 320) / 2)
        const [cx, cz] = bandToWorld(side, u, BAND_DEPTH / 2 - BLOCK / 2)
        patrols.push({
          cx, cz,
          orbit: rand(rng, 30, 60),
          speed: rand(rng, 0.15, 0.3),
          phase: rand(rng, 0, Math.PI * 2),
          height: 8,
          detectR: rand(rng, 12, 18),
        })
      }
    }

    // guaranteed hub at the inner edge of the band
    const [hx, hz] = bandToWorld(side, 0, 8)
    pads.push({ id: `${d.id}-hub`, x: hx, y: 0, z: hz, district: d.id, rooftop: false })
  }
}

export function buildCity(seed = WORLD_SEED): CityData {
  const rng = mulberry32(seed)
  const buildings: Building[] = []
  const pads: Pad[] = []
  const noFly: NoFlyZone[] = []
  const rings: SpeedRing[] = []
  const cranes: Crane[] = []
  const patrols: Patrol[] = []

  genQuadrants(rng, buildings, pads)
  genBands(mulberry32(seed ^ 0xbead), buildings, pads, rings, noFly, patrols)

  // No-fly zones: mostly downtown + one industrial (legacy inner-city set)
  const nfRng = mulberry32(seed ^ 0x5afe)
  const nfDistricts: DistrictId[] = ['downtown', 'downtown', 'industrial', 'harbor']
  for (const did of nfDistricts) {
    const d = DISTRICTS[did]
    if (d.zone.kind !== 'quadrant') continue
    noFly.push({
      x: d.zone.qx * rand(nfRng, STEP * 1.5, CITY_HALF * 0.75),
      z: d.zone.qz * rand(nfRng, STEP * 1.5, CITY_HALF * 0.75),
      radius: rand(nfRng, 22, 38),
      height: randInt(nfRng, 60, 140),
    })
  }

  // animated cranes in the industrial quadrant + harbor edge
  const crRng = mulberry32(seed ^ 0xc4a)
  for (let i = 0; i < 7; i++) {
    const ind = i < 4
    cranes.push({
      x: (ind ? -1 : 1) * rand(crRng, STEP * 1.2, CITY_HALF * 0.85),
      z: -rand(crRng, STEP * 1.2, CITY_HALF * 0.85),
      height: rand(crRng, 38, 58),
      armLen: rand(crRng, 18, 30),
      speed: rand(crRng, 0.04, 0.12) * (crRng() < 0.5 ? 1 : -1),
      phase: rand(crRng, 0, Math.PI * 2),
    })
  }

  // spatial hash for collision queries
  const grid = new Map<string, number[]>()
  buildings.forEach((b, i) => {
    const minX = Math.floor((b.x - b.w / 2) / CELL)
    const maxX = Math.floor((b.x + b.w / 2) / CELL)
    const minZ = Math.floor((b.z - b.d / 2) / CELL)
    const maxZ = Math.floor((b.z + b.d / 2) / CELL)
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const k = cellKey(cx, cz)
        let arr = grid.get(k)
        if (!arr) grid.set(k, (arr = []))
        arr.push(i)
      }
    }
  })

  return { buildings, pads, noFly, rings, cranes, patrols, grid, cell: CELL }
}

export function nearbyBuildings(city: CityData, x: number, z: number): number[] {
  const cx = Math.floor(x / city.cell)
  const cz = Math.floor(z / city.cell)
  const out: number[] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const arr = city.grid.get(cellKey(cx + dx, cz + dz))
      if (arr) out.push(...arr)
    }
  }
  return out
}

/**
 * First obstruction along the segment from→to against building boxes.
 * Returns t in [0,1]: 1 = clear path, smaller = fraction of the way to the hit.
 * Used to keep the chase camera from clipping through walls.
 */
export function cameraObstruction(
  city: CityData,
  fx: number, fy: number, fz: number,
  tx: number, ty: number, tz: number,
  margin = 0.6
): number {
  // candidate buildings from cells around start, midpoint and end of the segment
  const seen = new Set<number>()
  const candidates: number[] = []
  for (const [cx, cz] of [
    [fx, fz],
    [(fx + tx) / 2, (fz + tz) / 2],
    [tx, tz],
  ]) {
    for (const i of nearbyBuildings(city, cx, cz)) {
      if (!seen.has(i)) {
        seen.add(i)
        candidates.push(i)
      }
    }
  }

  const dx = tx - fx
  const dy = ty - fy
  const dz = tz - fz
  let tHit = 1

  for (const idx of candidates) {
    const b = city.buildings[idx]
    const minX = b.x - b.w / 2 - margin
    const maxX = b.x + b.w / 2 + margin
    const minY = b.baseY - margin
    const maxY = b.baseY + b.h + margin
    const minZ = b.z - b.d / 2 - margin
    const maxZ = b.z + b.d / 2 + margin

    // slab test
    let t0 = 0
    let t1 = 1
    let ok = true
    for (const [f, d, mn, mx] of [
      [fx, dx, minX, maxX],
      [fy, dy, minY, maxY],
      [fz, dz, minZ, maxZ],
    ] as const) {
      if (Math.abs(d) < 1e-7) {
        if (f < mn || f > mx) {
          ok = false
          break
        }
      } else {
        let near = (mn - f) / d
        let far = (mx - f) / d
        if (near > far) {
          const tmp = near
          near = far
          far = tmp
        }
        t0 = Math.max(t0, near)
        t1 = Math.min(t1, far)
        if (t0 > t1) {
          ok = false
          break
        }
      }
    }
    if (ok && t0 > 0.001 && t0 < tHit) tHit = t0
  }
  return tHit
}

// Singleton city — generated once, shared by renderer + physics + missions
export const CITY = buildCity()
