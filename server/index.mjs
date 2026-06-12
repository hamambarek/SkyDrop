// SkyDrop API — accounts, cloud saves, leaderboards, trial times.
// Local: npm run server (reads server/.env)
// Vercel: exported app is wrapped by api/index.mjs (env from project settings)

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config as loadEnv } from 'dotenv'

// also load server/.env when started from the repo root
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') })

const { DATABASE_URL, JWT_SECRET, ADMIN_KEY, PORT = 8787 } = process.env
if (!DATABASE_URL || !JWT_SECRET) {
  console.error('Missing DATABASE_URL or JWT_SECRET (see server/.env.example)')
  process.exit(1)
}

// modest pool: serverless instances each hold a couple of connections
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 })

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS saves (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS saves_xp_idx ON saves (((data->>'xp')::int) DESC);
    CREATE TABLE IF NOT EXISTS trial_times (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trial_id TEXT NOT NULL,
      ms INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, trial_id)
    );
    CREATE INDEX IF NOT EXISTS trial_times_board_idx ON trial_times (trial_id, ms ASC);
    ALTER TABLE trial_times ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;
    CREATE TABLE IF NOT EXISTS trial_nonces (
      nonce TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trial_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '256kb' }))

const sign = user => jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: '90d' })

function auth(req, res, next) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not logged in' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired — log in again' })
  }
}

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body ?? {}
    if (!USERNAME_RE.test(username ?? ''))
      return res.status(400).json({ error: 'Callsign must be 3-20 letters, numbers, _ or -' })
    if (typeof password !== 'string' || password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      'INSERT INTO users (username, pass_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    )
    res.json({ token: sign(rows[0]), username: rows[0].username })
  } catch (e) {
    if (e?.code === '23505') return res.status(409).json({ error: 'That callsign is taken' })
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {}
    const { rows } = await pool.query('SELECT id, username, pass_hash FROM users WHERE username = $1', [username ?? ''])
    if (!rows.length || !(await bcrypt.compare(password ?? '', rows[0].pass_hash)))
      return res.status(401).json({ error: 'Wrong callsign or password' })
    res.json({ token: sign(rows[0]), username: rows[0].username })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

app.get('/api/save', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT data, updated_at FROM saves WHERE user_id = $1', [req.user.uid])
  res.json(rows.length ? { save: rows[0].data, updatedAt: rows[0].updated_at } : { save: null })
})

app.put('/api/save', auth, async (req, res) => {
  const data = req.body?.save
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Bad save payload' })
  await pool.query(
    `INSERT INTO saves (user_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()`,
    [req.user.uid, JSON.stringify(data)]
  )
  res.json({ ok: true })
})

// ---- competitive time trials ----

import { TRIAL_ROUTES } from '../shared/trial-routes.mjs'

const MAX_PLAUSIBLE_SPEED = 100 // m/s between samples (boost + rings + wind headroom)
const WAYPOINT_RADIUS = 11 // capture radius is 6.5m; samples are 0.5s apart
const dist3 = (ax, ay, az, b) => Math.hypot(ax - b[0], ay - b[1], az - b[2])

/**
 * Anti-cheat: verify the submitted flight trace actually flew the course.
 * Returns null when valid, otherwise a human-readable rejection reason.
 */
function validateTrialRun(trialId, ms, trace) {
  const route = TRIAL_ROUTES[trialId]
  if (!route) return 'Unknown trial'
  if (!Array.isArray(trace) || trace.length < 8 || trace.length > 2000) return 'Missing or malformed flight trace'
  for (const s of trace) {
    if (!Array.isArray(s) || s.length !== 4 || s.some(v => !Number.isFinite(v))) return 'Corrupt trace sample'
  }
  // clock consistency: trace timeline must match the claimed time
  if (trace[0][0] > 3) return 'Trace starts too late'
  if (Math.abs(trace[trace.length - 1][0] - ms / 1000) > 3) return 'Trace clock does not match the submitted time'
  // physics plausibility between samples
  let total = 0
  for (let i = 1; i < trace.length; i++) {
    const [t0, x0, y0, z0] = trace[i - 1]
    const [t1, x1, y1, z1] = trace[i]
    const dt = t1 - t0
    if (dt <= 0 || dt > 4) return 'Non-monotonic trace timeline'
    const d = Math.hypot(x1 - x0, y1 - y0, z1 - z0)
    if (d / dt > MAX_PLAUSIBLE_SPEED) return 'Teleportation detected'
    total += d
  }
  if (total / (ms / 1000) > 80) return 'Average speed beyond drone limits'
  // run must begin near the launch pad
  if (dist3(trace[0][1], trace[0][2], trace[0][3], route.pickup) > 70) return 'Run did not start at the launch zone'
  // ordered waypoint passes: pickup, then every stop, in sequence
  const waypoints = [route.pickup, ...route.stops]
  let idx = 0
  for (const wp of waypoints) {
    let passed = false
    for (; idx < trace.length; idx++) {
      if (dist3(trace[idx][1], trace[idx][2], trace[idx][3], wp) <= WAYPOINT_RADIUS) {
        passed = true
        break
      }
    }
    if (!passed) return 'Route checkpoint missed — the course was not flown'
  }
  return null
}

