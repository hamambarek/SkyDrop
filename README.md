# 🚁 SkyDrop: Drone Delivery Empire

A futuristic drone-delivery simulation game in a stylized neon cyber-city. Fly physics-based missions, build your courier empire across four districts, and unlock a chapter-driven story — all in the browser at 60fps.

![stack](https://img.shields.io/badge/stack-React%2019%20·%20TypeScript%20·%20Three.js%20(R3F)%20·%20Zustand%20·%20Vite-39c2ff)

## ▶ Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 and hit **START MISSION** — you're flying within 10 seconds.

### Controls (fully remappable in Settings → Controls)

| Default | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Fly forward / strafe |
| `SPACE` / `SHIFT` | Ascend / descend |
| `Q` `E` | Yaw (turn) |
| `LMB` / `F` | **Boost** (faster, drains battery) |
| `RMB` / `X` | **Air brake** |
| `V` | Camera mode (chase / near / top) |
| `M` | Minimap zoom (local ↔ full city) |
| `ESC` / `P` | Pause |
| Touch | Twin virtual sticks (left: move, right: turn + altitude) |
| Gamepad | Left stick move, right stick yaw/lift, triggers boost/brake |

Every action has two binding slots, accepts keyboard **and mouse buttons**, detects conflicts (auto-moves the key with a warning), applies instantly without reload, and has a one-click reset to defaults.

**The loop:** follow the light pillar → hover inside the beacon to pick up → carry it through every stop → earn credits + XP + faction rep → upgrade, unlock districts, climb the story.

## 🎮 What's in the game

- **Physics-based arcade flight** — thrust, drag, wind, cargo weight, battery, boost/brake, crash + fast respawn, recharge pads (including rooftop and sky-bridge pads)
- **Eight districts** — four inner quadrants (Solace Heights, Axiom Core, Ferrum Works, Neon Harbor) plus four expansion bands unlocked through the story:
  - **Vela Business Core** — high-speed corridors threaded with boost rings
  - **Spire Bridges** — 150m twin spires connected by sky bridges with landing pads (pure vertical navigation)
  - **Subgrid Logistics** — covered freight tunnels; fly under the roofs, dodge the patrols
  - **Halcyon Secure Zone** — late-game restricted area: dense no-fly grids + orbiting patrol scanners
- **Living world** — AI courier traffic, freight blimps, rotating cranes, patrol drones, lightning, wind-streak gusts, the central **Nexus spire** landmark with rotating holo rings, ~46 neon billboards, blinking antenna forests, sweeping searchlights and district-tinted streets
- **Mission variety** — standard / express / heavy / fragile / **stealth** (avoid scan fields or the contract burns) / **storm runs** (weather locked to ion storm) / **multi-stop chains** (2–3 ordered drops), plus daily contracts, a rotating 10-slot offer board with long **cross-district hauls**, and ⚜ **weekly Elite contracts** (500–1000m+ runs at double pay). Routes are guaranteed long (level-scaled minimum legs) with tight delivery clocks
- **Cloud accounts** — register a callsign and progress syncs automatically to Postgres via the bundled API (`npm run server`); global XP leaderboard included
- **8-chapter free story** — from noodle runs to the Halcyon Accord, each chapter unlocks a district
- **NPC factions + reputation** — Couriers Union, Axiom Corp, The Syndicate, Civic Authority; every contract builds standing (Neutral → Legend) with a small earned loyalty pay bonus
- **Drone hangar** — 9 frames across 5 classes (starter / speed / heavy cargo / stealth / experimental) with honest stat trade-offs and unique perks; earned with credits + pilot level, **never sold for gems**
- **Deep upgrades** — 6 tracks: battery, thrust, gyro, lift frame, stability core (wind), storm plating (weather/jamming)
- **Dynamic weather** — clear / wind / neon rain / ion storms with gusts, lightning and hazard-pay multipliers
- **Premium cosmetics (mocked store)** — 5 rarity tiers up to **Mythic**, animated hue-shift skins, geometry flairs (holo wings, halos, particle auras), rainbow trails, city-themed bundles, seasonal storefront, founder pack. *Zero pay-to-win, zero lootboxes, all gameplay free.*
- **Tactical minimap** — circular radar with district-colored building footprints, no-fly zones, pads, boost rings, live patrol scan fields, chain stops and a guide line to the target; click or press `M` to switch between local and full-city view
- **Polish** — mission briefing previews, wall-aware chase camera (sweeps against building geometry, never clips through walls), camera modes + speed-FOV + impact shake, boost thrusters, delivery particle bursts, wind/detection/cargo HUD, synthesized engine hum + wind ambience, delivery streak bonus (consecutive successes pay up to +24%), daily login bonus, 25 achievements
- **Save system** — versioned `localStorage` persistence with automatic migration from older saves

## 🛠 Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npx eslint src` | Lint |

## 🚀 Deployment

The build output is a fully static site — host it anywhere.

**Vercel**
```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```
(Framework preset: Vite — auto-detected. Output dir: `dist`.)

**Netlify** — drag-and-drop `dist/`, or `netlify deploy --prod --dir=dist` (build command `npm run build`).

**Self-host** — `npm run build`, then serve `dist/` with any static server (`npx serve dist`, nginx, Caddy, S3 + CDN…).

## 📁 Architecture

```
src/
├── game/            # engine-agnostic game logic (no React)
│   ├── constants.ts # tuning: flight model, districts, weather, XP curve, upgrades
│   ├── bindings.ts  # keybinding system: actions, defaults, conflicts, live lookup
│   ├── rng.ts       # seeded RNG (deterministic city + dailies)
│   ├── city.ts      # procedural city gen: quadrants + expansion bands, bridges,
│   │                #   tunnels, boost rings, cranes, patrols, spatial hash
│   ├── physics.ts   # flight model, boost/brake, collisions (incl. elevated boxes),
│   │                #   battery, weather sim, stealth detection, mission progress
│   ├── runtime.ts   # mutable 60fps state (outside React) + keyboard/mouse/gamepad poll
│   ├── missions.ts  # procedural missions: chains, stealth, storm runs, dailies
│   ├── story.ts     # 8 chapters, narrative, story missions
│   ├── factions.ts  # NPC factions + reputation tiers
│   ├── cosmetics.ts # drone frames w/ stats & classes, skins, trails, bundles, season
│   ├── achievements.ts
│   └── sfx.ts       # synthesized WebAudio SFX (no assets)
├── state/store.ts   # Zustand store: versioned persistence + migration, session state
├── components/      # R3F scene (city, drone, traffic, blimps, cranes, patrols, weather)
└── ui/              # HUD, menu, panels, mission previews, controls remapper, touch sticks
```

Design notes:
- Per-frame state lives in a plain mutable `runtime` object so physics never triggers React re-renders; the HUD mirrors it at ~12Hz.
- The city is generated from a fixed seed, so collision data, mission pads and visuals always agree — and every player sees the same city.
- Buildings render as two `InstancedMesh`es (bodies + neon parapets) → the whole city is a handful of draw calls.

## 🗺 Roadmap ideas

- Real payment integration (Stripe/platform IAP) behind the existing mock store
- Harbor sea-lane visuals, more building archetypes, day/night cycle
- Leaderboards + ghost races (needs a small backend)
- Expansion districts already stubbed in the shop
