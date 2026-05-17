import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-page': 'var(--gate-midnight)',
        'surface-card': 'var(--gate-iron)',
        'surface-elevated': 'var(--gate-steel)',
        'surface-hover': 'rgba(255,255,255,0.04)',
        'text-primary': 'var(--gate-text)',
        'text-secondary': 'var(--gate-muted)',
        'text-muted': 'rgba(139,148,158,0.6)',
        'accent-primary': 'var(--gate-key)',
        'accent-hover': 'var(--gate-key-dim)',
        'accent-subtle': 'rgba(240,165,0,0.12)',
        'status-allow': 'var(--gate-safe)',
        'status-deny': 'var(--gate-danger)',
        'status-warning': '#E3B341',
        'border-default': 'rgba(48,54,61,1)',
        'border-subtle': 'rgba(255,255,255,0.06)',
        'border-accent': 'rgba(240,165,0,0.3)',
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        input: '8px',
        badge: '6px',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        hover: '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
        float: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
        accent: '0 0 0 1px rgba(240,165,0,0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
