import { render, screen, fireEvent } from '@testing-library/react'
import SignalRow from '../SignalRow'
import type { SignalResponse } from '@/lib/types'

const mockSignal: SignalResponse = {
  id: 'sig-1',
  stock_id: 'abc',
  ticker: 'AAPL',
  stock_name: 'Apple Inc.',
  sector: 'Technology',
  last_price: 175.0,
  price_at_signal: null,
  direction: 'bullish',
  confidence: 0.72,
  expected_move_low: 0.03,
  expected_move_high: 0.07,
  horizon_days: 5,
  opportunity_score: 0.85,
  crash_risk_score: 0.05,
  rank: 1,
  explanation: null,
  drivers: ['Strong earnings beat', 'Positive guidance'],
  evidence: { sources: ['Bloomberg'], article_ids: ['x'], article_count: 2, avg_credibility: 0.9 },
  historical_analog: { avg_move: 0.05, hit_rate: 0.64, sample_size: 10 },
  risk_flags: [],
  created_at: '2026-03-29T00:00:00Z',
  expires_at: null,
  is_expired: false,
  deleted_at: null,
  actual_move: null,
  was_correct: null,
  resolved_verdict: null,
}

const mockSignalWithPrice: SignalResponse = {
  ...mockSignal,
  last_price: 182.0,
  price_at_signal: 175.0,
  explanation: 'Strong momentum driven by earnings beat.',
  risk_flags: ['Sector volatility'],
}

describe('SignalRow', () => {
  it('renders rank, ticker, and direction in collapsed state', () => {
    render(<SignalRow signal={mockSignal} isExpanded={false} onToggle={() => {}} />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('↑ Bullish')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('does not show drivers when collapsed', () => {
    render(<SignalRow signal={mockSignal} isExpanded={false} onToggle={() => {}} />)
    expect(screen.queryByText('Strong earnings beat')).not.toBeInTheDocument()
  })

  it('calls onToggle when chevron button is clicked', () => {
    const onToggle = jest.fn()
    render(<SignalRow signal={mockSignal} isExpanded={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: /toggle AAPL/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows drivers list when isExpanded is true', () => {
    render(<SignalRow signal={mockSignal} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByText('Strong earnings beat')).toBeInTheDocument()
    expect(screen.getByText('Positive guidance')).toBeInTheDocument()
  })

  it('ticker is a link to /stock/[ticker]', () => {
    render(<SignalRow signal={mockSignal} isExpanded={false} onToggle={() => {}} />)
    const link = screen.getByRole('link', { name: /AAPL/i })
    expect(link).toHaveAttribute('href', '/stock/AAPL')
  })
})

describe('SignalRow — expanded panel', () => {
  it('shows progress bar when price_at_signal and last_price are present', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByTestId('signal-progress-track')).toBeInTheDocument()
  })

  it('hides progress section when price_at_signal is null', () => {
    render(<SignalRow signal={mockSignal} isExpanded={true} onToggle={() => {}} />)
    expect(screen.queryByTestId('signal-progress-track')).not.toBeInTheDocument()
  })

  it('shows actual move percentage', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    // (182-175)/175*100 = 4.0%
    expect(screen.getByTestId('actual-move')).toHaveTextContent('+4.0%')
  })

  it('shows target range', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByTestId('target-range')).toHaveTextContent('3.0% → 7.0%')
  })

  it('shows explanation when present', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByText('Strong momentum driven by earnings beat.')).toBeInTheDocument()
  })

  it('hides explanation when null', () => {
    render(<SignalRow signal={mockSignal} isExpanded={true} onToggle={() => {}} />)
    expect(screen.queryByTestId('explanation-section')).not.toBeInTheDocument()
  })

  it('shows evidence section', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByTestId('evidence-section')).toBeInTheDocument()
    expect(screen.getByText('2 articles')).toBeInTheDocument()
  })

  it('shows historical analog section', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByTestId('historical-section')).toBeInTheDocument()
    // avg_move=0.05 → 5.0%, hit_rate=0.64 → 64%
    expect(screen.getByText('5.0%')).toBeInTheDocument()
    expect(screen.getByText('64% hit rate')).toBeInTheDocument()
  })

  it('shows risk flags when present', () => {
    render(<SignalRow signal={mockSignalWithPrice} isExpanded={true} onToggle={() => {}} />)
    expect(screen.getByText('Sector volatility')).toBeInTheDocument()
  })

  it('hides risk flags section when array is empty', () => {
    render(<SignalRow signal={mockSignal} isExpanded={true} onToggle={() => {}} />)
    expect(screen.queryByTestId('risk-flags-section')).not.toBeInTheDocument()
  })
})
