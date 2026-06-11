import { useEffect } from 'react'
import { Scene } from './components/Scene'
import { attachKeyboard, runtime } from './game/runtime'
import { setMuted, startEngine, stopEngine } from './game/sfx'
import { useGame } from './state/store'
import { HUD } from './ui/HUD'
import { MainMenu } from './ui/MainMenu'
import { ChapterIntro, MissionPreview, PauseMenu, ResultModal, Toasts } from './ui/Overlays'
import { Panels } from './ui/Panels'
import { TouchControls } from './ui/TouchControls'

export default function App() {
  const screen = useGame(s => s.screen)
  const muted = useGame(s => s.muted)

  useEffect(() => attachKeyboard(), [])
  useEffect(() => setMuted(muted), [muted])
  useEffect(() => {
    // motor hum + wind ambience only while flying
    if (screen === 'game') startEngine()
    else stopEngine()
    return stopEngine
  }, [screen])
  useEffect(() => {
    useGame.getState().claimLoginBonus()
  }, [])
  useEffect(() => {
    if (import.meta.env.DEV) {
      // dev console hook for testing: window.__skydrop.runtime / .store
      ;(window as unknown as Record<string, unknown>).__skydrop = { runtime, store: useGame }
    }
  }, [])

  return (
    <div className="app">
      <Scene />
      {screen === 'menu' && <MainMenu />}
      {screen === 'game' && (
        <>
          <HUD />
          <TouchControls />
        </>
      )}
      <Panels />
      <MissionPreview />
      <Toasts />
      <ResultModal />
      <ChapterIntro />
      <PauseMenu />
    </div>
  )
}
