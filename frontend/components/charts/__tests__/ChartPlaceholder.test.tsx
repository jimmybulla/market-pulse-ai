import { render, screen } from '@testing-library/react'
import ChartPlaceholder from '../ChartPlaceholder'

describe('ChartPlaceholder', () => {
  it('renders the chart title', () => {
    render(<ChartPlaceholder title="Price Chart" />)
    expect(screen.getByText('Price Chart')).toBeInTheDocument()
  })

  it('renders the phase note', () => {
    render(<ChartPlaceholder title="Sentiment Trend" />)
    expect(screen.getByText('Live data in Phase 3')).toBeInTheDocument()
  })
})
