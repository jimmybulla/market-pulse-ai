import { render, screen } from '@testing-library/react'
import NewsFeed from '../NewsFeed'
import type { NewsArticleResponse } from '@/lib/types'

const articles: NewsArticleResponse[] = [
  {
    id: '1', source_id: null,
    headline: 'First article', body: null, url: null,
    published_at: '2026-03-26T15:00:00Z', fetched_at: '2026-03-26T16:00:00Z',
    tickers: ['AAPL'], sentiment_score: 0.5, event_type: 'earnings',
    novelty_score: 0.8, credibility_score: 0.9, severity: 0.5,
  },
  {
    id: '2', source_id: null,
    headline: 'Second article', body: null, url: null,
    published_at: '2026-03-26T14:00:00Z', fetched_at: '2026-03-26T15:00:00Z',
    tickers: ['MSFT'], sentiment_score: 0.6, event_type: 'product',
    novelty_score: 0.7, credibility_score: 0.85, severity: 0.4,
  },
]

describe('NewsFeed', () => {
  it('renders all articles', () => {
    render(<NewsFeed articles={articles} />)
    expect(screen.getByText('First article')).toBeInTheDocument()
    expect(screen.getByText('Second article')).toBeInTheDocument()
  })

  it('shows empty state when no articles', () => {
    render(<NewsFeed articles={[]} />)
    expect(screen.getByText('No recent news')).toBeInTheDocument()
  })
})
