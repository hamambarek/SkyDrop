import * as THREE from 'three'
import { CITY, nearbyBuildings, patrolPos } from './city'
import {
  BASE_BATTERY, BASE_LIFT, BASE_MAX_SPEED, BASE_THRUST, BASE_YAW_RATE,
  BATTERY_IDLE_DRAIN, BATTERY_THRUST_DRAIN, BOOST_DRAIN, BOOST_SPEED_MULT,
  BOOST_THRUST_MULT, BRAKE_DAMPING, CRASH_SPEED, DETECTION_DECAY, DETECTION_RATE,
  DRAG, DRONE_RADIUS, MAX_ALTITUDE, PAD_RECHARGE_RATE, PICKUP_CHANNEL_TIME,
  PICKUP_RADIUS, RESPAWN_DELAY, RING_BOOST, WEATHERS, WORLD_HALF, type WeatherId,
} from './constants'
import { droneById } from './cosmetics'
import { pollInput, runtime } from './runtime'
import { engineUpdate, sfx } from './sfx'
import { currentTarget, useGame } from '../state/store'

const tmp = new THREE.Vector3()
const prevPos = new THREE.Vector3()

// weather state machine ------------------------------------------------------
const WEATHER_CYCLE: { id: WeatherId; weight: number }[] = [
  { id: 'clear', weight: 0.42 },
  { id: 'windy', weight: 0.26 },
  { id: 'rain', weight: 0.2 },
  { id: 'storm', weight: 0.12 },
]

function rollWeather(): WeatherId {
  const r = Math.random()
  let acc = 0
  for (const w of WEATHER_CYCLE) {
    acc += w.weight
    if (r < acc) return w.id
  }
  return 'clear'
}

function stepWeather(dt: number) {
  if (!runtime.weatherLocked) {
    runtime.weatherTimer -= dt
    if (runtime.weatherTimer <= 0) {
      const next = rollWeather()
      if (next !== runtime.weather) {
        runtime.weather = next
        const w = WEATHERS[next]
        useGame.getState().toast(`${w.icon} Weather shift: ${w.name}${w.payBonus > 1 ? ` (pay ×${w.payBonus})` : ''}`)
      }
      runtime.weatherTimer = 55 + Math.random() * 50
    }
  }

  // sustained wind + gusts, direction wanders slowly
  const w = WEATHERS[runtime.weather]
  runtime.gustPhase += dt
  const t = runtime.gustPhase
  const dir = t * 0.07
  const gust = Math.sin(t * 1.7) * Math.sin(t * 0.63 + 2.1) * w.gust
  const speed = w.wind + gust
  runtime.wind.set(Math.cos(dir) * speed, Math.sin(t * 0.9) * w.gust * 0.25, Math.sin(dir) * speed)
}

// pad proximity --------------------------------------------------------------
function nearPad(): boolean {
  const p = runtime.pos
  for (const pad of CITY.pads) {
    if (Math.abs(pad.y - p.y) < 5 && Math.hypot(pad.x - p.x, pad.z - p.z) < 9) return true
  }
  return false
}

function nearestPad(): { x: number; y: number; z: number } {
  const p = runtime.pos
  let best = CITY.pads[0]
  let bestD = Infinity
  for (const pad of CITY.pads) {
    const d = Math.hypot(pad.x - p.x, pad.z - p.z) + Math.abs(pad.y - p.y) * 2
    if (d < bestD) {
      bestD = d
      best = pad
    }
  }
  return best
}

// main step ------------------------------------------------------------------
let hudAccum = 0
let noFlyWarned = false
let detectWarned = false

