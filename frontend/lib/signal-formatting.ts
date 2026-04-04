import type { SignalDirection } from './types'

export function directionLabel(d: SignalDirection): string {
  if (d === 'bullish') return '↑ Bullish'
  if (d === 'bearish') return '↓ Bearish'
  return '⚠ Crash Risk'
}

export function directionColor(d: SignalDirection): string {
  return d === 'bullish' ? 'text-profit' : 'text-loss'
}

export function calcActualPct(lastPrice: number | null, priceAtSignal: number | null): number | null {
  if (lastPrice == null || priceAtSignal == null) return null
  return ((lastPrice - priceAtSignal) / priceAtSignal) * 100
}

export function calcProgressPct(direction: SignalDirection, actualPct: number, expectedMoveLow: number, expectedMoveHigh: number): number {
  if (direction === 'bullish') {
    const denom = expectedMoveHigh * 100
    return denom !== 0 ? Math.min((actualPct / denom) * 100, 100) : 0
  }
  if (direction === 'crash_risk') {
    return Math.min((Math.abs(actualPct) / 10) * 100, 100)
  }
  // bearish: use expectedMoveHigh (larger magnitude) as full target
  const denom = Math.abs(expectedMoveHigh) * 100
  return denom !== 0 ? Math.min((Math.abs(actualPct) / denom) * 100, 100) : 0
}

export function calcDaysRemaining(createdAt: string, horizonDays: number): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000
  return Math.round(horizonDays - ageDays)
}

export function sourceDomain(url: string | null): string {
  if (!url) return ''
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return '' }
}

export function sentimentColor(score: number | null): string {
  if (score == null) return 'text-gray-500'
  return score >= 0 ? 'text-profit' : 'text-loss'
}

export function sentimentLabel(score: number | null): string {
  if (score == null) return '--'
  const prefix = score >= 0 ? '+' : ''
  return `${prefix}${score.toFixed(2)}`
}
