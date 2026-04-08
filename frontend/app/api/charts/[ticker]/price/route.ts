import { proxyGet } from '@/lib/proxy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
): Promise<Response> {
  const { ticker } = await params
  const { searchParams } = new URL(request.url)
  const res = await proxyGet(
    `/stocks/${ticker.toUpperCase()}/price-history?${searchParams}`,
    { next: { revalidate: 3600 } }
  )
  const data = await res.json()
  return Response.json(data, {
    status: res.status,
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  })
}
