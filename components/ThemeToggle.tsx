'use client'

import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { effective, toggle } = useTheme()
  const isDark = effective === 'dark'

  return (
    <button
      type="button"
      className="theme-switch"
      onClick={toggle}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className="theme-switch-icon">☀️</span>
      <span className={`theme-switch-track${isDark ? ' on' : ''}`}>
        <span className={`theme-switch-knob${isDark ? ' on' : ''}`} />
      </span>
      <span className="theme-switch-icon">🌙</span>
    </button>
  )
}
