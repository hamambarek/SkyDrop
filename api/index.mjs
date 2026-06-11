// Vercel function entry — wraps the Express app from server/index.mjs.
// All /api/* traffic is rewritten here (see vercel.json).

import { app, migrate } from '../server/index.mjs'

let ready

export default async function handler(req, res) {
  // run schema migration once per cold start
  ready ??= migrate().catch(e => {
    ready = undefined
    throw e
  })
  await ready
  return app(req, res)
}
