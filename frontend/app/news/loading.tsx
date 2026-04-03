import { Skeleton } from '@/components/ui/skeleton'

export default function NewsLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-20 bg-surface-elevated" />
        <Skeleton className="h-3 w-44 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-36 rounded-lg bg-surface-elevated" />
          <Skeleton className="h-9 w-36 rounded-lg bg-surface-elevated" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface-card rounded-xl border border-white/8 px-4 py-3 flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full bg-surface-elevated" />
                <Skeleton className="h-3 w-3/4 bg-surface-elevated" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-16 bg-surface-elevated" />
                  <Skeleton className="h-3 w-20 bg-surface-elevated" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-surface-elevated shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
