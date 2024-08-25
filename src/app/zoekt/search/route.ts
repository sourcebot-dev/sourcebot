import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const numResults = searchParams.get('numResults');

    const res = await fetch(`http://localhost:6070/search?q=${query}&num=${numResults}&format=json`);
    const data = await res.json();
     
    return Response.json({ data })
}