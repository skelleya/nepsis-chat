import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// Installer is on GitHub Releases — fixed artifact name for stable URL
const GITHUB_DOWNLOAD_URL = 'https://github.com/skelleya/nepsis-chat/releases/latest/download/NepsisChat-Setup.exe'
const GITHUB_RELEASES_API = 'https://api.github.com/repos/skelleya/nepsis-chat/releases/latest'

export function DownloadPage() {
  const [available, setAvailable] = useState<boolean | null>(null)

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
          setAvailable(false)
          return
        }
        const hasExe = data.assets.some((a: { name: string }) =>
          a.name === 'NepsisChat-Setup.exe'
        )
        setAvailable(hasExe)
      })
      .catch(() => {
        clearTimeout(timeout)
        setAvailable(false)
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-darker">
      <div className="w-full max-w-lg p-8 rounded-xl bg-app-dark text-center">
        <img src="./logo.png" alt="Nepsis" className="h-14 mx-auto mb-4 object-contain bg-white rounded-full p-1" />
        <h1 className="text-2xl font-bold text-white mb-2">Download Nepsis Chat</h1>
        <p className="text-app-muted mb-6">
          Get the desktop app for Windows. Voice chat with WebRTC and Opus audio.
        </p>
        {available === null ? (
          <div className="inline-block px-8 py-4 rounded-lg bg-app-channel text-app-muted">
            Checking availability...
          </div>
        ) : available ? (
          <>
            <span className="inline-block px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-sm font-medium mb-3">
              Available
            </span>
            <a
              href={GITHUB_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors"
            >
              Download for Windows (.exe)
            </a>
          </>
        ) : (
          <>
            <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium mb-3">
              Coming soon
            </span>
            <p className="text-app-muted text-sm mb-2">
              The desktop app is not yet published. Run <code className="bg-app-channel px-1 rounded">npm run release</code> to build and publish.
            </p>
            <a
              href="https://github.com/skelleya/nepsis-chat/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 rounded-lg bg-app-channel text-app-muted hover:text-app-text text-sm"
            >
              View releases
            </a>
          </>
        )}
        <p className="text-app-muted text-sm mt-4">
          Or use the web app in your browser.
        </p>
        <Link
          to="/"
          className="inline-block mt-4 text-app-accent hover:underline"
        >
          Open web app
        </Link>
      </div>
    </div>
  )
}
