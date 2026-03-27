# Phase 5: Browser Push Alert System Design
**Date:** 2026-03-27
**Scope:** Browser push notifications for high-confidence signals and crash risk spikes
**Approach:** Web Push API + VAPID + pywebpush, triggered post-pipeline, subscriptions stored in Supabase

---

## Decisions & Constraints

- **Delivery:** Browser push notifications only (no email, no in-app panel for MVP)
- **Triggers:** Two only — high confidence signal (confidence ≥ 0.8) and crash risk spike (crash_risk_score ≥ 0.8)
- **Timing:** Post-pipeline — alerts fire after each 30-minute pipeline run
- **Deduplication:** 31-minute query window naturally prevents re-sending old signals; no separate "sent" flag
- **VAPID auth:** Keys generated once, stored in env vars; public key exposed to frontend via `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- **No user accounts:** Subscriptions are anonymous; stored by endpoint URL only
- **Precedence rule:** If a signal fires both triggers, only the crash risk notification is sent

---

## 1. New Files

```
backend/app/
├── routers/
│   └── alerts.py             ← POST /alerts/subscribe, DELETE /alerts/unsubscribe
└── services/
    └── push.py               ← VAPID push sending via pywebpush

frontend/
├── public/
│   └── sw.js                 ← service worker: push event handler + notificationclick
├── lib/
│   └── push.ts               ← subscribe/unsubscribe helpers (PushManager)
└── components/
    └── alerts/
        └── PushNotificationToggle.tsx  ← bell icon button (3 states)
└── app/
    └── api/
        └── alerts/
            ├── subscribe/route.ts      ← proxy → POST /alerts/subscribe
            └── unsubscribe/route.ts    ← proxy → DELETE /alerts/unsubscribe
```

**Modified files:**
- `backend/app/services/pipeline.py` — call `check_and_push_alerts(db)` at end of pipeline run
- `backend/app/main.py` — register `alerts` router
- `frontend/app/layout.tsx` — register service worker on mount
- `frontend/components/layout/TopBar.tsx` — add `PushNotificationToggle` to right side

---

## 2. Database

New table: **`push_subscriptions`**

```sql
CREATE TABLE push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

No foreign key to users (app has no auth). Subscriptions are anonymous.

---

## 3. Environment Variables

```
# Backend (.env)
VAPID_PRIVATE_KEY=<base64url>
VAPID_PUBLIC_KEY=<base64url>
VAPID_CONTACT_EMAIL=mailto:you@example.com

# Frontend (.env.local)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same base64url as VAPID_PUBLIC_KEY>
```

Generate keys once with:
```python
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print(v.private_pem().decode())
print(v.public_key.public_bytes(...))
```
Or use the `web-push` npm CLI: `npx web-push generate-vapid-keys`.

---

## 4. Backend

### `POST /alerts/subscribe`

Request body:
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "<base64url>",
    "auth": "<base64url>"
  }
}
```

- Upserts into `push_subscriptions` (conflict on `endpoint` → do nothing)
- Returns `{"status": "subscribed"}`

### `DELETE /alerts/unsubscribe`

Request body: `{ "endpoint": "..." }`

- Deletes row matching `endpoint`
- Returns `{"status": "unsubscribed"}`

### `services/push.py` — `send_push_notification`

```python
def send_push_notification(subscription: dict, title: str, body: str, url: str) -> None:
    """Send a single Web Push notification via VAPID."""
```

- Wraps `pywebpush.webpush()`
- On `WebPushException` with status 410 (Gone) or 404 → subscription is stale, delete it from DB
- Silently logs other errors (don't crash the pipeline)

### `services/pipeline.py` — `check_and_push_alerts`

Called at the end of each pipeline run:

```python
def check_and_push_alerts(db: Client) -> None:
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=31)).isoformat()

    # Query new signals
    rows = (
        db.table("signals")
          .select("ticker, direction, confidence, crash_risk_score, expected_move_low, expected_move_high, horizon_days")
          .gte("created_at", cutoff)
          .execute()
          .data or []
    )

    # Load subscriptions
    subs = db.table("push_subscriptions").select("*").execute().data or []
    if not subs:
        return

    for row in rows:
        crash_risk = row["crash_risk_score"] >= 0.8
        high_conf = row["confidence"] >= 0.8

        if crash_risk:
            title = f"⚠ {row['ticker']} Crash Risk"
            body = f"Risk score: {row['crash_risk_score']:.2f} · Take caution"
            url = f"/stock/{row['ticker']}"
        elif high_conf:
            direction = row["direction"].capitalize()
            pct = f"+{row['expected_move_low']*100:.0f}%–{row['expected_move_high']*100:.0f}%"
            title = f"{row['ticker']} → {direction} ({row['confidence']*100:.0f}%)"
            body = f"Expected {pct} · {row['horizon_days']} days"
            url = f"/stock/{row['ticker']}"
        else:
            continue

        for sub in subs:
            subscription = {"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}}
            send_push_notification(subscription, title, body, url)
```

---

## 5. Frontend

### `public/sw.js` — Service Worker

```javascript
self.addEventListener('push', (event) => {
  const { title, body, url } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

### `lib/push.ts` — Helpers

```typescript
export function urlBase64ToUint8Array(base64String: string): Uint8Array { ... }

export async function subscribeToPush(): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  })
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) await sub.unsubscribe()
}
```

### `PushNotificationToggle` — Three States

| State | Condition | Visual | Click action |
|-------|-----------|--------|--------------|
| `unsupported` | `!('PushManager' in window)` | Muted bell, disabled | None |
| `unsubscribed` | No active subscription | Bell with slash | Request permission → subscribe → POST |
| `subscribed` | Active subscription | Solid bell (brand-cyan) | Unsubscribe → DELETE |

Component initialises state in `useEffect` by calling `reg.pushManager.getSubscription()`.

### `layout.tsx` — Service Worker Registration

```typescript
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
  }
}, [])
```

This `useEffect` runs in a client component wrapper (e.g. a `<Providers>` component already wrapping layout, or a new `<ServiceWorkerRegistrar />`).

---

## 6. Error Handling

| Scenario | Handling |
|----------|----------|
| Browser doesn't support Push API | `PushNotificationToggle` renders as `unsupported` (disabled) |
| User denies permission | Bell stays `unsubscribed`; no error shown |
| Subscription endpoint gone (410/404) | `send_push_notification` deletes stale sub from DB |
| pywebpush send failure | Log error; continue to next subscription; don't crash pipeline |
| `/alerts/subscribe` backend down | Frontend shows no error (best-effort); notifications simply won't arrive |

---

## 7. Out of Scope (Future)

- Per-ticker alert subscriptions (subscribe only to TSLA alerts)
- Alert history / in-app panel
- Email alerts
- Custom confidence thresholds per user
- "Signal change" and "major news" triggers
- Alert snooze / quiet hours
