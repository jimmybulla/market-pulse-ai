'use client'

import { Newspaper } from 'lucide-react'
import NewsItem from './NewsItem'
import type { NewsArticleResponse } from '@/lib/types'

interface NewsFeedProps {
  articles: NewsArticleResponse[]
}

export default function NewsFeed({ articles }: NewsFeedProps) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600 gap-2">
        <Newspaper className="w-8 h-8" />
        <p className="text-sm">No recent news</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-white/5">
      {articles.map((article) => (
        <NewsItem key={article.id} article={article} />
      ))}
    </div>
  )
}
