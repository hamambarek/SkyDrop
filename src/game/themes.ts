// Time-of-day visual themes. Everything the renderer needs to relight the city.

export type ThemeId = 'night' | 'dusk' | 'dawn' | 'day'

export interface ThemeDef {
  id: ThemeId
  name: string
  icon: string
  bg: string
  fog: string
  fogDensity: number
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  sun: string
  sunIntensity: number
  sunPos: [number, number, number]
  rim: string
  rimIntensity: number
  ambient: number
  ambientColor: string
  stars: number // 0..1 star visibility
  windows: number // window emissive multiplier (1 = full night glow)
  groundGlow: number // road neon multiplier
  bloom: number
  preview: string // CSS gradient for the settings chip
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  night: {
    id: 'night', name: 'Neon Night', icon: '🌙',
    bg: '#05060f', fog: '#0a0d1f', fogDensity: 0.0014,
    hemiSky: '#3a4a8a', hemiGround: '#0a0c18', hemiIntensity: 0.6,
    sun: '#8fb0ff', sunIntensity: 0.55, sunPos: [120, 220, 80],
    rim: '#b96bff', rimIntensity: 0.18,
    ambient: 0.16, ambientColor: '#445',
    stars: 1, windows: 1, groundGlow: 1, bloom: 1.1,
    preview: 'linear-gradient(160deg, #05060f, #16224a 60%, #39c2ff22)',
  },
  dusk: {
    id: 'dusk', name: 'Violet Dusk', icon: '🌆',
    bg: '#170d26', fog: '#2a1840', fogDensity: 0.00125,
    hemiSky: '#b96bff', hemiGround: '#190f22', hemiIntensity: 0.55,
    sun: '#ff9d5c', sunIntensity: 1.0, sunPos: [-260, 60, 140],
    rim: '#ff6bd5', rimIntensity: 0.3,
    ambient: 0.22, ambientColor: '#534',
    stars: 0.5, windows: 0.85, groundGlow: 0.9, bloom: 1.0,
    preview: 'linear-gradient(160deg, #170d26, #4a1f4d 55%, #ff9d5c66)',
  },
  dawn: {
    id: 'dawn', name: 'Ion Dawn', icon: '🌅',
    bg: '#221a2e', fog: '#41304a', fogDensity: 0.0011,
    hemiSky: '#ff9fb6', hemiGround: '#241a20', hemiIntensity: 0.65,
    sun: '#ffd2a0', sunIntensity: 1.4, sunPos: [260, 90, -120],
    rim: '#7fd9ff', rimIntensity: 0.22,
    ambient: 0.28, ambientColor: '#655',
    stars: 0.15, windows: 0.5, groundGlow: 0.7, bloom: 0.85,
    preview: 'linear-gradient(160deg, #221a2e, #6e4458 55%, #ffd2a066)',
  },
  day: {
    id: 'day', name: 'Chrome Day', icon: '☀️',
    bg: '#7fa9c9', fog: '#92bbd8', fogDensity: 0.00085,
    hemiSky: '#dcecff', hemiGround: '#5a738c', hemiIntensity: 1.05,
    sun: '#fff2dd', sunIntensity: 2.0, sunPos: [160, 280, 60],
    rim: '#bcd9ff', rimIntensity: 0.3,
    ambient: 0.5, ambientColor: '#9ab',
    stars: 0, windows: 0.12, groundGlow: 0.35, bloom: 0.5,
    preview: 'linear-gradient(160deg, #7fa9c9, #b7d6ec 55%, #fff2dd)',
  },
}

export const THEME_LIST = Object.values(THEMES)
