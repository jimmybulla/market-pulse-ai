import { render, screen } from '@testing-library/react'
import ArticleList from '../ArticleList'
import type { NewsArticleResponse } from '@/lib/types'

const makeArticle = (overrides: Partial<NewsArticleResponse> = {}): NewsArticleResponse => ({
  id: 'art-1',
  source_id: null,
  headline: 'Apple beats Q4 earnings',
  body: null,
  url: 'https://reuters.com/aapl',
  published_at: '2026-03-25T14:00:00Z',
  fetched_at: '2026-03-25T15:00:00Z',
  tickers: ['AAPL'],
  sentiment_score: 0.75,
  event_type: 'earnings',
  novelty_score: 0.9,
  credibility_score: 0.92,
  severity: 0.8,
  ...overrides,
})

describe('ArticleList', () => {
  it('renders all articles', () => {
    const articles = [
      makeArticle({ id: 'art-1', headline: 'Apple beats Q4 earnings' }),
      makeArticle({ id: 'art-2', headline: 'Tesla misses revenue' }),
    ]
    render(<ArticleList articles={articles} />)
    expect(screen.getByText('Apple beats Q4 earnings')).toBeInTheDocument()
    expect(screen.getByText('Tesla misses revenue')).toBeInTheDocument()
  })

  it('renders headline as a link when url is present', () => {
    render(<ArticleList articles={[makeArticle({ url: 'https://reuters.com/aapl' })]} />)
    const link = screen.getByRole('link', { name: 'Apple beats Q4 earnings' })
    expect(link).toHaveAttribute('href', 'https://reuters.com/aapl')
  })

  it('shows — for null published_at', () => {
    render(<ArticleList articles={[makeArticle({ published_at: null })]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows empty state when articles array is empty', () => {
    render(<ArticleList articles={[]} />)
    expect(screen.getByText('No articles found')).toBeInTheDocument()
  })

  it('shows + prefix for non-negative sentiment and no prefix for negative', () => {
    const { rerender } = render(
      <ArticleList articles={[makeArticle({ sentiment_score: 0.75 })]} />
    )
    expect(screen.getByText('+0.75')).toBeInTheDocument()

    rerender(
      <ArticleList articles={[makeArticle({ sentiment_score: -0.32 })]} />
    )
    expect(screen.getByText('-0.32')).toBeInTheDocument()
  })
})
