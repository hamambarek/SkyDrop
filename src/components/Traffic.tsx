import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WORLD_HALF } from '../game/constants'
import { mulberry32, rand, pick } from '../game/rng'

// Ambient AI courier drones criss-crossing the skyline.

const COUNT = 28
const CITY_HALF = WORLD_HALF - 60
const COLORS = ['#39c2ff', '#b96bff', '#ffb13d', '#2bffc8', '#ff6bd5']

interface Agent {
  pos: THREE.Vector3
  target: THREE.Vector3
  speed: number
  bob: number
}

function randomPoint(rng: () => number, out: THREE.Vector3) {
  out.set(rand(rng, -CITY_HALF, CITY_HALF), rand(rng, 34, 95), rand(rng, -CITY_HALF, CITY_HALF))
}

// Massive slow freight blimps drifting above the skyline.
function Blimps() {
  const group = useRef<THREE.Group>(null!)
  const defs = useMemo(() => {
    const rng = mulberry32(2468)
    return Array.from({ length: 4 }, (_, i) => ({
      r: rand(rng, 200, WORLD_HALF - 80),
      h: rand(rng, 120, 165),
      speed: rand(rng, 0.008, 0.018) * (i % 2 ? 1 : -1),
      phase: rand(rng, 0, Math.PI * 2),
      glow: pick(rng, COLORS),
    }))
  }, [])

  useFrame(state => {
    const t = state.clock.elapsedTime
    defs.forEach((d, i) => {
      const g = group.current?.children[i]
      if (!g) return
      const a = d.phase + t * d.speed
      g.position.set(Math.cos(a) * d.r, d.h + Math.sin(t * 0.3 + i) * 2, Math.sin(a) * d.r)
      g.rotation.y = -a - Math.PI / 2 * (d.speed > 0 ? 1 : -1)
    })
  })

  return (
    <group ref={group}>
      {defs.map((d, i) => (
        <group key={i}>
          <mesh scale={[1, 1, 2.6]}>
            <sphereGeometry args={[7, 14, 12]} />
            <meshStandardMaterial color="#141a2c" roughness={0.7} metalness={0.3} />
          </mesh>
          <mesh position={[0, -7, 0]}>
            <boxGeometry args={[2.5, 1.8, 8]} />
            <meshStandardMaterial color="#1c2438" roughness={0.6} metalness={0.5} />
          </mesh>
          {/* hull running lights */}
          <mesh position={[0, 0, 17]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color={new THREE.Color(d.glow).multiplyScalar(2)} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -17]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color={new THREE.Color('#ff3d5e').multiplyScalar(2)} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Traffic() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const glowRef = useRef<THREE.InstancedMesh>(null!)

  const agents = useMemo<Agent[]>(() => {
    const rng = mulberry32(777)
    return Array.from({ length: COUNT }, () => {
      const a: Agent = {
        pos: new THREE.Vector3(),
        target: new THREE.Vector3(),
        speed: rand(rng, 7, 16),
        bob: rand(rng, 0, Math.PI * 2),
      }
      randomPoint(rng, a.pos)
      randomPoint(rng, a.target)
      return a
    })
  }, [])

  const { glowColors } = useMemo(() => {
    const rng = mulberry32(909)
    const glowColors = agents.map(() => new THREE.Color(pick(rng, COLORS)).multiplyScalar(2))
    return { glowColors }
  }, [agents])

  const mtx = useMemo(() => new THREE.Matrix4(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const seededRng = useMemo(() => mulberry32(13579), [])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    agents.forEach((a, i) => {
      dir.subVectors(a.target, a.pos)
      const d = dir.length()
      if (d < 6) {
        randomPoint(seededRng, a.target)
      } else {
        dir.normalize()
        a.pos.addScaledVector(dir, a.speed * Math.min(dt, 0.05))
      }
      const bobY = Math.sin(t * 1.6 + a.bob) * 0.6

      const yaw = Math.atan2(dir.x, dir.z)
      quat.setFromAxisAngle(up, yaw)
      scale.setScalar(1)
      mtx.compose(a.pos.clone().setY(a.pos.y + bobY), quat, scale)
      meshRef.current.setMatrixAt(i, mtx)
      glowRef.current.setMatrixAt(i, mtx)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
    glowRef.current.instanceMatrix.needsUpdate = true
  })

  const glowGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.32, 8, 8)
    g.translate(0, -0.3, 0)
    return g
  }, [])

  return (
    <group>
      <Blimps />
      <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <boxGeometry args={[1.4, 0.5, 1.8]} />
        <meshStandardMaterial color="#1c2438" roughness={0.6} metalness={0.5} />
      </instancedMesh>
      <instancedMesh
        ref={el => {
          if (el) {
            glowRef.current = el
            glowColors.forEach((c, i) => el.setColorAt(i, c))
            if (el.instanceColor) el.instanceColor.needsUpdate = true
          }
        }}
        args={[glowGeo, undefined, COUNT]}
        frustumCulled={false}
      >
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
