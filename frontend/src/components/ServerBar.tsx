import type { Server } from '../types'

interface ServerBarProps {
  servers: Server[]
  currentServerId: string | null
  onSelectServer: (serverId: string) => void
}

export function ServerBar({ servers, currentServerId, onSelectServer }: ServerBarProps) {
  return (
    <div className="w-[72px] bg-app-dark flex flex-col items-center py-3 gap-2">
      <img src="./logo.png" alt="Nepsis" className="w-10 h-10 object-contain flex-shrink-0 bg-white rounded-full p-1" />
      <div className="w-12 h-12 rounded-2xl bg-app-accent flex items-center justify-center text-white font-bold text-lg cursor-pointer hover:rounded-xl transition-all hover:bg-app-accent-hover">
        +
      </div>
      <div className="w-12 h-0.5 bg-app-channel rounded-full" />
      {servers.map((server) => (
        <button
          key={server.id}
          onClick={() => onSelectServer(server.id)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm transition-all hover:rounded-xl ${
            currentServerId === server.id
              ? 'bg-app-accent rounded-xl'
              : 'bg-app-channel hover:bg-app-accent hover:rounded-xl'
          }`}
        >
          {server.name.charAt(0)}
        </button>
      ))}
    </div>
  )
}
