'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { subscribeToPush, unsubscribeFromPush } from '@/lib/push'

type State = 'unsupported' | 'unsubscribed' | 'subscribed'

export default function PushNotificationToggle() {
  const [state, setState] = useState<State>('unsupported')

  useEffect(() => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported')
      return
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? 'subscribed' : 'unsubscribed')
      })
    })
  }, [])

  async function handleClick() {
    if (state === 'unsupported') return

    if (state === 'unsubscribed') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      try {
        const sub = await subscribeToPush()
        const { endpoint, keys } = sub.toJSON() as {
          endpoint: string
          keys: { p256dh: string; auth: string }
        }
        await fetch('/api/alerts/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, keys }),
        })
        setState('subscribed')
      } catch {
        // silent — user may retry
      }
    } else {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/alerts/unsubscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await unsubscribeFromPush()
        }
        setState('unsubscribed')
      } catch {
        // silent
      }
    }
  }

  if (state === 'unsupported') {
    return (
      <button
        disabled
        className="p-2 text-gray-600 cursor-not-allowed"
        title="Push notifications not supported"
      >
        <BellOff className="w-4 h-4" />
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-md transition-colors ${
        state === 'subscribed'
          ? 'text-brand-cyan hover:text-brand-cyan/80'
          : 'text-gray-500 hover:text-gray-300'
      }`}
      title={state === 'subscribed' ? 'Disable push alerts' : 'Enable push alerts'}
    >
      {state === 'subscribed' ? (
        <Bell className="w-4 h-4" />
      ) : (
        <BellOff className="w-4 h-4" />
      )}
    </button>
  )
}
