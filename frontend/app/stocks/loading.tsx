import { Skeleton } from '@/components/ui/skeleton'

export default function StocksLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-24 bg-surface-elevated" />
        <Skeleton className="h-3 w-36 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64 rounded-lg bg-surface-elevated" />
          <Skeleton className="h-10 w-40 rounded-lg bg-surface-elevated" />
        </div>
        <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex gap-6">
            <Skeleton className="h-3 w-16 bg-surface-elevated" />
            <Skeleton className="h-3 w-32 bg-surface-elevated" />
            <Skeleton className="h-3 w-24 bg-surface-elevated" />
            <Skeleton className="h-3 w-16 bg-surface-elevated ml-auto" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-6 border-b border-white/5 last:border-0">
              <Skeleton className="h-4 w-14 bg-surface-elevated shrink-0" />
              <Skeleton className="h-3 w-40 bg-surface-elevated flex-1" />
              <Skeleton className="h-5 w-24 rounded-full bg-surface-elevated" />
              <Skeleton className="h-4 w-16 bg-surface-elevated ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
