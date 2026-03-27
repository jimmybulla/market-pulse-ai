export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  try {
    const res = await fetch(
      `${process.env.BACKEND_URL}/stocks/${ticker.toUpperCase()}`,
      { cache: 'no-store' }
    )
    return Response.json(await res.json(), { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
