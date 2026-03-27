import { render, screen } from '@testing-library/react'
import SignalExpanded from '../SignalExpanded'
import type { SignalResponse } from '@/lib/types'

const signal: SignalResponse = {
  id: '1', stock_id: 'x', ticker: 'NVDA', stock_name: 'NVIDIA',
  sector: 'Technology', last_price: 875.5,
  direction: 'bullish', confidence: 1.0,
  expected_move_low: 0.05, expected_move_high: 0.10,
  horizon_days: 5, opportunity_score: 1.0, crash_risk_score: 0.0,
  rank: 3, explanation: 'AI analysis pending',
  drivers: ['Strong earnings sentiment', 'Strong product momentum'],
  evidence: { sources: ['Bloomberg'], article_ids: ['x'], article_count: 2, avg_credibility: 0.94 },
  historical_analog: { avg_move: 0.075, hit_rate: 0.64, sample_size: 15 },
  risk_flags: ['Overextended rally'],
  created_at: '2026-03-27T00:00:00Z', expires_at: null,
}

const signalNoFlags: SignalResponse = {
  ...signal,
  risk_flags: [],
}

describe('SignalExpanded', () => {
  it('renders key drivers', () => {
    render(<SignalExpanded signal={signal} />)
    expect(screen.getByText('Strong earnings sentiment')).toBeInTheDocument()
    expect(screen.getByText('Strong product momentum')).toBeInTheDocument()
  })

  it('renders evidence stats', () => {
    render(<SignalExpanded signal={signal} />)
    expect(screen.getByText('2 articles')).toBeInTheDocument()
    expect(screen.getByText('94% avg credibility')).toBeInTheDocument()
  })

  it('renders historical analog', () => {
    render(<SignalExpanded signal={signal} />)
    expect(screen.getByText('+7.5% avg move')).toBeInTheDocument()
    expect(screen.getByText('64% hit rate')).toBeInTheDocument()
  })

  it('renders risk flags when present', () => {
    render(<SignalExpanded signal={signal} />)
    expect(screen.getByText('Overextended rally')).toBeInTheDocument()
  })

  it('hides risk flags section when empty', () => {
    render(<SignalExpanded signal={signalNoFlags} />)
    expect(screen.queryByText('Risk Flags')).not.toBeInTheDocument()
  })
})
