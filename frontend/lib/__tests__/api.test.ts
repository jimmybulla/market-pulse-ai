// frontend/lib/__tests__/api.test.ts
import { getSignals, getStock, getNews } from '../api'

const mockSignalsResponse = {
  data: [{ id: '1', ticker: 'AAPL', direction: 'bullish', rank: 1 }],
  total: 1, limit: 10, offset: 0,
}

const mockStockResponse = {
  id: '1', ticker: 'NVDA', name: 'NVIDIA Corporation',
  sector: 'Technology', market_cap: 2800000000000, last_price: 875.5,
  updated_at: '2026-03-27T00:00:00Z', latest_signal: null,
}

const mockNewsResponse = {
  data: [{ id: '1', headline: 'NVDA earnings beat', tickers: ['NVDA'] }],
  total: 1, limit: 10, offset: 0,
}

beforeEach(() => {
  process.env.BACKEND_URL = 'http://localhost:8000'
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('getSignals', () => {
  it('fetches signals with no params', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSignalsResponse,
    })

    const result = await getSignals()

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/signals',
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('fetches signals with direction filter', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSignalsResponse,
    })

    await getSignals({ direction: 'bullish', limit: 5 })

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('direction=bullish')
    expect(calledUrl).toContain('limit=5')
  })

  it('throws on non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    await expect(getSignals()).rejects.toThrow('Failed to fetch signals')
  })
})

describe('getStock', () => {
  it('fetches a single stock by ticker', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStockResponse,
    })

    const result = await getStock('nvda')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/stocks/NVDA',
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(result.ticker).toBe('NVDA')
  })

  it('throws on 404', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    })

    await expect(getStock('FAKE')).rejects.toThrow('Failed to fetch stock')
  })
})

describe('getNews', () => {
  it('fetches news with ticker filter', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNewsResponse,
    })

    await getNews({ ticker: 'NVDA' })

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('ticker=NVDA')
  })
})
