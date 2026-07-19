/**
 * CoolIcons via Iconify (`ci` set) — same Free Iconset as
 * https://www.figma.com/design/Tc9b7o3jIahxfod2gnEEnY/coolicons
 *
 * Browse names: https://icon-sets.iconify.design/ci/
 */
import { Icon, addCollection } from '@iconify/react'
import ci from '@iconify-json/ci/icons.json'

addCollection(ci)

interface CoolIconProps {
  /** CoolIcons name without `ci:` prefix (e.g. `users`, `chevron-left`) */
  name: string
  size?: number
  className?: string
  /** Accessible label — omit for decorative */
  label?: string
}

/** Map app semantic names → CoolIcons */
const ALIASES: Record<string, string> = {
  mic: 'user-voice',
  'mic-off': 'volume-off',
  mute: 'volume-off',
  deafen: 'headphones',
  'deafen-off': 'volume-off-02',
  members: 'users',
  minimize: 'chevron-right',
  expand: 'chevron-left',
  kick: 'user-close',
  ban: 'circle-warning',
  offline: 'wifi-off',
}

export function CoolIcon({ name, size = 18, className = '', label }: CoolIconProps) {
  const icon = ALIASES[name] ?? name
  return (
    <Icon
      icon={`ci:${icon}`}
      width={size}
      height={size}
      className={`block shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
