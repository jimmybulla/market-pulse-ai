import { render, screen, fireEvent } from '@testing-library/react'
import StocksTable from '../StocksTable'
import type { StockResponse } from '@/lib/types'

const makeStock = (overrides: Partial<StockResponse> = {}): StockResponse => ({
  id: 'stock-1',
  ticker: 'AAPL',
  name: 'Apple Inc.',
  sector: 'Technology',
  market_cap: 3000000000000,
  last_price: 175.00,
  updated_at: '2026-03-29T00:00:00Z',
  ...overrides,
})

describe('StocksTable', () => {
  it('renders all stocks when no filters active', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'AAPL', name: 'Apple Inc.' }),
      makeStock({ id: 'stock-2', ticker: 'MSFT', name: 'Microsoft Corp.' }),
    ]
    render(<StocksTable stocks={stocks} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
  })

  it('search by ticker hides non-matching rows', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'AAPL', name: 'Apple Inc.' }),
      makeStock({ id: 'stock-2', ticker: 'MSFT', name: 'Microsoft Corp.' }),
    ]
    render(<StocksTable stocks={stocks} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'AAPL' } })
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
  })

  it('search by name hides non-matching rows', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'AAPL', name: 'Apple Inc.' }),
      makeStock({ id: 'stock-2', ticker: 'MSFT', name: 'Microsoft Corp.' }),
    ]
    render(<StocksTable stocks={stocks} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Apple' } })
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
  })

  it('sector filter hides non-matching rows', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'AAPL', sector: 'Technology' }),
      makeStock({ id: 'stock-2', ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' }),
    ]
    render(<StocksTable stocks={stocks} />)
    fireEvent.change(screen.getByLabelText('Sector'), { target: { value: 'Technology' } })
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.queryByText('JPM')).not.toBeInTheDocument()
  })

  it('clicking ticker column header sorts ascending by default then descending on second click', () => {
    const stocks = [
      makeStock({ id: 'stock-1', ticker: 'MSFT', name: 'Microsoft Corp.' }),
      makeStock({ id: 'stock-2', ticker: 'AAPL', name: 'Apple Inc.' }),
    ]
    render(<StocksTable stocks={stocks} />)
    // Default sort is asc by ticker — AAPL < MSFT
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('AAPL')
    expect(rows[2]).toHaveTextContent('MSFT')
    // Click ticker header to toggle to desc
    fireEvent.click(screen.getByRole('columnheader', { name: /Ticker/ }))
    const rowsDesc = screen.getAllByRole('row')
    expect(rowsDesc[1]).toHaveTextContent('MSFT')
    expect(rowsDesc[2]).toHaveTextContent('AAPL')
  })

  it('each row ticker is a link to /stock/[ticker]', () => {
    render(<StocksTable stocks={[makeStock({ ticker: 'AAPL' })]} />)
    const link = screen.getByRole('link', { name: 'AAPL' })
    expect(link).toHaveAttribute('href', '/stock/AAPL')
  })

  it('shows empty state when no stocks match filters', () => {
    render(<StocksTable stocks={[makeStock({ ticker: 'AAPL', name: 'Apple Inc.' })]} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ZZZZ' } })
    expect(screen.getByText('No stocks found')).toBeInTheDocument()
  })

  it('renders empty state when stocks prop is empty', () => {
    render(<StocksTable stocks={[]} />)
    expect(screen.getByText('No stocks found')).toBeInTheDocument()
  })
})
