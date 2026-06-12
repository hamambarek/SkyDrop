import { useEffect, useState } from 'react'
import { ACHIEVEMENTS } from '../game/achievements'
import { api, type LeaderboardRow } from '../game/api'
import { ACTIONS, keyLabel, type ActionId } from '../game/bindings'
import { DISTRICTS, levelFromXp, UPGRADES } from '../game/constants'
import {
  BUNDLES, CLASS_ICON, CLASS_LABEL, DRONES, EXPANSIONS, FOUNDER_PACK, GEM_PACKS,
  RARITY_LABEL, SEASON, SKINS, TRAILS, type Currency, type DroneStats, type Rarity,
} from '../game/cosmetics'
import { FACTION_LIST, repTier, REP_TIERS } from '../game/factions'
import { generateDailies, generateElites, generateOffers, storyToMission, todayKey, weekKey, type Mission } from '../game/missions'
import { CHAPTERS } from '../game/story'
import { THEME_LIST } from '../game/themes'
import { fmtMs, TRIALS, trialToMission } from '../game/trials'
import { droneById } from '../game/cosmetics'
import { unlockedDistricts, useGame } from '../state/store'

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  const setPanel = useGame(s => s.setPanel)
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setPanel(null)}>
      <div className="sheet">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="x-btn" onClick={() => setPanel(null)}>✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

// ---------------- Contracts ----------------

const TYPE_TAG: Record<string, string> = {
  daily: 'daily', express: 'express', fragile: 'fragile', heavy: 'heavy',
  stealth: 'stealth', storm: 'storm', chain: 'chain', standard: 'standard', story: 'story',
}

function MissionCard({ m, done, elite }: { m: Mission; done?: boolean; elite?: boolean }) {
  const openPreview = useGame(s => s.openPreview)
  const tagClass = m.daily ? 'daily' : TYPE_TAG[m.type] ?? 'standard'
  return (
    <div className={`card mission-card mc-${TYPE_TAG[m.type] ?? 'standard'} ${elite ? 'elite-card' : ''}`}>
      <div className="row">
        <h3>{m.title}</h3>
        <span className={`tag ${tagClass}`}>{m.daily ? 'daily' : m.type}</span>
      </div>
      <p>{m.brief}</p>
      <div className="meta">
        <span className="tag">{DISTRICTS[m.district].name}</span>
        <span className="tag heavy">{m.cargoWeight}kg</span>
        {m.stops.length > 1 && <span className="tag chain">{m.stops.length} stops</span>}
        {m.timeLimit && <span className="tag express">⏱ {m.timeLimit}s</span>}
      </div>
      <div className="row">
        <span className="reward">
          ¢{m.reward.toLocaleString()} · {m.xp} XP
        </span>
        <button className="btn small" disabled={done} onClick={() => openPreview(m)}>
          {done ? 'Done ✓' : 'Details'}
        </button>
      </div>
    </div>
  )
}