export function stepSimulation(dt: number) {
  dt = Math.min(dt, 0.05) // clamp tab-switch spikes
  const st = useGame.getState()
  stepWeather(dt)

  // camera shake decays regardless of pause
  runtime.shake = Math.max(0, runtime.shake - dt * 1.4)

  if (st.paused || st.result || st.chapterIntro != null) {
    engineUpdate(0, false, 0) // idle the motor hum while frozen
    return
  }

  pollInput()
  const inp = runtime.input

  // crash / respawn ----------------------------------------------------------
  if (runtime.crashed) {
    runtime.crashTimer -= dt
    runtime.vel.y -= 25 * dt
    runtime.vel.multiplyScalar(1 - 1.5 * dt)
    runtime.pos.addScaledVector(runtime.vel, dt)
    if (runtime.pos.y < 0.4) {
      runtime.pos.y = 0.4
      runtime.vel.set(0, 0, 0)
    }
    if (runtime.crashTimer <= 0) {
      const pad = nearestPad()
      runtime.pos.set(pad.x, pad.y + 6, pad.z)
      runtime.vel.set(0, 0, 0)
      runtime.crashed = false
      runtime.battery = Math.max(runtime.battery, 40)
    }
    return
  }

  // drone frame + upgrades ---------------------------------------------------
  const drone = droneById(st.equipped.model)
  const ds = drone.stats
  const up = st.upgrades
  const m = st.activeMission
  const weight = m && runtime.carrying ? m.cargoWeight : 0
  const cargoDiv = ds.cargo * (1 + up.cargo * 0.15)
  const weightPenalty = 1 + weight / (22 * cargoDiv)
  const boosting = inp.boost && runtime.battery > 0
  const boostThrust = boosting ? BOOST_THRUST_MULT : 1
  const thrust = (BASE_THRUST * ds.speed * (1 + up.motor * 0.12) * boostThrust) / weightPenalty
  const lift = (BASE_LIFT * ds.speed * (1 + up.motor * 0.08)) / weightPenalty
  const maxSpeed = (BASE_MAX_SPEED * ds.speed * (1 + up.motor * 0.12) * (boosting ? BOOST_SPEED_MULT : 1)) / Math.sqrt(weightPenalty)
  const yawRate = BASE_YAW_RATE * ds.agility * (1 + up.handling * 0.15)
  const drag = DRAG * (1 + up.handling * 0.06) + (inp.brake ? BRAKE_DAMPING * ds.agility : 0)
  const capacity = BASE_BATTERY * ds.battery * (1 + up.battery * 0.25)
  const windResist = Math.max(0.1, (1 - up.stability * 0.18) / ds.stability)
  const stormResist = Math.max(0.2, 1 - up.weather * 0.15)
  const crashSpeed = CRASH_SPEED * (drone.id === 'model-titan' ? 1.2 : 1)

  // battery ------------------------------------------------------------------
  const throttle = Math.min(1, Math.abs(inp.forward) + Math.abs(inp.strafe) + Math.abs(inp.lift))
  const boostDrain = boosting ? BOOST_DRAIN * (drone.id === 'model-falcon' ? 0.75 : 1) : 0
  const stormDrain = runtime.weather === 'storm' && drone.id !== 'model-aether' ? 0.35 * stormResist : 0
  const drainPct =
    ((BATTERY_IDLE_DRAIN + BATTERY_THRUST_DRAIN * throttle * weightPenalty + boostDrain + stormDrain) * dt * 100) / capacity
  runtime.onPad = nearPad() && runtime.vel.length() < 2
  if (runtime.onPad) {
    runtime.battery = Math.min(100, runtime.battery + PAD_RECHARGE_RATE * dt)
    runtime.lowBatteryWarned = runtime.battery < 25
  } else {
    runtime.battery = Math.max(0, runtime.battery - drainPct)
    if (drone.id === 'model-spectre') runtime.battery = Math.min(100, runtime.battery + 0.1 * dt)
  }
  if (runtime.battery < 15 && !runtime.lowBatteryWarned) {
    runtime.lowBatteryWarned = true
    sfx.warn()
    st.toast('🔋 Battery critical — find a landing pad', 'bad')
  }
  const dead = runtime.battery <= 0

  // control forces -----------------------------------------------------------
  runtime.yaw -= inp.yaw * yawRate * dt

  if (!dead) {
    const sin = Math.sin(runtime.yaw)
    const cos = Math.cos(runtime.yaw)
    const ax = (sin * -inp.forward + cos * inp.strafe) * thrust
    const az = (cos * -inp.forward - sin * inp.strafe) * thrust
    runtime.vel.x += ax * dt
    runtime.vel.z += az * dt
    runtime.vel.y += inp.lift * lift * dt
    if (inp.lift === 0) runtime.vel.y *= 1 - 2.2 * dt
  } else {
    runtime.vel.y -= 6 * dt
  }

  // wind + drag (stability core + frame stats fight the wind)
  runtime.vel.x += runtime.wind.x * 0.55 * windResist * dt
  runtime.vel.z += runtime.wind.z * 0.55 * windResist * dt
  runtime.vel.y += runtime.wind.y * 0.3 * windResist * dt
  runtime.vel.multiplyScalar(Math.max(0, 1 - drag * dt))

  // clamp horizontal speed
  const hs = Math.hypot(runtime.vel.x, runtime.vel.z)
  if (hs > maxSpeed) {
    const k = maxSpeed / hs
    runtime.vel.x *= k
    runtime.vel.z *= k
  }
  runtime.vel.y = THREE.MathUtils.clamp(runtime.vel.y, -28, 16)

  // integrate
  prevPos.copy(runtime.pos)
  runtime.pos.addScaledVector(runtime.vel, dt)

  // world bounds
  runtime.pos.x = THREE.MathUtils.clamp(runtime.pos.x, -WORLD_HALF - 40, WORLD_HALF + 40)
  runtime.pos.z = THREE.MathUtils.clamp(runtime.pos.z, -WORLD_HALF - 40, WORLD_HALF + 40)
  if (runtime.pos.y > MAX_ALTITUDE) {
    runtime.pos.y = MAX_ALTITUDE
    runtime.vel.y = Math.min(0, runtime.vel.y)
  }

  // ground (always safe — arcade kindness)
  if (runtime.pos.y < 0.5) {
    runtime.pos.y = 0.5
    if (runtime.vel.y < 0) runtime.vel.y = 0
    if (dead && runtime.onPad) {
      runtime.battery = Math.min(100, runtime.battery + PAD_RECHARGE_RATE * dt)
    } else if (dead) {
      runtime.battery = Math.min(30, runtime.battery + 2.5 * dt)
    }
  }

  // building collisions (supports elevated boxes: bridges, tunnel roofs) ------
  const candidates = nearbyBuildings(CITY, runtime.pos.x, runtime.pos.z)
  for (const idx of candidates) {
    const b = CITY.buildings[idx]
    const minX = b.x - b.w / 2 - DRONE_RADIUS
    const maxX = b.x + b.w / 2 + DRONE_RADIUS
    const minZ = b.z - b.d / 2 - DRONE_RADIUS
    const maxZ = b.z + b.d / 2 + DRONE_RADIUS
    const minY = b.baseY - DRONE_RADIUS
    const maxY = b.baseY + b.h + DRONE_RADIUS
    const p = runtime.pos
    if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ && p.y < maxY && p.y > minY) {
      const dx = Math.min(p.x - minX, maxX - p.x)
      const dz = Math.min(p.z - minZ, maxZ - p.z)
      const dyTop = maxY - p.y
      const dyBot = p.y - minY
      const impact = runtime.vel.length()

      if (impact > crashSpeed) {
        triggerCrash()
        return
      }

      const minPen = Math.min(dx, dz, dyTop, dyBot)
      if (minPen === dyTop && runtime.vel.y <= 0.5) {
        p.y = maxY // landed on top
        if (runtime.vel.y < 0) runtime.vel.y = 0
      } else if (minPen === dyBot && b.baseY > 0) {
        p.y = minY // bumped the underside of a bridge/tunnel roof
        if (runtime.vel.y > 0) runtime.vel.y = -1
        runtime.shake = Math.max(runtime.shake, 0.25)
      } else if (dx < dz) {
        p.x = p.x - minX < maxX - p.x ? minX : maxX
        runtime.vel.x *= -0.25
      } else {
        p.z = p.z - minZ < maxZ - p.z ? minZ : maxZ
        runtime.vel.z *= -0.25
      }
    }
  }

  // no-fly zones: heavy battery drain + alarm (Spectre + Storm Plating resist)
  const jamResist = (drone.id === 'model-spectre' ? 0.5 : 1) * stormResist
  for (const nf of CITY.noFly) {
    if (runtime.pos.y < nf.height && Math.hypot(runtime.pos.x - nf.x, runtime.pos.z - nf.z) < nf.radius) {
      runtime.battery = Math.max(0, runtime.battery - 6 * jamResist * dt)
      if (!noFlyWarned) {
        noFlyWarned = true
        sfx.warn()
        st.toast('🚫 NO-FLY ZONE — security jamming is draining your battery!', 'bad')
        setTimeout(() => (noFlyWarned = false), 4000)
      }
    }
  }

  // speed rings: pass through for a velocity surge ----------------------------
  for (const ring of CITY.rings) {
    if (ring.id === runtime.lastRingId) continue
    const d = Math.hypot(runtime.pos.x - ring.x, runtime.pos.y - ring.y, runtime.pos.z - ring.z)
    if (d < 6) {
      runtime.lastRingId = ring.id
      const axisX = Math.sin(ring.yaw)
      const axisZ = Math.cos(ring.yaw)
      // boost along the ring axis in the direction of current travel
      const sign = runtime.vel.x * axisX + runtime.vel.z * axisZ >= 0 ? 1 : -1
      runtime.vel.x += axisX * sign * RING_BOOST
      runtime.vel.z += axisZ * sign * RING_BOOST
      runtime.boostHeat = 1
      st.onRingHit()
    }
  }
  runtime.boostHeat = Math.max(boosting ? 0.7 : 0, runtime.boostHeat - dt * 1.5)

  // stealth detection ---------------------------------------------------------
  if (m?.stealth) {
    const detectMult = ds.detection
    const decayMult = drone.id === 'model-umbra' ? 2 : 1
    let inScan = false
    for (const pt of CITY.patrols) {
      const pos = patrolPos(pt, runtime.missionClock)
      const d = Math.hypot(runtime.pos.x - pos.x, runtime.pos.y - pos.y, runtime.pos.z - pos.z)
      if (d < pt.detectR) {
        inScan = true
        break
      }
    }
    runtime.detected = inScan
    if (inScan) {
      runtime.detection = Math.min(1, runtime.detection + DETECTION_RATE * detectMult * dt)
      if (!detectWarned && runtime.detection > 0.25) {
        detectWarned = true
        sfx.warn()
        st.toast('📡 Scan contact — break line of sight!', 'bad')
        setTimeout(() => (detectWarned = false), 3000)
      }
      if (runtime.detection >= 1) {
        st.onDetected()
        return
      }
    } else {
      runtime.detection = Math.max(0, runtime.detection - DETECTION_DECAY * decayMult * dt)
    }
  } else {
    runtime.detection = 0
    runtime.detected = false
  }

  // visual tilt
  const targetPitch = THREE.MathUtils.clamp(inp.forward * (boosting ? 0.5 : 0.38), -0.55, 0.55)
  const targetRoll = THREE.MathUtils.clamp(-inp.strafe * 0.32 + inp.yaw * 0.12, -0.4, 0.4)
  runtime.tilt.pitch += (targetPitch - runtime.tilt.pitch) * Math.min(1, 8 * dt)
  runtime.tilt.roll += (targetRoll - runtime.tilt.roll) * Math.min(1, 8 * dt)
  runtime.rotorSpeed = dead ? runtime.rotorSpeed * (1 - dt) : 18 + throttle * 26 + (boosting ? 14 : 0)

  // mission progress ----------------------------------------------------------
  runtime.missionClock += dt
  if (m) {
    const target = currentTarget(st)!
    const d = Math.hypot(runtime.pos.x - target[0], runtime.pos.y - (target[1] + 2), runtime.pos.z - target[2])
    const slow = runtime.vel.length() < 7
    if (d < PICKUP_RADIUS && slow) {
      runtime.channel += dt / PICKUP_CHANNEL_TIME
      if (runtime.channel >= 1) {
        runtime.channel = 0
        if (st.phase === 'toPickup') st.onPickup()
        else st.onStopReached()
      }
    } else {
      runtime.channel = Math.max(0, runtime.channel - dt * 2)
    }
    st.tickMission(dt, prevPos.distanceTo(runtime.pos))
  }

  // HUD sync + engine audio at ~12Hz
  hudAccum += dt
  if (hudAccum > 0.085) {
    hudAccum = 0
    st.syncHud()
    engineUpdate(dead ? 0 : throttle, boosting, Math.hypot(runtime.wind.x, runtime.wind.z))
  }
}

function triggerCrash() {
  runtime.crashed = true
  runtime.crashTimer = RESPAWN_DELAY
  runtime.crashedThisMission = true
  tmp.copy(runtime.vel).multiplyScalar(-0.3)
  runtime.vel.copy(tmp)
  runtime.vel.y = 2
  useGame.getState().onCrash()
}
