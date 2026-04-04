import { proxyPost } from '@/lib/proxy'

export async function POST(request: Request): Promise<Response> {
  const body = await request.json()
  return proxyPost('/alerts/subscribe', body)
}