function ContractsPanel() {
  const unlockedCh = useGame(s => s.unlockedChapters)
  const xp = useGame(s => s.xp)
  const dailyDone = useGame(s => s.dailyDone)
  const districts = unlockedDistricts(unlockedCh)
  const level = levelFromXp(xp).level

  const [board, setBoard] = useState<{ offers: Mission[]; dailies: Mission[]; elites: Mission[]; dateKey: string }>({
    offers: [],
    dailies: [],
    elites: [],
    dateKey: '',
  })
  useEffect(() => {
    // the board is derived from wall-clock time (rotating epoch), which must not be read during render
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBoard({
      offers: generateOffers(districts, level, Math.floor(Date.now() / 300_000)),
      dailies: generateDailies(districts, level, todayKey()),
      elites: generateElites(districts, level, weekKey()),
      dateKey: todayKey(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedCh])
  const { offers, dailies, elites } = board
  const doneToday = dailyDone[board.dateKey] ?? []
  const allDone = Object.values(dailyDone).flat()

  return (
    <Sheet title="📋 Contracts">
      <div className="shop-section">
        <h3 style={{ color: 'var(--gold)' }}>⚜ Elite contracts — weekly rotation, double pay, no mercy</h3>
        <div className="card-grid">
          {elites.map(m => (
            <MissionCard key={m.id} m={m} done={allDone.includes(m.id)} elite />
          ))}
        </div>
      </div>
      <div className="shop-section">
        <h3>Daily contracts — bonus pay, refresh at midnight</h3>
        <div className="card-grid">
          {dailies.map(m => (
            <MissionCard key={m.id} m={m} done={doneToday.includes(m.id)} />
          ))}
        </div>
      </div>
      <div className="shop-section">
        <h3>Open contracts — board refreshes every few minutes</h3>
        <div className="card-grid">
          {offers.map(m => (
            <MissionCard key={m.id} m={m} />
          ))}
        </div>
      </div>
    </Sheet>
  )
}

// ---------------- Story ----------------

function StoryPanel() {
  const completedStory = useGame(s => s.completedStory)
  const unlockedCh = useGame(s => s.unlockedChapters)
  const openPreview = useGame(s => s.openPreview)

  return (
    <Sheet title="📖 Story — all chapters free, forever">
      {CHAPTERS.map(ch => {
        const locked = ch.id > unlockedCh
        const next = ch.missions.find(m => !completedStory.includes(m.id))
        return (
          <div key={ch.id} className={`chapter-block ${locked ? 'locked' : ''}`}>
            <div className="chapter-head">
              <h3>
                Chapter {ch.id}: {ch.title}
              </h3>
              <span className="tagline">{ch.tagline}</span>
            </div>
            <span className="tag story">{DISTRICTS[ch.unlocks].name}</span>{' '}
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{DISTRICTS[ch.unlocks].blurb}</span>
            <div className="story-missions">
              {ch.missions.map(m => {
                const done = completedStory.includes(m.id)
                const isNext = !locked && next?.id === m.id
                return (
                  <div key={m.id} className={`story-mission ${done ? 'done' : ''} ${isNext ? 'next' : ''}`}>
                    <span>
                      {done ? '✅' : isNext ? '▶' : '·'} {m.title}
                      {m.fragile && ' 🫧'}
                      {m.kind === 'stealth' && ' 🦇'}
                      {m.kind === 'storm' && ' ⛈'}
                      {m.kind === 'chain' && ' 🔗'}
                      {m.timeLimit && ' ⏱'}
                    </span>
                    {isNext ? (
                      <button className="btn small" onClick={() => openPreview(storyToMission(m, ch.id))}>
                        Fly — ¢{m.reward}
                      </button>
                    ) : (
                      <span className="reward">¢{m.reward}</span>
                    )}
                  </div>
                )
              })}
            </div>
            {locked && (
              <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-dim)' }}>
                🔒 Finish Chapter {ch.id - 1} to unlock.
              </p>
            )}
          </div>
        )
      })}
    </Sheet>
  )
}

// ---------------- Garage ----------------

function rarityCard(r: Rarity) {
  return `card rarity-card r-${r}`
}

function PriceButton({
  price, currency, owned, equipped, onBuy, onEquip,
}: {
  price: number
  currency: Currency
  owned: boolean
  equipped: boolean
  onBuy: () => void
  onEquip: () => void
}) {
  if (equipped) return <span className="equipped-mark">EQUIPPED</span>
  if (owned)
    return (
      <button className="btn small" onClick={onEquip}>
        Equip
      </button>
    )
  if (price < 0)
    return (
      <span style={{ fontSize: 12, color: 'var(--gold)' }}>Founder Pack exclusive</span>
    )
  return (
    <button className="btn small" onClick={onBuy}>
      {currency === 'gems' ? `💎 ${price}` : `¢ ${price.toLocaleString()}`}
    </button>
  )
}

const STAT_ROWS: { key: keyof DroneStats; label: string; invert?: boolean }[] = [
  { key: 'speed', label: 'SPD' },
  { key: 'agility', label: 'AGI' },
  { key: 'cargo', label: 'CRG' },
  { key: 'stability', label: 'STB' },
  { key: 'battery', label: 'BAT' },
  { key: 'detection', label: 'STL', invert: true },
]

function StatBars({ stats }: { stats: DroneStats }) {
  return (
    <div className="stat-bars">
      {STAT_ROWS.map(r => {
        const raw = stats[r.key]
        const v = r.invert ? 2 - raw : raw // lower detection = better stealth
        const pct = Math.round(Math.min(100, Math.max(6, ((v - 0.5) / 1.1) * 100)))
        return (
          <div key={r.key} className="stat-row">
            <span>{r.label}</span>
            <div className="stat-track">
              <div style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GaragePanel() {
  const upgrades = useGame(s => s.upgrades)
  const buyUpgrade = useGame(s => s.buyUpgrade)
  const credits = useGame(s => s.credits)
  const xp = useGame(s => s.xp)
  const owned = useGame(s => s.owned)
  const equipped = useGame(s => s.equipped)
  const equip = useGame(s => s.equip)
  const buyCosmetic = useGame(s => s.buyCosmetic)
  const buyDrone = useGame(s => s.buyDrone)
  const level = levelFromXp(xp).level

  return (
    <Sheet title="🛠 Garage">
      <div className="shop-section">
        <h3>Hangar — drone frames are earned with credits, never bought with gems</h3>
        <div className="card-grid">
          {DRONES.map(d => {
            const has = owned.includes(d.id)
            const lvlLocked = level < d.requiresLevel
            return (
              <div key={d.id} className={rarityCard(d.rarity)}>
                <div className="row">
                  <h3>
                    {CLASS_ICON[d.cls]} {d.name}
                  </h3>
                  <span className="rarity-chip">{RARITY_LABEL[d.rarity]}</span>
                </div>
                <span className="tag" style={{ alignSelf: 'flex-start' }}>{CLASS_LABEL[d.cls]} class</span>
                <p>
                  {d.desc}
                  {d.perk && (
                    <>
                      <br />
                      <em style={{ color: 'var(--mint)' }}>★ {d.perk}</em>
                    </>
                  )}
                </p>
                <StatBars stats={d.stats} />
                <div className="row">
                  {has ? (
                    equipped.model === d.id ? (
                      <span className="equipped-mark">EQUIPPED</span>
                    ) : (
                      <button className="btn small" onClick={() => equip('model', d.id)}>
                        Equip
                      </button>
                    )
                  ) : lvlLocked ? (
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>🔒 Pilot level {d.requiresLevel}</span>
                  ) : (
                    <button className="btn small" disabled={credits < d.price} onClick={() => buyDrone(d.id)}>
                      ¢ {d.price.toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="shop-section">
        <h3>Performance upgrades — apply to every frame you own</h3>
        <div className="card-grid">
          {UPGRADES.map(u => {
            const lvl = upgrades[u.id]
            const maxed = lvl >= u.maxLevel
            const cost = u.cost(lvl)
            return (
              <div key={u.id} className="card">
                <div className="row">
                  <h3>
                    {u.icon} {u.name}
                  </h3>
                  <div className="pips">
                    {Array.from({ length: u.maxLevel }, (_, i) => (
                      <div key={i} className={`pip ${i < lvl ? 'on' : ''}`} />
                    ))}
                  </div>
                </div>
                <p>
                  {u.desc} <em>{u.effect}</em>
                </p>
                <div className="row">
                  <span className="reward">{maxed ? 'MAXED' : `¢ ${cost.toLocaleString()}`}</span>
                  <button className="btn small" disabled={maxed || credits < cost} onClick={() => buyUpgrade(u.id)}>
                    {maxed ? '★' : 'Upgrade'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="shop-section">
        <h3>Drone skins — pure style, zero stats</h3>
        <div className="card-grid">
          {SKINS.map(s => (
            <div key={s.id} className={rarityCard(s.rarity)}>
              <div
                className="swatch"
                style={{
                  background: `linear-gradient(120deg, ${s.body} 55%, ${s.accent})`,
                  boxShadow: `0 0 ${s.glow * 6}px ${s.accent}66`,
                }}
              />
              <div className="row">
                <h3>{s.name}</h3>
                <span className="rarity-chip">
                  {RARITY_LABEL[s.rarity]}
                  {s.animated ? ' ✦' : ''}
                </span>
              </div>
              {s.flair && (
                <span className="tag" style={{ alignSelf: 'flex-start' }}>
                  {s.flair === 'wings' ? '🪽 holo wings' : s.flair === 'halo' ? '⭕ halo' : '🌀 particle aura'}
                </span>
              )}
              <div className="row">
                <PriceButton
                  price={s.price}
                  currency={s.currency}
                  owned={owned.includes(s.id)}
                  equipped={equipped.skin === s.id}
                  onBuy={() => buyCosmetic(s.id, s.price, s.currency)}
                  onEquip={() => equip('skin', s.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shop-section">
        <h3>Trails</h3>
        <div className="card-grid">
          {TRAILS.map(t => (
            <div key={t.id} className={rarityCard(t.rarity)}>
              <div
                className="swatch"
                style={{
                  background: t.rainbow
                    ? 'linear-gradient(90deg, #ff4d6d, #ffb13d, #2bffc8, #39c2ff, #b96bff)'
                    : `linear-gradient(90deg, transparent, ${t.color})`,
                  height: 22,
                }}
              />
              <div className="row">
                <h3>{t.name}</h3>
                <span className="rarity-chip">{RARITY_LABEL[t.rarity]}</span>
              </div>
              <div className="row">
                <PriceButton
                  price={t.price}
                  currency={t.currency}
                  owned={owned.includes(t.id)}
                  equipped={equipped.trail === t.id}
                  onBuy={() => buyCosmetic(t.id, t.price, t.currency)}
                  onEquip={() => equip('trail', t.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

// ---------------- Shop ----------------

function ShopPanel() {
  const buyGems = useGame(s => s.buyGems)
  const buyFounder = useGame(s => s.buyFounder)
  const buyBundle = useGame(s => s.buyBundle)
  const buyCosmetic = useGame(s => s.buyCosmetic)
  const founder = useGame(s => s.founder)
  const owned = useGame(s => s.owned)

  return (
    <Sheet title="💎 Supporter Shop">
      <div className="fairness-note">
        💚 <b>Fair-play promise:</b> everything here is cosmetic or extra content. All eight story chapters, every district,
        every drone frame and every upgrade are earnable free, forever. No pay-to-win. No lootboxes. (Demo build —
        purchases are simulated and charge nothing.)
      </div>

      <div className="shop-section">
        <h3>{SEASON.name} — limited cosmetics</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0 }}>{SEASON.endsNote}</p>
        <div className="card-grid">
          {SEASON.items.map(it => (
            <div key={it.id} className={rarityCard(it.rarity)}>
              <div className="row">
                <h3>✨ {it.name}</h3>
                <span className="rarity-chip">{RARITY_LABEL[it.rarity]}</span>
              </div>
              <p>{it.desc}</p>
              <div className="row">
                {owned.includes(it.grants) ? (
                  <span className="equipped-mark">OWNED</span>
                ) : (
                  <button className="btn small" onClick={() => buyCosmetic(it.grants, it.price, 'gems')}>
                    💎 {it.price}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shop-section">
        <h3>Founder pack</h3>
        <div className="card-grid">
          <div className="card founder-card">
            <h3>💙 {FOUNDER_PACK.name}</h3>
            <p>
              {FOUNDER_PACK.contents.map(c => (
                <span key={c}>
                  • {c}
                  <br />
                </span>
              ))}
            </p>
            <div className="row">
              <span className="price-usd">{FOUNDER_PACK.priceUsd}</span>
              <button className="btn small" disabled={founder} onClick={buyFounder}>
                {founder ? 'Owned 💙' : 'Support us'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="shop-section">
        <h3>City cosmetic packs — themed bundles</h3>
        <div className="card-grid">
          {BUNDLES.map(b => (
            <div key={b.id} className="card">
              <div className="row">
                <h3>🎁 {b.name}</h3>
                <span className="tag">{b.theme}</span>
              </div>
              <p>{b.desc}</p>
              <div className="row">
                <span className="price-usd">{b.priceUsd}</span>
                <button className="btn small" disabled={owned.includes(b.id)} onClick={() => buyBundle(b.id)}>
                  {owned.includes(b.id) ? 'Owned ✓' : 'Purchase'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shop-section">
        <h3>Gem packs — for epic, legendary &amp; mythic cosmetics</h3>
        <div className="card-grid">
          {GEM_PACKS.map(p => (
            <div key={p.id} className="card">
              <div className="row">
                <h3>💎 {p.name}</h3>
                {p.tag && <span className="tag daily">{p.tag}</span>}
              </div>
              <p>{p.gems} gems</p>
              <div className="row">
                <span className="price-usd">{p.priceUsd}</span>
                <button className="btn small" onClick={() => buyGems(p.id)}>
                  Purchase
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shop-section">
        <h3>Expansions &amp; side arcs — optional extra content</h3>
        <div className="card-grid">
          {EXPANSIONS.map(e => (
            <div key={e.id} className="card">
              <h3>{e.name}</h3>
              <p>{e.desc}</p>
              <div className="row">
                <span className="price-usd">{e.priceUsd}</span>
                <button className="btn small" disabled>
                  Coming soon
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

// ---------------- Factions ----------------

function FactionsPanel() {
  const reputation = useGame(s => s.reputation)
  return (
    <Sheet title="🤝 Factions">
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 0 }}>
        Every contract builds standing with its faction. Higher tiers pay a small loyalty bonus on that faction's
        contracts — earned in the air, never sold.
      </p>
      {FACTION_LIST.map(f => {
        const rep = reputation[f.id]
        const t = repTier(rep)
        return (
          <div key={f.id} className="faction-row" style={{ borderColor: `${f.color}44` }}>
            <span className="icon" style={{ fontSize: 26 }}>{f.icon}</span>
            <div style={{ flex: 1 }}>
              <div className="row">
                <h4 style={{ color: f.color }}>{f.name}</h4>
                <span className="rep-tier" style={{ color: f.color }}>
                  {t.tier.name}
                  {t.next && <span style={{ color: 'var(--text-dim)' }}> · {rep}/{t.next.at}</span>}
                </span>
              </div>
              <p>{f.desc}</p>
              <div className="bar" style={{ marginTop: 6 }}>
                <div style={{ width: `${Math.round(t.progress * 100)}%`, background: f.color }} />
              </div>
            </div>
          </div>
        )
      })}
      <p style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
        Tiers: {REP_TIERS.map(t => t.name).join(' → ')} · +5% faction pay per tier
      </p>
    </Sheet>
  )
}

// ---------------- Pilot Guide ----------------

function K({ code }: { code: string | null }) {
  return <kbd className="gk">{keyLabel(code)}</kbd>
}

function GuidePanel() {
  const c = useGame(s => s.controls)
  return (
    <Sheet title="📘 Pilot Guide">
      <div className="guide-grid">
        <div className="guide-block">
          <h3>🛸 Flight</h3>
          <ul>
            <li>
              <K code={c.moveForward[0]} />
              <K code={c.moveLeft[0]} />
              <K code={c.moveBack[0]} />
              <K code={c.moveRight[0]} /> — fly forward / strafe left / back / strafe right
            </li>
            <li>
              <K code={c.ascend[0]} /> climb · <K code={c.descend[0]} /> descend
            </li>
            <li>
              <K code={c.yawLeft[0]} /> turn left · <K code={c.yawRight[0]} /> turn right
            </li>
            <li>Landing on the ground is always safe — only fast impacts with buildings destroy the drone.</li>
          </ul>
        </div>

        <div className="guide-block">
          <h3>⚡ Boost &amp; Brake</h3>
          <ul>
            <li>
              <K code={c.boost[0]} /> or <K code={c.boost[1]} /> — <b>boost</b>: +50% top speed, drains extra battery. Watch
              the rear thrusters glow.
            </li>
            <li>
              <K code={c.brake[0]} /> or <K code={c.brake[1]} /> — <b>air brake</b>: hard deceleration for tight landings and
              dodges.
            </li>
            <li>Cyan boost rings in Vela Business Core fling you forward for free — chain them on express runs.</li>
          </ul>
        </div>

        <div className="guide-block">
          <h3>🎥 Camera &amp; HUD</h3>
          <ul>
            <li>
              <K code={c.cameraToggle[0]} /> — cycle camera: <b>chase</b> (default) → <b>near</b> (close action cam) →{' '}
              <b>top</b> (overhead navigation).
            </li>
            <li>
              <K code={c.minimap[0]} /> or click the minimap — toggle <b>LOCAL</b> (380m radar) / <b>CITY</b> (whole map).
            </li>
            <li>
              <K code={c.pause[0]} /> / <K code={c.pause[1]} /> — pause. The ⏸ 🎥 🗺 buttons top-right do the same by mouse.
            </li>
            <li>Top tape = compass heading. Console gauge = artificial horizon (your tilt). Mint edge arrow = target is off-screen; follow it.</li>
          </ul>
        </div>

        <div className="guide-block">
          <h3>📦 Deliveries</h3>
          <ul>
            <li>Follow the light pillar (blue = pickup, mint = drop-off). <b>Hover inside it, slow,</b> for ~1.5s to grab or deliver.</li>
            <li>Chain contracts have several numbered drops — the next one lights up after each delivery.</li>
            <li>Bonuses stack: perfect flight (no crash), early delivery, weather hazard pay, faction standing, 🔥 streak.</li>
            <li>Fragile cargo dies in any crash. Timed contracts fail at 0s. You can always retry.</li>
          </ul>
        </div>

        <div className="guide-block">
          <h3>🔋 Energy</h3>
          <ul>
            <li>Land on a glowing pad ring (ground or rooftop) and stay still to recharge.</li>
            <li>Red cylinders are <b>no-fly zones</b> — security jamming drains your battery fast inside them.</li>
            <li>Ion storms slowly drain charge (Storm Plating upgrade and the Aether frame resist it).</li>
            <li>Battery empty = forced descent, then a slow emergency trickle. You are never hard-stuck.</li>
          </ul>
        </div>

        <div className="guide-block">
          <h3>🦇 Stealth &amp; Patrols</h3>
          <ul>
            <li>Red drones with glowing scan fields patrol the Subgrid and Halcyon Secure Zone.</li>
            <li>On <b>stealth contracts</b>, time inside a scan fills the 📡 meter — full meter burns the contract.</li>
            <li>The meter decays once you break contact. Stealth-class frames (Manta, Umbra) are scanned far slower.</li>
          </ul>
        </div>

        <div className="guide-block">
          <h3>⏱ Time Trials</h3>
          <ul>
            <li>Fixed courses, one per district, each requiring a specific frame — same route for every pilot in the world.</li>
            <li>The clock is the score: your best time posts to the global leaderboard (log in to compete).</li>
          </ul>
        </div>

        <div className="guide-block">
          <h3>🎮 Gamepad &amp; Touch</h3>
          <ul>
            <li>Gamepad: left stick fly · right stick turn + altitude · A/B up/down · triggers boost/brake.</li>
            <li>Touch: left half = move stick, right half = turn &amp; altitude stick.</li>
            <li>Every keyboard/mouse binding is remappable in Settings → Controls.</li>
          </ul>
        </div>
      </div>
    </Sheet>
  )
}

// ---------------- Time Trials ----------------

function TrialsPanel() {
  const owned = useGame(s => s.owned)
  const trialBest = useGame(s => s.trialBest)
  const equip = useGame(s => s.equip)
  const startMission = useGame(s => s.startMission)
  const authToken = useGame(s => s.authToken)
  const authUser = useGame(s => s.authUser)
  const setPanel = useGame(s => s.setPanel)
  const toast = useGame(s => s.toast)
  const [boards, setBoards] = useState<Record<string, { username: string; ms: number }[]>>({})
  const [mine, setMine] = useState<Record<string, number>>({})

  useEffect(() => {
    api
      .trialSummary(authToken)
      .then(r => {
        setBoards(r.boards)
        if (r.mine) setMine(r.mine)
      })
      .catch(() => {})
  }, [authToken])

  const launch = (trialId: string) => {
    const def = TRIALS.find(t => t.id === trialId)!
    if (!owned.includes(def.drone)) {
      toast(`Requires the ${droneById(def.drone).name} — earn it in the Garage`, 'bad')
      return
    }
    equip('model', def.drone)
    startMission(trialToMission(def))
  }

  return (
    <Sheet title="⏱ Time Trials — fixed courses, global clocks">
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 0 }}>
        Every pilot flies the identical route on the required frame. Fastest time owns the board.
        {!authUser && (
          <>
            {' '}
            <button className="btn small" style={{ marginLeft: 6 }} onClick={() => setPanel('account')}>
              Log in to compete globally
            </button>
          </>
        )}
      </p>
      <div className="card-grid trials-grid">
        {TRIALS.map(t => {
          const drone = droneById(t.drone)
          const hasDrone = owned.includes(t.drone)
          const localBest = trialBest[t.id]
          const cloudBest = mine[t.id]
          const best = cloudBest !== undefined && (localBest === undefined || cloudBest < localBest) ? cloudBest : localBest
          const top = boards[t.id] ?? []
          return (
            <div key={t.id} className="card trial-card">
              <div className="row">
                <h3>⏱ {t.name}</h3>
                <span className="tag">{DISTRICTS[t.district].name}</span>
              </div>
              <p>{t.desc}</p>
              <div className="meta">
                <span className={`tag ${hasDrone ? 'story' : 'fragile'}`}>🚁 {drone.name}</span>
                {t.modifiers.map(m => (
                  <span key={m} className="tag heavy">{m}</span>
                ))}
              </div>
              <div className="trial-board">
                {top.length === 0 && <span className="trial-empty">No times yet — set the first record</span>}
                {top.map((r, i) => (
                  <div key={r.username} className={`trial-row ${r.username === authUser ? 'me' : ''}`}>
                    <span>{['🥇', '🥈', '🥉'][i]}</span>
                    <span className="trial-name">{r.username}</span>
                    <span className="trial-time">{fmtMs(r.ms)}</span>
                  </div>
                ))}
              </div>
              <div className="row">
                <span className="reward">{best !== undefined ? `Your best: ${fmtMs(best)}` : 'Not yet flown'}</span>
                <button className="btn small" onClick={() => launch(t.id)} disabled={!hasDrone}>
                  {hasDrone ? '▶ Race' : '🔒 Need frame'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

// ---------------- Account ----------------

function AccountPanel() {
  const authUser = useGame(s => s.authUser)
  const authBusy = useGame(s => s.authBusy)
  const syncStatus = useGame(s => s.syncStatus)
  const registerAccount = useGame(s => s.registerAccount)
  const loginAccount = useGame(s => s.loginAccount)
  const logout = useGame(s => s.logout)
  const syncNow = useGame(s => s.syncNow)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') await loginAccount(username, password)
      else await registerAccount(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (authUser) {
    return (
      <Sheet title="👤 Pilot Account">
        <div className="account-card">
          <h3 style={{ fontSize: 20 }}>☁️ {authUser}</h3>
          <p style={{ color: 'var(--text-dim)' }}>
            Progress, cosmetics, reputation and controls sync to the cloud automatically a few seconds after anything
            changes — log in on any device to continue your empire.
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 12 }}>
            Sync status:{' '}
            <span style={{ color: syncStatus === 'error' ? 'var(--red)' : 'var(--mint)' }}>
              {syncStatus === 'synced' ? '✓ synced' : syncStatus === 'syncing' ? '… syncing' : syncStatus === 'error' ? '⚠ offline — will retry' : 'idle'}
            </span>
          </p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <button className="btn small" onClick={() => void syncNow()}>
              ☁ Sync now
            </button>
            <button className="btn small ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="👤 Pilot Account">
      <div className="account-card">
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginBottom: 14 }}>
          <button className={`btn small ${mode === 'login' ? '' : 'ghost'}`} onClick={() => setMode('login')}>
            Log in
          </button>
          <button className={`btn small ${mode === 'register' ? '' : 'ghost'}`} onClick={() => setMode('register')}>
            Create account
          </button>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 0 }}>
          {mode === 'register'
            ? 'Pick a callsign and your local progress becomes a cloud save — playable from any device.'
            : 'Log in to restore your cloud save. Your progress follows you everywhere.'}
        </p>
        <form onSubmit={submit} className="account-form">
          <label>
            Callsign
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="sky_pilot"
              autoComplete="username"
              maxLength={20}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>
          {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
          <button className="btn primary" style={{ fontSize: 14, padding: '12px 28px' }} disabled={authBusy}>
            {authBusy ? '…' : mode === 'login' ? '▶ Log in' : '▶ Create & sync'}
          </button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Playing without an account keeps your progress in this browser only.
        </p>
      </div>
    </Sheet>
  )
}

// ---------------- Achievements + Leaderboard ----------------

function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const authUser = useGame(s => s.authUser)
  useEffect(() => {
    api
      .leaderboard()
       
      .then(r => setRows(r.leaderboard))
      .catch(() => setFailed(true))
  }, [])
  if (failed) return null
  return (
    <div className="shop-section">
      <h3>🌐 Global leaderboard — top pilots by XP</h3>
      {!rows ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No pilots yet — create an account and claim #1.</p>
      ) : (
        <div className="lb-table">
          {rows.map((r, i) => (
            <div key={r.username} className={`lb-row ${r.username === authUser ? 'me' : ''}`}>
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-name">
                {i === 0 ? '👑 ' : ''}
                {r.username}
              </span>
              <span className="lb-stat">LV {levelFromXp(r.xp).level}</span>
              <span className="lb-stat">{r.deliveries} drops</span>
              <span className="lb-stat reward">¢{r.credits_earned.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AchievementsPanel() {
  const unlocked = useGame(s => s.achievementsUnlocked)
  const stats = useGame(s => s.stats)
  return (
    <Sheet title={`🏅 Records — ${unlocked.length}/${ACHIEVEMENTS.length}`}>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 0 }}>
        {stats.deliveries} deliveries · {(stats.distanceFlown / 1000).toFixed(1)} km flown · ¢
        {stats.creditsEarned.toLocaleString()} earned · {stats.crashes} crashes · {stats.ringsHit} rings
      </p>
      <Leaderboard />
      {ACHIEVEMENTS.map(a => {
        const has = unlocked.includes(a.id)
        return (
          <div key={a.id} className={`ach-row ${has ? '' : 'locked'}`}>
            <span className="icon">{a.icon}</span>
            <div>
              <h4>{a.name}</h4>
              <p>{a.desc}</p>
            </div>
          </div>
        )
      })}
    </Sheet>
  )
}

// ---------------- Settings + Controls ----------------

function BindingButton({
  action, slot, listening, onListen,
}: {
  action: ActionId
  slot: 0 | 1
  listening: boolean
  onListen: () => void
}) {
  const controls = useGame(s => s.controls)
  const code = controls[action][slot]
  return (
    <button className={`bind-btn ${listening ? 'listening' : ''}`} onClick={onListen}>
      {listening ? 'press a key…' : keyLabel(code)}
    </button>
  )
}

function ControlsSection() {
  const setBinding = useGame(s => s.setBinding)
  const resetBindings = useGame(s => s.resetBindings)
  const [listening, setListening] = useState<{ action: ActionId; slot: 0 | 1 } | null>(null)

  useEffect(() => {
    if (!listening) return
    const finish = (code: string | null) => {
      if (code) setBinding(listening.action, listening.slot, code)
      setListening(null)
    }
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') finish(null)
      else if (e.code === 'Backspace' || e.code === 'Delete') {
        setBinding(listening.action, listening.slot, null)
        setListening(null)
      } else finish(e.code)
    }
    const onMouse = (e: MouseEvent) => {
      // ignore the click that opened the listener (capture phase guards via timeout below)
      e.preventDefault()
      e.stopPropagation()
      finish(`Mouse${e.button}`)
    }
    const onCtx = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('keydown', onKey, true)
    const t = setTimeout(() => {
      window.addEventListener('mousedown', onMouse, true)
      window.addEventListener('contextmenu', onCtx, true)
    }, 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onMouse, true)
      window.removeEventListener('contextmenu', onCtx, true)
    }
  }, [listening, setBinding])

  return (
    <div className="shop-section">
      <div className="row" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Controls — click a slot, press any key or mouse button</h3>
        <button className="btn small ghost" onClick={resetBindings}>
          ↺ Reset to defaults
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 0 }}>
        Two slots per action. BACKSPACE clears a slot, ESC cancels. Conflicting keys are automatically moved.
        Gamepad: left stick fly · right stick turn/altitude · A/B up/down · triggers boost/brake.
      </p>
      <div className="bind-table">
        {ACTIONS.map((a, i) => {
          const header = a.group !== ACTIONS[i - 1]?.group ? a.group : null
          return (
            <div key={a.id}>
              {header && <div className="bind-group">{header}</div>}
              <div className="bind-row">
                <span className="bind-label">{a.label}</span>
                {([0, 1] as const).map(slot => (
                  <BindingButton
                    key={slot}
                    action={a.id}
                    slot={slot}
                    listening={listening?.action === a.id && listening?.slot === slot}
                    onListen={() => setListening({ action: a.id, slot })}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ThemeChip({ id, name, icon, preview }: { id: string; name: string; icon: string; preview: string }) {
  const theme = useGame(s => s.theme)
  const setTheme = useGame(s => s.setTheme)
  const active = theme === id
  return (
    <button className={`theme-chip ${active ? 'active' : ''}`} onClick={() => setTheme(id as typeof theme)}>
      <span className="theme-swatch" style={{ background: preview }} />
      <span>
        {icon} {name}
      </span>
    </button>
  )
}

function SettingsPanel() {
  const muted = useGame(s => s.muted)
  const toggleMute = useGame(s => s.toggleMute)
  const quality = useGame(s => s.quality)
  const setQuality = useGame(s => s.setQuality)
  const resetSave = useGame(s => s.resetSave)
  const setPanel = useGame(s => s.setPanel)

  return (
    <Sheet title="⚙ Settings">
      <div className="shop-section">
        <h3>Time of day — relights the whole city</h3>
        <div className="theme-row">
          {THEME_LIST.map(t => (
            <ThemeChip key={t.id} id={t.id} name={t.name} icon={t.icon} preview={t.preview} />
          ))}
        </div>
      </div>
      <ControlsSection />
      <div className="shop-section">
        <h3>General</h3>
        <div className="card-grid">
          <div className="card">
            <h3>Sound</h3>
            <p>Synthesized SFX for pickups, deliveries and warnings.</p>
            <button className="btn small" onClick={toggleMute}>
              {muted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
          </div>
          <div className="card">
            <h3>Graphics</h3>
            <p>Low disables bloom and renders at native-1x for older devices.</p>
            <button className="btn small" onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}>
              Quality: {quality === 'high' ? '✨ High' : '⚡ Low'}
            </button>
          </div>
          <div className="card">
            <h3>Danger zone</h3>
            <p>Wipe all progress, cosmetics and credits.</p>
            <button
              className="btn small danger"
              onClick={() => {
                if (confirm('Really reset all SkyDrop progress?')) {
                  resetSave()
                  setPanel(null)
                }
              }}
            >
              Reset save
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}

// ---------------- switch ----------------

export function Panels() {
  const panel = useGame(s => s.panel)
  if (!panel) return null
  switch (panel) {
    case 'missions':
      return <ContractsPanel />
    case 'story':
      return <StoryPanel />
    case 'garage':
      return <GaragePanel />
    case 'shop':
      return <ShopPanel />
    case 'factions':
      return <FactionsPanel />
    case 'trials':
      return <TrialsPanel />
    case 'guide':
      return <GuidePanel />
    case 'account':
      return <AccountPanel />
    case 'achievements':
      return <AchievementsPanel />
    case 'settings':
      return <SettingsPanel />
    default:
      return null
  }
}
