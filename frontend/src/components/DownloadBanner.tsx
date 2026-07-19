import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import gsap from 'gsap'

const STORAGE_KEY = 'nepsis-download-banner-dismissed'

export function DownloadBanner() {
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const isElectron = !!(window as any).electronAPI?.isElectron
    if (isElectron) return
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted || pathname === '/download') {
      document.documentElement.style.removeProperty('--download-banner-height')
      return
    }

    const el = bannerRef.current
    if (!el) return

    gsap.set(el, { y: -48, opacity: 0 })
    gsap.to(el, {
      y: 0,
      opacity: 1,
      duration: 0.5,
      ease: 'power3.out',
    })

    const updateHeight = () => {
      document.documentElement.style.setProperty('--download-banner-height', `${el.offsetHeight}px`)
    }
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(el)
    return () => {
      observer.disconnect()
      gsap.killTweensOf(el)
      document.documentElement.style.removeProperty('--download-banner-height')
    }
  }, [mounted, pathname])

  const dismiss = () => {
    if (closing) return
    setClosing(true)
    localStorage.setItem(STORAGE_KEY, '1')

    const el = bannerRef.current
    if (!el) {
      setMounted(false)
      return
    }

    gsap.to(el, {
      y: -48,
      opacity: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        document.documentElement.style.removeProperty('--download-banner-height')
        setMounted(false)
      },
    })
  }

  // Landing already offers Download App; keep banner off home + download
  if (!mounted || pathname === '/download' || pathname === '/') return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div
        ref={bannerRef}
        className="pointer-events-auto flex items-center gap-3 bg-app-accent text-white pl-4 pr-2 py-2 rounded-b-xl shadow-sm will-change-transform"
      >
        <p className="text-[13px] font-medium leading-snug whitespace-nowrap">
          Prefer the desktop app?
        </p>
        <Link
          to="/download"
          className="flex-shrink-0 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 font-medium text-[13px] transition-colors whitespace-nowrap"
        >
          Download
        </Link>
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss"
          aria-label="Dismiss banner"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
