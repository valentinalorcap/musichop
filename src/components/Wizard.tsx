import type { ReactNode } from 'react'
import type { StageId, StageMeta } from '../types'
import './Wizard.css'

export const STAGES: StageMeta[] = [
  { id: 1, label: 'Conectá Spotify', short: 'Spotify' },
  { id: 2, label: 'Subí tu archivo', short: 'Archivo' },
  { id: 3, label: 'Elegí playlists', short: 'Playlists' },
  { id: 4, label: 'Migrá', short: 'Migrar' },
  { id: 5, label: 'Informe', short: 'Informe' },
]

interface WizardProps {
  current: StageId
  /** stage máximo desbloqueado — permite volver a stages anteriores */
  maxReached: StageId
  onStepClick?: (id: StageId) => void
  children: ReactNode
  /** nav footer; si se omite, el stage maneja su propia navegación */
  nav?: {
    onPrev?: () => void
    onNext?: () => void
    prevLabel?: string
    nextLabel?: string
    prevDisabled?: boolean
    nextDisabled?: boolean
    hidePrev?: boolean
  }
}

export default function Wizard({ current, maxReached, onStepClick, children, nav }: WizardProps) {
  return (
    <div className="wizard">
      <div className="wizard-topbar">
        <span className="wizard-logo">
          Me cambio a <span>Spotify</span>
        </span>
      </div>

      <div className="stepper" role="tablist" aria-label="Pasos">
        {STAGES.map((s) => {
          const state = s.id < current ? 'done' : s.id === current ? 'active' : 'todo'
          const clickable = s.id <= maxReached && s.id !== current
          return (
            <button
              key={s.id}
              type="button"
              className={`step ${state}`}
              onClick={clickable ? () => onStepClick?.(s.id) : undefined}
              disabled={!clickable}
              aria-selected={s.id === current}
              role="tab"
              style={{ background: 'none', border: 'none', cursor: clickable ? 'pointer' : 'default' }}
            >
              <span className="step-dot">{s.id < current ? '✓' : s.id}</span>
              <span className="step-label">{s.short}</span>
            </button>
          )
        })}
      </div>

      <div className="wizard-body">{children}</div>

      {nav && (
        <div className="wizard-nav">
          {nav.hidePrev ? (
            <span />
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={nav.onPrev}
              disabled={nav.prevDisabled || !nav.onPrev}
            >
              ← {nav.prevLabel ?? 'Volver'}
            </button>
          )}
          {nav.onNext && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={nav.onNext}
              disabled={nav.nextDisabled}
            >
              {nav.nextLabel ?? 'Continuar'} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
