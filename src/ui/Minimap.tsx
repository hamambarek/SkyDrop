import { useEffect, useRef, useState } from 'react'
import { CITY, patrolPos } from '../game/city'
import { DISTRICTS, WORLD_HALF } from '../game/constants'
import { runtime } from '../game/runtime'
import { currentTarget, useGame } from '../state/store'

// Tactical minimap: a static base layer (buildings, pads, no-fly, rings)
// rendered once to an offscreen canvas, plus a live overlay (drone, target,
// patrols, chain stops) blitted at ~20Hz. Click or press M to toggle zoom.

const BASE_PX = 1024
const WORLD_SPAN = (WORLD_HALF + 40) * 2

let baseCanvas: HTMLCanvasElement | null = null

function worldToBase(x: number) {
  return ((x + WORLD_SPAN / 2) / WORLD_SPAN) * BASE_PX
}

function buildBaseMap(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = BASE_PX
  c.height = BASE_PX
  const g = c.getContext('2d')!
  g.fillStyle = '#06070d'
  g.fillRect(0, 0, BASE_PX, BASE_PX)

  const s = BASE_PX / WORLD_SPAN

  // district-tinted building footprints
  for (const b of CITY.buildings) {
    const neon = DISTRICTS[b.district].neon
    g.fillStyle = neon + (b.baseY > 0 ? '30' : '55') // elevated structures fainter
    g.fillRect(worldToBase(b.x - b.w / 2), worldToBase(b.z - b.d / 2), b.w * s, b.d * s)
  }

  // no-fly zones
  for (const nf of CITY.noFly) {
    g.fillStyle = 'rgba(255, 34, 68, 0.18)'
    g.strokeStyle = 'rgba(255, 34, 68, 0.6)'
    g.lineWidth = 1.5
    g.beginPath()
    g.arc(worldToBase(nf.x), worldToBase(nf.z), nf.radius * s, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }

  // landing pads
  g.fillStyle = '#2bffc8'
  for (const p of CITY.pads) {
    g.beginPath()
    g.arc(worldToBase(p.x), worldToBase(p.z), 2.2, 0, Math.PI * 2)
    g.fill()
  }

  // boost rings
  g.fillStyle = '#41d9ff'
  for (const r of CITY.rings) {
    g.beginPath()
    g.arc(worldToBase(r.x), worldToBase(r.z), 2.6, 0, Math.PI * 2)
    g.fill()
  }

  return c
}

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoomed, setZoomed] = useState(true)
  const zoomedRef = useRef(true)
  useEffect(() => {
    zoomedRef.current = zoomed
  }, [zoomed])

  // M key toggles zoom (respects custom bindings)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const codes = useGame.getState().controls.minimap
      if (codes.includes(e.code)) setZoomed(z => !z)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!baseCanvas) baseCanvas = buildBaseMap()
    const canvas = canvasRef.current
    if (!canvas) return
    const SIZE = 300 // internal px (CSS scales down)
    canvas.width = SIZE
    canvas.height = SIZE
    const g = canvas.getContext('2d')!
    let raf = 0
    let last = 0

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 50) return // ~20Hz
      last = now

      const st = useGame.getState()
      const target = currentTarget(st)
      const px = runtime.pos.x
      const pz = runtime.pos.z

      // view: zoomed = 380m span centered on drone; full = whole world
      const span = zoomedRef.current ? 380 : WORLD_SPAN
      const scale = SIZE / span // px per meter
      const baseScale = (scale * WORLD_SPAN) / BASE_PX
      const cx = zoomedRef.current ? px : 0
      const cz = zoomedRef.current ? pz : 0
      const toPx = (x: number) => (x - cx) * scale + SIZE / 2
      const toPy = (z: number) => (z - cz) * scale + SIZE / 2

      g.clearRect(0, 0, SIZE, SIZE)
      g.save()
      // circular mask
      g.beginPath()
      g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2)
      g.clip()
      g.fillStyle = '#06070d'
      g.fillRect(0, 0, SIZE, SIZE)

      // base layer
      g.drawImage(
        baseCanvas!,
        toPx(-WORLD_SPAN / 2),
        toPy(-WORLD_SPAN / 2),
        BASE_PX * baseScale,
        BASE_PX * baseScale
      )

      const t = now / 1000

      // patrol scanners
      for (const p of CITY.patrols) {
        const clock = st.activeMission ? runtime.missionClock : t
        const pos = patrolPos(p, clock)
        const x = toPx(pos.x)
        const y = toPy(pos.z)
        if (x < -20 || x > SIZE + 20 || y < -20 || y > SIZE + 20) continue
        g.fillStyle = 'rgba(255, 61, 94, 0.15)'
        g.beginPath()
        g.arc(x, y, p.detectR * scale, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#ff3d5e'
        g.beginPath()
        g.arc(x, y, 2.5, 0, Math.PI * 2)
        g.fill()
      }

      // mission target + upcoming stops
      if (target) {
        const tx = toPx(target[0])
        const ty = toPy(target[2])
        // guide line
        g.strokeStyle = 'rgba(43, 255, 200, 0.5)'
        g.lineWidth = 1.5
        g.setLineDash([4, 4])
        g.beginPath()
        g.moveTo(toPx(px), toPy(pz))
        g.lineTo(tx, ty)
        g.stroke()
        g.setLineDash([])
        // pulsing target dot
        const pulse = 4 + Math.sin(t * 5) * 1.5
        g.strokeStyle = st.phase === 'toPickup' ? '#39c2ff' : '#2bffc8'
        g.lineWidth = 2
        g.beginPath()
        g.arc(tx, ty, pulse, 0, Math.PI * 2)
        g.stroke()

        const m = st.activeMission
        if (m && st.phase === 'toStop') {
          g.fillStyle = 'rgba(43, 255, 200, 0.6)'
          m.stops.forEach((s, i) => {
            if (i > st.stopIndex) {
              g.beginPath()
              g.arc(toPx(s[0]), toPy(s[2]), 3, 0, Math.PI * 2)
              g.fill()
            }
          })
        }
      }

      // player drone: triangle pointing along heading
      const dx = Math.sin(runtime.yaw)
      const dz = Math.cos(runtime.yaw)
      const ang = Math.atan2(dx, -dz)
      g.save()
      g.translate(toPx(px), toPy(pz))
      g.rotate(ang)
      g.fillStyle = '#ffffff'
      g.shadowColor = '#39c2ff'
      g.shadowBlur = 8
      g.beginPath()
      g.moveTo(0, -7)
      g.lineTo(5, 6)
      g.lineTo(0, 3)
      g.lineTo(-5, 6)
      g.closePath()
      g.fill()
      g.restore()

      g.restore()

      // rim
      g.strokeStyle = 'rgba(57, 194, 255, 0.55)'
      g.lineWidth = 2
      g.beginPath()
      g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2)
      g.stroke()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="minimap" onClick={() => setZoomed(z => !z)} title="Click or press M to toggle zoom">
      <canvas ref={canvasRef} />
      <span className="minimap-mode">{zoomed ? 'LOCAL' : 'CITY'}</span>
      <span className="minimap-n">N</span>
    </div>
  )
}
