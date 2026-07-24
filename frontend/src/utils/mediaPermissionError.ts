/**
 * Map getUserMedia / getDisplayMedia failures to actionable copy.
 * Windows often surfaces the raw DOMException "Permission denied by system"
 * when OS privacy settings block the mic/camera (not a Nepsis server ACL).
 */

export function formatMediaPermissionError(
  err: unknown,
  kind: 'microphone' | 'camera' | 'microphone-or-camera' | 'screen' = 'microphone'
): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const lower = message.toLowerCase()

  const isDenied =
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    /permission denied/i.test(message) ||
    /not allowed/i.test(lower)

  const isSystemDenied = /permission denied by system/i.test(message) || /by system/i.test(lower)

  const deviceLabel =
    kind === 'camera'
      ? 'camera'
      : kind === 'microphone-or-camera'
        ? 'microphone or camera'
        : kind === 'screen'
          ? 'screen sharing'
          : 'microphone'

  if (isSystemDenied) {
    return (
      `Your operating system blocked ${deviceLabel} access ("Permission denied by system"). ` +
      `On Windows: Settings → Privacy & security → Microphone (and Camera if needed) → ` +
      `allow access for desktop apps, then allow Nepsis Chat / your browser. ` +
      `On macOS: System Settings → Privacy & Security → Microphone. Then retry joining voice.`
    )
  }

  if (isDenied) {
    return (
      `${deviceLabel.charAt(0).toUpperCase()}${deviceLabel.slice(1)} permission was denied. ` +
      `Allow access in the browser/app prompt (or site settings), then try again.`
    )
  }

  if (name === 'NotFoundError' || /not found|no device/i.test(lower)) {
    return `No ${deviceLabel} device was found. Plug one in and check system sound settings.`
  }

  if (name === 'NotReadableError' || /could not start|in use|busy/i.test(lower)) {
    return (
      `Could not open the ${deviceLabel} — another app may be using it exclusively. ` +
      `Close other voice apps and retry.`
    )
  }

  if (message.trim()) return message
  return `Failed to access ${deviceLabel}`
}
