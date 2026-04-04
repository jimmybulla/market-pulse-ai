import { proxyGet } from '@/lib/proxy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  return proxyGet(`/signals/${id}`, { cache: 'no-store' })
}
