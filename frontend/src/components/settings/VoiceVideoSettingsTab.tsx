import { useCallback, useEffect, useRef, useState } from 'react'
import { loadPrefs, updatePrefs, type VoicePrefs } from '../../services/userPrefs'
import { SettingsDropdown } from './SettingsDropdown'
import { SettingsToggle } from './SettingsToggle'

type DeviceOption = { deviceId: string; label: string }

export function VoiceVideoSettingsTab() {
  const [prefs, setPrefs] = useState<VoicePrefs>(() => loadPrefs().voice)
  const [mics, setMics] = useState<DeviceOption[]>([])
  const [speakers, setSpeakers] = useState<DeviceOption[]>([])
  const [cameras, setCameras] = useState<DeviceOption[]>([])
  const [saved, setSaved] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const testStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const refreshDevices = useCallback(async () => {
    try {
      // Prompt once so labels are available
      if (navigator.mediaDevices?.getUserMedia) {
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
        tmp.getTracks().forEach((t) => t.stop())
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(
        devices
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
      )
      setSpeakers(
        devices
          .filter((d) => d.kind === 'audiooutput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` }))
      )
      setCameras(
        devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not list devices')
    }
  }, [])

  useEffect(() => {
    refreshDevices()
    const onChange = () => refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange)
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange)
      stopMicTest()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshDevices])

  const persist = (patch: Partial<VoicePrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    updatePrefs({ voice: patch })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  const stopMicTest = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    testStreamRef.current?.getTracks().forEach((t) => t.stop())
    testStreamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setTesting(false)
    setMicLevel(0)
  }

  const startMicTest = async () => {
    setError(null)
    stopMicTest()
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: prefs.echoCancellation,
          noiseSuppression: prefs.noiseSuppression,
          autoGainControl: prefs.autoGainControl,
          ...(prefs.audioInputId ? { deviceId: { exact: prefs.audioInputId } } : {}),
        },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      testStreamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      setTesting(true)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setMicLevel(Math.min(1, avg / 80))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone test failed')
      stopMicTest()
    }
  }

  const Select = ({
    label,
    value,
    options,
    onChange,
    emptyLabel,
  }: {
    label: string
    value: string
    options: DeviceOption[]
    onChange: (id: string) => void
    emptyLabel: string
  }) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase text-app-muted">{label}</label>
      <SettingsDropdown
        fullWidth
        value={value}
        onChange={onChange}
        aria-label={label}
        placeholder={emptyLabel}
        options={[
          { value: '', label: emptyLabel },
          ...options.map((o) => ({ value: o.deviceId, label: o.label })),
        ]}
      />
    </div>
  )

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-1">Voice & Video</h3>
      <p className="text-app-muted text-sm mb-4">
        Choose devices and processing. Applied the next time you join voice or start a call.
      </p>

      <div className="bg-[#2b2d31] rounded-lg p-4 mb-4 space-y-4">
        <Select
          label="Input device (microphone)"
          value={prefs.audioInputId}
          options={mics}
          onChange={(id) => persist({ audioInputId: id })}
          emptyLabel="System default"
        />
        <Select
          label="Output device (speakers)"
          value={prefs.audioOutputId}
          options={speakers}
          onChange={(id) => persist({ audioOutputId: id })}
          emptyLabel="System default"
        />
        <Select
          label="Camera"
          value={prefs.videoInputId}
          options={cameras}
          onChange={(id) => persist({ videoInputId: id })}
          emptyLabel="System default"
        />
      </div>

      <div className="bg-[#2b2d31] rounded-lg p-4 mb-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase text-app-muted">Output volume</label>
            <span className="text-xs text-app-muted">{Math.round(prefs.outputVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={prefs.outputVolume}
            onChange={(e) => persist({ outputVolume: Number(e.target.value) })}
            className="w-full accent-[rgb(var(--app-accent))]"
          />
        </div>

        {([
          ['echoCancellation', 'Echo cancellation'],
          ['noiseSuppression', 'Noise suppression'],
          ['autoGainControl', 'Auto gain control'],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-white">{label}</span>
            <SettingsToggle
              checked={prefs[key]}
              onChange={(v) => persist({ [key]: v })}
              aria-label={label}
            />
          </div>
        ))}
      </div>

      <div className="bg-[#2b2d31] rounded-lg p-4 mb-4 space-y-3">
        <h4 className="font-semibold text-white">Mic test</h4>
        <div className="h-2 rounded-full bg-[#1e1f22] overflow-hidden">
          <div
            className="h-full bg-app-accent transition-[width] duration-75"
            style={{ width: `${Math.round(micLevel * 100)}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => (testing ? stopMicTest() : startMicTest())}
          className="px-3 py-2 rounded-md text-sm font-medium bg-app-accent hover:bg-app-accent-hover text-white"
        >
          {testing ? 'Stop test' : 'Test microphone'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {saved && <p className="text-green-400 text-sm">Voice settings saved</p>}
    </div>
  )
}
