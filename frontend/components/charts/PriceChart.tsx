'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

interface PricePoint {
  date: string
  close: number
}

interface Props {
  ticker: string
  range: string
}

export default function PriceChart({ ticker, range }: Props) {
  const [data, setData] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/charts/${ticker}/price?range=${range}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load price data')
        return r.json()
      })
      .then((d) => setData(d.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker, range])

  if (loading) return <Skeleton className="h-52 w-full rounded-xl" />

  if (error) {
    return (
      <div className="h-52 rounded-xl bg-surface-card border border-white/8 flex items-center justify-center">
        <p className="text-sm text-loss">{error}</p>
      </div>
    )
  }

  return (
    <div className="h-52 bg-surface-card rounded-xl border border-white/8 p-4">
      <p className="text-xs text-gray-500 mb-2 font-medium">Price</p>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00B4FF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00B4FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={(v: number) => `$${v}`}
            domain={['auto', 'auto']}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1E1E1E',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
            }}
            labelStyle={{ color: '#9CA3AF', fontSize: 11 }}
            itemStyle={{ color: '#00B4FF', fontSize: 11 }}
            formatter={(v) => [`$${Number(v ?? 0).toFixed(2)}`, 'Close']}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#00B4FF"
            fill="url(#priceGradient)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
