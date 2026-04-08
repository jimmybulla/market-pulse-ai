'use client'

import { useState } from 'react'
import ResolvedSignalRow from './ResolvedSignalRow'
import type { ResolvedSignalEntry } from '@/lib/types'

interface Props {
  initialData: ResolvedSignalEntry[]
}

export default function PastSignals({ initialData }: Props) {
  const [entries, setEntries] = useState(initialData)

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-600 bg-surface-card rounded-xl border border-white/8">
        No resolved signals yet
      </div>
    )
  }

  return (
    <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
      {entries.map((entry) => (
        <ResolvedSignalRow key={entry.id} entry={entry} onDelete={handleDelete} />
      ))}
    </div>
  )
}
