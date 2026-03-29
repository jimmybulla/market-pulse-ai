import { getSignals } from '@/lib/api'
import SignalList from '@/components/signals/SignalList'
import TopBar from '@/components/layout/TopBar'

export default async function SignalsPage() {
  const { data } = await getSignals({ limit: 100 })
  return (
    <div>
      <TopBar title="Signals" subtitle="All active signals ranked by opportunity score" />
      <div className="p-6">
        <SignalList signals={data} />
      </div>
    </div>
  )
}
