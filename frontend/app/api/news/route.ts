import { proxyGet } from '@/lib/proxy'

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  return proxyGet(`/news?${searchParams}`, { cache: 'no-store' })
}
