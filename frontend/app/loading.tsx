import { Skeleton } from '@/components/ui/skeleton'

function TableSectionSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40 bg-surface-elevated" />
      <div className="bg-surface-card rounded-xl border border-white/8 overflow-hidden">
        <div className="px-4 py-2 border-b border-white/8">
          <Skeleton className="h-3 w-full bg-surface-elevated" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
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
  )
}

export default function DashboardLoading() {
  return (
    <div>
      <div className="h-14 border-b border-white/8 bg-surface-card/50 px-6 flex items-center gap-3">
        <Skeleton className="h-5 w-28 bg-surface-elevated" />
        <Skeleton className="h-3 w-40 bg-surface-elevated" />
      </div>
      <div className="p-6 space-y-6">
        <TableSectionSkeleton rows={5} />
        <TableSectionSkeleton rows={3} />
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 bg-surface-elevated" />
          <div className="bg-surface-card rounded-xl border border-white/8 p-2 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg bg-surface-elevated" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
