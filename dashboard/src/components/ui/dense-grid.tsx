import type { ReactNode } from 'react'

export function DenseGridContainer({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div
      className="border border-[#21262D] rounded-[4px] overflow-hidden bg-[#0D1117]"
      data-testid={testId}
    >
      {children}
    </div>
  )
}

interface DenseGridHeaderProps {
  label: string
  stats?: { label: string; value: ReactNode; accent?: boolean }[]
}

export function DenseGridHeader({ label, stats }: DenseGridHeaderProps) {
  return (
    <div className="bg-[#161B22] px-4 py-2.5 border-b border-[#21262D] flex items-center justify-between">
      <span className="text-[11px] font-mono font-medium text-[#8B949E] uppercase tracking-[0.1em]">
        {label}
      </span>
      {stats && stats.length > 0 && (
        <div className="flex items-center gap-4">
          {stats.map((s, i) => (
            <span key={i} className="text-[10px] font-mono uppercase tracking-[0.08em]">
              <span className={s.accent ? 'text-[#3FB950]' : 'text-[#8B949E]'}>{s.value}</span>
              {' '}
              <span className="text-[#484F58]">{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function DenseGridTable({ children }: { children: ReactNode }) {
  return (
    <table className="w-full">
      {children}
    </table>
  )
}

export function DenseGridThead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[#21262D] bg-[#0D1117]">
        {children}
      </tr>
    </thead>
  )
}

export function DenseGridTh({ children, align = 'left' }: { children?: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={[
        'py-2 px-4 text-[10px] font-medium text-[#484F58] uppercase tracking-[0.12em]',
        align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </th>
  )
}

export function DenseGridThNum() {
  return <th className="py-2 pl-4 pr-2 w-10 text-[10px] text-[#484F58]">#</th>
}

interface DenseGridRowProps {
  children: ReactNode
  testId?: string
}

export function DenseGridRow({ children, testId }: DenseGridRowProps) {
  return (
    <tr
      className="border-b border-dashed border-[#21262D] last:border-0 hover:bg-[#161B22] transition-colors group"
      data-testid={testId}
    >
      {children}
    </tr>
  )
}

export function DenseGridRowNum({ index }: { index: number }) {
  return (
    <td className="py-[10px] pl-4 pr-2 text-[11px] font-mono text-[#484F58] align-top w-10">
      {String(index + 1).padStart(3, '0')}
    </td>
  )
}

export function DenseGridCell({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td
      className={[
        'py-[10px] px-4 text-[13px] font-mono text-[#E6EDF3] align-top',
        align === 'right' ? 'text-right' : '',
        className,
      ].join(' ')}
    >
      {children}
    </td>
  )
}

export function DenseGridCellStack({
  primary,
  secondary,
  className = '',
}: {
  primary: ReactNode
  secondary?: ReactNode
  className?: string
}) {
  return (
    <td className={['py-[10px] px-4 align-top', className].join(' ')}>
      <div className="text-[13px] font-mono text-[#E6EDF3] leading-tight">{primary}</div>
      {secondary && (
        <div className="text-[11px] text-[#6E7681] mt-0.5 leading-tight">{secondary}</div>
      )}
    </td>
  )
}

export function DenseGridActionsCell({ children }: { children: ReactNode }) {
  return (
    <td className="py-[10px] px-4 text-right align-top">
      <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        {children}
      </div>
    </td>
  )
}

interface DenseGridFooterProps {
  showing: number
  total?: number
  onLoadMore?: () => void
  loadingMore?: boolean
  isDone?: boolean
}

export function DenseGridFooter({ showing, total, onLoadMore, loadingMore, isDone }: DenseGridFooterProps) {
  return (
    <div className="bg-[#161B22] border-t border-[#21262D] px-4 py-2.5 flex items-center justify-between">
      <span className="text-[10px] font-mono text-[#484F58] uppercase tracking-[0.08em]">
        Mostrando {showing}{total !== undefined ? ` de ${total}` : ''}
      </span>
      {onLoadMore && !isDone && (
        <button
          data-testid="btn-load-more"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="text-[10px] font-mono text-[#8B949E] hover:text-[#E6EDF3] transition-colors cursor-pointer disabled:opacity-50 uppercase tracking-[0.08em]"
        >
          {loadingMore ? 'Carregando…' : 'Carregar mais →'}
        </button>
      )}
    </div>
  )
}

export function DenseGridActionBtn({
  onClick,
  variant = 'default',
  children,
  testId,
}: {
  onClick: () => void
  variant?: 'default' | 'danger' | 'accent'
  children: ReactNode
  testId?: string
}) {
  const colors = {
    default: 'text-[#8B949E] border-[#30363D] hover:text-[#E6EDF3] hover:border-[#8B949E]',
    danger: 'text-[#F85149] border-[#F85149]/30 hover:bg-[#F85149]/10',
    accent: 'text-[#58A6FF] border-[#58A6FF]/30 hover:bg-[#58A6FF]/10',
  }
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={[
        'px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] border rounded-[2px] transition-colors cursor-pointer',
        colors[variant],
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function DenseGridStatusBadge({ value, type }: { value: string; type: 'allow' | 'deny' | 'neutral' }) {
  const styles = {
    allow: 'text-[#3FB950] border-[#3FB950]/30 bg-[#3FB950]/8',
    deny: 'text-[#F85149] border-[#F85149]/30 bg-[#F85149]/8',
    neutral: 'text-[#8B949E] border-[#30363D] bg-[#161B22]',
  }
  return (
    <span className={['inline-flex px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] border rounded-[2px]', styles[type]].join(' ')}>
      {value}
    </span>
  )
}
