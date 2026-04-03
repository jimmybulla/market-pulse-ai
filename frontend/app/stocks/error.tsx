'use client'

import { useEffect } from 'react'
import { BarChart3 } from 'lucide-react'

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
      <BarChart3 className="w-12 h-12 text-loss" />
      <h2 className="text-lg font-semibold text-white">Failed to load stocks</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        We couldn&apos;t reach the stocks data. Try refreshing the page.
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
