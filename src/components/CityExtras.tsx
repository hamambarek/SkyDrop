 
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CITY } from '../game/city'
import { mulberry32, pick, rand } from '../game/rng'

// Landmarks and set-dressing that make the city feel designed, not generated:
// the central Nexus spire, neon billboards, antenna forests and searchlights.

// ---------- central landmark: the Nexus spire ----------

function NexusSpire() {
  const rings = useRef<THREE.Group>(null!)
  const core = useRef<THREE.Mesh>(null!)

  useFrame(state => {
    const t = state.clock.elapsedTime
    if (rings.current) {
      rings.current.children.forEach((r, i) => {
        r.rotation.y = t * (0.2 + i * 0.12) * (i % 2 ? -1 : 1)
        r.position.y = 38 + i * 22 + Math.sin(t * 0.8 + i) * 1.5
      })
    }
    if (core.current) {
      const m = core.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.55 + Math.sin(t * 2) * 0.15
    }
  })

  return (
    <group>
      {/* tapered obelisk */}
      <mesh position={[0, 55, 0]}>
        <cylinderGeometry args={[2.5, 7, 110, 6]} />
        <meshStandardMaterial color="#10162a" roughness={0.4} metalness={0.9} />
      </mesh>
      {/* glowing core seam */}
      <mesh ref={core} position={[0, 55, 0]}>
        <cylinderGeometry args={[2.7, 2.7, 96, 6, 1, true]} />
        <meshBasicMaterial color={new THREE.Color('#39c2ff').multiplyScalar(1.8)} transparent opacity={0.6} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* rotating holo rings */}
      <group ref={rings}>
        {[0, 1, 2].map(i => (
          <group key={i} position={[0, 38 + i * 22, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[10 - i * 2, 0.3, 8, 48]} />
              <meshBasicMaterial color={new THREE.Color(['#39c2ff', '#b96bff', '#2bffc8'][i]).multiplyScalar(2)} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
      {/* apex beacon + sky beam */}
      <mesh position={[0, 112, 0]}>
        <octahedronGeometry args={[3.2, 0]} />
        <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(2.4)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 150, 0]}>
        <cylinderGeometry args={[0.7, 2.2, 80, 12, 1, true]} />
        <meshBasicMaterial color="#9fdcff" transparent opacity={0.1} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#39c2ff" intensity={60} distance={120} decay={2} position={[0, 80, 0]} />
    </group>
  )
}

// ---------- neon billboards on tall facades ----------

const AD_DEFS: { lines: string[]; fg: string; bg: string }[] = [
  { lines: ['SKYDROP', 'COURIER NETWORK'], fg: '#39c2ff', bg: '#071120' },
  { lines: ['VELA', 'TIME IS MONEY'], fg: '#41d9ff', bg: '#081a2e' },
  { lines: ['AXIOM', 'BUILD TOMORROW'], fg: '#b96bff', bg: '#120a24' },
  { lines: ['ナイト・マーケット', 'OPEN ALL NIGHT'], fg: '#ff6bd5', bg: '#1f0a18' },
  { lines: ['FERRUM', 'HEAVY INDUSTRY'], fg: '#ffb13d', bg: '#1c1206' },
  { lines: ['SUBGRID', 'NO QUESTIONS'], fg: '#7dff3d', bg: '#0a1606' },
]

function makeAdTexture(def: (typeof AD_DEFS)[number]): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = def.bg
  g.fillRect(0, 0, 256, 128)
  g.strokeStyle = def.fg
  g.lineWidth = 4
  g.strokeRect(5, 5, 246, 118)
  g.fillStyle = def.fg
  g.textAlign = 'center'
  g.font = 'bold 38px Orbitron, sans-serif'
  g.fillText(def.lines[0], 128, 60)
  g.font = '600 17px Rajdhani, sans-serif'
  g.fillText(def.lines[1], 128, 95)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Billboards() {
  const boards = useMemo(() => {
    const rng = mulberry32(4711)
    const texes = AD_DEFS.map(makeAdTexture)
    const mats = texes.map(
      t => new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.35, 1.35, 1.35) })
    )
    // tall, wide-enough buildings get a board on a random face
    const candidates = CITY.buildings.filter(b => b.baseY === 0 && b.h > 45 && Math.min(b.w, b.d) > 16)
    const out: { pos: [number, number, number]; rotY: number; w: number; h: number; mat: THREE.MeshBasicMaterial }[] = []
    for (const b of candidates) {
      if (rng() > 0.32 || out.length >= 46) continue
      const face = Math.floor(rng() * 4)
      const bw = Math.min(b.w, b.d) * rand(rng, 0.6, 0.85)
      const bh = bw / 2
      const y = rand(rng, b.h * 0.45, b.h * 0.85)
      const off = 0.35
      let pos: [number, number, number]
      let rotY: number
      if (face === 0) { pos = [b.x, y, b.z + b.d / 2 + off]; rotY = 0 }
      else if (face === 1) { pos = [b.x, y, b.z - b.d / 2 - off]; rotY = Math.PI }
      else if (face === 2) { pos = [b.x + b.w / 2 + off, y, b.z]; rotY = Math.PI / 2 }
      else { pos = [b.x - b.w / 2 - off, y, b.z]; rotY = -Math.PI / 2 }
      out.push({ pos, rotY, w: bw, h: bh, mat: pick(rng, mats) })
    }
    return out
  }, [])

  return (
    <group>
      {boards.map((b, i) => (
        <mesh key={i} position={b.pos} rotation={[0, b.rotY, 0]} material={b.mat}>
          <planeGeometry args={[b.w, b.h]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- antenna forests + blinking aircraft-warning lights ----------

function Antennas() {
  const tipGroups = useRef<THREE.InstancedMesh[]>([])

  const { masts, tips } = useMemo(() => {
    const rng = mulberry32(6021)
    const spots: { x: number; y: number; z: number; h: number }[] = []
    for (const b of CITY.buildings) {
      if (b.baseY === 0 && b.h > 55 && !b.rooftopPad && rng() < 0.3 && spots.length < 90) {
        spots.push({
          x: b.x + rand(rng, -b.w / 4, b.w / 4),
          y: b.h,
          z: b.z + rand(rng, -b.d / 4, b.d / 4),
          h: rand(rng, 6, 16),
        })
      }
    }
    const mastGeo = new THREE.BoxGeometry(0.35, 1, 0.35)
    mastGeo.translate(0, 0.5, 0)
    const mastMat = new THREE.MeshStandardMaterial({ color: '#2a3142', roughness: 0.7, metalness: 0.6 })
    const masts = new THREE.InstancedMesh(mastGeo, mastMat, spots.length)
    const mtx = new THREE.Matrix4()
    spots.forEach((s, i) => {
      mtx.makeScale(1, s.h, 1)
      mtx.setPosition(s.x, s.y, s.z)
      masts.setMatrixAt(i, mtx)
    })
    masts.instanceMatrix.needsUpdate = true

    // three phase groups of blinking red tips
    const tipGeo = new THREE.SphereGeometry(0.45, 6, 6)
    const tips: THREE.InstancedMesh[] = [0, 1, 2].map(() => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3030').multiplyScalar(2), toneMapped: false, transparent: true })
      return new THREE.InstancedMesh(tipGeo, mat, Math.ceil(spots.length / 3))
    })
    const counts = [0, 0, 0]
    spots.forEach((s, i) => {
      const gIdx = i % 3
      mtx.identity()
      mtx.setPosition(s.x, s.y + s.h, s.z)
      tips[gIdx].setMatrixAt(counts[gIdx]++, mtx)
    })
    tips.forEach((t, i) => {
      t.count = counts[i]
      t.instanceMatrix.needsUpdate = true
    })
    return { masts, tips }
  }, [])

  useFrame(state => {
    const t = state.clock.elapsedTime
    tipGroups.current.forEach((mesh, i) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.sin(t * 2 + i * 2.1) > 0.55 ? 1 : 0.08
    })
  })

  return (
    <group>
      <primitive object={masts} />
      {tips.map((t, i) => (
        <primitive key={i} object={t} ref={(el: THREE.InstancedMesh) => (tipGroups.current[i] = el)} />
      ))}
    </group>
  )
}

// ---------- sweeping searchlights ----------

const LIGHT_SPOTS = [
  { x: -180, z: 170, h: 95, color: '#b96bff', speed: 0.21 },
  { x: 60, z: 430, h: 80, color: '#41d9ff', speed: -0.16 },
  { x: -430, z: -60, h: 75, color: '#ff3d5e', speed: 0.26 },
]

function Searchlights() {
  const group = useRef<THREE.Group>(null!)
  useFrame(state => {
    const t = state.clock.elapsedTime
    LIGHT_SPOTS.forEach((s, i) => {
      const g = group.current?.children[i]
      if (!g) return
      g.rotation.y = t * s.speed + i * 2
      g.rotation.x = 0.6 + Math.sin(t * 0.4 + i) * 0.18
    })
  })
  return (
    <group ref={group}>
      {LIGHT_SPOTS.map((s, i) => (
        <group key={i} position={[s.x, s.h, s.z]}>
          <mesh position={[0, 60, 28]} rotation={[Math.PI / 2 - 0.45, 0, 0]}>
            <coneGeometry args={[9, 140, 16, 1, true]} />
            <meshBasicMaterial
              color={s.color}
              transparent
              opacity={0.05}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function CityExtras() {
  return (
    <group>
      <NexusSpire />
      <Billboards />
      <Antennas />
      <Searchlights />
    </group>
  )
}
