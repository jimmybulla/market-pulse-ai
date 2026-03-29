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
