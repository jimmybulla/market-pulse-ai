import { proxyDelete } from '@/lib/proxy'

export async function DELETE(request: Request): Promise<Response> {
  const body = await request.json()
  return proxyDelete('/alerts/unsubscribe', body)
}
