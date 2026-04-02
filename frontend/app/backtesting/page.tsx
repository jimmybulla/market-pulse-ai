import { getBacktestingStats, getPerformanceOverTime } from '@/lib/api'
import BacktestingDashboard from '@/components/analytics/BacktestingDashboard'
import TopBar from '@/components/layout/TopBar'

export default async function BacktestingPage() {
  const [stats, performanceData] = await Promise.all([
    getBacktestingStats(),
    getPerformanceOverTime(),
  ])
  return (
    <div>
      <TopBar title="Backtesting" subtitle="Signal accuracy tracking" />
      <div className="p-6">
        <BacktestingDashboard stats={stats} performanceData={performanceData} />
      </div>
    </div>
  )
}
