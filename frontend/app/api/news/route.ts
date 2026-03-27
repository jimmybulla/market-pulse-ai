export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const res = await fetch(
    `${process.env.BACKEND_URL}/news?${searchParams}`,
    { cache: 'no-store' }
  )
  return Response.json(await res.json(), { status: res.status })
}
