'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react'

interface ThemeContextValue {
  effective: 'light' | 'dark'
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  effective: 'light',
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

const STORAGE_KEY = 'theme-preference'

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getStored(): 'light' | 'dark' | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return null
}

function apply(effective: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', effective === 'dark')
}

function getSnapshot(): 'light' | 'dark' {
  const stored = getStored()
  return stored ?? (getSystemDark() ? 'dark' : 'light')
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', callback)
  window.addEventListener('storage', callback)
  return () => {
    mq.removeEventListener('change', callback)
    window.removeEventListener('storage', callback)
  }
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const effective: 'light' | 'dark' = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => 'light' as const
  )

  useEffect(() => {
    apply(effective as 'light' | 'dark')
  }, [effective])

  const toggle = useCallback(() => {
    const next = effective === 'light' ? 'dark' : 'light'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    apply(next)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: next }))
  }, [effective])

  return <ThemeContext.Provider value={{ effective, toggle }}>{children}</ThemeContext.Provider>
}
