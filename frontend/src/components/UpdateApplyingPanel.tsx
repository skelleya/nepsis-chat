import { useEffect, useState } from 'react'

export const UPDATE_APPLY_STEPS = [
  'Preparing update packages',
  'Verifying downloaded files',
  'Installing application files',
  'Applying configuration',
  'Restarting Nepsis Chat',
] as const

type UpdateApplyingPanelProps = {
  /** When true, advance through Discord-like apply steps. */
  active: boolean
  versionLabel?: string | null
  error?: string | null
  /** Optional override for the step list (defaults to install/restart steps). */
  steps?: readonly string[]
  footer?: string
}

/**
 * Discord-style “Applying update N of M” progress used while installing / restarting.
 */
export function UpdateApplyingPanel({
  active,
  versionLabel,
  error,
  steps = UPDATE_APPLY_STEPS,
  footer = 'Do not close the app. Nepsis will reopen automatically.',
}: UpdateApplyingPanelProps) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setStepIndex(0)
      return
    }
    setStepIndex(0)
    const id = window.setInterval(() => {
      setStepIndex((prev) => (prev >= steps.length - 1 ? prev : prev + 1))
    }, 750)
    return () => window.clearInterval(id)
  }, [active, steps.length])

  const current = Math.min(stepIndex, steps.length - 1)
  const percent = Math.max(8, Math.round(((current + 1) / steps.length) * 100))

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-app-text">{steps[current]}</p>
          <p className="shrink-0 text-xs tabular-nums text-app-muted">
            {current + 1} of {steps.length}
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-app-glass/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff7a3d] to-app-accent shadow-[0_0_16px_rgba(255,90,31,0.35)] transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        {versionLabel ? (
          <p className="mt-2 text-xs text-app-muted">Installing {versionLabel}</p>
        ) : null}
      </div>

      <ul className="space-y-1.5">
        {steps.map((label, i) => {
          const done = i < current
          const activeStep = i === current
          return (
            <li
              key={label}
              className={`flex items-center gap-2.5 text-[12.5px] ${
                done ? 'text-[#23a559]' : activeStep ? 'text-app-text' : 'text-app-muted'
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  done
                    ? 'bg-[#23a559]'
                    : activeStep
                      ? 'bg-app-accent shadow-[0_0_0_4px_rgba(255,90,31,0.18)]'
                      : 'bg-app-glass/20'
                }`}
              />
              {label}
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-app-muted">{footer}</p>
      {error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
