import { render, screen } from '@testing-library/react'
import NewsCard from '../NewsCard'
import type { NewsFeedItem } from '@/lib/types'

const mockItem: NewsFeedItem = {
  id: 'art-1',
  headline: 'Apple reports record earnings',
  url: 'https://example.com/apple-earnings',
  published_at: '2026-03-20T10:00:00Z',
  sentiment_score: 0.42,
  event_type: 'earnings',
  credibility_score: 0.8,
  tickers: ['AAPL'],
  signal_direction: 'bullish',
  signal_confidence: 0.75,
  signal_opportunity_score: 0.85,
}

describe('NewsCard', () => {
  it('renders headline as a link to the article url', () => {
    render(<NewsCard item={mockItem} />)
    const link = screen.getByRole('link', { name: /apple reports record earnings/i })
    expect(link).toHaveAttribute('href', 'https://example.com/apple-earnings')
  })

  it('renders ticker badge', () => {
    render(<NewsCard item={mockItem} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
  })

  it('renders signal direction label and confidence', () => {
    render(<NewsCard item={mockItem} />)
    expect(screen.getByText(/bullish/i)).toBeInTheDocument()
    expect(screen.getByText(/75%/i)).toBeInTheDocument()
  })

  it('renders positive sentiment with text-profit class', () => {
    render(<NewsCard item={mockItem} />)
    const el = screen.getByText('+0.42')
    expect(el).toHaveClass('text-profit')
  })

  it('renders negative sentiment with text-loss class', () => {
    render(<NewsCard item={{ ...mockItem, sentiment_score: -0.18 }} />)
    const el = screen.getByText('-0.18')
    expect(el).toHaveClass('text-loss')
  })

  it('renders headline as plain text when url is empty', () => {
    render(<NewsCard item={{ ...mockItem, url: '' }} />)
    expect(screen.queryByRole('link', { name: /apple reports record earnings/i })).not.toBeInTheDocument()
    expect(screen.getByText('Apple reports record earnings')).toBeInTheDocument()
  })
})
