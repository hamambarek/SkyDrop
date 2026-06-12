import * as THREE from 'three'
import { codesFor, GAMEPAD_MAP } from './bindings'
import type { WeatherId } from './constants'

// Mutable, non-reactive state touched every frame by physics, camera and HUD.
// Kept outside React/Zustand so 60fps updates never trigger re-renders.

export interface InputState {
  forward: number // -1..1
  strafe: number // -1..1
  lift: number // -1..1
  yaw: number // -1..1
  boost: boolean
  brake: boolean
}

export type CameraMode = 'chase' | 'near' | 'top'
export const CAMERA_MODES: CameraMode[] = ['chase', 'near', 'top']

export interface Runtime {
  pos: THREE.Vector3
  vel: THREE.Vector3
  yaw: number
  tilt: { pitch: number; roll: number }
  battery: number // 0..100
  crashed: boolean
  crashTimer: number
  carrying: boolean
  channel: number // beacon hover progress 0..1
  missionClock: number // seconds elapsed in current mission
  crashedThisMission: boolean
  onPad: boolean
  input: InputState
  touchActive: boolean
  wind: THREE.Vector3
  weather: WeatherId
  weatherLocked: boolean // storm missions pin the weather
  weatherTimer: number
  gustPhase: number
  rotorSpeed: number
  lowBatteryWarned: boolean
  detection: number // 0..1 stealth detection meter
  detected: boolean // inside a scan cone right now
  shake: number // camera shake impulse 0..1
  boostHeat: number // 0..1 visual thruster heat
  cameraMode: CameraMode
  lastRingId: number // last speed ring passed (debounce)
  /** Current beacon target projected to screen space (written by the renderer each frame). */
  targetScreen: { dx: number; dy: number; off: boolean; active: boolean }
}

export const runtime: Runtime = {
  pos: new THREE.Vector3(0, 0, 0),
  vel: new THREE.Vector3(),
  yaw: 0,
  tilt: { pitch: 0, roll: 0 },
  battery: 100,
  crashed: false,
  crashTimer: 0,
  carrying: false,
  channel: 0,
  missionClock: 0,
  crashedThisMission: false,
  onPad: false,
  input: { forward: 0, strafe: 0, lift: 0, yaw: 0, boost: false, brake: false },
  touchActive: false,
  wind: new THREE.Vector3(),
  weather: 'clear',
  weatherLocked: false,
  weatherTimer: 70,
  gustPhase: 0,
  rotorSpeed: 0,
  lowBatteryWarned: false,
  detection: 0,
  detected: false,
  shake: 0,
  boostHeat: 0,
  cameraMode: 'chase',
  lastRingId: -1,
  targetScreen: { dx: 0, dy: 0, off: false, active: false },
}

// Flight trace recorded during time trials — submitted with the time so the
// server can verify the route was actually flown. [t, x, y, z] per sample.
export const trialTrace: number[][] = []

export function resetTrialTrace() {
  trialTrace.length = 0
}

export function resetRuntimeAt(x: number, y: number, z: number, yaw = 0) {
  runtime.pos.set(x, y, z)
  runtime.vel.set(0, 0, 0)
  runtime.yaw = yaw
  runtime.tilt.pitch = 0
  runtime.tilt.roll = 0
  runtime.crashed = false
  runtime.crashTimer = 0
  runtime.channel = 0
  runtime.lowBatteryWarned = false
  runtime.detection = 0
  runtime.detected = false
  runtime.shake = 0
  runtime.lastRingId = -1
}

// ---------- Keyboard + mouse + gamepad input ----------

const pressed = new Set<string>()
let camToggleLatch = false

export function attachKeyboard() {
  const down = (e: KeyboardEvent) => {
    if (e.repeat) return
    pressed.add(e.code)
  }
  const up = (e: KeyboardEvent) => pressed.delete(e.code)
  const blur = () => pressed.clear()
  const mdown = (e: MouseEvent) => {
    // ignore clicks on UI elements — only the 3D canvas drives flight input
    if ((e.target as HTMLElement)?.tagName === 'CANVAS') pressed.add(`Mouse${e.button}`)
  }
  const mup = (e: MouseEvent) => pressed.delete(`Mouse${e.button}`)
  const ctx = (e: MouseEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'CANVAS') e.preventDefault()
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  window.addEventListener('mousedown', mdown)
  window.addEventListener('mouseup', mup)
  window.addEventListener('contextmenu', ctx)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    window.removeEventListener('mousedown', mdown)
    window.removeEventListener('mouseup', mup)
    window.removeEventListener('contextmenu', ctx)
  }
}

export function isKeyDown(code: string) {
  return pressed.has(code)
}

function actionDown(action: Parameters<typeof codesFor>[0]): boolean {
  for (const code of codesFor(action)) {
    if (code && pressed.has(code)) return true
  }
  return false
}

/** Poll bound keys/mouse + first connected gamepad into runtime.input (touch writes directly). */
export function pollInput() {
  // camera toggle works regardless of input source
  const camDown = actionDown('cameraToggle')
  if (camDown && !camToggleLatch) {
    const i = CAMERA_MODES.indexOf(runtime.cameraMode)
    runtime.cameraMode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length]
  }
  camToggleLatch = camDown

  if (runtime.touchActive) return // virtual sticks own movement input

  const i = runtime.input
  const v = (a: Parameters<typeof codesFor>[0]) => (actionDown(a) ? 1 : 0)
  i.forward = v('moveForward') - v('moveBack')
  i.strafe = v('moveRight') - v('moveLeft')
  i.lift = v('ascend') - v('descend')
  i.yaw = v('yawRight') - v('yawLeft')
  i.boost = actionDown('boost')
  i.brake = actionDown('brake')

  // optional gamepad (structure defined in bindings.GAMEPAD_MAP)
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
  const gp = pads && pads[0]
  if (gp) {
    const dz = (x: number) => (Math.abs(x) > 0.15 ? x : 0)
    const A = GAMEPAD_MAP.axes
    const B = GAMEPAD_MAP.buttons
    if (dz(gp.axes[A.moveY])) i.forward = -dz(gp.axes[A.moveY])
    if (dz(gp.axes[A.moveX])) i.strafe = dz(gp.axes[A.moveX])
    if (dz(gp.axes[A.yaw])) i.yaw = dz(gp.axes[A.yaw])
    if (dz(gp.axes[A.lift])) i.lift = -dz(gp.axes[A.lift])
    if (gp.buttons[B.ascend]?.pressed) i.lift = 1
    if (gp.buttons[B.descend]?.pressed) i.lift = -1
    if (gp.buttons[B.boost]?.pressed) i.boost = true
    if (gp.buttons[B.brake]?.pressed) i.brake = true
  }

  i.forward = Math.max(-1, Math.min(1, i.forward))
  i.strafe = Math.max(-1, Math.min(1, i.strafe))
  i.lift = Math.max(-1, Math.min(1, i.lift))
  i.yaw = Math.max(-1, Math.min(1, i.yaw))
}
