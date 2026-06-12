// Canonical trial routes — the single source of truth shared by the game
// client (course rendering) and the API server (anti-cheat validation).
// Generated from the deterministic city seed; regenerate if city gen changes:
// in a dev console run trialToMission() for every trial and paste here.

export const TRIAL_ROUTES = {
  'trial-maiden': { pickup: [31.9, 0, 31.9], stops: [[190.2, 0, 248.2]] },
  'trial-canyon': { pickup: [-74.2, 0, 306.2], stops: [[-31.9, 0, 31.9], [-190.2, 0, 248.2]] },
  'trial-corridor': { pickup: [-358, 0, 446], stops: [[396, 37.4, 388]] },
  'trial-heavyhaul': { pickup: [-31.9, 0, -31.9], stops: [[-190.2, 0, -306.2]] },
  'trial-spire': { pickup: [388, 0, 454], stops: [[504, 53.5, -387], [388, 76.8, 396]] },
  'trial-ghost': { pickup: [-474, 32.4, -388], stops: [[48, 27.3, -504]] },
  'trial-storm': { pickup: [132.2, 0, -190.2], stops: [[31.9, 0, -31.9]] },
  'trial-halcyon': { pickup: [-446, 40, -300], stops: [[-446, 30.2, 338], [-388, 69, -300]] },
}
