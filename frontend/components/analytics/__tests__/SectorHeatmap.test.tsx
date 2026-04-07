import { render, screen } from '@testing-library/react'
import SectorHeatmap from '../SectorHeatmap'
import type { SectorHeatmapEntry } from '@/lib/types'

const noData: SectorHeatmapEntry[] = []

const withData: SectorHeatmapEntry[] = [
  { sector: 'Technology', signal_count: 5, bullish: 4, bearish: 1, crash_risk: 0 },
  { sector: 'Healthcare', signal_count: 2, bullish: 0, bearish: 2, crash_risk: 0 },
  { sector: 'Financials', signal_count: 1, bullish: 0, bearish: 1, crash_risk: 0 },
]

describe('SectorHeatmap', () => {
  it('renders all 11 GICS sectors regardless of data', () => {
    render(<SectorHeatmap data={noData} />)
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('Healthcare')).toBeInTheDocument()
    expect(screen.getByText('Energy')).toBeInTheDocument()
    expect(screen.getByText('Real Estate')).toBeInTheDocument()
  })

  it('shows signal count for sectors with data', () => {
    render(<SectorHeatmap data={withData} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows dash for sectors with no signals', () => {
    render(<SectorHeatmap data={withData} />)
    // Energy and other empty sectors should show —
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })
})
