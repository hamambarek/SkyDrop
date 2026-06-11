import { useEffect, useState } from 'react'
import { levelFromXp } from '../game/constants'
import { IS_TOUCH } from '../game/device'
import { keyLabel } from '../game/bindings'
import { runtime } from '../game/runtime'
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
  const setPaused = useGame(s => s.setPaused)
  const isTouch = IS_TOUCH

  const lvl = levelFromXp(xp)
  const totalStops = mission?.stops.length ?? 1
  const objective =
    phase === 'toPickup'
      ? '→ Fly to the pickup beacon'
      : totalStops > 1
        ? `→ Deliver stop ${stopIndex + 1} of ${totalStops}`
        : '→ Deliver to the drop zone'

  return (
    <div className="hud">
      {mission && (
        <div className="hud-mission panel">
          <div className="title">
            {mission.type === 'story' ? `CH.${mission.chapterId} — ` : ''}
            {mission.title}
          </div>
          <div className="obj">{objective}</div>
          <div className="dist">{fmt(hud.dist)} m</div>
          {mission.trialId && <TrialClock />}
          {timeLeft != null && (
            <div className={`timer ${timeLeft < 20 ? 'low' : ''}`}>⏱ {Math.max(0, Math.ceil(timeLeft))}s</div>
          )}
          <div className="hud-cargo-tags">
            {mission.fragile && <span className="tag fragile">FRAGILE</span>}
            {mission.stealth && <span className="tag fragile" style={{ borderColor: 'rgba(255,61,94,.4)' }}>STEALTH</span>}
            {mission.storm && <span className="tag express">ION STORM</span>}
            <span className="tag heavy">{phase === 'toPickup' ? 'no cargo' : `${mission.cargoWeight}kg aboard`}</span>
          </div>
        </div>
      )}

      <div className="hud-top-right">
        <div className="wallet panel">
          {streak > 1 && <span className="streak-chip">🔥{streak}</span>}
          <span className="credits">¢ {fmt(credits)}</span>
          <span className="gems">💎 {fmt(gems)}</span>
          <span>LV {lvl.level}</span>
        </div>
        <div className="weather-chip panel">
          {hud.weatherIcon} <b>{hud.weather}</b>
          {hud.windSpeed > 1.5 && (
            <span className="wind-ind">
              <span className="wind-arrow" style={{ transform: `rotate(${Math.round((hud.windAngle * 180) / Math.PI) + 180}deg)` }}>➤</span>
              {hud.windSpeed.toFixed(0)} m/s
            </span>
          )}
        </div>
        <Minimap />
      </div>

      <button className="btn small ghost pause-btn" onClick={() => setPaused(true)}>
        ⏸ Pause
      </button>

      <div className="hud-bottom-left">
        <div className="bar-wrap panel">
          <div className="bar-label">
            <span>BATTERY {hud.boost && <span className="boost-chip">⚡BOOST</span>}</span>
            <span>
              {Math.round(hud.battery)}% {hud.charging && <span className="charging-chip">⚡ CHARGING</span>}
            </span>
          </div>
          <div className={`bar ${hud.battery < 25 ? 'low' : ''}`}>
            <div style={{ width: `${hud.battery}%` }} />
          </div>
        </div>
        {mission?.stealth && (
          <div className="bar-wrap panel">
            <div className="bar-label">
              <span style={{ color: hud.detection > 0.5 ? 'var(--red)' : undefined }}>📡 DETECTION</span>
              <span>{Math.round(hud.detection * 100)}%</span>
            </div>
            <div className="bar detect">
              <div style={{ width: `${hud.detection * 100}%` }} />
            </div>
          </div>
        )}
        <div className="flight-nums">
          <span>
            SPD <b>{Math.round(hud.speed)}</b> m/s
          </span>
          <span>
            ALT <b>{Math.round(hud.alt)}</b> m
          </span>
        </div>
      </div>

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
