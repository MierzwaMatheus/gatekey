// @vitest-environment jsdom
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const globalsCSS = readFileSync(resolve(__dirname, '../globals.css'), 'utf-8')

describe('fonts', () => {
  it('imports Inter font', () => {
    expect(globalsCSS).toContain('Inter')
  })

  it('imports JetBrains Mono font', () => {
    expect(globalsCSS).toContain('JetBrains+Mono')
  })

  it('applies Inter to body', () => {
    expect(globalsCSS).toMatch(/body\s*\{[^}]*Inter/)
  })

  it('applies JetBrains Mono to mono elements', () => {
    expect(globalsCSS).toMatch(/JetBrains Mono.*monospace/)
  })
})
