export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params
  try {
    const res = await fetch(
      `${process.env.BACKEND_URL}/signals/history/${ticker}`,
      { cache: 'no-store' },
    )
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
