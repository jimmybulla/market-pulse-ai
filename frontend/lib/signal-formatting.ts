import type { SignalDirection } from './types'

export function directionLabel(d: SignalDirection): string {
  if (d === 'bullish') return '↑ Bullish'
  if (d === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

export function directionColor(d: SignalDirection): string {
  return d === 'bullish' ? 'text-profit' : 'text-loss'
}
