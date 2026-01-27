import { NextRequest } from "next/server";

export interface PaginationParams {
    page: number;
    perPage: number;
    totalCount: number;
    extraParams?: Record<string, string>;
}

/**
 * Build RFC 5988 Link header value
 * @see https://datatracker.ietf.org/doc/html/rfc5988
 */
export const buildLinkHeader = (baseUrl: string, params: PaginationParams): string | null => {
    const { page, perPage, totalCount, extraParams } = params;
    const totalPages = Math.ceil(totalCount / perPage);

    if (totalPages <= 1) return null;

    const buildUrl = (targetPage: number): string => {
        const url = new URL(baseUrl);
        url.searchParams.set('page', targetPage.toString());
        url.searchParams.set('perPage', perPage.toString());
        if (extraParams) {
            for (const [key, value] of Object.entries(extraParams)) {
                url.searchParams.set(key, value);
            }
        }
        return url.toString();
    };

    const links: string[] = [];
    links.push(`<${buildUrl(1)}>; rel="first"`);
    if (page > 1) links.push(`<${buildUrl(page - 1)}>; rel="prev"`);
    if (page < totalPages) links.push(`<${buildUrl(page + 1)}>; rel="next"`);
    links.push(`<${buildUrl(totalPages)}>; rel="last"`);

    return links.join(', ');
};

/**
 * Extract base URL from request (without query params)
 */
export const getBaseUrl = (request: NextRequest): string => {
    const url = new URL(request.url);
    url.search = '';
    return url.toString();
};
