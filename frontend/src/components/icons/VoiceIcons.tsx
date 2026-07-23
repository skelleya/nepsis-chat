/**
 * Voice icons — CoolIcons (Iconify `ci` set / Figma Free Iconset).
 */
import { CoolIcon } from './CoolIcon'

type IconProps = { className?: string; size?: number }

export function MicIcon({ className, size = 20 }: IconProps) {
  return <CoolIcon name="user-voice" size={size} className={className} />
}

export function MicOffIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`block shrink-0 ${className ?? ''}`}
      aria-hidden
    >
      <path d="M9 9.4V6a3 3 0 016 0v6c0 .35-.06.69-.17 1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M18 11.5v.5a6 6 0 01-9.7 4.72M6 11.5v.5c0 .75.14 1.47.39 2.13M12 18v3M9 21h6M4 4l16 16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function HeadphonesIcon({ className, size = 20 }: IconProps) {
  return <CoolIcon name="headphones" size={size} className={className} />
}

export function HeadphonesOffIcon({ className, size = 20 }: IconProps) {
  return <CoolIcon name="volume-off-02" size={size} className={className} />
}
