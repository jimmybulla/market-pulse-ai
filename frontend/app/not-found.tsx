import Link from 'next/link'
import { Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <Search className="w-12 h-12 text-gray-600" />
      <h2 className="text-lg font-semibold text-white">Not Found</h2>
      <p className="text-sm text-gray-500">
        That ticker or page doesn&apos;t exist in our system.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-sm hover:bg-brand-cyan/20 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
