import { render, screen, waitFor } from '@testing-library/react'
import SignalHistory from '../SignalHistory'

const mockEntry = (overrides = {}) => ({
  id: 'hist-1',
  direction: 'bullish',
  confidence: 0.75,
  expected_move_low: 0.03,
  expected_move_high: 0.07,
  horizon_days: 5,
  price_at_signal: 150.0,
  actual_move: null,
  was_correct: null,
  accuracy_notes: null,
  created_at: '2026-03-20T10:00:00Z',
  ...overrides,
})

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  } as Response)
})

afterEach(() => jest.restoreAllMocks())

describe('SignalHistory', () => {
  it('renders empty state when no history', async () => {
    render(<SignalHistory ticker="AAPL" />)
    await waitFor(() =>
      expect(screen.getByText('No signal history yet')).toBeInTheDocument()
    )
  })

  it('renders a pending row with Pending label', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockEntry()]),
    } as Response)
    render(<SignalHistory ticker="AAPL" />)
    await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument())
  })

  it('renders a correct resolved row with checkmark', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockEntry({ actual_move: 0.05, was_correct: true })]),
    } as Response)
    render(<SignalHistory ticker="AAPL" />)
    await waitFor(() => expect(screen.getByText('✓')).toBeInTheDocument())
  })

  it('renders an incorrect resolved row with cross', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockEntry({ actual_move: 0.01, was_correct: false })]),
    } as Response)
    render(<SignalHistory ticker="AAPL" />)
    await waitFor(() => expect(screen.getByText('✗')).toBeInTheDocument())
  })
})
