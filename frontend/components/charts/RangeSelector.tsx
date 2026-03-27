'use client'

type Range = '7d' | '30d' | '90d'

const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
]

interface Props {
  value: Range
  onChange: (range: Range) => void
}

export default function RangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1 text-xs rounded-md font-mono transition-colors ${
            value === r.value
              ? 'bg-brand-cyan text-anchor font-semibold'
              : 'bg-surface-elevated text-gray-400 hover:text-gray-200'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
