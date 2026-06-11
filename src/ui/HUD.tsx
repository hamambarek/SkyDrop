import { useEffect, useRef, useState } from 'react'
import { levelFromXp } from '../game/constants'
import { IS_TOUCH } from '../game/device'
import { keyLabel } from '../game/bindings'
import { CAMERA_MODES, runtime } from '../game/runtime'
import { fmtMs } from '../game/trials'
import { useGame } from '../state/store'
import { Minimap } from './Minimap'

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

function ChannelBar() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setProgress(runtime.channel), 60)
    return () => clearInterval(id)
  }, [])
  if (progress <= 0.01) return null
  const phase = useGame.getState().phase
  return (
    <div className="hud-channel">
      <span>{phase === 'toPickup' ? 'SECURING PACKAGE' : 'DELIVERING'}</span>
      <div className="bar">
        <div style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </div>
    </div>
  )
}

function TrialClock() {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setMs(Math.round(runtime.missionClock * 1000)), 100)
    return () => clearInterval(id)
  }, [])
  return <div className="trial-hud-clock">⏱ {fmtMs(ms)}</div>
}

function CrashFlash() {
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setFlash(runtime.crashed), 100)
    return () => clearInterval(id)
  }, [])
  return flash ? <div className="crash-flash" /> : null
}

// ---- top-center compass heading tape ----

const COMPASS_LABELS: [number, string][] = [
  [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
]

function Compass() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = 360
    const H = 38
    canvas.width = W * 2
    canvas.height = H * 2
    const g = canvas.getContext('2d')!
    g.scale(2, 2)
    let raf = 0
    let last = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 50) return
      last = now
      // heading: 0 = north (-z), increasing clockwise
      const fx = Math.sin(runtime.yaw)
      const fz = Math.cos(runtime.yaw)
      let heading = (Math.atan2(fx, -fz) * 180) / Math.PI
      if (heading < 0) heading += 360

      g.clearRect(0, 0, W, H)
      const span = 100 // degrees visible across the tape
      const pxPerDeg = W / span

      g.font = '700 11px Orbitron, sans-serif'
      g.textAlign = 'center'
      for (let d = -60; d <= 60; d += 5) {
        let deg = Math.round((heading + d) / 5) * 5
        const offset = deg - heading
        deg = ((deg % 360) + 360) % 360
        const x = W / 2 + offset * pxPerDeg
        if (x < 6 || x > W - 6) continue
        const major = deg % 45 === 0
        const fade = 1 - Math.abs(offset) / (span / 2)
        g.globalAlpha = Math.max(0.12, fade)
        g.strokeStyle = major ? '#39c2ff' : 'rgba(143,163,187,0.7)'
        g.lineWidth = major ? 2 : 1
        g.beginPath()
        g.moveTo(x, H - 6)
        g.lineTo(x, H - (major ? 16 : 11))
        g.stroke()
        if (major) {
          const label = COMPASS_LABELS.find(l => l[0] === deg)?.[1] ?? `${deg}`
          g.fillStyle = label.length <= 2 && isNaN(Number(label)) ? '#dbe7f4' : '#8fa3bb'
          g.fillText(label, x, H - 20)
        }
      }
      g.globalAlpha = 1
      // center caret
      g.fillStyle = '#2bffc8'
      g.beginPath()
      g.moveTo(W / 2, H - 2)
      g.lineTo(W / 2 - 5, H + 4)
      g.lineTo(W / 2 + 5, H + 4)
      g.fill()
      // heading readout
      g.fillStyle = '#2bffc8'
      g.font = '700 12px Orbitron, sans-serif'
      g.fillText(`${Math.round(heading).toString().padStart(3, '0')}°`, W / 2, 11)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="compass panel">
      <canvas ref={canvasRef} style={{ width: 360, height: 38 }} />
    </div>
  )
}

// ---- top-right system buttons: pause / camera / map ----

function SystemButtons() {
  const setPaused = useGame(s => s.setPaused)
  const [cam, setCam] = useState(runtime.cameraMode)
  return (
    <div className="sys-btns">
      <button className="sys-btn" title="Pause (ESC)" onClick={() => setPaused(true)}>
        ⏸
      </button>
      <button
        className="sys-btn"
        title={`Camera: ${cam} (V)`}
        onClick={() => {
          const i = CAMERA_MODES.indexOf(runtime.cameraMode)
          runtime.cameraMode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length]
          setCam(runtime.cameraMode)
        }}
      >
        🎥
      </button>
      <button
        className="sys-btn"
        title="Minimap zoom (M)"
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }))}
      >
        🗺
      </button>
    </div>
  )
}

// ---- bottom-center flight console ----

