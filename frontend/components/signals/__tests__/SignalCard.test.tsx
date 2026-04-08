import { render, screen } from '@testing-library/react'
import SignalCard from '../SignalCard'
import type { SignalResponse } from '@/lib/types'

const bullishSignal: SignalResponse = {
  id: '1',
  stock_id: 'abc',
  ticker: 'NVDA',
  stock_name: 'NVIDIA Corporation',
  sector: 'Technology',
  last_price: 875.5,
  price_at_signal: null,
  direction: 'bullish',
  confidence: 0.85,
  expected_move_low: 0.05,
  expected_move_high: 0.10,
  horizon_days: 5,
  opportunity_score: 0.85,
  crash_risk_score: 0.05,
  rank: 3,
  explanation: 'AI analysis pending',
  drivers: ['Strong earnings'],
  evidence: { sources: ['Bloomberg'], article_ids: ['x'], article_count: 1, avg_credibility: 0.92 },
  historical_analog: { avg_move: 0.075, hit_rate: 0.64, sample_size: 15 },
  risk_flags: [],
  created_at: '2026-03-27T00:00:00Z',
  expires_at: null,
  is_expired: false,
  deleted_at: null,
  actual_move: null,
  was_correct: null,
  resolved_verdict: null,
}

const crashSignal: SignalResponse = {
  ...bullishSignal,
  id: '2',
  ticker: 'PFE',
  stock_name: 'Pfizer Inc.',
  direction: 'crash_risk',
  confidence: 0.76,
  rank: 11,
}

describe('SignalCard', () => {
  it('renders ticker and company name', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('NVIDIA Corporation')).toBeInTheDocument()
  })

  it('renders rank badge', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('renders bullish direction with up arrow', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('↑ Bullish')).toBeInTheDocument()
  })

  it('renders crash risk direction with warning icon', () => {
    render(<SignalCard signal={crashSignal} />)
    expect(screen.getByText('⚠ Crash Risk')).toBeInTheDocument()
  })

  it('renders confidence percentage', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('renders expected move range', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('+5.0% to +10.0%')).toBeInTheDocument()
  })

  it('renders horizon', () => {
    render(<SignalCard signal={bullishSignal} />)
    expect(screen.getByText('5 days')).toBeInTheDocument()
  })

  it('links to stock detail page', () => {
    render(<SignalCard signal={bullishSignal} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/stock/NVDA')
  })
})
