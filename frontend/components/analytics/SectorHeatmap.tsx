import type { SectorHeatmapEntry } from '@/lib/types'

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Industrials',
  'Communication Services',
  'Consumer Staples',
  'Energy',
  'Utilities',
  'Real Estate',
  'Materials',
]

function cellStyle(entry: SectorHeatmapEntry | undefined): string {
  if (!entry || entry.signal_count === 0) {
    return 'bg-surface-card border-white/8 text-gray-600'
  }

  const { signal_count, bullish, bearish, crash_risk } = entry
  const bearishTotal = bearish + crash_risk

  // Intensity based on signal count
  const intensity = signal_count >= 7 ? '60' : signal_count >= 4 ? '40' : '20'

  if (bullish > bearishTotal) {
    return `bg-profit/10 border-profit/${intensity} text-profit`
  }
  if (bearishTotal > bullish) {
    return `bg-loss/10 border-loss/${intensity} text-loss`
  }
  // Mixed
  return `bg-amber-500/10 border-amber-500/${intensity} text-amber-400`
}

interface Props {
  data: SectorHeatmapEntry[]
}

export default function SectorHeatmap({ data }: Props) {
  const byName = Object.fromEntries(data.map((d) => [d.sector, d]))

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {SECTORS.map((sector) => {
        const entry = byName[sector]
        const count = entry?.signal_count ?? 0
        return (
          <div
            key={sector}
            className={`rounded-lg border px-3 py-2 ${cellStyle(entry)}`}
          >
            <div className="text-xs font-medium leading-tight">{sector}</div>
            <div className="text-lg font-semibold mt-1">
              {count > 0 ? count : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
