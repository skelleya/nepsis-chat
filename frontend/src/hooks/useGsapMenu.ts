import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import gsap from 'gsap'

type GsapMenuOptions = {
  enterY?: number
  exitY?: number
  enterScale?: number
  exitScale?: number
  transformOrigin?: string
}

export function useGsapMenu(
  isOpen: boolean,
  ref: RefObject<HTMLElement | null>,
  {
    enterY = 8,
    exitY = 6,
    enterScale = 0.96,
    exitScale = 0.96,
    transformOrigin = 'top center',
  }: GsapMenuOptions = {}
) {
  const [shouldRender, setShouldRender] = useState(isOpen)
  const closingRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      closingRef.current = false
      setShouldRender(true)
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (!shouldRender) return
    const el = ref.current
    if (!el) return

    if (isOpen) {
      gsap.killTweensOf(el)
      gsap.fromTo(
        el,
        { opacity: 0, y: enterY, scale: enterScale, transformOrigin },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.22,
          ease: 'power3.out',
          force3D: false,
        }
      )
      return () => {
        gsap.killTweensOf(el)
      }
    }

    if (closingRef.current) return
    closingRef.current = true
    gsap.killTweensOf(el)
    gsap.to(el, {
      opacity: 0,
      y: exitY,
      scale: exitScale,
      duration: 0.16,
      ease: 'power2.in',
      force3D: false,
      onComplete: () => {
        closingRef.current = false
        setShouldRender(false)
      },
    })
  }, [shouldRender, isOpen, ref, enterY, exitY, enterScale, exitScale, transformOrigin])

  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) gsap.killTweensOf(el)
    }
  }, [ref])

  return shouldRender
}
