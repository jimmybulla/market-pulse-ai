// frontend/lib/__tests__/push.test.ts
import { urlBase64ToUint8Array } from '../push'

describe('urlBase64ToUint8Array', () => {
  it('converts a base64url string to a Uint8Array', () => {
    // "hello" in base64url is "aGVsbG8"
    const result = urlBase64ToUint8Array('aGVsbG8')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
    // atob('aGVsbG8=') === 'hello', charCodes: 104, 101, 108, 108, 111
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111])
  })

  it('handles standard base64url with - and _ characters', () => {
    // base64url uses - instead of + and _ instead of /
    const base64url = 'YWJj'   // 'abc' in standard base64
    const result = urlBase64ToUint8Array(base64url)
    expect(Array.from(result)).toEqual([97, 98, 99])
  })
})

describe('subscribeToPush', () => {
  it('calls pushManager.subscribe with userVisibleOnly:true and the VAPID key', async () => {
    const mockSubscription = { endpoint: 'https://fcm.example.com/sub' }
    const mockSubscribeFn = jest.fn().mockResolvedValue(mockSubscription)
    const mockReg = { pushManager: { subscribe: mockSubscribeFn } }
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      writable: true,
      configurable: true,
    })
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'dGVzdA'  // base64url for 'test'

    const { subscribeToPush } = await import('../push')
    const result = await subscribeToPush()

    expect(mockSubscribeFn).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    })
    expect(result).toBe(mockSubscription)
  })
})

describe('unsubscribeFromPush', () => {
  it('calls sub.unsubscribe() when a subscription exists', async () => {
    const mockUnsubscribe = jest.fn().mockResolvedValue(true)
    const mockSub = { unsubscribe: mockUnsubscribe }
    const mockReg = {
      pushManager: { getSubscription: jest.fn().mockResolvedValue(mockSub) },
    }
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      writable: true,
      configurable: true,
    })

    const { unsubscribeFromPush } = await import('../push')
    await unsubscribeFromPush()

    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('does nothing when no subscription exists', async () => {
    const mockReg = {
      pushManager: { getSubscription: jest.fn().mockResolvedValue(null) },
    }
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockReg) },
      writable: true,
      configurable: true,
    })

    const { unsubscribeFromPush } = await import('../push')
    await expect(unsubscribeFromPush()).resolves.toBeUndefined()
  })
})
