interface IconProps {
  name: string
  size?: number
  className?: string
}

export function Icon({ name, size = 14, className = '' }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24' as string,
    fill: 'none' as const,
    stroke: 'currentColor' as const,
    strokeWidth: 1.5 as number,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }
  switch (name) {
    case 'sessions':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" /><path d="M3 9h18" /><path d="M7 13h4" /></svg>
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.2" /><path d="M16 14c2.5 0 4 1.5 4 4" /></svg>
    case 'roles':
      return <svg {...common}><path d="M12 3l8 4v5c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V7l8-4z" /></svg>
    case 'policies':
      return <svg {...common}><path d="M5 4h11l3 3v13H5z" /><path d="M9 10h6M9 14h6M9 18h4" /></svg>
    case 'audit':
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10" /></svg>
    case 'orgs':
      return <svg {...common}><rect x="4" y="9" width="7" height="11" /><rect x="13" y="4" width="7" height="16" /><path d="M7 13h1M7 16h1M16 8h1M16 12h1M16 16h1" /></svg>
    case 'tokens':
      return <svg {...common}><circle cx="8" cy="12" r="4" /><path d="M12 12h9M17 12v3M20 12v2" /></svg>
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="2.5" /><path d="M19.4 13.5l1.6 1-1.6 2.8-1.8-.6a7 7 0 0 1-1.8 1l-.3 1.9h-3.2l-.3-1.9a7 7 0 0 1-1.8-1l-1.8.6L4.8 14l1.6-1a7 7 0 0 1 0-2L4.8 10l1.6-2.8 1.8.6a7 7 0 0 1 1.8-1l.3-1.9h3.2l.3 1.9a7 7 0 0 1 1.8 1l1.8-.6L19.2 10l-1.6 1a7 7 0 0 1 0 2z" /></svg>
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
    case 'desktop':
      return <svg {...common}><rect x="3" y="4" width="18" height="12" /><path d="M8 20h8M12 16v4" /></svg>
    case 'mobile':
      return <svg {...common}><rect x="7" y="3" width="10" height="18" /><path d="M11 18h2" /></svg>
    case 'api':
      return <svg {...common}><path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 5l-4 14" /></svg>
    case 'tablet':
      return <svg {...common}><rect x="4" y="3" width="16" height="18" /><path d="M11 18h2" /></svg>
    case 'chevron':
      return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>
    case 'refresh':
      return <svg {...common}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
    case 'export':
      return <svg {...common}><path d="M12 4v11M7 9l5-5 5 5M5 20h14" /></svg>
    case 'warn':
      return <svg {...common}><path d="M12 4l10 17H2z" /><path d="M12 10v5M12 18v.5" /></svg>
    case 'command':
      return <svg {...common}><path d="M6 9h12v6H6z" /><path d="M6 9V7a2 2 0 1 1 2 2H6zM18 9V7a2 2 0 1 0-2 2h2zM6 15v2a2 2 0 1 0 2-2H6zM18 15v2a2 2 0 1 1-2-2h2z" /></svg>
    case 'x':
      return <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>
    case 'shield':
      return <svg {...common}><path d="M12 3l8 4v5c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V7l8-4z" /></svg>
    case 'link2':
      return <svg {...common}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
    case 'layers':
      return <svg {...common}><path d="M12 2l8 4.5-8 4.5-8-4.5z" /><path d="M4 11l8 4.5 8-4.5" /><path d="M4 16l8 4.5 8-4.5" /></svg>
    case 'terminal':
      return <svg {...common}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
    case 'building2':
      return <svg {...common}><path d="M4 9h16v12H4z" /><path d="M9 9V5h6v4" /><path d="M9 13h1M14 13h1M9 17h1M14 17h1" /></svg>
    case 'zap':
      return <svg {...common}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
    case 'key':
      return <svg {...common}><circle cx="7.5" cy="15.5" r="5.5" /><path d="M21 2l-9.6 9.6" /><path d="M15.5 7.5l3 3L21 8l-3-3" /></svg>
    case 'sliders':
      return <svg {...common}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
    case 'hard-drive':
      return <svg {...common}><path d="M22 12H2" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><line x1="6" y1="16" x2="6.01" y2="16" /><line x1="10" y1="16" x2="10.01" y2="16" /></svg>
    case 'monitor-dot':
      return <svg {...common}><path d="M19 3H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7" /><path d="M19 8h.01" /><path d="M13 20l2 2 4-4" /></svg>
    case 'scroll-text':
      return <svg {...common}><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 0 1-2 2z" /><path d="M10 7H8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2" /><path d="M8 3a2 2 0 1 0 4 0v6" /><path d="M12 3h8v10" /><path d="M14 9h5M14 13h5" /></svg>
    case 'layout-grid':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
    default:
      return null
  }
}

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M10 3h12l7 7v12l-7 7H10l-7-7V10z"
        stroke="#F0A500"
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />
      <path
        d="M16 9.5v6.5l4.5 2.5"
        stroke="#F0A500"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
      <circle cx="16" cy="16" r="1.2" fill="#F0A500" />
    </svg>
  )
}
