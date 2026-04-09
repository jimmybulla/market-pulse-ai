'use client'

import { useEffect, useRef } from 'react'

interface Props {
  ticker: string
  range: '7d' | '30d' | '90d'
}

const RANGE_MAP = {
  '7d': '7D',
  '30d': '1M',
  '90d': '3M',
}

export default function PriceChart({ ticker, range }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: ticker,
      range: RANGE_MAP[range],
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(18, 18, 18, 1)',
      gridColor: 'rgba(255, 255, 255, 0.04)',
      hide_top_toolbar: false,
      hide_legend: true,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    })

    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [ticker, range])

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden" style={{ height: '400px' }}>
      <div className="tradingview-widget-container h-full" ref={containerRef}>
        <div className="tradingview-widget-container__widget h-full" />
      </div>
    </div>
  )
}
