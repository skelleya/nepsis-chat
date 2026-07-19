export type DetectedOs = 'windows' | 'mac' | 'other'

/** Best-effort OS detect for download / install CTAs. */
export function detectPlatform(): DetectedOs {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  const platform = (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    || navigator.platform
    || ''
  ).toLowerCase()
  if (platform.includes('mac') || ua.includes('mac os') || ua.includes('macintosh')) return 'mac'
  if (platform.includes('win') || ua.includes('windows')) return 'windows'
  if (ua.includes('iphone') || ua.includes('ipad')) return 'mac'
  return 'other'
}
