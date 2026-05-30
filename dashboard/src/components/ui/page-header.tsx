import { useState, useEffect, type ReactNode } from 'react'

interface PageHeaderProps {
  module: string
  submodule: string
  scope: string
  context: string
  number: string
  title: string
  description: string
  tenant?: string
  caller?: string
  actions?: ReactNode
}

export function PageHeader({
  module,
  submodule,
  scope,
  context,
  number,
  title,
  description,
  tenant,
  caller,
  actions,
}: PageHeaderProps) {
  const [ts, setTs] = useState(() => new Date().toISOString().slice(0, 19) + 'Z')

  useEffect(() => {
    const id = setInterval(() => {
      setTs(new Date().toISOString().slice(0, 19) + 'Z')
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="pb-5 border-b border-border-default">
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-[11px] text-accent-primary tracking-widest">
          {'// '}
          <span className="text-text-secondary">{module}</span>
          {' · '}
          <span className="text-text-secondary">{submodule}</span>
          {' · SCOPE · '}
          <span className="text-text-secondary">{context.toUpperCase()}</span>
        </span>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-mono text-[22px] font-bold text-accent-primary leading-none">
          {number}
        </span>
        <h1 className="text-[22px] font-bold text-text-primary leading-none">{title}</h1>
      </div>

      <p className="text-[12px] text-text-secondary mb-3 max-w-2xl leading-relaxed">
        {description}
      </p>

      <div className="font-mono text-[10.5px] text-text-secondary flex flex-wrap gap-x-5 gap-y-1">
        <span>
          <span className="text-text-muted">node</span>{' '}
          <span>sa-east-1a</span>
        </span>
        <span>
          <span className="text-text-muted">ts</span>{' '}
          <span>{ts}</span>
        </span>
        {tenant && (
          <span>
            <span className="text-text-muted">tenant</span>{' '}
            <span>{tenant}</span>
          </span>
        )}
        {caller && (
          <span>
            <span className="text-text-muted">caller</span>{' '}
            <span className="text-accent-primary">{caller}</span>
          </span>
        )}
      </div>
    </div>
  )
}
