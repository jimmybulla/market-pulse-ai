'use client'

import { useEffect } from 'react'
import { TrendingUp } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <TrendingUp className="w-12 h-12 text-loss" />
      <h2 className="text-lg font-semibold text-white">Failed to load signals</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        The signal feed is temporarily unavailable. Check back in a few minutes.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-sm hover:bg-brand-cyan/20 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
