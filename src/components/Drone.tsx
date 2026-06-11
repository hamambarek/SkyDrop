/* eslint-disable react-hooks/immutability -- three.js objects are mutated in-place per frame by design */
import { Trail } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { cameraObstruction, CITY } from '../game/city'
import { droneById, skinById, trailById } from '../game/cosmetics'
import { stepSimulation } from '../game/physics'
import { runtime } from '../game/runtime'
import { useGame } from '../state/store'

const camDesired = new THREE.Vector3()
const lookAt = new THREE.Vector3()

export function PlayerDrone() {
  const group = useRef<THREE.Group>(null!)
  const inner = useRef<THREE.Group>(null!)
  const rotors = useRef<THREE.Mesh[]>([])
  const cargoRef = useRef<THREE.Mesh>(null!)
  const thrusterRefs = useRef<THREE.Mesh[]>([])
  const auraRef = useRef<THREE.Mesh>(null!)
  const camera = useThree(s => s.camera)

  const equipped = useGame(s => s.equipped)
  const skin = skinById(equipped.skin)
  const trail = trailById(equipped.trail)
  const model = droneById(equipped.model)

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: skin.body, roughness: 0.45, metalness: skin.metal }),
    [skin]
  )
  const accentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#111',
        emissive: new THREE.Color(skin.accent),
        emissiveIntensity: skin.glow,
        roughness: 0.3,
        metalness: 0.6,
      }),
    [skin]
  )
  const flairMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(skin.accent).multiplyScalar(1.4),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthWrite: false,
      }),
    [skin]
  )
  const trailColor = useMemo(() => new THREE.Color(trail.color), [trail])

  useFrame((state, dt) => {
    stepSimulation(dt)

    const g = group.current
    if (!g) return
    g.position.copy(runtime.pos)
    g.rotation.set(0, runtime.yaw, 0)
    if (inner.current) {
      inner.current.rotation.x = runtime.tilt.pitch
      inner.current.rotation.z = runtime.tilt.roll
      if (runtime.crashed) {
        inner.current.rotation.x += Math.sin(runtime.crashTimer * 30) * 0.5
        inner.current.rotation.z += Math.cos(runtime.crashTimer * 25) * 0.5
      }
    }
    for (const r of rotors.current) {
      if (r) r.rotation.y += runtime.rotorSpeed * dt
    }
    if (cargoRef.current) cargoRef.current.visible = runtime.carrying

    // boost thruster glow
    const heat = runtime.boostHeat
    for (const t of thrusterRefs.current) {
      if (t) {
        t.visible = heat > 0.05
        t.scale.set(1, 0.6 + heat * 1.6, 1)
        ;(t.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, heat)
      }
    }

    // animated skins: hue cycle accent + rainbow trail
    if (skin.animated) {
      const t = performance.now() * 0.0004
      accentMat.emissive.setHSL(t % 1, 0.85, 0.6)
      flairMat.color.setHSL(t % 1, 0.85, 0.6)
    }
    if (trail.rainbow) {
      trailColor.setHSL((performance.now() * 0.0003) % 1, 0.9, 0.6)
    }

    // aura flair pulse
    if (auraRef.current) {
      const t = state.clock.elapsedTime
      auraRef.current.rotation.y = t * 1.2
      auraRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.08)
    }

    // ----- camera: three modes + speed FOV kick + impact shake -----
    const speed = runtime.vel.length()
    const mode = runtime.cameraMode
    if (mode === 'chase') {
      const back = 13 + speed * 0.18
      camDesired.set(
        runtime.pos.x - Math.sin(runtime.yaw) * back,
        runtime.pos.y + 5.5,
        runtime.pos.z - Math.cos(runtime.yaw) * back
      )
    } else if (mode === 'near') {
      const back = 7 + speed * 0.08
      camDesired.set(
        runtime.pos.x - Math.sin(runtime.yaw) * back,
        runtime.pos.y + 2.6,
        runtime.pos.z - Math.cos(runtime.yaw) * back
      )
    } else {
      camDesired.set(runtime.pos.x - Math.sin(runtime.yaw) * 4, runtime.pos.y + 38, runtime.pos.z - Math.cos(runtime.yaw) * 4)
    }
    camDesired.y = Math.max(camDesired.y, 2)

    // wall clipping: sweep from just above the drone toward the desired camera
    // spot and pull the camera in front of the first building it would enter
    const ox = runtime.pos.x
    const oy = runtime.pos.y + 1.2
    const oz = runtime.pos.z
    const tHit = cameraObstruction(CITY, ox, oy, oz, camDesired.x, camDesired.y, camDesired.z)
    if (tHit < 1) {
      const t = Math.max(0.12, tHit - 0.06) // keep a sliver of clearance, never inside the drone
      camDesired.set(ox + (camDesired.x - ox) * t, Math.max(2, oy + (camDesired.y - oy) * t), oz + (camDesired.z - oz) * t)
    }

    const k = 1 - Math.pow(0.0001, dt)
    camera.position.lerp(camDesired, k)

    if (runtime.shake > 0.01) {
      const s = runtime.shake * 0.5
      camera.position.x += (Math.random() - 0.5) * s
      camera.position.y += (Math.random() - 0.5) * s
      camera.position.z += (Math.random() - 0.5) * s
    }

    if (mode === 'top') {
      lookAt.set(runtime.pos.x, runtime.pos.y, runtime.pos.z)
    } else {
      lookAt.set(
        runtime.pos.x + Math.sin(runtime.yaw) * 8,
        runtime.pos.y + 1,
        runtime.pos.z + Math.cos(runtime.yaw) * 8
      )
    }
    camera.lookAt(lookAt)

    // speed/boost FOV kick
    const cam = camera as THREE.PerspectiveCamera
    const targetFov = 60 + Math.min(14, speed * 0.28) + runtime.boostHeat * 6
    if (Math.abs(cam.fov - targetFov) > 0.1) {
      cam.fov += (targetFov - cam.fov) * Math.min(1, 6 * dt)
      cam.updateProjectionMatrix()
    }
  })

  const [bw, bh, bd] = model.bodyScale
  const arm = model.armLength
  const rotor = model.rotorSize
  const armPositions: [number, number][] = [
    [-arm, -arm],
    [arm, -arm],
    [-arm, arm],
    [arm, arm],
  ]

  return (
    <group ref={group}>
      <Trail width={trail.width * 2.2} length={trail.length} color={trailColor} attenuation={t => t * t} decay={2}>
        <group ref={inner}>
          {/* hull */}
          <mesh material={bodyMat} castShadow>
            <boxGeometry args={[bw, bh, bd]} />
          </mesh>
          {/* cockpit accent strip */}
          <mesh material={accentMat} position={[0, bh * 0.25, -bd * 0.32]}>
            <boxGeometry args={[bw * 0.7, bh * 0.35, bd * 0.18]} />
          </mesh>
          {/* belly ring light */}
          <mesh material={accentMat} position={[0, -bh * 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.min(bw, bd) * 0.42, 0.06, 6, 20]} />
          </mesh>
          {/* arms + rotors */}
          {armPositions.map(([x, z], i) => (
            <group key={i}>
              <mesh material={bodyMat} position={[x / 2, 0, z / 2]} rotation={[0, Math.atan2(x, z), 0]}>
                <boxGeometry args={[0.16, 0.12, Math.hypot(x, z)]} />
              </mesh>
              <mesh material={accentMat} position={[x, 0.08, z]}>
                <cylinderGeometry args={[0.12, 0.16, 0.18, 8]} />
              </mesh>
              <mesh ref={el => el && (rotors.current[i] = el)} position={[x, 0.2, z]}>
                <boxGeometry args={[rotor * 2.4, 0.02, 0.14]} />
                <meshStandardMaterial color="#aaccee" transparent opacity={0.55} />
              </mesh>
            </group>
          ))}
          {/* boost thrusters (rear pair, glow with boost heat) */}
          {[-bw * 0.3, bw * 0.3].map((x, i) => (
            <mesh
              key={i}
              ref={el => el && (thrusterRefs.current[i] = el)}
              position={[x, -bh * 0.1, bd * 0.6]}
              rotation={[Math.PI / 2, 0, 0]}
              visible={false}
            >
              <coneGeometry args={[0.22, 1.6, 8]} />
              <meshBasicMaterial color={new THREE.Color('#7fd9ff').multiplyScalar(2.2)} transparent opacity={0.8} toneMapped={false} depthWrite={false} />
            </mesh>
          ))}
          {/* --- skin flair: real geometry, not just paint --- */}
          {skin.flair === 'wings' && (
            <>
              <mesh material={flairMat} position={[-bw * 0.9, 0.05, 0.1]} rotation={[0, 0, 0.35]}>
                <planeGeometry args={[bw * 1.4, bd * 0.7]} />
              </mesh>
              <mesh material={flairMat} position={[bw * 0.9, 0.05, 0.1]} rotation={[0, 0, -0.35]}>
                <planeGeometry args={[bw * 1.4, bd * 0.7]} />
              </mesh>
            </>
          )}
          {skin.flair === 'halo' && (
            <mesh material={flairMat} position={[0, bh + 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[Math.max(bw, bd) * 0.55, 0.05, 8, 32]} />
            </mesh>
          )}
          {skin.flair === 'aura' && (
            <mesh ref={auraRef} material={flairMat} position={[0, 0, 0]}>
              <torusKnotGeometry args={[Math.max(bw, bd) * 0.85, 0.03, 64, 8, 2, 3]} />
            </mesh>
          )}
          {/* cargo box (visible while carrying) */}
          <mesh ref={cargoRef} position={[0, -bh - 0.32, 0]} visible={false}>
            <boxGeometry args={[0.8, 0.6, 0.8]} />
            <meshStandardMaterial color="#b07a3a" roughness={0.8} />
          </mesh>
          {/* nav light glow for bloom */}
          <pointLight color={skin.accent} intensity={6} distance={14} decay={2} position={[0, -0.4, 0]} />
        </group>
      </Trail>
    </group>
  )
}
