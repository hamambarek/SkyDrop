/* eslint-disable react-hooks/immutability -- three.js buffer geometry is mutated in-place every frame by design */
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WEATHERS } from '../game/constants'
import { mulberry32 } from '../game/rng'
import { runtime } from '../game/runtime'

const RAIN_COUNT = 1600
const BOX = 120 // rain volume half-extent around the camera

export function WeatherFx() {
  const pointsRef = useRef<THREE.Points>(null!)
  const flashRef = useRef<THREE.AmbientLight>(null!)
  const camera = useThree(s => s.camera)
  const nextFlash = useRef(6)

  const { geo, velocities } = useMemo(() => {
    const rng = mulberry32(4242)
    const positions = new Float32Array(RAIN_COUNT * 3)
    const velocities = new Float32Array(RAIN_COUNT)
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (rng() * 2 - 1) * BOX
      positions[i * 3 + 1] = rng() * BOX
      positions[i * 3 + 2] = (rng() * 2 - 1) * BOX
      velocities[i] = 55 + rng() * 35
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geo, velocities }
  }, [])

  useFrame((state, dt) => {
    const w = WEATHERS[runtime.weather]
    const pts = pointsRef.current
    if (!pts) return

    pts.visible = w.rain > 0
    if (pts.visible) {
      const mat = pts.material as THREE.PointsMaterial
      mat.opacity = 0.25 + w.rain * 0.3
      const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array
      const visible = Math.floor(RAIN_COUNT * w.rain)
      geo.setDrawRange(0, visible)
      for (let i = 0; i < visible; i++) {
        arr[i * 3 + 1] -= velocities[i] * dt
        arr[i * 3] += runtime.wind.x * dt * 2
        arr[i * 3 + 2] += runtime.wind.z * dt * 2
        if (arr[i * 3 + 1] < -4) {
          arr[i * 3] = (Math.random() * 2 - 1) * BOX
          arr[i * 3 + 1] = BOX
          arr[i * 3 + 2] = (Math.random() * 2 - 1) * BOX
        }
      }
      geo.attributes.position.needsUpdate = true
      pts.position.set(camera.position.x, Math.max(0, camera.position.y - BOX / 3), camera.position.z)
    }

    // lightning during storms
    if (flashRef.current) {
      flashRef.current.intensity = Math.max(0, flashRef.current.intensity - dt * 8)
      if (runtime.weather === 'storm') {
        nextFlash.current -= dt
        if (nextFlash.current <= 0) {
          flashRef.current.intensity = 2.2
          nextFlash.current = 3 + Math.random() * 8
        }
      }
    }
    void state
  })

  return (
    <group>
      <points ref={pointsRef} geometry={geo} visible={false}>
        <pointsMaterial color="#9fd0ff" size={0.18} transparent opacity={0.4} sizeAttenuation depthWrite={false} />
      </points>
      <ambientLight ref={flashRef} color="#cfe4ff" intensity={0} />
      <WindStreaks />
    </group>
  )
}

// Horizontal streak lines that appear in strong wind — makes gusts readable.
const STREAKS = 70

function WindStreaks() {
  const ref = useRef<THREE.LineSegments>(null!)
  const camera = useThree(s => s.camera)

  const { geo, seeds } = useMemo(() => {
    const rng = mulberry32(9876)
    const positions = new Float32Array(STREAKS * 6)
    const seeds: { x: number; y: number; z: number }[] = []
    for (let i = 0; i < STREAKS; i++) {
      seeds.push({ x: (rng() * 2 - 1) * 70, y: rng() * 50 + 4, z: (rng() * 2 - 1) * 70 })
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geo, seeds }
  }, [])

  useFrame((state, dt) => {
    const wind = Math.hypot(runtime.wind.x, runtime.wind.z)
    const ln = ref.current
    if (!ln) return
    ln.visible = wind > 3
    if (!ln.visible) return
    const mat = ln.material as THREE.LineBasicMaterial
    mat.opacity = Math.min(0.35, (wind - 3) * 0.06)
    const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array
    const t = state.clock.elapsedTime
    const len = Math.min(8, wind * 0.7)
    const nx = runtime.wind.x / (wind || 1)
    const nz = runtime.wind.z / (wind || 1)
    seeds.forEach((s, i) => {
      // streaks drift with the wind and wrap around the camera
      s.x += runtime.wind.x * dt * 3
      s.z += runtime.wind.z * dt * 3
      if (Math.abs(s.x) > 70) s.x = -Math.sign(s.x) * 70
      if (Math.abs(s.z) > 70) s.z = -Math.sign(s.z) * 70
      const wob = Math.sin(t * 2 + i) * 0.4
      arr[i * 6] = s.x
      arr[i * 6 + 1] = s.y + wob
      arr[i * 6 + 2] = s.z
      arr[i * 6 + 3] = s.x - nx * len
      arr[i * 6 + 4] = s.y + wob
      arr[i * 6 + 5] = s.z - nz * len
    })
    geo.attributes.position.needsUpdate = true
    ln.position.set(camera.position.x, 0, camera.position.z)
  })

  return (
    <lineSegments ref={ref} geometry={geo} visible={false}>
      <lineBasicMaterial color="#9fd0ff" transparent opacity={0.2} depthWrite={false} />
    </lineSegments>
  )
}
