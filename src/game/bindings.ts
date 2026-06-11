// Custom keybinding system. Bindings live in the persisted store; this module
// keeps a fast lookup copy used by the 60fps input poll (no React involved).

export type ActionId =
  | 'moveForward'
  | 'moveBack'
  | 'moveLeft'
  | 'moveRight'
  | 'ascend'
  | 'descend'
  | 'yawLeft'
  | 'yawRight'
  | 'boost'
  | 'brake'
  | 'cameraToggle'
  | 'minimap'
  | 'pause'

export interface ActionDef {
  id: ActionId
  label: string
  group: 'Flight' | 'Maneuver' | 'Systems'
}

export const ACTIONS: ActionDef[] = [
  { id: 'moveForward', label: 'Move Forward', group: 'Flight' },
  { id: 'moveBack', label: 'Move Back', group: 'Flight' },
  { id: 'moveLeft', label: 'Strafe Left', group: 'Flight' },
  { id: 'moveRight', label: 'Strafe Right', group: 'Flight' },
  { id: 'ascend', label: 'Ascend', group: 'Flight' },
  { id: 'descend', label: 'Descend', group: 'Flight' },
  { id: 'yawLeft', label: 'Turn Left', group: 'Maneuver' },
  { id: 'yawRight', label: 'Turn Right', group: 'Maneuver' },
  { id: 'boost', label: 'Boost', group: 'Maneuver' },
  { id: 'brake', label: 'Air Brake', group: 'Maneuver' },
  { id: 'cameraToggle', label: 'Camera Mode', group: 'Systems' },
  { id: 'minimap', label: 'Minimap Zoom', group: 'Systems' },
  { id: 'pause', label: 'Pause', group: 'Systems' },
]

// Two slots per action. Keys use KeyboardEvent.code; mouse buttons use Mouse0/1/2.
export type Bindings = Record<ActionId, [string | null, string | null]>

export const DEFAULT_BINDINGS: Bindings = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', null],
  moveRight: ['KeyD', null],
  ascend: ['Space', null],
  descend: ['ShiftLeft', 'KeyC'],
  yawLeft: ['KeyQ', 'ArrowLeft'],
  yawRight: ['KeyE', 'ArrowRight'],
  boost: ['Mouse0', 'KeyF'],
  brake: ['Mouse2', 'KeyX'],
  cameraToggle: ['KeyV', null],
  minimap: ['KeyM', null],
  pause: ['Escape', 'KeyP'],
}

// Basic controller mapping structure (extensible — axes/buttons per action).
export const GAMEPAD_MAP = {
  axes: {
    moveX: 0, // left stick X -> strafe
    moveY: 1, // left stick Y -> forward/back (inverted)
    yaw: 2, // right stick X
    lift: 3, // right stick Y (inverted)
  },
  buttons: {
    ascend: 0, // A / Cross
    descend: 1, // B / Circle
    boost: 7, // RT
    brake: 6, // LT
    pause: 9, // Start
  },
} as const

/** Human-readable label for a binding code. */
export function keyLabel(code: string | null): string {
  if (!code) return '—'
  if (code === 'Mouse0') return 'LMB'
  if (code === 'Mouse1') return 'MMB'
  if (code === 'Mouse2') return 'RMB'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  const map: Record<string, string> = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT', AltRight: 'R-ALT', Space: 'SPACE', Escape: 'ESC',
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
    Tab: 'TAB', Enter: 'ENTER', Backspace: 'BKSP', CapsLock: 'CAPS',
  }
  return map[code] ?? code.toUpperCase()
}

/** Find which other action already uses this code (conflict detection). */
export function findConflict(bindings: Bindings, code: string, exclude: ActionId): ActionId | null {
  for (const a of ACTIONS) {
    if (a.id === exclude) continue
    if (bindings[a.id][0] === code || bindings[a.id][1] === code) return a.id
  }
  return null
}

export function actionLabel(id: ActionId): string {
  return ACTIONS.find(a => a.id === id)?.label ?? id
}

// ---- live lookup used by the input poll ----

let live: Bindings = { ...DEFAULT_BINDINGS }
let codeToActions = new Map<string, ActionId[]>()

function rebuildLookup() {
  codeToActions = new Map()
  for (const a of ACTIONS) {
    for (const code of live[a.id]) {
      if (!code) continue
      const arr = codeToActions.get(code) ?? []
      arr.push(a.id)
      codeToActions.set(code, arr)
    }
  }
}
rebuildLookup()

/** Push new bindings into the live lookup — takes effect on the next frame, no reload. */
export function setLiveBindings(b: Bindings) {
  live = b
  rebuildLookup()
}

export function codesFor(action: ActionId): (string | null)[] {
  return live[action]
}

/** Merge stored bindings over defaults so new actions added in updates get keys. */
export function withDefaults(stored: Partial<Bindings> | undefined): Bindings {
  const out = { ...DEFAULT_BINDINGS }
  if (stored) {
    for (const a of ACTIONS) {
      const v = stored[a.id]
      if (Array.isArray(v)) out[a.id] = [v[0] ?? null, v[1] ?? null]
    }
  }
  return out
}
