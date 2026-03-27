import { render, screen, fireEvent } from '@testing-library/react'
import ChartsSection from '../ChartsSection'

jest.mock('../RangeSelector', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (r: string) => void }) => (
    <div
      data-testid="range-selector"
      data-value={value}
      onClick={() => onChange('7d')}
    />
  ),
}))
jest.mock('../PriceChart', () => ({
  __esModule: true,
  default: ({ ticker, range }: { ticker: string; range: string }) => (
    <div data-testid="price-chart" data-ticker={ticker} data-range={range} />
  ),
}))
jest.mock('../SentimentChart', () => ({
  __esModule: true,
  default: ({ ticker, range }: { ticker: string; range: string }) => (
    <div data-testid="sentiment-chart" data-ticker={ticker} data-range={range} />
  ),
}))
jest.mock('../NewsVolumeChart', () => ({
  __esModule: true,
  default: ({ ticker, range }: { ticker: string; range: string }) => (
    <div data-testid="news-volume-chart" data-ticker={ticker} data-range={range} />
  ),
}))

describe('ChartsSection', () => {
  it('renders RangeSelector and all three charts', () => {
    render(<ChartsSection ticker="AAPL" />)
    expect(screen.getByTestId('range-selector')).toBeInTheDocument()
    expect(screen.getByTestId('price-chart')).toBeInTheDocument()
    expect(screen.getByTestId('sentiment-chart')).toBeInTheDocument()
    expect(screen.getByTestId('news-volume-chart')).toBeInTheDocument()
  })

  it('passes ticker to all three charts', () => {
    render(<ChartsSection ticker="NVDA" />)
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-ticker', 'NVDA')
    expect(screen.getByTestId('sentiment-chart')).toHaveAttribute('data-ticker', 'NVDA')
    expect(screen.getByTestId('news-volume-chart')).toHaveAttribute('data-ticker', 'NVDA')
  })

  it('defaults to 30d range for all charts', () => {
    render(<ChartsSection ticker="AAPL" />)
    expect(screen.getByTestId('range-selector')).toHaveAttribute('data-value', '30d')
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-range', '30d')
    expect(screen.getByTestId('sentiment-chart')).toHaveAttribute('data-range', '30d')
    expect(screen.getByTestId('news-volume-chart')).toHaveAttribute('data-range', '30d')
  })

  it('updates all charts when range changes', () => {
    render(<ChartsSection ticker="AAPL" />)
    fireEvent.click(screen.getByTestId('range-selector'))
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-range', '7d')
    expect(screen.getByTestId('sentiment-chart')).toHaveAttribute('data-range', '7d')
    expect(screen.getByTestId('news-volume-chart')).toHaveAttribute('data-range', '7d')
  })
})
