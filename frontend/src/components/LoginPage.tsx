import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const { login } = useApp()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    await login(username.trim())
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-darker">
      <div className="w-full max-w-md p-8 rounded-xl bg-app-dark">
        <img src="./logo.png" alt="Nepsis" className="h-12 mx-auto mb-6 object-contain" />
        <h1 className="text-2xl font-bold text-white text-center mb-6">Nepsis Chat</h1>
        <p className="text-center mb-4">
          <Link to="/download" className="text-app-accent hover:underline text-sm">Download desktop app</Link>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-app-muted mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-4 py-3 rounded-lg bg-app-channel text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
