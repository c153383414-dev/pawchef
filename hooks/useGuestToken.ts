'use client'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pawchef_guest_token'

/** Compute a simple SHA-256 browser fingerprint from stable browser attributes */
async function computeFingerprint(): Promise<string> {
  try {
    const parts = [
      navigator.userAgent,
      `${screen.width}x${screen.height}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      new Date().getTimezoneOffset().toString(),
    ]

    // Canvas fingerprint
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.textBaseline = 'top'
        ctx.font = '14px Arial'
        ctx.fillText('PawChef🐾', 2, 2)
        parts.push(canvas.toDataURL().slice(0, 64))
      }
    } catch { /* canvas blocked — ok */ }

    const raw = parts.join('|')
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return 'fp-unavailable'
  }
}

/** Generate or retrieve the guest token stored in localStorage */
function getOrCreateToken(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const token = `gt_${crypto.randomUUID()}`
    localStorage.setItem(STORAGE_KEY, token)
    return token
  } catch {
    // localStorage unavailable (SSR, private browsing, etc.)
    return `gt_${Math.random().toString(36).slice(2)}`
  }
}

export interface GuestTokenState {
  guestToken: string
  fingerprint: string
  /** Call this to clear the token (e.g., after signup) */
  clearToken: () => void
}

export function useGuestToken(): GuestTokenState {
  const [guestToken, setGuestToken] = useState('')
  const [fingerprint, setFingerprint] = useState('')

  useEffect(() => {
    setGuestToken(getOrCreateToken())
    computeFingerprint().then(setFingerprint)
  }, [])

  const clearToken = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ok */ }
    setGuestToken(`gt_${Math.random().toString(36).slice(2)}`)
  }

  return { guestToken, fingerprint, clearToken }
}
