'use client'

import { useEffect, useRef } from 'react'

interface Props {
  ticker: string
  range: '7d' | '30d' | '90d'
}

const DATE_RANGE_MAP: Record<string, string> = {
  '7d': '1W',
  '30d': '1M',
  '90d': '3M',
}

export default function PriceChart({ ticker, range }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Full teardown — TradingView widgets don't support in-place updates
    while (container.firstChild) container.removeChild(container.firstChild)

    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container'
    wrapper.style.width = '100%'
    wrapper.style.height = '100%'

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.width = '100%'
    widgetDiv.style.height = '100%'
    wrapper.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'
    script.async = true
    script.textContent = JSON.stringify({
      symbols: [[ticker]],
      chartOnly: true,
      width: '100%',
      height: '100%',
      locale: 'en',
      colorTheme: 'dark',
      autosize: true,
      showVolume: true,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: true,
      hideSymbolLogo: true,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily: 'inherit',
      fontSize: '10',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'candlesticks',
      dateRange: DATE_RANGE_MAP[range] ?? '1M',
      lineWidth: 2,
      lineType: 0,
      dateFormat: 'MM/dd/yyyy',
    })
    wrapper.appendChild(script)
    container.appendChild(wrapper)

    return () => {
      while (container.firstChild) container.removeChild(container.firstChild)
    }
  }, [ticker, range])

  return (
    <div
      className="rounded-xl border border-white/8 bg-[#121212]"
      style={{ height: '420px', width: '100%' }}
      ref={containerRef}
    />
  )
}
