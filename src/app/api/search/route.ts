import { createPathWithQueryParams } from '@/lib/utils';
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    // @todo: proper error handling
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const numResults = searchParams.get('numResults');

    const url = createPathWithQueryParams(
        "http://localhost:6070/search",
        ["q", query],
        ["num", numResults],
        ["format", "json"],
    );
    console.log(url);
    const res = await fetch(url);
    const data = await res.json();
     
    return Response.json({ data })
}