import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const globalsCSS = readFileSync(resolve(__dirname, '../globals.css'), 'utf-8')

const requiredVars = [
  '--gate-midnight',
  '--gate-iron',
  '--gate-steel',
  '--gate-key',
  '--gate-key-dim',
  '--gate-safe',
  '--gate-danger',
  '--gate-text',
  '--gate-muted',
]

describe('design tokens', () => {
  it.each(requiredVars)('globals.css defines %s', (varName) => {
    expect(globalsCSS).toContain(varName)
  })
})
