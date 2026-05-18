import { useState, useEffect } from 'react'
import { Icon } from './icons'
import { LanguageSwitcher } from './language-switcher'

interface TopBarProps {
  scope: string
  context: string
  section: string
}

export function TopBar({ scope, context, section }: TopBarProps) {
  const [clock, setClock] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(11, 19)
  })

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toISOString().slice(11, 19))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="crumb-prefix">scope</span>
        <span className="crumb muted">{scope}</span>
        <Icon name="chevron" size={11} className="chevron-icon" />
        <span className="crumb muted">{context}</span>
        <Icon name="chevron" size={11} className="chevron-icon" />
        <span className="crumb">{section}</span>
      </div>
      <div className="topbar-right">
        <div className="live-clock">
          <span className="live-clock-dot" />
          <span>{clock} UTC</span>
        </div>
        <div className="kbd-search">
          <Icon name="search" size={12} />
          <span>buscar / userId / IP …</span>
          <span className="kbd">⌘K</span>
        </div>
        <LanguageSwitcher />
        <button className="icon-btn" title="Refresh">
          <Icon name="refresh" size={13} />
        </button>
      </div>
    </header>
  )
}
