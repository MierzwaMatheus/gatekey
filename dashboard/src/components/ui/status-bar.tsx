import { useState, useEffect } from 'react'

interface StatusBarProps {
  tenant?: string
}

export function StatusBar({ tenant = 'root' }: StatusBarProps) {
  const [clock, setClock] = useState(() => new Date().toISOString().slice(11, 19))

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toISOString().slice(11, 19))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-ok">●</span>
        <span>api · 142ms</span>
      </div>
      <div className="status-item">
        <b>region</b>
        <span>sa-east-1a</span>
      </div>
      <div className="status-item">
        <b>build</b>
        <span>2.4.1 · a7f3c01</span>
      </div>
      <div className="status-right">
        <div className="status-item">
          <b>ts</b>
          <span>{clock}Z</span>
        </div>
        <div className="status-item">
          <b>tenant</b>
          <span>{tenant}</span>
        </div>
      </div>
    </div>
  )
}
