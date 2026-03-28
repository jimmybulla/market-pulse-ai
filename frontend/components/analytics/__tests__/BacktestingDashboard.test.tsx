import { render, screen } from '@testing-library/react'
import BacktestingDashboard from '../BacktestingDashboard'
import type { BacktestingStats } from '@/lib/types'

const emptyStats: BacktestingStats = {
  total_resolved: 0,
  overall_hit_rate: 0,
  by_direction: {},
  by_confidence_tier: {},
  avg_predicted_move: 0,
  avg_actual_move: 0,
}

const richStats: BacktestingStats = {
  total_resolved: 10,
  overall_hit_rate: 0.7,
  by_direction: {
    bullish: { total: 7, hit_rate: 0.71 },
    bearish: { total: 3, hit_rate: 0.67 },
  },
  by_confidence_tier: {
    high: { total: 4, hit_rate: 0.75 },
    medium: { total: 6, hit_rate: 0.67 },
  },
  avg_predicted_move: 0.05,
  avg_actual_move: 0.043,
}

describe('BacktestingDashboard', () => {
  it('renders empty state when total_resolved is 0', () => {
    render(<BacktestingDashboard stats={emptyStats} />)
    expect(screen.getByText(/No resolved signals yet/i)).toBeInTheDocument()
  })

  it('renders overall hit rate stat card', () => {
    render(<BacktestingDashboard stats={richStats} />)
    expect(screen.getByText('70.0%')).toBeInTheDocument()
  })

  it('renders total resolved stat card', () => {
    render(<BacktestingDashboard stats={richStats} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders by_direction table rows', () => {
    render(<BacktestingDashboard stats={richStats} />)
    expect(screen.getByText('bullish')).toBeInTheDocument()
    expect(screen.getByText('bearish')).toBeInTheDocument()
  })

  it('renders by_confidence_tier table rows', () => {
    render(<BacktestingDashboard stats={richStats} />)
    expect(screen.getByText(/high/i)).toBeInTheDocument()
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })
})
