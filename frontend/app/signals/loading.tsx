import { Skeleton } from '@/components/ui/skeleton'

export default function SignalsLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-24 bg-surface-elevated" />
        <Skeleton className="h-3 w-48 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-3">
        <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/8">
            <Skeleton className="h-3 w-full bg-surface-elevated" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-4 w-6 bg-surface-elevated shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20 bg-surface-elevated" />
                <Skeleton className="h-2.5 w-32 bg-surface-elevated" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-surface-elevated shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-1.5 w-full rounded-full bg-surface-elevated" />
                <Skeleton className="h-2.5 w-24 bg-surface-elevated" />
              </div>
              <Skeleton className="h-3 w-8 bg-surface-elevated shrink-0" />
              <Skeleton className="h-3 w-12 bg-surface-elevated shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
