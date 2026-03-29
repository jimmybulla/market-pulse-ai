export async function GET() {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/news/feed`, {
      cache: 'no-store',
    })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
