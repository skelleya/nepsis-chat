import { Link } from 'react-router-dom'

// Installer is on GitHub Releases — fixed artifact name for stable URL
const GITHUB_DOWNLOAD_URL = 'https://github.com/skelleya/nepsis-chat/releases/latest/download/NepsisChat-Setup.exe'

export function DownloadPage() {

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-darker">
      <div className="w-full max-w-lg p-8 rounded-xl bg-app-dark text-center">
        <img src="./logo.png" alt="Nepsis" className="h-14 mx-auto mb-4 object-contain bg-white rounded-full p-1" />
        <h1 className="text-2xl font-bold text-white mb-2">Download Nepsis Chat</h1>
        <p className="text-app-muted mb-6">
          Get the desktop app for Windows. Voice chat with WebRTC and Opus audio.
        </p>
        <a
          href={GITHUB_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-4 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors"
        >
          Download for Windows (.exe)
        </a>
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
