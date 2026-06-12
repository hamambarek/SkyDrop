/* eslint-disable react-hooks/immutability -- three.js objects are mutated in-place per frame by design */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CITY, patrolPos } from '../game/city'
import { BLOCK, CITY_HALF, DISTRICTS, ROAD, WORLD_HALF } from '../game/constants'
import { mulberry32 } from '../game/rng'
import { runtime } from '../game/runtime'
import { THEMES } from '../game/themes'
import { useGame } from '../state/store'
import { CityExtras } from './CityExtras'

// ---------- generated textures ----------

function makeWindowTexture(): THREE.CanvasTexture {
  const rng = mulberry32(818)
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, c.width, c.height)
  const cols = 7
  const rows = 22
  const cw = c.width / cols
  const ch = c.height / rows
  const colors = ['#ffd9a0', '#a0d8ff', '#fff2cc', '#7fe7ff']
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (rng() < 0.42) {
        g.fillStyle = colors[Math.floor(rng() * colors.length)]
        g.globalAlpha = 0.5 + rng() * 0.5
        g.fillRect(x * cw + 3, y * ch + 3, cw - 6, ch - 6)
      }
    }
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeGroundTexture(): THREE.CanvasTexture {
  const size = 4096
  const worldSpan = (WORLD_HALF + 60) * 2
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#070910'
  g.fillRect(0, 0, size, size)

  const toPx = (w: number) => ((w + worldSpan / 2) / worldSpan) * size
  const step = BLOCK + ROAD

  // soft district color washes — each zone reads as its own neighborhood
  const tints: { x: number; z: number; r: number; color: string }[] = []
  for (const d of Object.values(DISTRICTS)) {
    if (d.zone.kind === 'quadrant') {
      tints.push({ x: d.zone.qx * (CITY_HALF / 2 + 30), z: d.zone.qz * (CITY_HALF / 2 + 30), r: CITY_HALF * 0.62, color: d.neon })
    } else {
      const inner = CITY_HALF + 26 + 90
      const s = d.zone.side
      const [tx, tz] = s === 'N' ? [0, inner] : s === 'S' ? [0, -inner] : s === 'E' ? [inner, 0] : [-inner, 0]
      tints.push({ x: tx, z: tz, r: WORLD_HALF * 0.55, color: d.neon })
    }
  }
  for (const t of tints) {
    const grad = g.createRadialGradient(toPx(t.x), toPx(t.z), 0, toPx(t.x), toPx(t.z), (t.r / worldSpan) * size)
    grad.addColorStop(0, t.color + '14')
    grad.addColorStop(1, t.color + '00')
    g.fillStyle = grad
    g.fillRect(0, 0, size, size)
  }

  // road glow lines across the full world grid
  g.strokeStyle = 'rgba(48, 84, 140, 0.5)'
  g.lineWidth = (ROAD / worldSpan) * size * 0.32
  const start = step * 0.9 - ROAD / 2
  for (let q = 0; q < 2; q++) {
    const sign = q === 0 ? 1 : -1
    for (let i = 0; i <= Math.floor(WORLD_HALF / step) + 1; i++) {
      const px = toPx(sign * (start + i * step))
      g.beginPath()
      g.moveTo(px, 0)
      g.lineTo(px, size)
      g.stroke()
      g.beginPath()
      g.moveTo(0, px)
      g.lineTo(size, px)
      g.stroke()
    }
  }

  // bright central avenues
  g.strokeStyle = 'rgba(57, 194, 255, 0.5)'
  g.lineWidth = (ROAD / worldSpan) * size * 0.5
  g.beginPath()
  g.moveTo(toPx(0), 0)
  g.lineTo(toPx(0), size)
  g.stroke()
  g.beginPath()
  g.moveTo(0, toPx(0))
  g.lineTo(size, toPx(0))
  g.stroke()

  // ring road separating the inner city from the expansion bands
  g.strokeStyle = 'rgba(57, 194, 255, 0.35)'
  g.lineWidth = 5
  const inner = CITY_HALF + 12
  g.strokeRect(toPx(-inner), toPx(-inner), toPx(inner) - toPx(-inner), toPx(inner) - toPx(-inner))

  // central plaza ring
  g.strokeStyle = 'rgba(57, 194, 255, 0.7)'
  g.lineWidth = 6
  g.beginPath()
  g.arc(toPx(0), toPx(0), (26 / worldSpan) * size, 0, Math.PI * 2)
  g.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// ---------- buildings ----------

function Buildings() {
  const { bodyMesh, capMesh, bodyMat } = useMemo(() => {
    const windowTex = makeWindowTexture()
    const n = CITY.buildings.length

    const bodyGeo = new THREE.BoxGeometry(1, 1, 1)
    bodyGeo.translate(0, 0.5, 0)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.85,
      metalness: 0.25,
      emissive: '#ffffff',
      emissiveMap: windowTex,
      emissiveIntensity: 0.55,
      map: windowTex,
    })
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, n)

    const capGeo = new THREE.BoxGeometry(1, 1, 1)
    capGeo.translate(0, 0.5, 0)
    const capMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
    const capMesh = new THREE.InstancedMesh(capGeo, capMat, n)

    const mtx = new THREE.Matrix4()
    const col = new THREE.Color()
    const capCol = new THREE.Color()
    CITY.buildings.forEach((b, i) => {
      mtx.makeScale(b.w, b.h, b.d)
      mtx.setPosition(b.x, b.baseY, b.z)
      bodyMesh.setMatrixAt(i, mtx)
      bodyMesh.setColorAt(i, col.set(b.color))

      // thin neon parapet on the roofline, district-colored (bloom feed)
      mtx.makeScale(b.w + 0.4, 0.35, b.d + 0.4)
      mtx.setPosition(b.x, b.baseY + b.h - 0.18, b.z)
      capMesh.setMatrixAt(i, mtx)
      capCol.set(DISTRICTS[b.district].neon).multiplyScalar(0.85)
      capMesh.setColorAt(i, capCol)
    })
    bodyMesh.instanceMatrix.needsUpdate = true
    capMesh.instanceMatrix.needsUpdate = true

    return { bodyMesh, capMesh, bodyMat }
  }, [])

  // window glow follows the time-of-day theme, with a subtle citywide shimmer
  useFrame(state => {
    const w = THEMES[useGame.getState().theme].windows
    bodyMat.emissiveIntensity = (0.55 + Math.sin(state.clock.elapsedTime * 0.8) * 0.06) * w
  })

  return (
    <>
      <primitive object={bodyMesh} />
      <primitive object={capMesh} />
    </>
  )
}

