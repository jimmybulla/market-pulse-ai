'use client'
import { useState } from 'react'
import type { NewsFeedItem } from '@/lib/types'
import NewsCard from './NewsCard'

export default function NewsFeed({ items }: { items: NewsFeedItem[] }) {
  const [direction, setDirection] = useState('')
  const [eventType, setEventType] = useState('')

  const filtered = items.filter((item) => {
    if (direction && item.signal_direction !== direction) return false
    if (eventType && item.event_type !== eventType) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <select
          aria-label="Direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Directions</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="crash_risk">Crash Risk</option>
        </select>

        <select
          aria-label="Event Type"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Event Types</option>
          <option value="earnings">Earnings</option>
          <option value="regulation">Regulation</option>
          <option value="m_a">M&amp;A</option>
          <option value="product_launch">Product Launch</option>
          <option value="executive_change">Executive Change</option>
          <option value="other">Other</option>
        </select>
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
