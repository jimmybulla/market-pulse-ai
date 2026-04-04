import { getStocks } from '@/lib/api'
import StocksTable from '@/components/stocks/StocksTable'
import TopBar from '@/components/layout/TopBar'

export default async function StocksPage() {
  const { data } = await getStocks({ limit: 100 })
  return (
    <div>
      <TopBar title="Stocks" subtitle="All tracked stocks" />
      <div className="p-6">
        <StocksTable stocks={data} />
      </div>
    </div>
  )
}