// ---------- pads ----------

function Pads() {
  const { base, ring } = useMemo(() => {
    const n = CITY.pads.length
    const baseGeo = new THREE.CylinderGeometry(5, 5.4, 0.6, 20)
    const baseMat = new THREE.MeshStandardMaterial({ color: '#10141f', roughness: 0.6, metalness: 0.4 })
    const base = new THREE.InstancedMesh(baseGeo, baseMat, n)

    const ringGeo = new THREE.TorusGeometry(4.4, 0.22, 8, 36)
    ringGeo.rotateX(Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2bffc8').multiplyScalar(2.4), toneMapped: false })
    const ring = new THREE.InstancedMesh(ringGeo, ringMat, n)

    const mtx = new THREE.Matrix4()
    CITY.pads.forEach((p, i) => {
      mtx.identity()
      mtx.setPosition(p.x, p.y + 0.3, p.z)
      base.setMatrixAt(i, mtx)
      mtx.setPosition(p.x, p.y + 0.75, p.z)
      ring.setMatrixAt(i, mtx)
    })
    base.instanceMatrix.needsUpdate = true
    ring.instanceMatrix.needsUpdate = true
    return { base, ring }
  }, [])

  return (
    <>
      <primitive object={base} />
      <primitive object={ring} />
    </>
  )
}

// ---------- no-fly zones ----------

function NoFlyZones() {
  return (
    <group>
      {CITY.noFly.map((nf, i) => (
        <group key={i} position={[nf.x, 0, nf.z]}>
          <mesh position={[0, nf.height / 2, 0]}>
            <cylinderGeometry args={[nf.radius, nf.radius, nf.height, 28, 1, true]} />
            <meshBasicMaterial color="#ff2244" transparent opacity={0.045} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[0, nf.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[nf.radius, 0.5, 8, 48]} />
            <meshBasicMaterial color={new THREE.Color('#ff2244').multiplyScalar(2)} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[nf.radius - 1, nf.radius, 48]} />
            <meshBasicMaterial color={new THREE.Color('#ff2244').multiplyScalar(1.6)} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------- boost rings (Business Core corridors) ----------

function SpeedRings() {
  const group = useRef<THREE.Group>(null!)
  useFrame(state => {
    const t = state.clock.elapsedTime
    if (!group.current) return
    group.current.children.forEach((child, i) => {
      const pulse = 1 + Math.sin(t * 3 + i * 1.3) * 0.06
      child.scale.setScalar(pulse)
      child.rotation.z = t * 0.4 + i
    })
  })
  return (
    <group ref={group}>
      {CITY.rings.map(r => (
        <group key={r.id} position={[r.x, r.y, r.z]} rotation={[0, r.yaw, 0]}>
          <mesh>
            <torusGeometry args={[5.2, 0.35, 10, 40]} />
            <meshBasicMaterial color={new THREE.Color('#41d9ff').multiplyScalar(2.6)} toneMapped={false} />
          </mesh>
          <mesh>
            <torusGeometry args={[4.2, 0.1, 8, 32]} />
            <meshBasicMaterial color="#9feaff" transparent opacity={0.5} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------- animated cranes (Ferrum Works / Harbor) ----------

function Cranes() {
  const arms = useRef<(THREE.Group | null)[]>([])
  useFrame(state => {
    const t = state.clock.elapsedTime
    CITY.cranes.forEach((c, i) => {
      const arm = arms.current[i]
      if (arm) arm.rotation.y = c.phase + t * c.speed
    })
  })
  return (
    <group>
      {CITY.cranes.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          {/* mast */}
          <mesh position={[0, c.height / 2, 0]}>
            <boxGeometry args={[2.2, c.height, 2.2]} />
            <meshStandardMaterial color="#4a4238" roughness={0.8} metalness={0.4} />
          </mesh>
          {/* rotating arm */}
          <group ref={el => (arms.current[i] = el)} position={[0, c.height, 0]}>
            <mesh position={[c.armLen / 2 - 4, 0, 0]}>
              <boxGeometry args={[c.armLen + 8, 1.6, 1.6]} />
              <meshStandardMaterial color="#5a5044" roughness={0.7} metalness={0.5} />
            </mesh>
            {/* warning light at the tip */}
            <mesh position={[c.armLen, -0.4, 0]}>
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshBasicMaterial color={new THREE.Color('#ffb13d').multiplyScalar(2)} toneMapped={false} />
            </mesh>
            {/* hanging cable + hook */}
            <mesh position={[c.armLen * 0.7, -4, 0]}>
              <boxGeometry args={[0.15, 8, 0.15]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

// ---------- patrol scanners (Secure Zone / Subgrid) ----------

function Patrols() {
  const group = useRef<THREE.Group>(null!)
  const stealthActive = useGame(s => !!s.activeMission?.stealth)

  useFrame(state => {
    if (!group.current) return
    // during a mission the physics clock drives patrols so scan positions match exactly
    const t = useGame.getState().activeMission ? runtime.missionClock : state.clock.elapsedTime
    CITY.patrols.forEach((p, i) => {
      const g = group.current.children[i]
      if (!g) return
      const pos = patrolPos(p, t)
      g.position.set(pos.x, pos.y, pos.z)
      const a = p.phase + t * p.speed
      g.rotation.y = -a - Math.PI / 2
    })
  })

  return (
    <group ref={group}>
      {CITY.patrols.map((p, i) => (
        <group key={i}>
          <mesh>
            <boxGeometry args={[2.2, 0.7, 2.6]} />
            <meshStandardMaterial color="#2a1218" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.45, 10, 10]} />
            <meshBasicMaterial color={new THREE.Color('#ff3d5e').multiplyScalar(2.4)} toneMapped={false} />
          </mesh>
          {/* scan field — prominent during stealth contracts, faint otherwise */}
          <mesh>
            <sphereGeometry args={[p.detectR, 18, 14]} />
            <meshBasicMaterial
              color="#ff3d5e"
              transparent
              opacity={stealthActive ? 0.085 : 0.025}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01 - p.height, 0]}>
            <ringGeometry args={[p.detectR - 0.8, p.detectR, 36]} />
            <meshBasicMaterial color="#ff3d5e" transparent opacity={stealthActive ? 0.4 : 0.12} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------- tunnel light strips (Subgrid) ----------

function TunnelStrips() {
  const strips = useMemo(() => CITY.buildings.filter(b => b.district === 'underground' && b.baseY > 0), [])
  return (
    <group>
      {strips.map((b, i) => (
        <mesh key={i} position={[b.x, b.baseY - 0.1, b.z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[b.w - 2, b.d - 2]} />
          <meshBasicMaterial color={new THREE.Color('#7dff3d').multiplyScalar(0.5)} toneMapped={false} transparent opacity={0.25} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- ground ----------

function Ground() {
  const tex = useMemo(() => makeGroundTexture(), [])
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const span = (WORLD_HALF + 60) * 2
  useFrame(() => {
    if (matRef.current) matRef.current.emissiveIntensity = 0.65 * THEMES[useGame.getState().theme].groundGlow
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[span, span]} />
      <meshStandardMaterial ref={matRef} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.65} roughness={0.9} metalness={0.1} />
    </mesh>
  )
}

export function City() {
  return (
    <group>
      <Ground />
      <Buildings />
      <Pads />
      <NoFlyZones />
      <SpeedRings />
      <Cranes />
      <Patrols />
      <TunnelStrips />
      <CityExtras />
    </group>
  )
}
