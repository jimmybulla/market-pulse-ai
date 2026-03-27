export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const { searchParams } = new URL(request.url)
  const res = await fetch(
    `${process.env.BACKEND_URL}/stocks/${ticker}/sentiment-trend?${searchParams}`,
    { cache: 'no-store' }
  )
  return Response.json(await res.json(), { status: res.status })
}
