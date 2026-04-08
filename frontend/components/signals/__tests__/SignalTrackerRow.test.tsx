import { render, screen } from '@testing-library/react'
import SignalTrackerRow from '../SignalTrackerRow'
import type { SignalResponse } from '@/lib/types'

const BASE: SignalResponse = {
  id: '1',
  stock_id: 'abc',
  ticker: 'AAPL',
  stock_name: 'Apple Inc.',
  sector: 'Technology',
  last_price: 205.25,
  price_at_signal: 200.00,
  direction: 'bullish',
  confidence: 0.72,
  expected_move_low: 0.03,
  expected_move_high: 0.07,
  horizon_days: 5,
  opportunity_score: 0.72,
  crash_risk_score: 0.05,
  rank: 1,
  explanation: null,
  drivers: [],
  evidence: { sources: [], article_ids: [], article_count: 0, avg_credibility: 0 },
  historical_analog: { avg_move: 0.05, hit_rate: 0.64, sample_size: 15 },
  risk_flags: [],
  // 2 days ago → 3d left with horizon_days=5
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  expires_at: null,
  is_expired: false,
  deleted_at: null,
  actual_move: null,
  was_correct: null,
  resolved_verdict: null,
}

const CRASH: SignalResponse = {
  ...BASE,
  id: '2',
  ticker: 'TSLA',
  stock_name: 'Tesla Inc.',
  direction: 'crash_risk',
  last_price: 194.00,
  price_at_signal: 200.00,
  rank: 1,
  confidence: 0.81,
}

const EXPIRED: SignalResponse = {
  ...BASE,
  id: '3',
  created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
}

const NO_PRICE: SignalResponse = {
  ...BASE,
  id: '4',
  last_price: null,
  price_at_signal: null,
}

describe('SignalTrackerRow', () => {
  it('renders rank, ticker and company name', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
  })

  it('links to stock detail page', () => {
    render(<SignalTrackerRow signal={BASE} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/stock/AAPL')
  })

  it('renders bullish direction badge', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByText('↑ Bullish')).toBeInTheDocument()
  })

  it('renders crash risk direction badge', () => {
    render(<SignalTrackerRow signal={CRASH} />)
    expect(screen.getByText('⚠ Crash Risk')).toBeInTheDocument()
  })

  it('renders confidence percentage', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('shows days remaining when within horizon', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByText('3d left')).toBeInTheDocument()
  })

  it('shows Expired when past horizon', () => {
    render(<SignalTrackerRow signal={EXPIRED} />)
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('shows actual move and target range when price data available', () => {
    render(<SignalTrackerRow signal={BASE} />)
    // last_price=205.25, price_at_signal=200 → +2.6%
    expect(screen.getByText(/\+2\.\d%/)).toBeInTheDocument()
    // target range
    expect(screen.getByText('+3.0–7.0%')).toBeInTheDocument()
  })

  it('shows em-dash when no price data', () => {
    render(<SignalTrackerRow signal={NO_PRICE} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a progress bar element', () => {
    render(<SignalTrackerRow signal={BASE} />)
    expect(screen.getByTestId('signal-progress-track')).toBeInTheDocument()
  })
})
