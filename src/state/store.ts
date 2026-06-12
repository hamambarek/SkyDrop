import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ACHIEVEMENTS, EMPTY_STATS, type Stats } from '../game/achievements'
import { api, ApiError } from '../game/api'
import {
  DEFAULT_BINDINGS, findConflict, setLiveBindings, withDefaults,
  type ActionId, type Bindings,
} from '../game/bindings'
import { CITY, nearbyBuildings } from '../game/city'
import { levelFromXp, UPGRADES, WEATHERS, type DistrictId, type UpgradeId } from '../game/constants'
import {
  BUNDLES, DRONES, droneById, FOUNDER_PACK, GEM_PACKS, type Currency,
} from '../game/cosmetics'
import { FACTION_LIST, repPayBonus, type FactionId } from '../game/factions'
import { generateDailies, generateOffers, nextStoryMission, todayKey, type Mission } from '../game/missions'
import { resetTrialTrace, runtime, trialTrace } from '../game/runtime'
import { setMuted as setSfxMuted, sfx } from '../game/sfx'
import { CHAPTERS } from '../game/story'
import type { ThemeId } from '../game/themes'
import { fmtMs } from '../game/trials'

export type Screen = 'menu' | 'game'
export type MissionPhase = 'toPickup' | 'toStop'
export type Panel = null | 'missions' | 'story' | 'garage' | 'shop' | 'achievements' | 'settings' | 'factions' | 'account' | 'trials' | 'guide'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'good' | 'bad' | 'gold'
}

export interface MissionResult {
  success: boolean
  mission: Mission
  credits: number
  xp: number
  bonusText: string[]
  failReason?: string
  leveledTo?: number
  chapterCompleted?: number
  repGain?: { faction: FactionId; amount: number }
  trialMs?: number
  trialNewBest?: boolean
  trialRank?: { rank: number; total: number }
}

export interface DeliveryBurst {
  seq: number
  x: number
  y: number
  z: number
}

interface PlayerSlice {
  credits: number
  gems: number
  xp: number
  completedStory: string[]
  unlockedChapters: number
  seenIntros: number[]
  upgrades: Record<UpgradeId, number>
  owned: string[]
  equipped: { skin: string; trail: string; model: string }
  stats: Stats
  achievementsUnlocked: string[]
  dailyDone: Record<string, string[]>
  founder: boolean
  muted: boolean
  quality: 'high' | 'low'
  reputation: Record<FactionId, number>
  controls: Bindings
  streak: number // consecutive successful deliveries
  lastLoginBonus: string // dateKey of the last daily login bonus
  authToken: string | null
  authUser: string | null
  trialBest: Record<string, number> // trialId -> best ms (local)
  theme: ThemeId
}

interface SessionSlice {
  screen: Screen
  panel: Panel
  paused: boolean
  activeMission: Mission | null
  phase: MissionPhase
  stopIndex: number // current delivery stop (when phase === 'toStop')
  timeLeft: number | null
  result: MissionResult | null
  preview: Mission | null // mission preview sheet before launch
  toasts: Toast[]
  chapterIntro: number | null
  burst: DeliveryBurst | null // delivery success particle burst
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  authBusy: boolean
  trialNonce: string | null // server-issued run token for the active trial
  hud: {
    battery: number
    speed: number
    alt: number
    dist: number
    weather: string
    weatherIcon: string
    charging: boolean
    windSpeed: number
    windAngle: number // wind direction relative to drone heading (radians)
    detection: number
    boost: boolean
  }
  showTutorial: boolean
}

interface Actions {
  setScreen: (s: Screen) => void
  setPanel: (p: Panel) => void
  setPaused: (p: boolean) => void
  toast: (text: string, kind?: Toast['kind']) => void
  dismissResult: () => void
  closeIntro: () => void

  quickStart: () => void
  openPreview: (m: Mission) => void
  closePreview: () => void
  startMission: (m: Mission) => void
  abortMission: () => void
  onPickup: () => void
  onStopReached: () => void
  onCrash: () => void
  onDetected: () => void
  onRingHit: () => void
  failMission: (reason: string) => void
  claimLoginBonus: () => void
  tickMission: (dt: number, distanceDelta: number) => void
  syncHud: () => void
  checkAchievements: () => void