/** Theoretical course minimum: route length at an unreachable 55 m/s average. */
function courseFloorMs(trialId) {
  const r = TRIAL_ROUTES[trialId]
  let d = 0
  let prev = r.pickup
  for (const s of r.stops) {
    d += Math.hypot(s[0] - prev[0], s[1] - prev[1], s[2] - prev[2])
    prev = s
  }
  return (d / 55) * 1000
}

// Per-run token: issued when a trial starts, single-use, and the claimed run
// time can never exceed the real wall-clock window it was flown in.
app.post('/api/trials/start', auth, async (req, res) => {
  try {
    const { trialId } = req.body ?? {}
    if (typeof trialId !== 'string' || !TRIAL_ROUTES[trialId]) return res.status(400).json({ error: 'Bad trial id' })
    const nonce = crypto.randomUUID()
    // one active run per user per trial; stale tokens get replaced
    await pool.query('DELETE FROM trial_nonces WHERE user_id = $1 AND trial_id = $2', [req.user.uid, trialId])
    await pool.query('INSERT INTO trial_nonces (nonce, user_id, trial_id) VALUES ($1, $2, $3)', [nonce, req.user.uid, trialId])
    res.json({ nonce })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

app.post('/api/trials', auth, async (req, res) => {
  try {
    const { trialId, ms, trace, nonce } = req.body ?? {}
    if (typeof trialId !== 'string' || !/^trial-[a-z]+$/.test(trialId))
      return res.status(400).json({ error: 'Bad trial id' })
    if (!Number.isFinite(ms) || ms < 8000 || ms > 3_600_000)
      return res.status(400).json({ error: 'Implausible time' })

    // ---- run token: must exist, match, be fresh, and cover the claimed duration
    if (typeof nonce !== 'string') return res.status(422).json({ error: 'Run rejected: No run token — start the trial again' })
    const nrow = await pool.query(
      'SELECT created_at FROM trial_nonces WHERE nonce = $1 AND user_id = $2 AND trial_id = $3',
      [nonce, req.user.uid, trialId]
    )
    if (!nrow.rows.length) return res.status(422).json({ error: 'Run rejected: Invalid or already-used run token' })
    await pool.query('DELETE FROM trial_nonces WHERE nonce = $1', [nonce]) // single use
    const elapsedMs = Date.now() - new Date(nrow.rows[0].created_at).getTime()
    if (elapsedMs > 45 * 60_000) return res.status(422).json({ error: 'Run rejected: Run token expired' })
    if (elapsedMs < ms - 3000)
      return res.status(422).json({ error: 'Run rejected: Claimed time exceeds the real run window' })

    const reason = validateTrialRun(trialId, ms, trace)
    if (reason) return res.status(422).json({ error: `Run rejected: ${reason}` })
    const time = Math.round(ms)

    // ---- statistical review: physically impossible or extreme outlier → flagged
    let flagged = time < courseFloorMs(trialId)
    if (!flagged) {
      const { rows: pop } = await pool.query(
        'SELECT ms FROM trial_times WHERE trial_id = $1 AND NOT flagged AND user_id <> $2',
        [trialId, req.user.uid]
      )
      if (pop.length >= 5) {
        const xs = pop.map(r => r.ms)
        const mean = xs.reduce((a, b) => a + b, 0) / xs.length
        const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
        if (std > 0 && time < mean - 2.5 * std) flagged = true
      }
    }

    await pool.query(
      `INSERT INTO trial_times (user_id, trial_id, ms, flagged) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, trial_id) DO UPDATE SET
         ms = LEAST(trial_times.ms, EXCLUDED.ms),
         flagged = CASE WHEN EXCLUDED.ms < trial_times.ms THEN EXCLUDED.flagged ELSE trial_times.flagged END,
         created_at = now()`,
      [req.user.uid, trialId, time, flagged]
    )
    const { rows } = await pool.query(
      `SELECT ms, flagged,
              (SELECT COUNT(*) + 1 FROM trial_times w WHERE w.trial_id = $2 AND NOT w.flagged AND w.ms < t.ms) AS rank,
              (SELECT COUNT(*) FROM trial_times w WHERE w.trial_id = $2 AND NOT w.flagged) AS total
       FROM trial_times t WHERE t.user_id = $1 AND t.trial_id = $2`,
      [req.user.uid, trialId]
    )
    const r = rows[0]
    res.json({
      best: r.ms,
      flagged: r.flagged,
      rank: r.flagged ? null : Number(r.rank),
      total: Number(r.total),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// ---- admin review of flagged times ----

function adminOk(req) {
  return ADMIN_KEY && req.query.key === ADMIN_KEY
}

app.get('/api/admin/flagged', async (req, res) => {
  if (!adminOk(req)) return res.status(403).json({ error: 'Forbidden' })
  const { rows } = await pool.query(`
    SELECT u.username, t.user_id, t.trial_id, t.ms, t.created_at
    FROM trial_times t JOIN users u ON u.id = t.user_id
    WHERE t.flagged ORDER BY t.created_at DESC LIMIT 100
  `)
  res.json({ flagged: rows })
})

app.post('/api/admin/resolve', async (req, res) => {
  if (!adminOk(req)) return res.status(403).json({ error: 'Forbidden' })
  const { userId, trialId, action } = req.body ?? {}
  if (action === 'approve') {
    await pool.query('UPDATE trial_times SET flagged = false WHERE user_id = $1 AND trial_id = $2', [userId, trialId])
  } else if (action === 'remove') {
    await pool.query('DELETE FROM trial_times WHERE user_id = $1 AND trial_id = $2', [userId, trialId])
  } else {
    return res.status(400).json({ error: 'action must be approve or remove' })
  }
  res.json({ ok: true })
})

// top-3 per trial in one call, plus the caller's own bests when authed
app.get('/api/trials/summary', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT trial_id, username, ms FROM (
        SELECT t.trial_id, u.username, t.ms,
               ROW_NUMBER() OVER (PARTITION BY t.trial_id ORDER BY t.ms ASC) AS rn
        FROM trial_times t JOIN users u ON u.id = t.user_id WHERE NOT t.flagged
      ) ranked WHERE rn <= 3 ORDER BY trial_id, ms ASC
    `)
    const boards = {}
    for (const r of rows) {
      ;(boards[r.trial_id] ??= []).push({ username: r.username, ms: r.ms })
    }
    let mine = null
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (token) {
      try {
        const user = jwt.verify(token, JWT_SECRET)
        const m = await pool.query('SELECT trial_id, ms FROM trial_times WHERE user_id = $1', [user.uid])
        mine = Object.fromEntries(m.rows.map(r => [r.trial_id, r.ms]))
      } catch {
        // anonymous summary is fine
      }
    }
    res.json({ boards, mine })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

app.get('/api/leaderboard', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT u.username,
           COALESCE((s.data->>'xp')::int, 0) AS xp,
           COALESCE((s.data->'stats'->>'deliveries')::int, 0) AS deliveries,
           COALESCE((s.data->'stats'->>'creditsEarned')::int, 0) AS credits_earned
    FROM saves s JOIN users u ON u.id = s.user_id
    ORDER BY xp DESC LIMIT 20
  `)
  res.json({ leaderboard: rows })
})

export { app }

// standalone mode: `node server/index.mjs` (skipped when imported by api/index.mjs)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      app.listen(PORT, () => console.log(`SkyDrop API listening on :${PORT}`))
    })
    .catch(e => {
      console.error('Migration failed:', e)
      process.exit(1)
    })
}
