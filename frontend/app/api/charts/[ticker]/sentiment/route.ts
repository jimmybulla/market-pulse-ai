export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const { searchParams } = new URL(request.url)
  try {
    const res = await fetch(
      `${process.env.BACKEND_URL}/stocks/${ticker.toUpperCase()}/sentiment-trend?${searchParams}`,
      { cache: 'no-store' }
    )
    return Response.json(await res.json(), { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
