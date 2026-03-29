import { getNewsFeed } from '@/lib/api'
import NewsFeed from '@/components/news/NewsFeed'
import TopBar from '@/components/layout/TopBar'

export default async function NewsPage() {
  const items = await getNewsFeed()
  return (
    <div>
      <TopBar title="News" subtitle="Signal-linked market news" />
      <div className="p-6">
        <NewsFeed items={items} />
      </div>
    </div>
  )
}
