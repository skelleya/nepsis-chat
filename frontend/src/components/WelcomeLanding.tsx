import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { detectPlatform } from '../utils/detectPlatform'

export type WelcomeLandingHandle = {
  /** Animate landing out, then resolve (for Use Web App / Download). */
  exit: (direction: 'left' | 'right' | 'up') => Promise<void>
}

interface WelcomeLandingProps {
  onUseWebApp: () => void
  onDownloadApp: () => void
}

/**
 * Pre-auth home: white split composition — brand/logo left, two clear CTAs right.
 */
export const WelcomeLanding = forwardRef<WelcomeLandingHandle, WelcomeLandingProps>(
  function WelcomeLanding({ onUseWebApp, onDownloadApp }, ref) {
    const rootRef = useRef<HTMLDivElement>(null)
    const logoRef = useRef<HTMLDivElement>(null)
    const copyRef = useRef<HTMLDivElement>(null)
    const isElectron = !!(window as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron
    const platform = useMemo(() => detectPlatform(), [])
    const installLabel =
      platform === 'mac' ? 'Install for Mac' : platform === 'windows' ? 'Install for Windows' : 'Install Desktop App'
    const installHint =
      platform === 'mac' ? 'macOS desktop app' : platform === 'windows' ? 'Windows desktop app' : 'Windows & macOS'

    useImperativeHandle(ref, () => ({
      exit: (direction) =>
        new Promise<void>((resolve) => {
          const root = rootRef.current
          if (!root) {
            resolve()
            return
          }
          const x = direction === 'left' ? -80 : direction === 'right' ? 80 : 0
          const y = direction === 'up' ? -56 : 0
          gsap.killTweensOf(root)
          gsap.to(root, {
            opacity: 0,
            x,
            y,
            duration: 0.42,
            ease: 'power3.in',
            force3D: false,
            onComplete: () => resolve(),
          })
        }),
    }))

    useLayoutEffect(() => {
      const root = rootRef.current
      const logo = logoRef.current
      const copy = copyRef.current
      if (!root || !logo || !copy) return

      const ctx = gsap.context(() => {
        gsap.set(root, { opacity: 1, x: 0, y: 0 })
        gsap.set(logo, { opacity: 0, x: -36, scale: 0.96 })
        gsap.set(copy, { opacity: 0, x: 28 })
        gsap.set(copy.querySelectorAll('[data-cta]'), { opacity: 0, y: 16 })

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.to(logo, { opacity: 1, x: 0, scale: 1, duration: 0.75 }, 0.08)
          .to(copy, { opacity: 1, x: 0, duration: 0.65 }, 0.22)
          .to(
            copy.querySelectorAll('[data-cta]'),
            {
              opacity: 1,
              y: 0,
              duration: 0.45,
              stagger: 0.1,
            },
            0.38,
          )
      }, root)

      return () => ctx.revert()
    }, [])

    return (
      <div
        ref={rootRef}
        className="landing-root fixed inset-0 z-20 flex flex-col lg:flex-row overflow-hidden will-change-transform"
      >
        <div className="pointer-events-none absolute inset-0 landing-atmosphere" aria-hidden />

        <section className="relative flex-1 flex items-center justify-center px-8 py-14 lg:py-0 min-h-[42vh] lg:min-h-0">
          <div
            ref={logoRef}
            className="relative flex flex-col items-center lg:items-start gap-6 max-w-[min(92vw,28rem)]"
          >
            <img
              src="./logo.png"
              alt="Nepsis"
              className="w-[min(72vw,22rem)] h-auto object-contain select-none landing-logo"
              draggable={false}
            />
            <p className="landing-wordmark text-center lg:text-left tracking-[0.28em] uppercase text-[11px] sm:text-xs font-semibold">
              Nepsis
            </p>
          </div>
        </section>

        <section className="relative flex-1 flex items-center justify-center lg:justify-start px-8 pb-16 lg:pb-0 lg:pl-6 lg:pr-16">
          <div ref={copyRef} className="w-full max-w-md">
            <h1 className="landing-headline text-[2.15rem] sm:text-5xl leading-[1.05] font-semibold text-[#141414] mb-3">
              Jump in.
            </h1>
            <p className="landing-sub text-[1.05rem] leading-relaxed text-[#5c5a57] mb-10 max-w-sm">
              Voice, chat, and servers — in the browser or on your desktop.
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                data-cta
                onClick={onUseWebApp}
                className="landing-cta-primary group w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>
                  <span className="block text-[1.05rem] font-semibold tracking-tight">Use Web App</span>
                  <span className="block text-sm font-normal opacity-80 mt-0.5">Open in this browser</span>
                </span>
                <span
                  className="landing-cta-arrow shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                >
                  →
                </span>
              </button>

              {!isElectron && (
                <button
                  type="button"
                  data-cta
                  onClick={onDownloadApp}
                  className="landing-cta-secondary group w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span className="flex items-start gap-3 min-w-0">
                    <img
                      src={platform === 'mac' ? './icons/apple.svg' : './icons/windows.svg'}
                      alt=""
                      className="mt-0.5 w-6 h-6 shrink-0 object-contain"
                      draggable={false}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-[1.05rem] font-semibold tracking-tight">{installLabel}</span>
                      <span className="block text-sm font-normal opacity-75 mt-0.5">{installHint}</span>
                    </span>
                  </span>
                  <span
                    className="landing-cta-arrow shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  >
                    ↓
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  },
)
