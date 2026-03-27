import { render, screen, fireEvent } from '@testing-library/react'
import RangeSelector from '../RangeSelector'

describe('RangeSelector', () => {
  it('renders 7D, 30D, and 90D buttons', () => {
    render(<RangeSelector value="30d" onChange={jest.fn()} />)
    expect(screen.getByText('7D')).toBeInTheDocument()
    expect(screen.getByText('30D')).toBeInTheDocument()
    expect(screen.getByText('90D')).toBeInTheDocument()
  })

  it('calls onChange with the clicked range value', () => {
    const onChange = jest.fn()
    render(<RangeSelector value="30d" onChange={onChange} />)
    fireEvent.click(screen.getByText('7D'))
    expect(onChange).toHaveBeenCalledWith('7d')
    fireEvent.click(screen.getByText('90D'))
    expect(onChange).toHaveBeenCalledWith('90d')
  })

  it('applies brand-cyan class to the active range button', () => {
    render(<RangeSelector value="30d" onChange={jest.fn()} />)
    const activeBtn = screen.getByText('30D')
    expect(activeBtn.className).toContain('bg-brand-cyan')
  })

  it('does not apply brand-cyan to inactive buttons', () => {
    render(<RangeSelector value="30d" onChange={jest.fn()} />)
    const inactiveBtn = screen.getByText('7D')
    expect(inactiveBtn.className).not.toContain('bg-brand-cyan')
  })
})
