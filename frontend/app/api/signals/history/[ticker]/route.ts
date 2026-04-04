import { proxyGet } from '@/lib/proxy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
): Promise<Response> {
  const { ticker } = await params
  return proxyGet(`/signals/history/${ticker}`, { cache: 'no-store' })
}
