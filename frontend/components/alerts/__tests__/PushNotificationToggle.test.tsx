import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PushNotificationToggle from '../PushNotificationToggle'

jest.mock('@/lib/push', () => ({
  subscribeToPush: jest.fn(),
  unsubscribeFromPush: jest.fn().mockResolvedValue(undefined),
}))

const mockFetch = (payload: object, ok = true) => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    json: () => Promise.resolve(payload),
  } as Response)
}

function setupPushManager(subscription: object | null = null) {
  const mockGetSubscription = jest.fn().mockResolvedValue(subscription)
  const mockReg = { pushManager: { getSubscription: mockGetSubscription } }
  ;(global as any).PushManager = class {}
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(mockReg) },
    writable: true,
    configurable: true,
  })
  return { mockGetSubscription, mockReg }
}

afterEach(() => {
  jest.restoreAllMocks()
  delete (global as any).PushManager
})

describe('PushNotificationToggle', () => {
  it('renders as disabled when PushManager is not available', () => {
    // PushManager not defined = unsupported
    render(<PushNotificationToggle />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })

  it('renders as unsubscribed when PushManager exists but no subscription', async () => {
    setupPushManager(null)
    render(<PushNotificationToggle />)
    await waitFor(() => {
      const btn = screen.getByRole('button')
      expect(btn).not.toBeDisabled()
      expect(btn).toHaveAttribute('title', 'Enable push alerts')
    })
  })

  it('renders as subscribed when subscription exists', async () => {
    setupPushManager({ endpoint: 'https://fcm.example.com/sub' })
    render(<PushNotificationToggle />)
    await waitFor(() => {
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('title', 'Disable push alerts')
    })
  })

  it('subscribes and posts to API when clicked in unsubscribed state', async () => {
    const { subscribeToPush } = require('@/lib/push')
    const mockSub = {
      endpoint: 'https://fcm.example.com/new',
      toJSON: () => ({
        endpoint: 'https://fcm.example.com/new',
        keys: { p256dh: 'pkey', auth: 'akey' },
      }),
    }
    ;(subscribeToPush as jest.Mock).mockResolvedValue(mockSub)
    setupPushManager(null)
    mockFetch({ status: 'subscribed' })
    ;(global as any).Notification = {
      requestPermission: jest.fn().mockResolvedValue('granted'),
    }

    render(<PushNotificationToggle />)
    await waitFor(() => expect(screen.getByTitle('Enable push alerts')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(subscribeToPush).toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/alerts/subscribe',
        expect.objectContaining({ method: 'POST' })
      )
    })
    await waitFor(() =>
      expect(screen.getByTitle('Disable push alerts')).toBeInTheDocument()
    )
  })

  it('unsubscribes and sends DELETE when clicked in subscribed state', async () => {
    const { unsubscribeFromPush } = require('@/lib/push')
    const mockSub = { endpoint: 'https://fcm.example.com/sub' }
    setupPushManager(mockSub)
    mockFetch({ status: 'unsubscribed' })

    render(<PushNotificationToggle />)
    await waitFor(() => expect(screen.getByTitle('Disable push alerts')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/alerts/unsubscribe',
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(unsubscribeFromPush).toHaveBeenCalled()
    })
    await waitFor(() =>
      expect(screen.getByTitle('Enable push alerts')).toBeInTheDocument()
    )
  })
})
