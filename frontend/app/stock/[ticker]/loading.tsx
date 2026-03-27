import { Skeleton } from '@/components/ui/skeleton'

export default function StockLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-lg bg-surface-elevated" />
        <Skeleton className="h-8 w-48 bg-surface-elevated" />
        <Skeleton className="h-8 w-24 ml-auto bg-surface-elevated" />
      </div>
      <Skeleton className="h-20 rounded-xl bg-surface-elevated" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Skeleton className="h-52 rounded-xl bg-surface-elevated" />
          <Skeleton className="h-40 rounded-xl bg-surface-elevated" />
          <Skeleton className="h-40 rounded-xl bg-surface-elevated" />
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-80 rounded-xl bg-surface-elevated" />
        </div>
      </div>
    </div>
  )
}