  buyUpgrade: (id: UpgradeId) => void
  buyCosmetic: (id: string, price: number, currency: Currency) => void
  buyDrone: (id: string) => void
  buyBundle: (id: string) => void
  equip: (slot: 'skin' | 'trail' | 'model', id: string) => void
  buyGems: (packId: string) => void
  buyFounder: () => void
  setBinding: (action: ActionId, slot: 0 | 1, code: string | null) => void
  resetBindings: () => void
  registerAccount: (username: string, password: string) => Promise<void>
  loginAccount: (username: string, password: string) => Promise<void>
  logout: () => void
  syncNow: () => Promise<void>
  toggleMute: () => void
  setQuality: (q: 'high' | 'low') => void
  setTheme: (t: ThemeId) => void
  resetSave: () => void
}

export type Store = PlayerSlice & SessionSlice & Actions

let toastId = 0
let burstSeq = 0

const initialPlayer: PlayerSlice = {
  credits: 250,
  gems: 40,
  xp: 0,
  completedStory: [],
  unlockedChapters: 1,
  seenIntros: [],
  upgrades: { battery: 0, motor: 0, handling: 0, cargo: 0, stability: 0, weather: 0 },
  owned: ['skin-courier', 'trail-ion', 'model-quad'],
  equipped: { skin: 'skin-courier', trail: 'trail-ion', model: 'model-quad' },
  stats: { ...EMPTY_STATS },
  achievementsUnlocked: [],
  dailyDone: {},
  founder: false,
  muted: false,
  quality: 'high',
  reputation: { union: 0, axiom: 0, syndicate: 0, civic: 0 },
  controls: { ...DEFAULT_BINDINGS },
  streak: 0,
  lastLoginBonus: '',
  authToken: null,
  authUser: null,
  trialBest: {},
  theme: 'night',
}

const initialSession: SessionSlice = {
  screen: 'menu',
  panel: null,
  paused: false,
  activeMission: null,
  phase: 'toPickup',
  stopIndex: 0,
  timeLeft: null,
  result: null,
  preview: null,
  toasts: [],
  chapterIntro: null,
  burst: null,
  syncStatus: 'idle',
  authBusy: false,
  trialNonce: null,
  hud: {
    battery: 100, speed: 0, alt: 0, dist: 0,
    weather: 'Clear Night', weatherIcon: '🌙', charging: false,
    windSpeed: 0, windAngle: 0, detection: 0, boost: false,
  },
  showTutorial: true,
}

export function unlockedDistricts(unlockedChapters: number): DistrictId[] {
  return CHAPTERS.filter(c => c.id <= unlockedChapters).map(c => c.unlocks)
}

export function chaptersDone(completedStory: string[]): number {
  let done = 0
  for (const ch of CHAPTERS) {
    if (ch.missions.every(m => completedStory.includes(m.id))) done++
    else break
  }
  return done
}

/** Current beacon target for the active mission. */
export function currentTarget(st: Pick<Store, 'activeMission' | 'phase' | 'stopIndex'>): [number, number, number] | null {
  const m = st.activeMission
  if (!m) return null
  return st.phase === 'toPickup' ? m.pickup : (m.stops[st.stopIndex] ?? m.dropoff)
}

function spawnIsClear(x: number, y: number, z: number): boolean {
  for (const i of nearbyBuildings(CITY, x, z)) {
    const b = CITY.buildings[i]
    if (
      x > b.x - b.w / 2 - 3 && x < b.x + b.w / 2 + 3 &&
      z > b.z - b.d / 2 - 3 && z < b.z + b.d / 2 + 3 &&
      y > b.baseY - 3 && y < b.baseY + b.h + 3
    )
      return false
  }
  return true
}

function placeDroneForMission(m: Mission) {
  // spawn near the pickup pad at the first building-free offset, facing it
  const [px, py, pz] = m.pickup
  const y = Math.max(py + 12, 14)
  let sx = px
  let sz = pz + 26
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2
    const cx = px + Math.sin(ang) * 26
    const cz = pz + Math.cos(ang) * 26
    if (spawnIsClear(cx, y, cz)) {
      sx = cx
      sz = cz
      break
    }
    if (a === 7) {
      sx = px
      sz = pz
    }
  }
  runtime.pos.set(sx, sx === px && sz === pz ? py + 24 : y, sz)
  runtime.vel.set(0, 0, 0)
  runtime.yaw = Math.atan2(px - runtime.pos.x, pz - runtime.pos.z)
  runtime.crashed = false
  runtime.crashTimer = 0
  runtime.carrying = false
  runtime.channel = 0
  runtime.missionClock = 0
  runtime.crashedThisMission = false
  runtime.battery = m.batteryStart ?? 100
  runtime.lowBatteryWarned = false
  runtime.detection = 0
  runtime.detected = false
  runtime.shake = 0
  runtime.lastRingId = -1
  // storm missions lock the weather for the whole run
  if (m.storm) {
    runtime.weather = 'storm'
    runtime.weatherLocked = true
  } else {
    runtime.weatherLocked = false
  }
}

