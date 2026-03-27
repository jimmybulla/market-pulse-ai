'use client'

import { BarChart2 } from 'lucide-react'

interface ChartPlaceholderProps {
  title: string
  height?: string
}

export default function ChartPlaceholder({ title, height = 'h-48' }: ChartPlaceholderProps) {
  return (
    <div className={`${height} rounded-xl bg-surface-card border border-white/8 flex flex-col items-center justify-center gap-2`}>
      <BarChart2 className="w-8 h-8 text-gray-600" />
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className="text-xs text-gray-600">Live data in Phase 3</p>
    </div>
  )
}
