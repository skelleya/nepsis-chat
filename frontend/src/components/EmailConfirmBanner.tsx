import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useApp } from '../contexts/AppContext'

const DISMISS_KEY = 'nepsis_email_confirm_banner_dismissed'

/**
 * Top dropdown banner for registered users who signed up before confirming email.
 * Dismissible for the session; returns after reload until Supabase marks email confirmed.
 */
export function EmailConfirmBanner() {
  const { needsEmailConfirmation, authEmail, resendConfirmationEmail } = useApp()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!needsEmailConfirmation) {
      setMounted(false)
      setMessage(null)
      sessionStorage.removeItem(DISMISS_KEY)
      return
    }
    if (sessionStorage.getItem(DISMISS_KEY) === '1') {
      setMounted(false)
      return
    }
    setMounted(true)
  }, [needsEmailConfirmation])

  useLayoutEffect(() => {
    if (!mounted) {
      document.documentElement.style.removeProperty('--email-confirm-banner-height')
      return
    }
    const el = bannerRef.current
    if (!el) return

    gsap.set(el, { y: -56, opacity: 0 })
    gsap.to(el, {
      y: 0,
      opacity: 1,
      duration: 0.45,
      ease: 'power3.out',
    })

    const updateHeight = () => {
      document.documentElement.style.setProperty('--email-confirm-banner-height', `${el.offsetHeight}px`)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(el)
    return () => {
      observer.disconnect()
      gsap.killTweensOf(el)
      document.documentElement.style.removeProperty('--email-confirm-banner-height')
    }
  }, [mounted])

  const dismiss = () => {
    if (closing) return
    setClosing(true)
    sessionStorage.setItem(DISMISS_KEY, '1')
    const el = bannerRef.current
    if (!el) {
      setMounted(false)
      setClosing(false)
      return
    }
    gsap.to(el, {
      y: -56,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        document.documentElement.style.removeProperty('--email-confirm-banner-height')
        setMounted(false)
        setClosing(false)
      },
    })
  }

  const resend = async () => {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      await resendConfirmationEmail()
      setMessage('Confirmation email sent. Check your inbox.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not resend email')
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  const isElectron = !!window.electronAPI?.isElectron
  const topOffset = isElectron ? 'top-8' : 'top-0'

  return (
    <div className={`fixed ${topOffset} left-0 right-0 z-[55] flex justify-center pointer-events-none`}>
      <div
        ref={bannerRef}
        className="pointer-events-auto mx-3 mt-0 flex max-w-3xl items-center gap-3 rounded-b-xl border border-amber-400/30 bg-[#2b2110] px-4 py-2.5 text-amber-50 shadow-lg will-change-transform"
        role="status"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-snug">
            Confirm your email to finish setting up your account
          </p>
          <p className="text-[12px] text-amber-100/80 leading-snug mt-0.5">
            We sent a link{authEmail ? ` to ${authEmail}` : ''}. You can keep using Nepsis, but confirm soon so you don’t lose access.
            {message ? ` ${message}` : ''}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void resend()}
          className="shrink-0 rounded-md bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-[#1a1408] hover:bg-amber-300 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Resend email'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1.5 text-amber-100/80 hover:bg-white/10 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
