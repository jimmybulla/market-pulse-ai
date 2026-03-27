export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const res = await fetch(
    `${process.env.BACKEND_URL}/stocks?${searchParams}`,
    { cache: 'no-store' }
  )
  return Response.json(await res.json(), { status: res.status })
}
