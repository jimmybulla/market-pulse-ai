import { proxyGet } from '@/lib/proxy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
): Promise<Response> {
  const { ticker } = await params
  return proxyGet(`/stocks/${ticker.toUpperCase()}`, { cache: 'no-store' })
}
