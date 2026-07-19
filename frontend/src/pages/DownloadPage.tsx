import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { detectPlatform, type DetectedOs } from '../utils/detectPlatform'

const GITHUB_WIN =
  'https://github.com/skelleya/nepsis-chat/releases/latest/download/NepsisChat-Setup.exe'
const GITHUB_RELEASES_API = 'https://api.github.com/repos/skelleya/nepsis-chat/releases/latest'
const GITHUB_RELEASES_PAGE = 'https://github.com/skelleya/nepsis-chat/releases/latest'

type InstallerId = 'mac' | 'windows' | 'linux'

/** Start the installer file download immediately (no new tab). */
function startInstallerDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  a.style.display = 'none'
  // Helps same-origin; GitHub still sends Content-Disposition: attachment
  a.setAttribute('download', '')
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function PlatformLogo({
  os,
  className = 'w-7 h-7',
  invert = false,
}: {
  os: InstallerId
  className?: string
  invert?: boolean
}) {
  const src =
    os === 'mac' ? './icons/apple.svg' : os === 'windows' ? './icons/windows.svg' : './icons/linux.svg'
  const alt = os === 'mac' ? 'Apple' : os === 'windows' ? 'Windows' : 'Linux'
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-contain shrink-0 ${invert ? 'brightness-0 invert' : ''}`}
      draggable={false}
    />
  )
}

export function DownloadPage() {
  const [availableWin, setAvailableWin] = useState<boolean | null>(null)
  const [availableMac, setAvailableMac] = useState<boolean | null>(null)
  const [macUrl, setMacUrl] = useState<string | null>(null)
  const [winUrl, setWinUrl] = useState<string | null>(null)
  const platform = detectPlatform()
  const [showOther, setShowOther] = useState(() => platform === 'other')
  const [downloading, setDownloading] = useState<InstallerId | null>(null)
  const navigate = useNavigate()
  const pageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const otherRef = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)

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

  useLayoutEffect(() => {
    const el = otherRef.current
    if (!el) return
    if (showOther) {
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.35, ease: 'power2.out' }
      )
    }
  }, [showOther])

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

  const primaryOs: InstallerId | null =
    platform === 'mac' ? 'mac' : platform === 'windows' ? 'windows' : null

  const urlFor = useCallback(
    (os: InstallerId): string | null => {
      if (os === 'mac') return macUrl
      if (os === 'windows') return winUrl || GITHUB_WIN
      return null
    },
    [macUrl, winUrl]
  )

  const availableFor = (os: InstallerId): boolean | null => {
    if (os === 'mac') return availableMac
    if (os === 'windows') return availableWin
    return false
  }

  const labelFor = (os: InstallerId) =>
    os === 'mac' ? 'Install for Mac' : os === 'windows' ? 'Install for Windows' : 'Install for Linux'

  const handleInstall = (os: InstallerId) => {
    if (os === 'linux') return
    const url = urlFor(os)
    if (!url || !availableFor(os)) return
    setDownloading(os)
    startInstallerDownload(url)
    // Clear “Downloading…” after the browser has taken the download
    window.setTimeout(() => setDownloading(null), 2500)
  }

  const checking = availableWin === null && availableMac === null
  const primaryAvailable = primaryOs ? availableFor(primaryOs) : null
  const otherInstallers: InstallerId[] = primaryOs
    ? (['windows', 'mac', 'linux'] as InstallerId[]).filter((os) => os !== primaryOs)
    : (['windows', 'mac', 'linux'] as InstallerId[])

  const detectedHint = (p: DetectedOs) => {
    if (p === 'mac') return 'We detected macOS — your installer will download when you click Install.'
    if (p === 'windows') return 'We detected Windows — your installer will download when you click Install.'
    return 'Pick an installer below. Linux support is coming soon.'
  }

  return (
    <div
      ref={pageRef}
      className="min-h-screen flex items-center justify-center bg-app-darker will-change-transform"
    >
      <div ref={cardRef} className="w-full max-w-lg p-8 rounded-xl bg-app-dark text-center">
        <img src="./logo.png" alt="Nepsis" className="h-14 mx-auto mb-4 object-contain bg-white rounded-full p-1" />
        <h1 className="font-display text-2xl font-bold text-white mb-2">Install Nepsis Chat</h1>
        <p className="text-app-muted mb-2">
          Same experience as the web app — voice, chat, and servers — as a native desktop app.
        </p>
        <p className="text-app-muted text-sm mb-6">{detectedHint(platform)}</p>

        {checking ? (
          <div className="inline-block px-8 py-4 rounded-lg bg-app-channel text-app-muted">
            Checking availability...
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-2">
            {/* Primary: detected Mac/Windows only */}
            {primaryOs && (
              primaryAvailable ? (
                <button
                  type="button"
                  onClick={() => handleInstall(primaryOs)}
                  disabled={downloading === primaryOs}
                  className="w-full px-6 py-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-3 bg-app-accent hover:bg-app-accent-hover text-white disabled:opacity-80"
                >
                  <PlatformLogo os={primaryOs} className="w-7 h-7" invert />
                  <span className="text-base">
                    {downloading === primaryOs ? 'Downloading…' : labelFor(primaryOs)}
                  </span>
                </button>
              ) : (
                <div className="w-full px-6 py-4 rounded-lg bg-app-channel text-app-muted text-sm flex items-center justify-center gap-3">
                  <PlatformLogo os={primaryOs} className="w-5 h-5 opacity-60" invert />
                  <span>
                    {labelFor(primaryOs)} — coming soon on{' '}
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
            )}

            <button
              type="button"
              onClick={() => setShowOther((v) => !v)}
              className="text-xs text-app-muted hover:text-app-text transition-colors py-1.5 underline-offset-2 hover:underline"
              aria-expanded={showOther}
            >
              Other Installers
            </button>

            {showOther && (
              <div ref={otherRef} className="overflow-hidden flex flex-col gap-2 pt-1">
                {otherInstallers.map((os) => {
                  if (os === 'linux') {
                    return (
                      <div
                        key={os}
                        className="w-full px-5 py-3.5 rounded-lg bg-app-channel/80 border border-app-hover/30 text-app-muted flex items-center justify-center gap-3"
                      >
                        <PlatformLogo os="linux" className="w-6 h-6 opacity-80" invert />
                        <span className="text-sm font-medium">
                          Install for Linux <span className="font-normal opacity-80">— Coming soon</span>
                        </span>
                      </div>
                    )
                  }

                  const available = availableFor(os)
                  if (!available) {
                    return (
                      <div
                        key={os}
                        className="w-full px-5 py-3.5 rounded-lg bg-app-channel text-app-muted text-sm flex items-center justify-center gap-3"
                      >
                        <PlatformLogo os={os} className="w-6 h-6 opacity-60" invert />
                        <span>
                          {labelFor(os)} — coming soon
                        </span>
                      </div>
                    )
                  }

                  return (
                    <button
                      key={os}
                      type="button"
                      onClick={() => handleInstall(os)}
                      disabled={downloading === os}
                      className={`w-full px-5 py-3.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-3 disabled:opacity-80 ${
                        !primaryOs
                          ? 'bg-app-accent hover:bg-app-accent-hover text-white'
                          : 'bg-app-channel hover:bg-app-hover text-app-text border border-app-hover/40'
                      }`}
                    >
                      <PlatformLogo os={os} className="w-6 h-6" invert />
                      <span className="text-sm">
                        {downloading === os ? 'Downloading…' : labelFor(os)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <p className="text-app-muted text-sm mt-6">
          Your browser will download the installer — open it to finish installing.
        </p>

        {(platform === 'mac' || showOther) && (
          <div className="mt-5 text-left rounded-lg border border-app-hover/40 bg-app-channel/60 px-4 py-3">
            <p className="text-sm font-semibold text-app-text mb-1">Mac: “damaged and cannot be opened”?</p>
            <p className="text-xs text-app-muted mb-2 leading-relaxed">
              macOS Gatekeeper blocks unsigned downloads. After dragging Nepsis Chat to Applications, run this in Terminal, then open the app again:
            </p>
            <code className="block text-[11px] sm:text-xs text-app-text bg-app-darker rounded px-3 py-2 break-all select-all">
              xattr -cr &quot;/Applications/Nepsis Chat.app&quot;
            </code>
            <p className="text-xs text-app-muted mt-2">
              Or right-click the app → <span className="text-app-text">Open</span> → Open.
            </p>
          </div>
        )}

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
