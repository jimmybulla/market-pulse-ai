import { render, screen, fireEvent } from '@testing-library/react'
import SignalList from '../SignalList'
import type { SignalResponse } from '@/lib/types'

const makeSignal = (overrides: Partial<SignalResponse> = {}): SignalResponse => ({
  id: 'sig-1',
  stock_id: 'abc',
  ticker: 'AAPL',
  stock_name: 'Apple Inc.',
  sector: 'Technology',
  last_price: 175.0,
  direction: 'bullish',
  confidence: 0.72,
  expected_move_low: 0.03,
  expected_move_high: 0.07,
  horizon_days: 5,
  opportunity_score: 0.85,
  crash_risk_score: 0.05,
  rank: 1,
  explanation: null,
  drivers: ['Strong earnings'],
  evidence: { sources: [], article_ids: [], article_count: 0, avg_credibility: 0 },
  historical_analog: { avg_move: 0.05, hit_rate: 0.6, sample_size: 5 },
  risk_flags: [],
  created_at: '2026-03-29T00:00:00Z',
  expires_at: null,
  ...overrides,
})

describe('SignalList', () => {
  it('renders empty state when signals is empty', () => {
    render(<SignalList signals={[]} />)
    expect(screen.getByText('No signals yet')).toBeInTheDocument()
  })

  it('renders all signals when no filter is active', () => {
    const signals = [
      makeSignal({ id: 'sig-1', ticker: 'AAPL', rank: 1 }),
      makeSignal({ id: 'sig-2', ticker: 'NVDA', rank: 2, direction: 'bearish' }),
    ]
    render(<SignalList signals={signals} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
  })

  it('direction filter hides non-matching rows', () => {
    const signals = [
      makeSignal({ id: 'sig-1', ticker: 'AAPL', direction: 'bullish', rank: 1 }),
      makeSignal({ id: 'sig-2', ticker: 'NVDA', direction: 'bearish', rank: 2 }),
    ]
    render(<SignalList signals={signals} />)
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'bullish' } })
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('NVDA')).not.toBeInTheDocument()
  })

  it('opening a second row closes the first', () => {
    const signals = [
      makeSignal({ id: 'sig-1', ticker: 'AAPL', rank: 1, drivers: ['Driver A'] }),
      makeSignal({ id: 'sig-2', ticker: 'NVDA', rank: 2, drivers: ['Driver B'] }),
    ]
    render(<SignalList signals={signals} />)
    // Open first row
    fireEvent.click(screen.getByRole('button', { name: /toggle AAPL/i }))
    expect(screen.getByText('Driver A')).toBeInTheDocument()
    // Open second row — first should close
    fireEvent.click(screen.getByRole('button', { name: /toggle NVDA/i }))
    expect(screen.queryByText('Driver A')).not.toBeInTheDocument()
    expect(screen.getByText('Driver B')).toBeInTheDocument()
  })
})
