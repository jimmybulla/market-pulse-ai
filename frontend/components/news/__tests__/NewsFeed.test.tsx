import { render, screen, fireEvent } from '@testing-library/react'
import NewsFeed from '../NewsFeed'
import type { NewsFeedItem } from '@/lib/types'

const makeItem = (overrides: Partial<NewsFeedItem> = {}): NewsFeedItem => ({
  id: 'art-1',
  headline: 'Test headline',
  url: 'https://example.com',
  published_at: '2026-03-20T10:00:00Z',
  sentiment_score: 0.3,
  event_type: 'earnings',
  credibility_score: 0.8,
  tickers: ['AAPL'],
  signal_direction: 'bullish',
  signal_confidence: 0.75,
  signal_opportunity_score: 0.8,
  ...overrides,
})

describe('NewsFeed', () => {
  it('renders empty state when items is empty', () => {
    render(<NewsFeed items={[]} />)
    expect(screen.getByText('No signal-linked news yet')).toBeInTheDocument()
  })

  it('renders all items when no filter is active', () => {
    const items = [
      makeItem({ id: 'art-1', headline: 'Story 1' }),
      makeItem({ id: 'art-2', headline: 'Story 2' }),
    ]
    render(<NewsFeed items={items} />)
    expect(screen.getByText('Story 1')).toBeInTheDocument()
    expect(screen.getByText('Story 2')).toBeInTheDocument()
  })

  it('filters to bullish direction only', () => {
    const items = [
      makeItem({ id: 'art-1', headline: 'Bullish story', signal_direction: 'bullish' }),
      makeItem({ id: 'art-2', headline: 'Bearish story', signal_direction: 'bearish' }),
    ]
    render(<NewsFeed items={items} />)
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'bullish' } })
    expect(screen.getByText('Bullish story')).toBeInTheDocument()
    expect(screen.queryByText('Bearish story')).not.toBeInTheDocument()
  })

  it('filters to earnings event type only', () => {
    const items = [
      makeItem({ id: 'art-1', headline: 'Earnings story', event_type: 'earnings' }),
      makeItem({ id: 'art-2', headline: 'Regulation story', event_type: 'regulation' }),
    ]
    render(<NewsFeed items={items} />)
    fireEvent.change(screen.getByLabelText('Event Type'), { target: { value: 'earnings' } })
    expect(screen.getByText('Earnings story')).toBeInTheDocument()
    expect(screen.queryByText('Regulation story')).not.toBeInTheDocument()
  })
})
