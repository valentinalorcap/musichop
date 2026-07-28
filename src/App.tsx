import { useState } from 'react'
import Wizard from './components/Wizard'
import Stage1Spotify from './components/Stage1Spotify'
import Stage2File from './components/Stage2File'
import Stage3Playlists from './components/Stage3Playlists'
import Stage4Migration from './components/Stage4Migration'
import Stage5Report from './components/Stage5Report'
import type { StageId } from './types'

export default function App() {
  const [current, setCurrent] = useState<StageId>(1)
  const [maxReached, setMaxReached] = useState<StageId>(1)

  const goTo = (id: StageId) => {
    setCurrent(id)
    setMaxReached((m) => (id > m ? id : m))
  }
  const next = () => current < 5 && goTo((current + 1) as StageId)
  const prev = () => current > 1 && goTo((current - 1) as StageId)

  return (
    <Wizard
      current={current}
      maxReached={maxReached}
      onStepClick={goTo}
      nav={{
        onPrev: current > 1 ? prev : undefined,
        onNext: current < 5 ? next : undefined,
        hidePrev: current === 1,
      }}
    >
      {current === 1 && <Stage1Spotify />}
      {current === 2 && <Stage2File />}
      {current === 3 && <Stage3Playlists />}
      {current === 4 && <Stage4Migration />}
      {current === 5 && <Stage5Report />}
    </Wizard>
  )
}
