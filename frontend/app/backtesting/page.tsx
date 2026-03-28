import { getBacktestingStats } from '@/lib/api'
import BacktestingDashboard from '@/components/analytics/BacktestingDashboard'
import TopBar from '@/components/layout/TopBar'

export default async function BacktestingPage() {
  const stats = await getBacktestingStats()
  return (
    <div>
      <TopBar title="Backtesting" subtitle="Signal accuracy tracking" />
      <div className="p-6">
        <BacktestingDashboard stats={stats} />
      </div>
    </div>
  )
}
