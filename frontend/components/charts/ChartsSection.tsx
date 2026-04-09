'use client'

import { useState } from 'react'
import RangeSelector from './RangeSelector'
import PriceChart from './PriceChart'
import SentimentChart from './SentimentChart'
import NewsVolumeChart from './NewsVolumeChart'

type Range = '7d' | '30d' | '90d'

interface Props {
  ticker: string
}

export default function ChartsSection({ ticker }: Props) {
  const [range, setRange] = useState<Range>('30d')

  return (
    <div className="space-y-4">
      <RangeSelector value={range} onChange={setRange} />
      <PriceChart key={`${ticker}-${range}`} ticker={ticker} range={range} />
      <SentimentChart ticker={ticker} range={range} />
      <NewsVolumeChart ticker={ticker} range={range} />
    </div>
  )
}
