const rawBackend = process.env.BACKEND_URL || 'http://localhost:8000'
const BACKEND = rawBackend.startsWith('http') ? rawBackend : `https://${rawBackend}`

export async function proxyGet(path: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${BACKEND}${path}`, init)
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'Backend unavailable' }, { status: 502 })
  }
}

export async function proxyPost(path: string, body: unknown): Promise<Response> {
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'Backend unavailable' }, { status: 502 })
  }
}

export async function proxyDelete(path: string, body: unknown): Promise<Response> {
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'Backend unavailable' }, { status: 502 })
  }
}
