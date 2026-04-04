import { proxyGet } from '@/lib/proxy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
): Promise<Response> {
  const { ticker } = await params
  const { searchParams } = new URL(request.url)
  return proxyGet(`/stocks/${ticker.toUpperCase()}/news-volume?${searchParams}`, { cache: 'no-store' })
}
