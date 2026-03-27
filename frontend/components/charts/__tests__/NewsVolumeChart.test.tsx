import { render, screen, waitFor } from '@testing-library/react'
import NewsVolumeChart from '../NewsVolumeChart'

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
}))

const mockFetch = (payload: object, ok = true) => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    json: () => Promise.resolve(payload),
  } as Response)
}

describe('NewsVolumeChart', () => {
  afterEach(() => jest.restoreAllMocks())

  it('fetches news-volume data from the correct URL', async () => {
    mockFetch({ ticker: 'MSFT', range: '90d', data: [] })
    render(<NewsVolumeChart ticker="MSFT" range="90d" />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/charts/MSFT/news-volume?range=90d'
      )
    )
  })

  it('renders bar chart after data loads', async () => {
    mockFetch({
      ticker: 'MSFT',
      range: '90d',
      data: [{ date: '2026-03-27', count: 3 }],
    })
    render(<NewsVolumeChart ticker="MSFT" range="90d" />)
    await waitFor(() =>
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    )
  })

  it('shows error message when fetch returns non-ok', async () => {
    mockFetch({}, false)
    render(<NewsVolumeChart ticker="MSFT" range="90d" />)
    await waitFor(() =>
      expect(
        screen.getByText('Failed to load news volume data')
      ).toBeInTheDocument()
    )
  })

  it('refetches when range prop changes', async () => {
    mockFetch({ ticker: 'MSFT', range: '7d', data: [] })
    const { rerender } = render(<NewsVolumeChart ticker="MSFT" range="7d" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    rerender(<NewsVolumeChart ticker="MSFT" range="30d" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/charts/MSFT/news-volume?range=30d'
    )
  })
})
