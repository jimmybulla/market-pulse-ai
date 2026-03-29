'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { StockResponse } from '@/lib/types'

type SortKey = 'ticker' | 'name' | 'sector' | 'last_price'

export default function StocksTable({ stocks }: { stocks: StockResponse[] }) {
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('ticker')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sectorOptions = Array.from(
    new Set(stocks.map((s) => s.sector).filter((s): s is string => s !== null))
  ).sort()

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function indicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const filtered = stocks
    .filter(
      (s) =>
        s.ticker.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase())
    )
    .filter((s) => !sector || s.sector === sector)

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (aVal === null) return 1
    if (bVal === null) return -1
    // Both non-null; same type per sortKey (all string or all number)
    return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * (sortDir === 'asc' ? 1 : -1)
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-3">
        <input
          aria-label="Search"
          placeholder="Search ticker or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20 w-64"
        />
        <select
          aria-label="Sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="bg-surface-card border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Sectors</option>
          {sectorOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-600">No stocks found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-gray-500">
                <th
                  className="pb-3 pr-6 cursor-pointer hover:text-gray-300 font-medium"
                  onClick={() => handleSort('ticker')}
                >
                  Ticker{indicator('ticker')}
                </th>
                <th
                  className="pb-3 pr-6 cursor-pointer hover:text-gray-300 font-medium"
                  onClick={() => handleSort('name')}
                >
                  Name{indicator('name')}
                </th>
                <th
                  className="pb-3 pr-6 cursor-pointer hover:text-gray-300 font-medium"
                  onClick={() => handleSort('sector')}
                >
                  Sector{indicator('sector')}
                </th>
                <th
                  className="pb-3 cursor-pointer hover:text-gray-300 font-medium"
                  onClick={() => handleSort('last_price')}
                >
                  Last Price{indicator('last_price')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((stock) => (
                <tr key={stock.id} className="border-b border-white/4 hover:bg-white/2">
                  <td className="py-3 pr-6">
                    <Link
                      href={`/stock/${stock.ticker}`}
                      className="font-mono font-bold text-cyan-400 hover:text-cyan-300"
                    >
                      {stock.ticker}
                    </Link>
                  </td>
                  <td className="py-3 pr-6 text-gray-300">{stock.name}</td>
                  <td className="py-3 pr-6 text-gray-400">{stock.sector ?? '—'}</td>
                  <td className="py-3 text-gray-300">
                    {stock.last_price !== null ? `$${stock.last_price.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
