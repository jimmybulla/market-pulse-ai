import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <Skeleton className="h-5 w-40 bg-surface-elevated" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl bg-surface-elevated" />
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 bg-surface-elevated" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-surface-elevated" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl bg-surface-elevated" />
      </div>
      <div className="xl:col-span-3 space-y-3">
        <Skeleton className="h-5 w-32 bg-surface-elevated" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg bg-surface-elevated" />
          ))}
        </div>
      </div>
    </div>
  )
}
