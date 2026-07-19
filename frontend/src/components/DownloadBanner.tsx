import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { detectPlatform } from '../utils/detectPlatform'

const STORAGE_KEY = 'nepsis-download-banner-dismissed'

export function DownloadBanner() {
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const platform = useMemo(() => detectPlatform(), [])
  const installCta =
    platform === 'mac' ? 'Install for Mac' : platform === 'windows' ? 'Install for Windows' : 'Install'

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
        <p className="text-[13px] font-medium leading-snug whitespace-nowrap flex items-center gap-2">
          {platform === 'mac' ? (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.22-1.98 1.08-3.13-1.05.04-2.31.7-3.06 1.58-.67.78-1.25 2.05-1.1 3.25 1.16.09 2.35-.66 3.08-1.7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 5.5L11 4.3v7.2H3V5.5zm0 13L11 19.7v-7.2H3v6zm8.5 1.1L21 21V12.5h-9.5v7.1zM12.5 11.5H21V3l-8.5 1.2v7.3z" />
            </svg>
          )}
          Prefer the desktop app?
        </p>
        <Link
          to="/download"
          className="flex-shrink-0 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 font-medium text-[13px] transition-colors whitespace-nowrap"
        >
          {installCta}
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
