import { ZOEKT_WEBSERVER_URL } from '@/lib/environment';
import { createPathWithQueryParams } from '@/lib/utils';
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    // @todo: proper error handling
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const numResults = searchParams.get('numResults');

    const url = createPathWithQueryParams(
        `${ZOEKT_WEBSERVER_URL}/search`,
        ["q", query],
        ["num", numResults],
        ["format", "json"],
    );
    const res = await fetch(url);
    const data = await res.json();

    return Response.json({ ...data })
}