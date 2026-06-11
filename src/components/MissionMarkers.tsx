/* eslint-disable react-hooks/immutability -- three.js objects are mutated in-place per frame by design */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../game/runtime'
import { currentTarget, useGame } from '../state/store'

// Target beacon (light pillar + pulsing rings), a 3D compass arrow above the
// drone, and a particle burst on every successful drop.

function DeliveryBurst() {
  const burst = useGame(s => s.burst)
  const points = useRef<THREE.Points>(null!)
  const startSeq = useRef(-1)
  const age = useRef(0)

  const { geo, dirs } = useMemo(() => {
    const N = 90
    const positions = new Float32Array(N * 3)
    const dirs: THREE.Vector3[] = []
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2
      const phi = Math.acos(2 * ((i * 7919) % N) / N - 1)
      dirs.push(new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi) * 0.6 + 0.5, Math.sin(phi) * Math.sin(theta)))
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geo, dirs }
  }, [])

  useFrame((_, dt) => {
    if (!burst || !points.current) return
    if (burst.seq !== startSeq.current) {
      startSeq.current = burst.seq
      age.current = 0
    }
    age.current += dt
    const t = age.current
    const visible = t < 1.2
    points.current.visible = visible
    if (!visible) return
    const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array
    const r = 2 + t * 14
    const fall = t * t * 6
    dirs.forEach((d, i) => {
      arr[i * 3] = d.x * r
      arr[i * 3 + 1] = Math.max(0.2, d.y * r - fall)
      arr[i * 3 + 2] = d.z * r
    })
    geo.attributes.position.needsUpdate = true
    const mat = points.current.material as THREE.PointsMaterial
    mat.opacity = Math.max(0, 1 - t / 1.2)
  })

  if (!burst) return null
  return (
    <points ref={points} geometry={geo} position={[burst.x, burst.y, burst.z]}>
      <pointsMaterial color="#5dffd2" size={0.55} transparent opacity={1} sizeAttenuation depthWrite={false} />
    </points>
  )
}

export function MissionMarkers() {
  const beacon = useRef<THREE.Group>(null!)
  const ring = useRef<THREE.Mesh>(null!)
  const arrow = useRef<THREE.Group>(null!)
  const pillarMat = useRef<THREE.MeshBasicMaterial>(null!)

  const mission = useGame(s => s.activeMission)
  const phase = useGame(s => s.phase)
  const stopIndex = useGame(s => s.stopIndex)

  useFrame(state => {
    if (!mission) return
    const t = state.clock.elapsedTime
    const target = currentTarget({ activeMission: mission, phase, stopIndex })
    if (!target) return
    const isPickup = phase === 'toPickup'
    const color = isPickup ? '#39c2ff' : '#2bffc8'

    if (beacon.current) {
      beacon.current.position.set(target[0], target[1], target[2])
      if (pillarMat.current) {
        pillarMat.current.color.set(color).multiplyScalar(1.6)
        pillarMat.current.opacity = 0.16 + Math.sin(t * 3) * 0.05
      }
    }
    if (ring.current) {
      const s = 1 + ((t * 0.8) % 1) * 2.2
      ring.current.scale.setScalar(s)
      const m = ring.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.85 * (1 - ((t * 0.8) % 1))
      m.color.set(color)
    }
    if (arrow.current) {
      arrow.current.position.set(runtime.pos.x, runtime.pos.y + 3.2 + Math.sin(t * 2.4) * 0.25, runtime.pos.z)
      const dx = target[0] - runtime.pos.x
      const dy = target[1] + 2 - runtime.pos.y
      const dz = target[2] - runtime.pos.z
      const yaw = Math.atan2(dx, dz)
      const pitch = Math.atan2(dy, Math.hypot(dx, dz))
      arrow.current.rotation.set(0, yaw, 0)
      const cone = arrow.current.children[0] as THREE.Mesh
      if (cone) cone.rotation.x = Math.PI / 2 - pitch * 0.6
      const am = (arrow.current.children[0] as THREE.Mesh)?.material as THREE.MeshBasicMaterial
      if (am) am.color.set(color).multiplyScalar(2)
    }
  })

  if (!mission) return null
  const totalStops = mission.stops.length

  return (
    <group>
      {/* beacon pillar */}
      <group ref={beacon}>
        <mesh position={[0, 60, 0]}>
          <cylinderGeometry args={[2.2, 3.4, 120, 16, 1, true]} />
          <meshBasicMaterial
            ref={pillarMat}
            color="#39c2ff"
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh ref={ring} position={[0, 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.4, 4, 40]} />
          <meshBasicMaterial color="#39c2ff" transparent opacity={0.8} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
        </mesh>
        <pointLight color="#39c2ff" intensity={20} distance={40} decay={2} position={[0, 6, 0]} />
      </group>

      {/* upcoming chain stops shown as faint markers */}
      {phase === 'toStop' &&
        totalStops > 1 &&
        mission.stops.map((s, i) =>
          i > stopIndex ? (
            <mesh key={i} position={[s[0], s[1] + 30, s[2]]}>
              <cylinderGeometry args={[1, 1.6, 60, 10, 1, true]} />
              <meshBasicMaterial color="#2bffc8" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          ) : null
        )}

      {/* compass arrow above player */}
      <group ref={arrow}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.42, 1.3, 4]} />
          <meshBasicMaterial color="#39c2ff" toneMapped={false} />
        </mesh>
      </group>

      <DeliveryBurst />
    </group>
  )
}
