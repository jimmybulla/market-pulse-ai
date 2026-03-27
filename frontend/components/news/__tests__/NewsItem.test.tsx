import { render, screen } from '@testing-library/react'
import NewsItem from '../NewsItem'
import type { NewsArticleResponse } from '@/lib/types'

const article: NewsArticleResponse = {
  id: '1',
  source_id: null,
  headline: 'NVIDIA reports record data center revenue',
  body: null,
  url: 'https://reuters.com/nvda-q4',
  published_at: '2026-03-26T15:00:00Z',
  fetched_at: '2026-03-26T16:00:00Z',
  tickers: ['NVDA'],
  sentiment_score: 0.88,
  event_type: 'earnings',
  novelty_score: 0.92,
  credibility_score: 0.92,
  severity: 0.85,
}

describe('NewsItem', () => {
  it('renders the headline', () => {
    render(<NewsItem article={article} />)
    expect(screen.getByText('NVIDIA reports record data center revenue')).toBeInTheDocument()
  })

  it('renders ticker badges', () => {
    render(<NewsItem article={article} />)
    expect(screen.getByText('NVDA')).toBeInTheDocument()
  })

  it('renders event type badge', () => {
    render(<NewsItem article={article} />)
    expect(screen.getByText('earnings')).toBeInTheDocument()
  })

  it('wraps with a link when url is present', () => {
    render(<NewsItem article={article} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://reuters.com/nvda-q4')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
