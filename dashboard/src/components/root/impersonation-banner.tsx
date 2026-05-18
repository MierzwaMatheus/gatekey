interface Props {
  impersonating: { id: string; name: string } | null
  onEnd: () => void
}

export function ImpersonationBanner({ impersonating, onEnd }: Props) {
  if (!impersonating) return null

  return (
    <div
      data-testid="impersonation-banner"
      className="flex items-center justify-between px-4 py-2 bg-[var(--gate-danger)] text-white text-sm font-medium"
    >
      <span>
        Você está agindo como <strong>{impersonating.name}</strong>
      </span>
      <button
        onClick={onEnd}
        className="ml-4 rounded px-3 py-1 bg-white/20 hover:bg-white/30 transition-colors"
      >
        Encerrar
      </button>
    </div>
  )
}
