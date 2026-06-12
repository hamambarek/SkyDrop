import { useEffect } from 'react'
import { DISTRICTS, WEATHERS } from '../game/constants'
import { FACTIONS } from '../game/factions'
import { runtime } from '../game/runtime'
import { CHAPTERS } from '../game/story'
import { fmtMs } from '../game/trials'
import { useGame } from '../state/store'

export function Toasts() {
  const toasts = useGame(s => s.toasts)
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

// ---------- mission preview (shown before launch) ----------

const TYPE_TIPS: Record<string, string> = {
  express: '⏱ Timed contract — boost rings and tailwinds are your friends.',
  fragile: '🫧 Fragile cargo — one crash while carrying and the contract fails.',
  heavy: '📦 Heavy lift — expect sluggish handling. Cargo-class frames shine here.',
  stealth: '🦇 Stealth run — stay out of the red scan fields. Full detection = burned contract.',
  storm: '⛈ Ion storm locked over the route. Hazard pay included; Storm Plating helps.',
  chain: '🔗 Multi-stop chain — deliver to each marked point in order.',
  daily: '📅 Daily contract — premium pay, once per day.',
  standard: '📦 Standard route. Fly safe, fly fast.',
  story: '📖 Story contract.',
}

export function MissionPreview() {
  const preview = useGame(s => s.preview)
  const closePreview = useGame(s => s.closePreview)
  const startMission = useGame(s => s.startMission)
  if (!preview) return null

  const d = DISTRICTS[preview.district]
  const faction = preview.faction ? FACTIONS[preview.faction] : null
  const weather = WEATHERS[runtime.weather]
  const routeLen = Math.round(
    [preview.pickup, ...preview.stops].reduce((acc, p, i, arr) => {
      if (i === 0) return 0
      const q = arr[i - 1]
      return acc + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    }, 0)
  )
  const tip = TYPE_TIPS[preview.storm ? 'storm' : preview.stealth ? 'stealth' : preview.type] ?? TYPE_TIPS.standard

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closePreview()}>
      <div className="sheet preview-sheet">
        <div className="sheet-head">
          <h2>Mission briefing</h2>
          <button className="x-btn" onClick={closePreview}>✕</button>
        </div>
        <div className="sheet-body">
          <h3 style={{ fontSize: 18, marginBottom: 6 }}>{preview.title}</h3>
          <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>{preview.brief}</p>

          <div className="preview-grid">
            <div className="preview-stat">
              <span>District</span>
              <b style={{ color: d.neon }}>{d.name}</b>
            </div>
            <div className="preview-stat">
              <span>Route</span>
              <b>{routeLen} m{preview.stops.length > 1 ? ` · ${preview.stops.length} stops` : ''}</b>
            </div>
            <div className="preview-stat">
              <span>Cargo</span>
              <b>{preview.cargoWeight} kg{preview.fragile ? ' · fragile' : ''}</b>
            </div>
            <div className="preview-stat">
              <span>Time limit</span>
              <b>{preview.timeLimit ? `${preview.timeLimit}s` : 'none'}</b>
            </div>
            <div className="preview-stat">
              <span>Weather now</span>
              <b>
                {preview.storm ? '⛈ Ion Storm (locked)' : `${weather.icon} ${weather.name}`}
              </b>
            </div>
            <div className="preview-stat">
              <span>Client</span>
              <b style={{ color: faction?.color }}>{faction ? `${faction.icon} ${faction.name}` : 'Private'}</b>
            </div>
          </div>

          <p className="preview-tip">{tip}</p>

          <div className="row" style={{ marginTop: 12 }}>
            <span className="reward" style={{ fontSize: 16 }}>
              ¢{preview.reward.toLocaleString()} · {preview.xp} XP
            </span>
            <button className="btn primary" style={{ fontSize: 15, padding: '12px 30px' }} onClick={() => startMission(preview)}>
              ▶ Launch
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ResultModal() {
  const result = useGame(s => s.result)
  const dismissResult = useGame(s => s.dismissResult)
  const setScreen = useGame(s => s.setScreen)
  const quickStart = useGame(s => s.quickStart)
  const startMission = useGame(s => s.startMission)
  if (!result) return null

  const toMenu = () => {
    dismissResult()
    setScreen('menu')
  }
  const repFaction = result.repGain ? FACTIONS[result.repGain.faction] : null

  return (
    <div className="modal-backdrop">
      <div className="sheet result-sheet">
        {result.success ? (
          <>
            <h2 className="win">{result.trialMs != null ? 'TRIAL COMPLETE' : 'DELIVERY COMPLETE'}</h2>
            {result.trialMs != null && (
              <div className="trial-result">
                <div className="trial-clock">{fmtMs(result.trialMs)}</div>
                {result.trialNewBest && <div className="level-up">🏁 NEW PERSONAL BEST</div>}
                {result.trialRank && (
                  <div style={{ color: 'var(--cyan)', fontFamily: 'var(--font-display)', fontSize: 14 }}>
                    🌐 GLOBAL RANK #{result.trialRank.rank} of {result.trialRank.total}
                  </div>
                )}
              </div>
            )}
            <div className="result-rewards">
              <span className="c">+¢{result.credits.toLocaleString()}</span>
              <span className="x">+{result.xp} XP</span>
            </div>
            {result.bonusText.length > 0 && (
              <div className="bonus-list">
                {result.bonusText.map(b => (
                  <span key={b}>{b}</span>
                ))}
              </div>
            )}
            {repFaction && (
              <div style={{ fontSize: 14, color: repFaction.color }}>
                {repFaction.icon} {repFaction.name} reputation +{result.repGain!.amount}
              </div>
            )}
            {result.leveledTo && <div className="level-up">⬆ LEVEL {result.leveledTo} REACHED</div>}
            {result.chapterCompleted && (
              <div className="level-up">
                🏆 CHAPTER {result.chapterCompleted} COMPLETE
                {result.chapterCompleted < CHAPTERS.length &&
                  ` — ${CHAPTERS[result.chapterCompleted].title.toUpperCase()} UNLOCKED`}
              </div>
            )}
            <div className="result-actions">
              <button
                className="btn primary"
                style={{ fontSize: 14, padding: '12px 26px' }}
                onClick={() => {
                  dismissResult()
                  quickStart()
                }}
              >
                ▶ Next mission
              </button>
              <button className="btn ghost" onClick={toMenu}>
                Menu
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="lose">CONTRACT FAILED</h2>
            <p style={{ color: 'var(--text-dim)', margin: 0 }}>{result.failReason}</p>
            <div className="result-actions">
              <button
                className="btn"
                onClick={() => {
                  dismissResult()
                  startMission(result.mission)
                }}
              >
                ↻ Retry
              </button>
              <button className="btn ghost" onClick={toMenu}>
                Menu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ChapterIntro() {
  const chapterIntro = useGame(s => s.chapterIntro)
  const closeIntro = useGame(s => s.closeIntro)
  if (chapterIntro == null) return null
  const ch = CHAPTERS.find(c => c.id === chapterIntro)
  if (!ch) return null
  return (
    <div className="modal-backdrop">
      <div className="sheet intro-sheet">
        <span className="ch-num">Chapter {ch.id}</span>
        <h2>{ch.title}</h2>
        {ch.intro.map((line, i) => (
          <p key={i} className="line">
            {line}
          </p>
        ))}
        <button className="btn primary" style={{ fontSize: 14, alignSelf: 'flex-start' }} onClick={closeIntro}>
          ▶ Take off
        </button>
      </div>
    </div>
  )
}

export function PauseMenu() {
  const paused = useGame(s => s.paused)
  const setPaused = useGame(s => s.setPaused)
  const abortMission = useGame(s => s.abortMission)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useGame.getState()
      const codes = st.controls.pause
      if (codes.includes(e.code)) {
        if (st.screen === 'game' && !st.result && st.chapterIntro == null && !st.preview) {
          st.setPaused(!st.paused)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!paused) return null
  return (
    <div className="modal-backdrop">
      <div className="sheet result-sheet">
        <h2>PAUSED</h2>
        <div className="result-actions">
          <button className="btn primary" style={{ fontSize: 14 }} onClick={() => setPaused(false)}>
            ▶ Resume
          </button>
          <button
            className="btn"
            onClick={() => {
              setPaused(false)
              useGame.getState().setPanel('guide')
            }}
          >
            📘 Pilot Guide
          </button>
          <button
            className="btn danger"
            onClick={() => {
              setPaused(false)
              abortMission()
            }}
          >
            Abandon mission
          </button>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>Pause key configurable in Settings → Controls</p>
      </div>
    </div>
  )
}
