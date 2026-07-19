import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import gsap from 'gsap'

const GITHUB_WIN =
  'https://github.com/skelleya/nepsis-chat/releases/latest/download/NepsisChat-Setup.exe'
const GITHUB_RELEASES_API = 'https://api.github.com/repos/skelleya/nepsis-chat/releases/latest'
const GITHUB_RELEASES_PAGE = 'https://github.com/skelleya/nepsis-chat/releases/latest'

function detectPlatform(): 'windows' | 'mac' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()
  if (platform.includes('mac') || ua.includes('mac os')) return 'mac'
  if (platform.includes('win') || ua.includes('windows')) return 'windows'
  return 'other'
}

export function DownloadPage() {
  const [availableWin, setAvailableWin] = useState<boolean | null>(null)
  const [availableMac, setAvailableMac] = useState<boolean | null>(null)
  const [macUrl, setMacUrl] = useState<string | null>(null)
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
        const win = assets.find((a) => a.name === 'NepsisChat-Setup.exe')
        const mac =
          assets.find((a) => /\.dmg$/i.test(a.name)) ||
          assets.find((a) => /mac.*\.zip$/i.test(a.name))
        setAvailableWin(!!win)
        setAvailableMac(!!mac)
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

  const primaryIsMac = platform === 'mac'
  const checking = availableWin === null && availableMac === null

  return (
    <div
      ref={pageRef}
      className="min-h-screen flex items-center justify-center bg-app-darker will-change-transform"
    >
      <div ref={cardRef} className="w-full max-w-lg p-8 rounded-xl bg-app-dark text-center">
        <img src="./logo.png" alt="Nepsis" className="h-14 mx-auto mb-4 object-contain bg-white rounded-full p-1" />
        <h1 className="text-2xl font-bold text-white mb-2">Download Nepsis Chat</h1>
        <p className="text-app-muted mb-6">
          Same experience as the web app — voice, chat, and servers — as a native desktop app for Windows and macOS.
        </p>

        {checking ? (
          <div className="inline-block px-8 py-4 rounded-lg bg-app-channel text-app-muted">
            Checking availability...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(primaryIsMac ? ['mac', 'windows'] : ['windows', 'mac']).map((os) => {
              const isMac = os === 'mac'
              const available = isMac ? availableMac : availableWin
              const href = isMac ? macUrl || GITHUB_RELEASES_PAGE : GITHUB_WIN
              const label = isMac ? 'Download for macOS' : 'Download for Windows (.exe)'
              return (
                <div key={os}>
                  {available ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block w-full px-8 py-4 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors"
                    >
                      {label}
                    </a>
                  ) : (
                    <div className="w-full px-6 py-3 rounded-lg bg-app-channel text-app-muted text-sm">
                      {isMac ? 'macOS build' : 'Windows build'} — coming soon on{' '}
                      <a href={GITHUB_RELEASES_PAGE} className="text-app-accent hover:underline" target="_blank" rel="noreferrer">
                        GitHub Releases
                      </a>
                    </div>
                  )}
                </div>
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
