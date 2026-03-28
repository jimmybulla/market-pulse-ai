export async function GET() {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/analytics/backtesting`, {
      next: { revalidate: 300 },
    })
    return Response.json(await res.json(), { status: res.status })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 })
  }
}
