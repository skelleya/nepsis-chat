import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useVoice } from '../../contexts/VoiceContext'
import { getAudioConstraints, loadPrefs, subscribePrefs, updatePrefs, type VoicePrefs } from '../../services/userPrefs'
import { SettingsDropdown, type SettingsDropdownOption } from './SettingsDropdown'
import { SettingsToggle } from './SettingsToggle'

type DeviceOption = { deviceId: string; label: string }

const CAMERA_QUALITY_OPTIONS: SettingsDropdownOption[] = [
  { value: '1080p', label: '1080p (recommended)' },
  { value: '1440p', label: '1440p / 2K' },
]

const SCREEN_QUALITY_OPTIONS: SettingsDropdownOption[] = [
  { value: '1080p', label: '1080p' },
  { value: '1440p', label: '1440p / 2K (recommended)' },
  { value: '4k', label: '2160p / 4K' },
]

const MIC_PROCESSING_OPTIONS: SettingsDropdownOption[] = [
  { value: 'off', label: 'Off' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High (when available)' },
]

interface DeviceSelectProps {
  label: string
  value: string
  options: DeviceOption[]
  onChange: (id: string) => void
  emptyLabel: string
}

/**
 * Module-level + memoized: parent Voice & Video re-renders must not remount
 * an open device menu or rebuild option identity without a device list change.
 */
const DeviceSelect = memo(function DeviceSelect({
  label,
  value,
  options,
  onChange,
  emptyLabel,
}: DeviceSelectProps) {
  const deviceKey = options.map((option) => `${option.deviceId}\0${option.label}`).join('\n')
  const dropdownOptions = useMemo(
    () => [
      { value: '', label: emptyLabel },
      ...options.map((option) => ({ value: option.deviceId, label: option.label })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deviceKey, emptyLabel]
  )
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase text-app-muted">{label}</label>
      <SettingsDropdown
        fullWidth
        value={value}
        onChange={onChange}
        aria-label={label}
        placeholder={emptyLabel}
        options={dropdownOptions}
      />
    </div>
  )
})

/**
 * Owns mic-meter RAF state so live level ticks never re-render sibling dropdowns.
 */
function MicTestPanel({ prefs }: { prefs: VoicePrefs }) {
  const [micLevel, setMicLevel] = useState(0)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const testStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const lastMicLevelRef = useRef(0)

  const stopMicTest = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    testStreamRef.current?.getTracks().forEach((t) => t.stop())
    testStreamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setTesting(false)
    lastMicLevelRef.current = 0
    setMicLevel(0)
  }, [])

  useEffect(() => () => stopMicTest(), [stopMicTest])

  const startMicTest = async () => {
    setError(null)
    stopMicTest()
    try {
      const constraints: MediaStreamConstraints = {
        audio: getAudioConstraints(prefs),
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
        const nextLevel = Math.min(1, avg / 80)
        if (Math.abs(nextLevel - lastMicLevelRef.current) >= 0.02) {
          lastMicLevelRef.current = nextLevel
          setMicLevel(nextLevel)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone test failed')
      stopMicTest()
    }
  }

  return (
    <div className="bg-app-channel rounded-lg p-4 mb-4 space-y-3">
      <h4 className="font-semibold text-app-text">Mic test</h4>
      <div className="h-2 rounded-full bg-app-darker overflow-hidden">
        <div
          className="h-full bg-app-accent transition-[width] duration-75"
          style={{ width: `${Math.round(micLevel * 100)}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => (testing ? stopMicTest() : void startMicTest())}
        className="px-3 py-2 rounded-md text-sm font-medium bg-app-accent hover:bg-app-accent-hover text-white"
      >
        {testing ? 'Stop test' : 'Test microphone'}
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}

export function VoiceVideoSettingsTab() {
  const { setMicProcessing: applyMicProcessing } = useVoice()
  const [prefs, setPrefs] = useState<VoicePrefs>(() => loadPrefs().voice)
  const [mics, setMics] = useState<DeviceOption[]>([])
  const [speakers, setSpeakers] = useState<DeviceOption[]>([])
  const [cameras, setCameras] = useState<DeviceOption[]>([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedTimerRef = useRef<number | null>(null)

  const markSaved = useCallback(() => {
    setSaved(true)
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => setSaved(false), 1500)
  }, [])

  const persist = useCallback((patch: Partial<VoicePrefs>) => {
    const next = updatePrefs({ voice: patch }).voice
    setPrefs(next)
    markSaved()
  }, [markSaved])

  const onMicChange = useCallback((id: string) => persist({ audioInputId: id }), [persist])
  const onSpeakerChange = useCallback((id: string) => persist({ audioOutputId: id }), [persist])
  const onCameraChange = useCallback((id: string) => persist({ videoInputId: id }), [persist])
  const onCameraQualityChange = useCallback(
    (value: string) => persist({ cameraQuality: value as VoicePrefs['cameraQuality'] }),
    [persist]
  )
  const onScreenQualityChange = useCallback(
    (value: string) => persist({ screenQuality: value as VoicePrefs['screenQuality'] }),
    [persist]
  )
  const onMirrorChange = useCallback(
    (value: boolean) => persist({ mirrorCameraPreview: value }),
    [persist]
  )
  const onScreenAudioChange = useCallback(
    (value: boolean) => persist({ includeScreenShareAudio: value }),
    [persist]
  )
  const onOutputVolumeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      persist({ outputVolume: Number(event.target.value) })
    },
    [persist]
  )
  const onMicProcessingChange = useCallback(
    (value: string) => {
      void applyMicProcessing(value as VoicePrefs['micProcessing'])
      markSaved()
    },
    [applyMicProcessing, markSaved]
  )

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
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    }
  }, [refreshDevices])

  useEffect(() => subscribePrefs((next) => {
    setPrefs(next.voice)
  }), [])

  return (
    <div>
      <h3 className="text-xl font-bold text-app-text mb-1">Voice & Video</h3>
      <p className="text-app-muted text-sm mb-4">
        Choose devices, capture quality, and processing. Quality changes apply when you next start
        the camera, screen share, or a call.
      </p>

      <div className="bg-app-channel rounded-lg p-4 mb-4 space-y-4">
        <DeviceSelect
          label="Input device (microphone)"
          value={prefs.audioInputId}
          options={mics}
          onChange={onMicChange}
          emptyLabel="System default"
        />
        <DeviceSelect
          label="Output device (speakers)"
          value={prefs.audioOutputId}
          options={speakers}
          onChange={onSpeakerChange}
          emptyLabel="System default"
        />
        <DeviceSelect
          label="Camera"
          value={prefs.videoInputId}
          options={cameras}
          onChange={onCameraChange}
          emptyLabel="System default"
        />
      </div>

      <div className="bg-app-channel rounded-lg p-4 mb-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase text-app-muted">Camera quality</label>
          <SettingsDropdown
            fullWidth
            value={prefs.cameraQuality}
            onChange={onCameraQualityChange}
            aria-label="Camera quality"
            options={CAMERA_QUALITY_OPTIONS}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase text-app-muted">Screen-share quality</label>
          <SettingsDropdown
            fullWidth
            value={prefs.screenQuality}
            onChange={onScreenQualityChange}
            aria-label="Screen-share quality"
            options={SCREEN_QUALITY_OPTIONS}
          />
        </div>
        <p className="sm:col-span-2 text-xs text-app-muted">
          The browser and camera may choose a lower resolution when the device or connection cannot sustain the selected quality.
        </p>
        <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-3 border-t border-app-hover/50">
          <div>
            <p className="text-sm text-app-text">Mirror my camera preview</p>
            <p className="text-xs text-app-muted">Only changes what you see; other users always see the natural orientation.</p>
          </div>
          <SettingsToggle
            checked={prefs.mirrorCameraPreview}
            onChange={onMirrorChange}
            aria-label="Mirror my camera preview"
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-3 border-t border-app-hover/50">
          <div>
            <p className="text-sm text-app-text">Include audio when sharing screen</p>
            <p className="text-xs text-app-muted">The browser picker still controls whether tab or system audio is available.</p>
          </div>
          <SettingsToggle
            checked={prefs.includeScreenShareAudio}
            onChange={onScreenAudioChange}
            aria-label="Include audio when sharing screen"
          />
        </div>
      </div>

      <div className="bg-app-channel rounded-lg p-4 mb-4 space-y-4">
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
            onChange={onOutputVolumeChange}
            className="w-full accent-[rgb(var(--app-accent))]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase text-app-muted">Mic noise reduction</label>
          <SettingsDropdown
            fullWidth
            value={prefs.micProcessing}
            onChange={onMicProcessingChange}
            aria-label="Mic noise reduction"
            options={MIC_PROCESSING_OPTIONS}
          />
          <p className="text-xs text-app-muted">
            Off disables browser mic cleanup. High requests extra voice isolation when the browser supports it.
          </p>
        </div>
      </div>

      <MicTestPanel prefs={prefs} />

      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {saved && <p className="text-green-400 text-sm">Voice settings saved</p>}
    </div>
  )
}
