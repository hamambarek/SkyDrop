import { useRef, useState } from 'react'
import { IS_TOUCH } from '../game/device'
import { runtime } from '../game/runtime'

// Twin virtual sticks for touch devices.
// Left stick: forward/strafe. Right stick: yaw (x) + altitude (y).

interface StickState {
  active: boolean
  ox: number // origin
  oy: number
  x: number // knob
  y: number
}

const idle: StickState = { active: false, ox: 0, oy: 0, x: 0, y: 0 }

function useStick(onMove: (nx: number, ny: number) => void, onEnd: () => void) {
  const [stick, setStick] = useState<StickState>(idle)
  const pointerId = useRef<number | null>(null)

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (pointerId.current != null) return
      pointerId.current = e.pointerId
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      runtime.touchActive = true
      setStick({ active: true, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY })
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerId !== pointerId.current) return
      setStick(s => {
        if (!s.active) return s
        const max = 52
        let dx = e.clientX - s.ox
        let dy = e.clientY - s.oy
        const d = Math.hypot(dx, dy)
        if (d > max) {
          dx = (dx / d) * max
          dy = (dy / d) * max
        }
        onMove(dx / max, dy / max)
        return { ...s, x: s.ox + dx, y: s.oy + dy }
      })
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerId !== pointerId.current) return
      pointerId.current = null
      onEnd()
      setStick(idle)
    },
    onPointerCancel: (e: React.PointerEvent) => {
      if (e.pointerId !== pointerId.current) return
      pointerId.current = null
      onEnd()
      setStick(idle)
    },
  }
  return { stick, handlers }
}

export function TouchControls() {
  const left = useStick(
    (nx, ny) => {
      runtime.input.strafe = nx
      runtime.input.forward = -ny
    },
    () => {
      runtime.input.strafe = 0
      runtime.input.forward = 0
    }
  )
  const right = useStick(
    (nx, ny) => {
      runtime.input.yaw = nx
      runtime.input.lift = -ny
    },
    () => {
      runtime.input.yaw = 0
      runtime.input.lift = 0
    }
  )

  if (!IS_TOUCH) return null

  return (
    <>
      <div className="touch-zone left" {...left.handlers}>
        {left.stick.active && (
          <>
            <div className="stick-base" style={{ left: left.stick.ox, top: left.stick.oy }} />
            <div className="stick-knob" style={{ left: left.stick.x, top: left.stick.y }} />
          </>
        )}
        <div className="stick-hint">MOVE</div>
      </div>
      <div className="touch-zone right" {...right.handlers}>
        {right.stick.active && (
          <>
            <div className="stick-base" style={{ left: right.stick.ox, top: right.stick.oy }} />
            <div className="stick-knob" style={{ left: right.stick.x, top: right.stick.y }} />
          </>
        )}
        <div className="stick-hint">TURN · ALTITUDE</div>
      </div>
    </>
  )
}
