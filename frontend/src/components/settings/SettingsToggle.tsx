import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'

interface SettingsToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

/** Animated on/off switch used across User Settings tabs. */
export function SettingsToggle({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
  className = '',
}: SettingsToggleProps) {
  const trackRef = useRef<HTMLButtonElement>(null)
  const knobRef = useRef<HTMLSpanElement>(null)
  const readyRef = useRef(false)

  useLayoutEffect(() => {
    const track = trackRef.current
    const knob = knobRef.current
    if (!track || !knob) return

    const x = checked ? 20 : 0
    const accentRaw =
      getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim() || '88 101 242'
    const darkRaw =
      getComputedStyle(document.documentElement).getPropertyValue('--app-dark').trim() || '30 31 34'
    const toCss = (raw: string) => (raw.includes(' ') ? `rgb(${raw})` : raw)
    const bg = checked ? toCss(accentRaw) : toCss(darkRaw)

    gsap.killTweensOf([track, knob])

    if (!readyRef.current) {
      gsap.set(knob, { x })
      gsap.set(track, { backgroundColor: bg })
      readyRef.current = true
      return
    }

    gsap.to(knob, {
      x,
      duration: 0.32,
      ease: 'power3.out',
    })
    gsap.fromTo(
      knob,
      { scale: 0.88 },
      { scale: 1, duration: 0.28, ease: 'back.out(2.2)' }
    )
    gsap.to(track, {
      backgroundColor: bg,
      duration: 0.28,
      ease: 'sine.out',
    })
  }, [checked])

  return (
    <button
      ref={trackRef}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <span
        ref={knobRef}
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm will-change-transform pointer-events-none"
      />
    </button>
  )
}
