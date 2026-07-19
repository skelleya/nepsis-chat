import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { detectPlatform } from '../utils/detectPlatform'

const GITHUB_WIN =
  'https://github.com/skelleya/nepsis-chat/releases/latest/download/NepsisChat-Setup.exe'
const GITHUB_RELEASES_API = 'https://api.github.com/repos/skelleya/nepsis-chat/releases/latest'
const GITHUB_RELEASES_PAGE = 'https://github.com/skelleya/nepsis-chat/releases/latest'

function AppleLogo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.22-1.98 1.08-3.13-1.05.04-2.31.7-3.06 1.58-.67.78-1.25 2.05-1.1 3.25 1.16.09 2.35-.66 3.08-1.7z" />
    </svg>
  )
}

function WindowsLogo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 5.5L11 4.3v7.2H3V5.5zm0 13L11 19.7v-7.2H3v6zm8.5 1.1L21 21V12.5h-9.5v7.1zM12.5 11.5H21V3l-8.5 1.2v7.3z" />
    </svg>
  )
}

export function DownloadPage() {
  const [availableWin, setAvailableWin] = useState<boolean | null>(null)
  const [availableMac, setAvailableMac] = useState<boolean | null>(null)
  const [macUrl, setMacUrl] = useState<string | null>(null)
  const [winUrl, setWinUrl] = useState<string | null>(null)
  const navigate = useNavigate()
  const pageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)
  const platform = detectPlatform()

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    fetch(GITHUB_RELEASES_API, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        clearTimeout(timeout)
        if (!data?.assets) {
          setAvailableWin(false)
          setAvailableMac(false)
          return
        }
        const assets = data.assets as { name: string; browser_download_url: string }[]
        const win =
          assets.find((a) => a.name === 'NepsisChat-Setup.exe') ||
          assets.find((a) => /\.exe$/i.test(a.name))
        const mac =
          assets.find((a) => /\.dmg$/i.test(a.name)) ||
          assets.find((a) => /mac.*\.zip$/i.test(a.name)) ||
          assets.find((a) => /\.zip$/i.test(a.name) && /darwin|mac|arm64|x64/i.test(a.name))
        setAvailableWin(!!win)
        setAvailableMac(!!mac)
        setWinUrl(win?.browser_download_url || null)
        setMacUrl(mac?.browser_download_url || null)
      })
      .catch(() => {
        clearTimeout(timeout)
        setAvailableWin(false)
        setAvailableMac(false)
      })
  }, [])

  useLayoutEffect(() => {
    const page = pageRef.current
    const card = cardRef.current
    if (!page || !card) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        page,
        { opacity: 0, y: 64 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', force3D: false }
      )
      gsap.fromTo(
        card,
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          duration: 0.58,
          ease: 'power3.out',
          delay: 0.06,
          force3D: false,
        }
      )
    }, page)

    return () => ctx.revert()
  }, [])

  const goHome = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (leaving) return
    setLeaving(true)
    const page = pageRef.current
    if (page) {
      await new Promise<void>((resolve) => {
        gsap.to(page, {
          opacity: 0,
          y: 48,
          duration: 0.35,
          ease: 'power2.in',
          force3D: false,
          onComplete: () => resolve(),
        })
      })
    }
    navigate('/')
  }

  const checking = availableWin === null && availableMac === null
  const order: Array<'mac' | 'windows'> =
    platform === 'mac' ? ['mac', 'windows'] : ['windows', 'mac']

  return (
    <div
      ref={pageRef}
      className="min-h-screen flex items-center justify-center bg-app-darker will-change-transform"
    >
      <div ref={cardRef} className="w-full max-w-lg p-8 rounded-xl bg-app-dark text-center">
        <img src="./logo.png" alt="Nepsis" className="h-14 mx-auto mb-4 object-contain bg-white rounded-full p-1" />
        <h1 className="text-2xl font-bold text-white mb-2">Install Nepsis Chat</h1>
        <p className="text-app-muted mb-2">
          Same experience as the web app — voice, chat, and servers — as a native desktop app.
        </p>
        <p className="text-app-muted text-sm mb-6">
          {platform === 'mac'
            ? 'We detected macOS — install for Mac is recommended.'
            : platform === 'windows'
              ? 'We detected Windows — install for Windows is recommended.'
              : 'Choose your platform below.'}
        </p>

        {checking ? (
          <div className="inline-block px-8 py-4 rounded-lg bg-app-channel text-app-muted">
            Checking availability...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {order.map((os, index) => {
              const isMac = os === 'mac'
              const available = isMac ? availableMac : availableWin
              const href = isMac ? macUrl || GITHUB_RELEASES_PAGE : winUrl || GITHUB_WIN
              const isPrimary = index === 0 && platform !== 'other'
              const label = isMac ? 'Install for Mac' : 'Install for Windows'
              const Logo = isMac ? AppleLogo : WindowsLogo

              if (!available) {
                return (
                  <div
                    key={os}
                    className="w-full px-6 py-4 rounded-lg bg-app-channel text-app-muted text-sm flex items-center justify-center gap-3"
                  >
                    <Logo className="w-5 h-5 opacity-50" />
                    <span>
                      {label} — coming soon on{' '}
                      <a
                        href={GITHUB_RELEASES_PAGE}
                        className="text-app-accent hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        GitHub Releases
                      </a>
                    </span>
                  </div>
                )
              }

              return (
                <a
                  key={os}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full px-6 py-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-3 ${
                    isPrimary
                      ? 'bg-app-accent hover:bg-app-accent-hover text-white'
                      : 'bg-app-channel hover:bg-app-hover text-app-text border border-app-hover/40'
                  }`}
                >
                  <Logo className="w-7 h-7 shrink-0" />
                  <span className="text-base">{label}</span>
                </a>
              )
            })}
          </div>
        )}

        <p className="text-app-muted text-sm mt-6">
          Desktop updates show a Nepsis badge at the top of the app when a new version is ready.
        </p>
        <p className="text-app-muted text-sm mt-4">Or use the web app in your browser.</p>
        <Link
          to="/"
          onClick={goHome}
          className="inline-block mt-4 text-app-accent hover:underline"
        >
          Open web app
        </Link>
      </div>
    </div>
  )
}
