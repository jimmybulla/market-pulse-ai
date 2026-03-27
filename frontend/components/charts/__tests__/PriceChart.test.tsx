import { render, screen, waitFor } from '@testing-library/react'
import PriceChart from '../PriceChart'

jest.mock('recharts', () => ({
  AreaChart: ({ children }: { children: any }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: any }) => <div>{children}</div>,
}))

const mockFetch = (payload: object, ok = true) => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    json: () => Promise.resolve(payload),
  } as Response)
}

describe('PriceChart', () => {
  afterEach(() => jest.restoreAllMocks())

  it('fetches price data from the correct URL', async () => {
    mockFetch({ ticker: 'AAPL', range: '7d', data: [] })
    render(<PriceChart ticker="AAPL" range="7d" />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/charts/AAPL/price?range=7d')
    )
  })

  it('renders area chart after data loads', async () => {
    mockFetch({
      ticker: 'AAPL',
      range: '30d',
      data: [{ date: '2026-03-27', close: 213.45 }],
    })
    render(<PriceChart ticker="AAPL" range="30d" />)
    await waitFor(() =>
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    )
  })

  it('shows error message when fetch returns non-ok', async () => {
    mockFetch({}, false)
    render(<PriceChart ticker="AAPL" range="30d" />)
    await waitFor(() =>
      expect(screen.getByText('Failed to load price data')).toBeInTheDocument()
    )
  })

  it('refetches when range prop changes', async () => {
    mockFetch({ ticker: 'AAPL', range: '7d', data: [] })
    const { rerender } = render(<PriceChart ticker="AAPL" range="7d" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    rerender(<PriceChart ticker="AAPL" range="30d" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(global.fetch).toHaveBeenLastCalledWith('/api/charts/AAPL/price?range=30d')
  })
})
