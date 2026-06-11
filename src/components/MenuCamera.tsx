import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const look = new THREE.Vector3(0, 30, 0)

// Slow cinematic orbit over the city while in the main menu.
export function MenuCamera() {
  const camera = useThree(s => s.camera)
  useFrame(state => {
    const t = state.clock.elapsedTime * 0.05
    const r = 320
    camera.position.set(Math.sin(t) * r, 130 + Math.sin(t * 0.7) * 30, Math.cos(t) * r)
    camera.lookAt(look)
  })
  return null
}
