import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense } from 'react'
import { THEMES } from '../game/themes'
import { useGame } from '../state/store'
import { City } from './City'
import { PlayerDrone } from './Drone'
import { Traffic } from './Traffic'
import { WeatherFx } from './Weather'
import { MissionMarkers } from './MissionMarkers'
import { MenuCamera } from './MenuCamera'

export function Scene() {
  const screen = useGame(s => s.screen)
  const quality = useGame(s => s.quality)
  const theme = THEMES[useGame(s => s.theme)]

  return (
    <Canvas
      dpr={quality === 'high' ? [1, 1.75] : 1}
      camera={{ fov: 60, near: 0.5, far: 1900, position: [0, 120, 220] }}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={[theme.bg]} />
      {/* exponential fog reads depth far better than linear in a neon city */}
      <fogExp2 attach="fog" args={[theme.fog, theme.fogDensity]} />

      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, theme.hemiIntensity]} />
      <directionalLight position={theme.sunPos} intensity={theme.sunIntensity} color={theme.sun} />
      <directionalLight position={[-150, 120, -120]} intensity={theme.rimIntensity} color={theme.rim} />
      <ambientLight intensity={theme.ambient} color={theme.ambientColor} />

      <Suspense fallback={null}>
        {theme.stars > 0 && (
          <Stars radius={900} depth={140} count={Math.round(2600 * theme.stars)} factor={5} saturation={0.4} fade speed={0.4} />
        )}
        <City />
        <Traffic />
        <WeatherFx />
        {screen === 'game' && (
          <>
            <PlayerDrone />
            <MissionMarkers />
          </>
        )}
        {screen === 'menu' && <MenuCamera />}
      </Suspense>

      {quality === 'high' && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={theme.bloom} luminanceThreshold={0.85} luminanceSmoothing={0.2} />
          <Vignette eskil={false} offset={0.18} darkness={theme.id === 'day' ? 0.45 : 0.78} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