function FlightConsole({ stealth }: { stealth: boolean }) {
  const hud = useGame(s => s.hud)
  const lowBat = hud.battery < 25
  return (
    <div className={`console panel ${lowBat ? 'console-low' : ''}`}>
      <div className="console-cell console-bat">
        <div className="bar-label">
          <span>
            PWR {hud.boost && <span className="boost-chip">⚡BOOST</span>}
            {hud.charging && <span className="charging-chip">⚡CHG</span>}
          </span>
          <span>{Math.round(hud.battery)}%</span>
        </div>
        <div className={`bar ${lowBat ? 'low' : ''}`}>
          <div style={{ width: `${hud.battery}%` }} />
        </div>
        {stealth && (
          <>
            <div className="bar-label" style={{ marginTop: 5 }}>
              <span style={{ color: hud.detection > 0.5 ? 'var(--red)' : undefined }}>📡 SCAN</span>
              <span>{Math.round(hud.detection * 100)}%</span>
            </div>
            <div className="bar detect">
              <div style={{ width: `${hud.detection * 100}%` }} />
            </div>
          </>
        )}
      </div>
      <div className="console-cell console-num">
        <b>{Math.round(hud.speed)}</b>
        <span>SPD m/s</span>
      </div>
      <div className="console-divider" />
      <div className="console-cell console-num">
        <b>{Math.round(hud.alt)}</b>
        <span>ALT m</span>
      </div>
    </div>
  )
}

export function HUD() {
  const mission = useGame(s => s.activeMission)
  const phase = useGame(s => s.phase)
  const stopIndex = useGame(s => s.stopIndex)
  const timeLeft = useGame(s => s.timeLeft)
  const hud = useGame(s => s.hud)
  const credits = useGame(s => s.credits)
  const gems = useGame(s => s.gems)
  const xp = useGame(s => s.xp)
  const streak = useGame(s => s.streak)
  const controls = useGame(s => s.controls)
  const showTutorial = useGame(s => s.showTutorial)
  const isTouch = IS_TOUCH

  const lvl = levelFromXp(xp)
  const totalStops = mission?.stops.length ?? 1
  const objective =
    phase === 'toPickup'
      ? 'Fly to the pickup beacon'
      : totalStops > 1
        ? `Deliver stop ${stopIndex + 1} of ${totalStops}`
        : 'Deliver to the drop zone'

  return (
    <div className="hud">
      {mission && (
        <div className="hud-mission panel">
          <div className="title">
            {mission.type === 'story' ? `CH.${mission.chapterId} — ` : ''}
            {mission.title}
          </div>
          <div className="obj">
            <span className="obj-arrow">▸</span> {objective}
          </div>
          <div className="dist">
            {fmt(hud.dist)} <small>m</small>
          </div>
          {mission.trialId && <TrialClock />}
          {timeLeft != null && (
            <div className={`timer ${timeLeft < 20 ? 'low' : ''}`}>⏱ {Math.max(0, Math.ceil(timeLeft))}s</div>
          )}
          <div className="hud-cargo-tags">
            {mission.fragile && <span className="tag fragile">FRAGILE</span>}
            {mission.stealth && <span className="tag stealth">STEALTH</span>}
            {mission.storm && <span className="tag storm">ION STORM</span>}
            <span className="tag heavy">{phase === 'toPickup' ? 'no cargo' : `${mission.cargoWeight}kg aboard`}</span>
          </div>
        </div>
      )}

      {!isTouch && <Compass />}

      <div className="hud-top-right">
        <div className="tr-row">
          <div className="wallet panel">
            {streak > 1 && <span className="streak-chip">🔥{streak}</span>}
            <span className="credits">¢ {fmt(credits)}</span>
            <span className="gems">💎 {fmt(gems)}</span>
            <span>LV {lvl.level}</span>
          </div>
          <SystemButtons />
        </div>
        <div className="weather-chip panel">
          {hud.weatherIcon} <b>{hud.weather}</b>
          {hud.windSpeed > 1.5 && (
            <span className="wind-ind">
              <span
                className="wind-arrow"
                style={{ transform: `rotate(${Math.round((hud.windAngle * 180) / Math.PI) + 180}deg)` }}
              >
                ➤
              </span>
              {hud.windSpeed.toFixed(0)} m/s
            </span>
          )}
        </div>
        <Minimap />
      </div>

      <FlightConsole stealth={!!mission?.stealth} />

      <ChannelBar />
      <CrashFlash />

      {showTutorial && !isTouch && (
        <div className="tutorial panel">
          <kbd>{keyLabel(controls.moveForward[0])}</kbd>
          <kbd>{keyLabel(controls.moveLeft[0])}</kbd>
          <kbd>{keyLabel(controls.moveBack[0])}</kbd>
          <kbd>{keyLabel(controls.moveRight[0])}</kbd> fly · <kbd>{keyLabel(controls.ascend[0])}</kbd> up ·{' '}
          <kbd>{keyLabel(controls.descend[0])}</kbd> down · <kbd>{keyLabel(controls.yawLeft[0])}</kbd>
          <kbd>{keyLabel(controls.yawRight[0])}</kbd> turn · <kbd>{keyLabel(controls.boost[0])}</kbd> boost ·{' '}
          <kbd>{keyLabel(controls.brake[0])}</kbd> brake · <kbd>{keyLabel(controls.cameraToggle[0])}</kbd> camera
          <br />
          Follow the light pillar. Hover inside the beacon to pick up &amp; deliver. Land on glowing pads to recharge.
        </div>
      )}
      {showTutorial && isTouch && (
        <div className="tutorial panel" style={{ bottom: '52vh' }}>
          Left stick: move • Right stick: turn &amp; altitude
          <br />
          Follow the light pillar and hover inside the beacon.
        </div>
      )}
    </div>
  )
}