/** Progress payload pushed to the cloud (everything persisted except the session token). */
export function snapshotSave(st: Store): Record<string, unknown> {
  return {
    credits: st.credits,
    gems: st.gems,
    xp: st.xp,
    completedStory: st.completedStory,
    unlockedChapters: st.unlockedChapters,
    seenIntros: st.seenIntros,
    upgrades: st.upgrades,
    owned: st.owned,
    equipped: st.equipped,
    stats: st.stats,
    achievementsUnlocked: st.achievementsUnlocked,
    dailyDone: st.dailyDone,
    founder: st.founder,
    reputation: st.reputation,
    controls: st.controls,
    streak: st.streak,
    lastLoginBonus: st.lastLoginBonus,
    trialBest: st.trialBest,
    theme: st.theme,
    showTutorial: st.showTutorial,
  }
}

function cloudToState(data: Record<string, unknown>): Partial<PlayerSlice> & { showTutorial?: boolean } {
  const d = data as Partial<PlayerSlice> & { showTutorial?: boolean }
  const controls = withDefaults(d.controls as Bindings | undefined)
  setLiveBindings(controls)
  return {
    ...d,
    upgrades: { ...initialPlayer.upgrades, ...(d.upgrades ?? {}) },
    stats: { ...EMPTY_STATS, ...(d.stats ?? {}) },
    reputation: { ...initialPlayer.reputation, ...(d.reputation ?? {}) },
    controls,
  }
}

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
      ...initialPlayer,
      ...initialSession,

      setScreen: s => set({ screen: s }),
      setPanel: p => {
        sfx.click()
        set({ panel: p })
      },
      setPaused: p => set({ paused: p }),

      toast: (text, kind = 'info') => {
        const id = ++toastId
        set(st => ({ toasts: [...st.toasts.slice(-3), { id, text, kind }] }))
        setTimeout(() => set(st => ({ toasts: st.toasts.filter(t => t.id !== id) })), 3500)
      },

      dismissResult: () => set({ result: null }),
      closeIntro: () => {
        const st = get()
        if (st.chapterIntro != null) {
          set({ chapterIntro: null, seenIntros: [...st.seenIntros, st.chapterIntro] })
        }
      },

      quickStart: () => {
        const st = get()
        const story = nextStoryMission(st.completedStory, st.unlockedChapters)
        if (story) {
          st.startMission(story)
        } else {
          const offers = generateOffers(unlockedDistricts(st.unlockedChapters), levelFromXp(st.xp).level, Math.floor(Date.now() / 300_000))
          st.startMission(offers[0])
        }
      },

      openPreview: m => {
        sfx.click()
        set({ preview: m })
      },
      closePreview: () => set({ preview: null }),

      startMission: m => {
        const st = get()
        placeDroneForMission(m)
        resetTrialTrace()
        // trials: ask the server for a single-use run token (anti-cheat)
        set({ trialNonce: null })
        if (m.trialId && st.authToken) {
          api
            .startTrialRun(st.authToken, m.trialId)
            .then(r => set({ trialNonce: r.nonce }))
            .catch(() => {})
        }
        const intro = m.chapterId != null && !st.seenIntros.includes(m.chapterId) ? m.chapterId : null
        set({
          screen: 'game',
          panel: null,
          paused: false,
          preview: null,
          activeMission: m,
          phase: 'toPickup',
          stopIndex: 0,
          timeLeft: m.timeLimit ?? null,
          result: null,
          chapterIntro: intro,
          burst: null,
        })
      },

      abortMission: () => {
        runtime.weatherLocked = false
        runtime.carrying = false
        set({ activeMission: null, screen: 'menu', paused: false, timeLeft: null })
      },

      onPickup: () => {
        const st = get()
        sfx.pickup()
        runtime.carrying = true
        runtime.channel = 0
        set({ phase: 'toStop', stopIndex: 0 })
        const m = st.activeMission
        const total = m?.stops.length ?? 1
        st.toast(total > 1 ? `📦 Package secured — ${total} drop points ahead` : '📦 Package secured — head to the drop zone', 'good')
      },

      // reached the current delivery stop: advance the chain or finish the mission
      onStopReached: () => {
        const st = get()
        const m = st.activeMission
        if (!m) return
        const isLast = st.stopIndex >= m.stops.length - 1
        const stop = m.stops[st.stopIndex]
        set({ burst: { seq: ++burstSeq, x: stop[0], y: stop[1] + 2, z: stop[2] } })

        if (!isLast) {
          sfx.pickup()
          runtime.channel = 0
          set({ stopIndex: st.stopIndex + 1 })
          st.toast(`✅ Stop ${st.stopIndex + 1}/${m.stops.length} — next point marked`, 'good')
          return
        }

        // ---- final delivery ----
        sfx.deliver()
        runtime.carrying = false
        runtime.weatherLocked = false

        // time trials: the clock IS the score — flat pay, no bonuses, submit the time
        if (m.trialId) {
          const ms = Math.round(runtime.missionClock * 1000)
          const prevBest = st.trialBest[m.trialId]
          const newBest = prevBest === undefined || ms < prevBest
          const stats: Stats = {
            ...st.stats,
            deliveries: st.stats.deliveries + 1,
            creditsEarned: st.stats.creditsEarned + m.reward,
          }
          set({
            credits: st.credits + m.reward,
            xp: st.xp + m.xp,
            stats,
            trialBest: newBest ? { ...st.trialBest, [m.trialId]: ms } : st.trialBest,
            activeMission: null,
            timeLeft: null,
            result: {
              success: true,
              mission: m,
              credits: m.reward,
              xp: m.xp,
              bonusText: newBest && prevBest !== undefined ? [`⏱ Previous best ${fmtMs(prevBest)}`] : [],
              trialMs: ms,
              trialNewBest: newBest,
            },
          })
          if (newBest) setTimeout(() => sfx.levelup(), 500)
          // submit to the global board and patch the rank into the open result
          const token = get().authToken
          if (token) {
            api
              .submitTrial(token, m.trialId, ms, trialTrace.map(p => [...p]), get().trialNonce)
              .then(r => {
                // the server's stored best is authoritative — heals stale local bests
                const tb = get().trialBest
                if (tb[m.trialId!] !== r.best) set({ trialBest: { ...tb, [m.trialId!]: r.best } })
                if (r.flagged) {
                  get().toast('🕵 Time flagged for review — extreme outlier check', 'bad')
                } else if (r.rank != null) {
                  const cur = get().result
                  if (cur?.trialMs === ms) set({ result: { ...cur, trialRank: { rank: r.rank, total: r.total } } })
                }
              })
              .catch(e => {
                if (e instanceof ApiError && e.status === 422) get().toast(`🚫 ${e.message}`, 'bad')
              })
          }
          get().checkAchievements()
          return
        }

        const weather = WEATHERS[runtime.weather]
        const bonusText: string[] = []
        let mult = weather.payBonus
        if (weather.payBonus > 1) bonusText.push(`${weather.icon} ${weather.name} hazard pay ×${weather.payBonus}`)
        if (!runtime.crashedThisMission) {
          mult *= 1.15
          bonusText.push('🕊 Perfect flight +15%')
        }
        if (m.timeLimit && st.timeLeft != null && st.timeLeft > m.timeLimit * 0.4) {
          mult *= 1.2
          bonusText.push('⚡ Early delivery +20%')
        }
        if (m.stealth && runtime.detection < 0.35) {
          mult *= 1.25
          bonusText.push('🦇 Clean run — barely a blip +25%')
        }
        // delivery streak: each consecutive success adds 3%, capped at +24%
        const streakBonus = 1 + Math.min(st.streak, 8) * 0.03
        if (streakBonus > 1) {
          mult *= streakBonus
          bonusText.push(`🔥 Streak ×${st.streak} +${Math.round((streakBonus - 1) * 100)}%`)
        }
        const rep = m.faction ? st.reputation[m.faction] : 0
        const repBonus = m.faction ? repPayBonus(rep) : 1
        if (repBonus > 1) {
          mult *= repBonus
          bonusText.push(`🤝 Faction standing ×${repBonus.toFixed(2)}`)
        }

        const credits = Math.round(m.reward * mult)
        const xpGain = Math.round(m.xp * mult)
        const before = levelFromXp(st.xp).level
        const after = levelFromXp(st.xp + xpGain).level

        const completedStory = m.storyId && !st.completedStory.includes(m.storyId) ? [...st.completedStory, m.storyId] : st.completedStory

        let unlockedCh = st.unlockedChapters
        let chapterCompleted: number | undefined
        let chapterReward = 0
        if (m.chapterId) {
          const ch = CHAPTERS.find(c => c.id === m.chapterId)!
          const allDone = ch.missions.every(x => completedStory.includes(x.id))
          if (allDone && st.unlockedChapters === ch.id && ch.id < CHAPTERS.length) {
            unlockedCh = ch.id + 1
            chapterCompleted = ch.id
            chapterReward = ch.rewardCredits
          } else if (allDone && ch.id === CHAPTERS.length && !st.completedStory.includes(m.storyId!)) {
            chapterCompleted = ch.id
            chapterReward = ch.rewardCredits
          }
        }
        if (chapterReward) bonusText.push(`🏆 Chapter ${chapterCompleted} complete +${chapterReward}¢`)

        // faction reputation
        const repGainAmount = m.faction ? Math.max(15, Math.round(xpGain * 0.25)) : 0
        const reputation = m.faction
          ? { ...st.reputation, [m.faction]: st.reputation[m.faction] + repGainAmount }
          : st.reputation

        const stats: Stats = {
          ...st.stats,
          deliveries: st.stats.deliveries + 1,
          perfectDeliveries: st.stats.perfectDeliveries + (runtime.crashedThisMission ? 0 : 1),
          expressDeliveries: st.stats.expressDeliveries + (m.type === 'express' ? 1 : 0),
          fragileDeliveries: st.stats.fragileDeliveries + (m.fragile ? 1 : 0),
          stealthDeliveries: st.stats.stealthDeliveries + (m.stealth ? 1 : 0),
          chainDeliveries: st.stats.chainDeliveries + (m.stops.length > 1 ? 1 : 0),
          creditsEarned: st.stats.creditsEarned + credits + chapterReward,
          stormDeliveries: st.stats.stormDeliveries + (runtime.weather === 'storm' ? 1 : 0),
          dailiesDone: st.stats.dailiesDone + (m.daily ? 1 : 0),
        }

        const dailyDone = { ...st.dailyDone }
        if (m.daily) {
          const key = todayKey()
          dailyDone[key] = [...(dailyDone[key] ?? []), m.id]
        }

        if (after > before) setTimeout(() => sfx.levelup(), 600)

        set({
          credits: st.credits + credits + chapterReward,
          xp: st.xp + xpGain,
          completedStory,
          unlockedChapters: unlockedCh,
          stats,
          dailyDone,
          reputation,
          streak: st.streak + 1,
          activeMission: null,
          timeLeft: null,
          showTutorial: false,
          result: {
            success: true,
            mission: m,
            credits: credits + chapterReward,
            xp: xpGain,
            bonusText,
            leveledTo: after > before ? after : undefined,
            chapterCompleted,
            repGain: m.faction ? { faction: m.faction, amount: repGainAmount } : undefined,
          },
        })
        get().checkAchievements()
      },

      onCrash: () => {
        const st = get()
        sfx.crash()
        runtime.shake = 1
        set({ stats: { ...st.stats, crashes: st.stats.crashes + 1 } })
        if (st.activeMission?.fragile && runtime.carrying) {
          st.failMission('The fragile cargo did not survive the crash.')
        } else {
          st.toast('💥 Drone down — redeploying…', 'bad')
        }
        get().checkAchievements()
      },

      onDetected: () => {
        const st = get()
        sfx.warn()
        st.failMission('Patrol scan locked on. The client burned the contract — and your callsign.')
      },

      onRingHit: () => {
        const st = get()
        sfx.pickup()
        set({ stats: { ...st.stats, ringsHit: st.stats.ringsHit + 1 } })
      },

      failMission: reason => {
        const st = get()
        const m = st.activeMission
        if (!m) return
        runtime.carrying = false
        runtime.weatherLocked = false
        if (st.streak > 1) st.toast(`🔥 Streak of ${st.streak} lost`, 'bad')
        set({
          activeMission: null,
          timeLeft: null,
          streak: 0,
          result: { success: false, mission: m, credits: 0, xp: 0, bonusText: [], failReason: reason },
        })
      },

      claimLoginBonus: () => {
        const st = get()
        const key = todayKey()
        if (st.lastLoginBonus === key || st.stats.deliveries === 0) return
        const bonus = 200 + levelFromXp(st.xp).level * 25
        set({ lastLoginBonus: key, credits: st.credits + bonus })
        st.toast(`🌅 Daily pilot bonus: +¢${bonus} — welcome back!`, 'gold')
      },

      tickMission: (dt, distanceDelta) => {
        const st = get()
        if (distanceDelta > 0) {
          st.stats.distanceFlown += distanceDelta
        }
        if (st.timeLeft != null && st.activeMission) {
          const t = st.timeLeft - dt
          if (t <= 0) {
            st.failMission('Out of time. The client cancelled the contract.')
          } else {
            set({ timeLeft: t })
          }
        }
      },

      syncHud: () => {
        const w = WEATHERS[runtime.weather]
        const st = get()
        const target = currentTarget(st)
        let dist = 0
        if (target) {
          dist = Math.hypot(runtime.pos.x - target[0], runtime.pos.y - target[1], runtime.pos.z - target[2])
        }
        const windSpeed = Math.hypot(runtime.wind.x, runtime.wind.z)
        const windAngle = Math.atan2(runtime.wind.x, runtime.wind.z) - runtime.yaw
        set({
          hud: {
            battery: runtime.battery,
            speed: runtime.vel.length(),
            alt: runtime.pos.y,
            dist,
            weather: w.name,
            weatherIcon: w.icon,
            charging: runtime.onPad,
            windSpeed,
            windAngle,
            detection: runtime.detection,
            boost: runtime.input.boost && runtime.battery > 0,
          },
        })
      },

      checkAchievements: () => {
        const st = get()
        const maxRep = Math.max(...FACTION_LIST.map(f => st.reputation[f.id]))
        const extra = { chaptersDone: chaptersDone(st.completedStory), level: levelFromXp(st.xp).level, maxRep, trialsFlown: Object.keys(st.trialBest).length }
        const fresh = ACHIEVEMENTS.filter(a => !st.achievementsUnlocked.includes(a.id) && a.check(st.stats, extra))
        if (fresh.length) {
          set({ achievementsUnlocked: [...st.achievementsUnlocked, ...fresh.map(a => a.id)] })
          for (const a of fresh) st.toast(`${a.icon} Achievement: ${a.name}`, 'gold')
        }
      },

      buyUpgrade: id => {
        const st = get()
        const lvl = st.upgrades[id]
        const def = UPGRADES.find(u => u.id === id)!
        const cost = def.cost(lvl)
        if (lvl >= def.maxLevel) return
        if (st.credits < cost) {
          st.toast('Not enough credits', 'bad')
          return
        }
        sfx.buy()
        set({ credits: st.credits - cost, upgrades: { ...st.upgrades, [id]: lvl + 1 } })
        st.toast('Upgrade installed ✓', 'good')
      },

      buyCosmetic: (id, price, currency) => {
        const st = get()
        if (st.owned.includes(id)) return
        const wallet = currency === 'gems' ? st.gems : st.credits
        if (wallet < price) {
          st.toast(currency === 'gems' ? 'Not enough gems — grab a pack in the shop' : 'Not enough credits', 'bad')
          return
        }
        sfx.buy()
        set({
          owned: [...st.owned, id],
          credits: currency === 'credits' ? st.credits - price : st.credits,
          gems: currency === 'gems' ? st.gems - price : st.gems,
        })
        st.toast('Added to your collection ✨', 'gold')
      },

      buyDrone: id => {
        const st = get()
        const drone = DRONES.find(d => d.id === id)
        if (!drone || st.owned.includes(id)) return
        const level = levelFromXp(st.xp).level
        if (level < drone.requiresLevel) {
          st.toast(`Requires pilot level ${drone.requiresLevel}`, 'bad')
          return
        }
        if (st.credits < drone.price) {
          st.toast('Not enough credits — fly more contracts', 'bad')
          return
        }
        sfx.buy()
        set({ owned: [...st.owned, id], credits: st.credits - drone.price })
        st.toast(`🚁 ${drone.name} added to your hangar`, 'gold')
      },

      buyBundle: id => {
        const st = get()
        const bundle = BUNDLES.find(b => b.id === id)
        if (!bundle || st.owned.includes(id)) return
        sfx.buy()
        const grants = bundle.contents.filter(c => !st.owned.includes(c))
        set({ owned: [...st.owned, id, ...grants] })
        st.toast(`🎁 ${bundle.name} unlocked (demo — no real charge)`, 'gold')
      },

      equip: (slot, id) => {
        const st = get()
        if (!st.owned.includes(id)) return
        sfx.click()
        set({ equipped: { ...st.equipped, [slot]: id } })
      },

      buyGems: packId => {
        const st = get()
        const pack = GEM_PACKS.find(p => p.id === packId)
        if (!pack) return
        sfx.buy()
        set({ gems: st.gems + pack.gems })
        st.toast(`💎 +${pack.gems} gems (demo store — no real charge)`, 'gold')
      },

      buyFounder: () => {
        const st = get()
        if (st.founder) return
        sfx.buy()
        set({
          founder: true,
          gems: st.gems + 600,
          owned: st.owned.includes('skin-aurora') ? st.owned : [...st.owned, 'skin-aurora'],
        })
        st.toast(`💙 ${FOUNDER_PACK.name} unlocked — thank you, Founder! (demo)`, 'gold')
      },

      setBinding: (action, slot, code) => {
        const st = get()
        const controls: Bindings = { ...st.controls, [action]: [...st.controls[action]] as [string | null, string | null] }
        if (code) {
          const conflict = findConflict(controls, code, action)
          if (conflict) {
            // unbind from the conflicting action and warn
            const other: [string | null, string | null] = [...controls[conflict]]
            if (other[0] === code) other[0] = null
            if (other[1] === code) other[1] = null
            controls[conflict] = other
            st.toast(`⚠ Key reassigned — removed from "${conflict}"`, 'bad')
          }
        }
        controls[action][slot] = code
        setLiveBindings(controls) // applies on the very next frame, no reload
        set({ controls })
      },

      resetBindings: () => {
        const controls = { ...DEFAULT_BINDINGS }
        setLiveBindings(controls)
        set({ controls })
        get().toast('Controls reset to defaults', 'good')
      },

      registerAccount: async (username, password) => {
        const st = get()
        set({ authBusy: true })
        try {
          const res = await api.register(username, password)
          set({ authToken: res.token, authUser: res.username, authBusy: false })
          // brand-new account: current local progress becomes the cloud save
          await api.putSave(res.token, snapshotSave(get()))
          set({ syncStatus: 'synced' })
          st.toast(`👤 Welcome aboard, ${res.username} — progress now syncs to the cloud`, 'gold')
        } catch (e) {
          set({ authBusy: false })
          st.toast(e instanceof ApiError ? e.message : 'Could not reach the server', 'bad')
          throw e
        }
      },

      loginAccount: async (username, password) => {
        const st = get()
        set({ authBusy: true })
        try {
          const res = await api.login(username, password)
          const cloud = await api.getSave(res.token)
          const localXp = get().xp
          const cloudXp = cloud.save ? Number((cloud.save as { xp?: number }).xp ?? 0) : 0

          if (cloud.save && cloudXp >= localXp) {
            // cloud is ahead (or equal): restore it
            set({ ...cloudToState(cloud.save), authToken: res.token, authUser: res.username, authBusy: false, syncStatus: 'synced' })
            st.toast(`☁️ Cloud save loaded — welcome back, ${res.username}`, 'gold')
          } else {
            // local is ahead: keep it and push up
            set({ authToken: res.token, authUser: res.username, authBusy: false })
            await api.putSave(res.token, snapshotSave(get()))
            set({ syncStatus: 'synced' })
            st.toast(`👤 Logged in as ${res.username} — local progress synced up`, 'gold')
          }
        } catch (e) {
          set({ authBusy: false })
          st.toast(e instanceof ApiError ? e.message : 'Could not reach the server', 'bad')
          throw e
        }
      },

      logout: () => {
        const st = get()
        const token = st.authToken
        if (token) {
          // best-effort final push
          api.putSave(token, snapshotSave(st)).catch(() => {})
        }
        set({ authToken: null, authUser: null, syncStatus: 'idle' })
        st.toast('Logged out — progress stays on this device', 'info')
      },

      syncNow: async () => {
        const st = get()
        if (!st.authToken) return
        set({ syncStatus: 'syncing' })
        try {
          await api.putSave(st.authToken, snapshotSave(get()))
          set({ syncStatus: 'synced' })
        } catch (e) {
          set({ syncStatus: 'error' })
          if (e instanceof ApiError && e.status === 401) {
            set({ authToken: null, authUser: null })
            get().toast('Session expired — please log in again', 'bad')
          }
        }
      },

      toggleMute: () => {
        const st = get()
        setSfxMuted(!st.muted)
        set({ muted: !st.muted })
      },
      setQuality: q => set({ quality: q }),
      setTheme: t => {
        sfx.click()
        set({ theme: t })
      },

      resetSave: () => {
        setLiveBindings({ ...DEFAULT_BINDINGS })
        set({ ...initialPlayer, ...initialSession })
      },
    }),
    {
      name: 'skydrop-save-v1',
      version: 2,
      migrate: (persisted, version) => {
        const p = persisted as Partial<PlayerSlice> & Record<string, unknown>
        if (version < 2) {
          p.upgrades = { ...initialPlayer.upgrades, ...(p.upgrades ?? {}) }
          p.stats = { ...EMPTY_STATS, ...(p.stats ?? {}) }
          p.reputation = { ...initialPlayer.reputation, ...(p.reputation ?? {}) }
          p.controls = withDefaults(p.controls as Bindings | undefined)
        }
        return p
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<Store>) }
        // belt-and-braces: ensure nested objects always have every key
        merged.upgrades = { ...initialPlayer.upgrades, ...merged.upgrades }
        merged.stats = { ...EMPTY_STATS, ...merged.stats }
        merged.reputation = { ...initialPlayer.reputation, ...merged.reputation }
        merged.controls = withDefaults(merged.controls)
        // legacy saves may have gem-era drones equipped that no longer exist
        if (!DRONES.some(d => d.id === merged.equipped.model)) {
          merged.equipped = { ...merged.equipped, model: droneById(merged.equipped.model).id }
        }
        return merged
      },
      partialize: st => ({
        credits: st.credits,
        gems: st.gems,
        xp: st.xp,
        completedStory: st.completedStory,
        unlockedChapters: st.unlockedChapters,
        seenIntros: st.seenIntros,
        upgrades: st.upgrades,
        owned: st.owned,
        equipped: st.equipped,
        stats: st.stats,
        achievementsUnlocked: st.achievementsUnlocked,
        dailyDone: st.dailyDone,
        founder: st.founder,
        muted: st.muted,
        quality: st.quality,
        reputation: st.reputation,
        controls: st.controls,
        streak: st.streak,
        lastLoginBonus: st.lastLoginBonus,
        authToken: st.authToken,
        authUser: st.authUser,
        trialBest: st.trialBest,
        theme: st.theme,
        showTutorial: st.showTutorial,
      }),
    }
  )
)

