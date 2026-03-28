export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const res = await fetch(`${process.env.BACKEND_URL}/alerts/unsubscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    return Response.json(await res.json(), { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
