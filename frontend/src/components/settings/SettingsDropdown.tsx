import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'

export type SettingsDropdownOption = {
  value: string
  label: string
  disabled?: boolean
}

interface SettingsDropdownProps {
  value: string
  options: SettingsDropdownOption[]
  onChange: (value: string) => void
  disabled?: boolean
  /** Wider trigger for full-width device pickers */
  fullWidth?: boolean
  className?: string
  'aria-label'?: string
  placeholder?: string
}

/** Custom select with GSAP open/close — replaces native `<select>` in settings. */
export function SettingsDropdown({
  value,
  options,
  onChange,
  disabled,
  fullWidth,
  className = '',
  'aria-label': ariaLabel,
  placeholder = 'Select…',
}: SettingsDropdownProps) {
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null)
  const closingRef = useRef(false)

  const selected = options.find((o) => o.value === value)
  const label = selected?.label ?? placeholder

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuHeight = Math.min(240, options.length * 36 + 8)
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const openUp = spaceBelow < menuHeight && rect.top > spaceBelow
    const width = Math.max(rect.width, fullWidth ? rect.width : 148)
    setMenuPos({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
      openUp,
    })
  }, [fullWidth, options.length])

  const close = useCallback(() => {
    if (!mounted || closingRef.current) return
    const menu = menuRef.current
    if (!menu) {
      setOpen(false)
      setMounted(false)
      return
    }
    closingRef.current = true
    gsap.killTweensOf(menu)
    gsap.to(menu, {
      opacity: 0,
      y: menuPos?.openUp ? 6 : -6,
      scale: 0.96,
      duration: 0.16,
      ease: 'power2.in',
      onComplete: () => {
        closingRef.current = false
        setOpen(false)
        setMounted(false)
      },
    })
  }, [mounted, menuPos?.openUp])

  const openMenu = () => {
    if (disabled || closingRef.current) return
    updatePosition()
    setOpen(true)
    setMounted(true)
  }

  useLayoutEffect(() => {
    if (!mounted || !open) return
    const menu = menuRef.current
    if (!menu || !menuPos) return
    gsap.killTweensOf(menu)
    gsap.fromTo(
      menu,
      {
        opacity: 0,
        y: menuPos.openUp ? 8 : -8,
        scale: 0.96,
        transformOrigin: menuPos.openUp ? 'bottom center' : 'top center',
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.22,
        ease: 'power3.out',
      }
    )
  }, [mounted, open, menuPos])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        triggerRef.current?.focus()
      }
    }
    const onScroll = () => close()
    const onResize = () => updatePosition()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    // Close when the settings panel scrolls underneath
    document.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close, updatePosition])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open, close])

  const pick = (next: string) => {
    if (next !== value) onChange(next)
    close()
    triggerRef.current?.focus()
  }

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={mounted ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        className={`group flex items-center gap-2 text-left text-sm text-app-text bg-[#1e1f22] border border-[#3f4147] hover:border-[#5c5e66] focus:border-app-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          fullWidth
            ? 'w-full px-3 py-2.5 rounded-md'
            : 'min-w-[148px] max-w-[200px] px-2.5 py-1.5 rounded-md'
        } ${open ? 'border-app-accent' : ''}`}
      >
        <span className="flex-1 min-w-0 truncate">{label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={`flex-shrink-0 text-[#b5bac1] transition-transform duration-200 ${open ? 'rotate-180 text-white' : 'group-hover:text-[#dbdee1]'}`}
        >
          <path d="M2.5 4.25L6 7.75L9.5 4.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted && menuPos && createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            top: menuPos.openUp ? undefined : menuPos.top,
            bottom: menuPos.openUp ? window.innerHeight - menuPos.top : undefined,
            left: menuPos.left,
            width: menuPos.width,
            zIndex: 80,
          }}
          className="rounded-md bg-[#111214] border border-[#3f4147] shadow-xl shadow-black/40 overflow-hidden py-1 max-h-60 overflow-y-auto will-change-transform"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => !opt.disabled && pick(opt.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-app-accent/25 text-white'
                    : 'text-[#dbdee1] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="w-3.5 flex-shrink-0 flex items-center justify-center" aria-hidden>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
