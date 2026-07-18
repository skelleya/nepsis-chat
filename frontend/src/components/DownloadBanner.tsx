import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

const STORAGE_KEY = 'nepsis-download-banner-dismissed'

export function DownloadBanner() {
  const [visible, setVisible] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const isElectron = !!(window as any).electronAPI?.isElectron
    if (isElectron) return
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  useEffect(() => {
    if (!visible || pathname === '/download') {
      document.documentElement.style.removeProperty('--download-banner-height')
      return
    }

    const el = bannerRef.current
    if (!el) return

    const updateHeight = () => {
      document.documentElement.style.setProperty('--download-banner-height', `${el.offsetHeight}px`)
    }
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--download-banner-height')
    }
  }, [visible, pathname])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!visible || pathname === '/download') return null

  return (
    <div ref={bannerRef} className="fixed top-0 left-0 right-0 z-50 bg-app-accent text-white shadow-lg">
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-5xl mx-auto">
        <p className="flex-1 min-w-0 text-sm font-semibold leading-snug">
          Using the web app? Download Nepsis for desktop for a better experience.
        </p>
        <Link
          to="/download"
          className="flex-shrink-0 px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 font-medium text-sm transition-colors whitespace-nowrap"
        >
          Download
        </Link>
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1.5 rounded hover:bg-white/20 transition-colors"
          title="Dismiss"
          aria-label="Dismiss banner"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
