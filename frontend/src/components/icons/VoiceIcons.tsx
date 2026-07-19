/**
 * Voice icons — CoolIcons (Iconify `ci` set / Figma Free Iconset).
 */
import { CoolIcon } from './CoolIcon'

type IconProps = { className?: string; size?: number }

export function MicIcon({ className, size = 20 }: IconProps) {
  return <CoolIcon name="user-voice" size={size} className={className} />
}

export function MicOffIcon({ className, size = 20 }: IconProps) {
  return <CoolIcon name="volume-off" size={size} className={className} />
}

export function HeadphonesIcon({ className, size = 20 }: IconProps) {
  return <CoolIcon name="headphones" size={size} className={className} />
}

export function HeadphonesOffIcon({ className, size = 20 }: IconProps) {
  return <CoolIcon name="volume-off-02" size={size} className={className} />
}
