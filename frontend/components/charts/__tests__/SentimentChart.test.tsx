import { render, screen, waitFor } from '@testing-library/react'
import SentimentChart from '../SentimentChart'

jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: any }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: any }) => <div>{children}</div>,
  ReferenceLine: () => null,
  Cell: () => null,
}))

const mockFetch = (payload: object, ok = true) => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    json: () => Promise.resolve(payload),
  } as Response)
}

describe('SentimentChart', () => {
  afterEach(() => jest.restoreAllMocks())

  it('fetches sentiment data from the correct URL', async () => {
    mockFetch({ ticker: 'TSLA', range: '30d', data: [] })
    render(<SentimentChart ticker="TSLA" range="30d" />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/charts/TSLA/sentiment?range=30d'
      )
    )
  })

  it('renders bar chart after data loads', async () => {
    mockFetch({
      ticker: 'TSLA',
      range: '30d',
      data: [{ date: '2026-03-27', avg_sentiment: 0.4 }],
    })
    render(<SentimentChart ticker="TSLA" range="30d" />)
    await waitFor(() =>
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    )
  })

  it('shows error message when fetch returns non-ok', async () => {
    mockFetch({}, false)
    render(<SentimentChart ticker="TSLA" range="30d" />)
    await waitFor(() =>
      expect(
        screen.getByText('Failed to load sentiment data')
      ).toBeInTheDocument()
    )
  })

  it('refetches when range prop changes', async () => {
    mockFetch({ ticker: 'TSLA', range: '7d', data: [] })
    const { rerender } = render(<SentimentChart ticker="TSLA" range="7d" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    rerender(<SentimentChart ticker="TSLA" range="90d" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/charts/TSLA/sentiment?range=90d'
    )
  })
})
