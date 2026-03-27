'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

interface VolumePoint {
  date: string
  count: number
}

interface Props {
  ticker: string
  range: string
}

export default function NewsVolumeChart({ ticker, range }: Props) {
  const [data, setData] = useState<VolumePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/charts/${ticker}/news-volume?range=${range}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load news volume data')
        return r.json()
      })
      .then((d) => setData(d.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker, range])

  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />

  if (error) {
    return (
      <div className="h-40 rounded-xl bg-surface-card border border-white/8 flex items-center justify-center">
        <p className="text-sm text-loss">{error}</p>
      </div>
    )
  }

  return (
    <div className="h-40 bg-surface-card rounded-xl border border-white/8 p-4">
      <p className="text-xs text-gray-500 mb-2 font-medium">News Volume</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#2A2A2A"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            allowDecimals={false}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1E1E1E',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
            }}
            labelStyle={{ color: '#9CA3AF', fontSize: 11 }}
            itemStyle={{ color: '#00B4FF', fontSize: 11 }}
            formatter={(v: number) => [v, 'Articles']}
          />
          <Bar dataKey="count" fill="#00B4FF" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
