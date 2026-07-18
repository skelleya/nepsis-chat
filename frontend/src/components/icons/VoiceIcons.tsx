/**
 * Voice icons: mic, mic-off, headphones, headphones-off
 * Shared 24×24 viewBox and similar glyph weight so UserPanel controls look even.
 */

type IconProps = { className?: string; size?: number }

const base = 'block shrink-0'

export function MicIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${base} ${className || ''}`}
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm5 9a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
    </svg>
  )
}

export function MicOffIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`${base} ${className || ''}`}
      aria-hidden
    >
      <path
        d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm5 9a5 5 0 0 1-.4 1.95L18.1 14.45A7 7 0 0 0 19 11h-2zm-2.08 4.52A7 7 0 0 1 13 17.92V21h-2v-3.08a7 7 0 0 1-5.45-4.37l1.55-1.55A5 5 0 0 0 14.92 15.52zM5 11c0 .34.03.67.08 1L3.55 13.53A7.05 7.05 0 0 1 5 11H5z"
        fill="currentColor"
      />
      <path d="M3.5 3.5l17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function HeadphonesIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${base} ${className || ''}`}
      aria-hidden
    >
      <path d="M12 3a8 8 0 0 0-8 8v6a3 3 0 0 0 3 3h2v-7H6v-2a6 6 0 0 1 12 0v2h-3v7h2a3 3 0 0 0 3-3v-6a8 8 0 0 0-8-8z" />
    </svg>
  )
}

export function HeadphonesOffIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`${base} ${className || ''}`}
      aria-hidden
    >
      <path
        d="M12 3a8 8 0 0 0-8 8v6a3 3 0 0 0 3 3h2v-7H6v-2a6 6 0 0 1 12 0v2h-3v7h2a3 3 0 0 0 3-3v-6a8 8 0 0 0-8-8z"
        fill="currentColor"
      />
      <path d="M3.5 3.5l17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
