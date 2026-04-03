import { Skeleton } from '@/components/ui/skeleton'

export default function BacktestingLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-28 bg-surface-elevated" />
        <Skeleton className="h-3 w-44 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-2">
              <Skeleton className="h-3 w-24 bg-surface-elevated" />
              <Skeleton className="h-8 w-20 bg-surface-elevated" />
            </div>
          ))}
        </div>
        <div className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-lg bg-surface-elevated" />
            <Skeleton className="h-7 w-20 rounded-lg bg-surface-elevated" />
          </div>
          <Skeleton className="h-56 w-full rounded-lg bg-surface-elevated" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-3">
            <Skeleton className="h-4 w-28 bg-surface-elevated" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-surface-elevated" />
                <Skeleton className="h-3 w-16 bg-surface-elevated" />
              </div>
            ))}
          </div>
          <div className="bg-surface-card rounded-xl border border-white/8 p-4 space-y-3">
            <Skeleton className="h-4 w-32 bg-surface-elevated" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-3 w-20 bg-surface-elevated" />
                <Skeleton className="h-3 w-16 bg-surface-elevated" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
