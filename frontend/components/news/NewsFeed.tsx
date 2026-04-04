'use client'
import { useState } from 'react'
import { Search } from 'lucide-react'
import type { NewsFeedItem } from '@/lib/types'
import NewsCard from './NewsCard'

const SELECT_CLS = 'bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20'

export default function NewsFeed({ items = [] }: { items: NewsFeedItem[] }) {
  const [direction, setDirection] = useState('')
  const [eventType, setEventType] = useState('')
  const [tickerSearch, setTickerSearch] = useState('')

  const filtered = items.filter((item) => {
    if (direction && item.signal_direction !== direction) return false
    if (eventType && item.event_type !== eventType) return false
    if (tickerSearch) {
      const q = tickerSearch.toUpperCase()
      if (!item.tickers.some((t) => t.includes(q))) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Ticker search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Ticker…"
            value={tickerSearch}
            onChange={(e) => setTickerSearch(e.target.value)}
            className="bg-surface-card border border-white/8 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-white/20 w-28"
          />
        </div>

        <select aria-label="Direction" value={direction} onChange={(e) => setDirection(e.target.value)} className={SELECT_CLS}>
          <option value="">All Directions</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="crash_risk">Crash Risk</option>
        </select>

        <select aria-label="Event Type" value={eventType} onChange={(e) => setEventType(e.target.value)} className={SELECT_CLS}>
          <option value="">All Event Types</option>
          <option value="earnings">Earnings</option>
          <option value="regulation">Regulation</option>
          <option value="m&a">M&amp;A</option>
          <option value="product">Product</option>
          <option value="executive">Executive</option>
          <option value="macro">Macro</option>
        </select>

        {(tickerSearch || direction || eventType) && (
          <button
            onClick={() => { setTickerSearch(''); setDirection(''); setEventType('') }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-600">
          No signal-linked news yet
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