// hydrate the live binding lookup from the (possibly persisted) store
setLiveBindings(useGame.getState().controls)

// ---------------- cloud auto-sync ----------------
// Cheap progress fingerprint: changes whenever anything save-worthy changes,
// stays constant across the 12Hz HUD updates.
function fingerprint(st: Store): string {
  return [
    st.xp, st.credits, st.gems, st.owned.length, st.completedStory.length,
    st.achievementsUnlocked.length, st.stats.deliveries, st.stats.crashes,
    st.equipped.skin, st.equipped.trail, st.equipped.model, st.streak,
    Object.values(st.upgrades).join(''), Object.values(st.reputation).join(','),
    JSON.stringify(st.controls),
  ].join('|')
}

let lastFp = fingerprint(useGame.getState())
let pushTimer: ReturnType<typeof setTimeout> | null = null

useGame.subscribe(st => {
  if (!st.authToken) return
  const fp = fingerprint(st)
  if (fp === lastFp) return
  lastFp = fp
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void useGame.getState().syncNow()
  }, 4000)
})

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const st = useGame.getState()
    if (!st.authToken) return
    // keepalive lets the request outlive the page
    void fetch('/api/save', {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${st.authToken}` },
      body: JSON.stringify({ save: snapshotSave(st) }),
    }).catch(() => {})
  })
}

export { generateOffers, generateDailies, nextStoryMission }
