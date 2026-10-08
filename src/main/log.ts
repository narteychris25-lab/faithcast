import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from './paths'

/** Minimal rotating file logger (logs/main.log, ~2 MB, one rollover). */
const MAX = 2 * 1024 * 1024

function write(level: string, args: unknown[]): void {
  const line = `${new Date().toISOString()} [${level}] ${args
    .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : safe(a)))
    .join(' ')}\n`
  if (level !== 'debug') (level === 'error' ? console.error : console.log)(line.trimEnd())
  try {
    const file = join(paths.logs(), 'main.log')
    if (existsSync(file) && statSync(file).size > MAX) renameSync(file, `${file}.1`)
    appendFileSync(file, line)
  } catch {
    /* logging must never throw */
  }
}

function safe(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export const log = {
  debug: (...a: unknown[]) => write('debug', a),
  info: (...a: unknown[]) => write('info', a),
  warn: (...a: unknown[]) => write('warn', a),
  error: (...a: unknown[]) => write('error', a)
}
