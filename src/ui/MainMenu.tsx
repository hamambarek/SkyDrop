import { levelFromXp } from '../game/constants'
import { useGame } from '../state/store'

const NAV: { panel: 'missions' | 'story' | 'trials' | 'garage' | 'shop' | 'factions' | 'achievements' | 'guide'; icon: string; label: string; sub: string }[] = [
  { panel: 'missions', icon: '📋', label: 'Contracts', sub: 'Daily · elite · open board' },
  { panel: 'story', icon: '📖', label: 'Story', sub: '8 chapters, all free' },
  { panel: 'trials', icon: '⏱', label: 'Time Trials', sub: 'Global speed leaderboards' },
  { panel: 'garage', icon: '🛠', label: 'Garage', sub: 'Frames · upgrades · skins' },
  { panel: 'shop', icon: '💎', label: 'Shop', sub: 'Cosmetics, never power' },
  { panel: 'factions', icon: '🤝', label: 'Factions', sub: 'Reputation & standing' },
  { panel: 'achievements', icon: '🏅', label: 'Records', sub: 'Achievements · rankings' },
  { panel: 'guide', icon: '📘', label: 'Pilot Guide', sub: 'Every key & mechanic explained' },
]

export function MainMenu() {
  const quickStart = useGame(s => s.quickStart)
  const setPanel = useGame(s => s.setPanel)
  const credits = useGame(s => s.credits)
  const gems = useGame(s => s.gems)
  const xp = useGame(s => s.xp)
  const streak = useGame(s => s.streak)
  const deliveries = useGame(s => s.stats.deliveries)
  const founder = useGame(s => s.founder)
  const authUser = useGame(s => s.authUser)
  const unlockedChapters = useGame(s => s.unlockedChapters)
  const lvl = levelFromXp(xp)

  return (
    <div className="menu-root2">
      <div className="menu-rail">
        <div className="logo">
          <div className="sky">SKYDROP</div>
          <div className="sub">Drone Delivery Empire</div>
        </div>

        <button className="btn primary start-btn" onClick={quickStart}>
          ▶ Start Mission
        </button>

        <nav className="rail-nav">
          {NAV.map(n => (
            <button key={n.panel} className="rail-item" onClick={() => setPanel(n.panel)}>
              <span className="rail-icon">{n.icon}</span>
              <span className="rail-text">
                <b>{n.label}</b>
                <small>{n.sub}</small>
              </span>
              <span className="rail-arrow">›</span>
            </button>
          ))}
        </nav>

        <div className="pilot-card panel">
          <div className="pilot-head">
            <span className="pilot-name">
              {founder && '💙 '}
              {authUser ?? 'GUEST PILOT'}
            </span>
            <button className="btn small ghost" onClick={() => setPanel('account')}>
              {authUser ? '☁ synced' : 'Log in'}
            </button>
          </div>
          <div className="bar">
            <div style={{ width: `${Math.round((lvl.into / lvl.need) * 100)}%` }} />
          </div>
          <div className="pilot-stats">
            <span>
              LV <b>{lvl.level}</b>
            </span>
            <span>
              <b style={{ color: 'var(--gold)' }}>¢{credits.toLocaleString()}</b>
            </span>
            <span>
              <b style={{ color: 'var(--violet)' }}>💎{gems.toLocaleString()}</b>
            </span>
            {streak > 1 && (
              <span>
                <b style={{ color: '#ff9d2b' }}>🔥{streak}</b>
              </span>
            )}
            <span>
              {deliveries} <small>drops</small>
            </span>
            <span>
              CH <b>{unlockedChapters}</b>/8
            </span>
          </div>
        </div>

        <button className="rail-settings" onClick={() => setPanel('settings')}>
          ⚙ Settings · Controls · Themes
        </button>
      </div>

      <div className="version-chip">SKYDROP v2.6 · NEON TIDE</div>
      <div className="hint-keys hint-right">
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> fly · <kbd>SPACE</kbd>/<kbd>SHIFT</kbd> altitude · <kbd>F</kbd> boost · <kbd>V</kbd> camera ·{' '}
        <kbd>M</kbd> map — touch &amp; gamepad supported
      </div>
    </div>
  )
}
