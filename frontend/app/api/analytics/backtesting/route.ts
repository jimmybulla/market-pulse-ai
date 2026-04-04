import { proxyGet } from '@/lib/proxy'

export async function GET(): Promise<Response> {
  return proxyGet('/analytics/backtesting', { next: { revalidate: 300 } } as RequestInit)
}
