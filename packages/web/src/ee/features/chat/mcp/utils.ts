/**
 * Sanitizes an MCP server name into a lowercase alphanumeric string suitable
 * for use as a tool-name prefix (e.g. "My Server!" → "my_server_").
 *
 * This is used to namespace MCP tools (mcp_{sanitizedName}__{toolName}) and
 * to key favicon maps. Must be kept consistent everywhere — collisions on
 * this value are prevented at server-creation time.
 */
// @techdebt : duplicated in ee and non-ee
export function sanitizeMcpServerName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// @techdebt : duplicated in ee and non-ee
export function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return count === 1 ? singular : plural;
}

const standardNumberFormatter = new Intl.NumberFormat();
const compactNumberFormatter = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
});

// @techdebt : duplicated in ee and non-ee
export function formatCount(count: number) {
    if (count >= 10_000) {
        return compactNumberFormatter.format(count);
    }
    return standardNumberFormatter.format(count);
}

// @techdebt : duplicated in ee and non-ee
export function formatUsageSharePercent(percent: number) {
    if (percent <= 0) {
        return "0%";
    }
    if (percent < 1) {
        return "<1%";
    }
    if (percent < 10) {
        return `${percent.toFixed(1).replace(/\.0$/, "")}%`;
    }
    return `${Math.round(percent)}%`;
}

function createMcpIconDataUri(svg: string): string {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const atlassianIconSvg = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_459_65346)">
<g clip-path="url(#clip1_459_65346)">
<path d="M41.3175 36.5672L25.4402 4.81262C25.1276 4.12502 24.8151 4 24.44 4C24.1275 4 23.7524 4.12502 23.3774 4.75011C21.127 8.31312 20.1269 12.4387 20.1269 16.7518C20.1269 22.7527 23.1898 28.3785 27.6905 37.4423C28.1906 38.4425 28.5656 38.63 29.4407 38.63H40.4423C41.2549 38.63 41.6925 38.3175 41.6925 37.6924C41.6925 37.3798 41.63 37.1923 41.3175 36.5672ZM18.2516 21.565C17.0014 19.6898 16.6264 19.5647 16.3138 19.5647C16.0013 19.5647 15.8138 19.6898 15.2512 20.8149L7.31255 36.6922C7.06251 37.1923 7 37.3798 7 37.6299C7 38.1299 7.43756 38.63 8.3752 38.63H19.5643C20.3144 38.63 20.877 38.0049 21.1895 36.8172C21.5646 35.317 21.6896 34.0043 21.6896 32.4416C21.6896 28.066 19.7518 23.8154 18.2516 21.565Z" fill="#1868DB"/>
</g>
</g>
<defs>
<clipPath id="clip0_459_65346">
<rect width="48" height="48" fill="white"/>
</clipPath>
<clipPath id="clip1_459_65346">
<rect width="34.6925" height="34.63" fill="white" transform="translate(7 4)"/>
</clipPath>
</defs>
</svg>`;

const githubIconSvg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="16" cy="16" r="16" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M16 0C7.16 0 0 7.16 0 16C0 23.08 4.58 29.06 10.94 31.18C11.74 31.32 12.04 30.84 12.04 30.42C12.04 30.04 12.02 28.78 12.02 27.44C8 28.18 6.96 26.46 6.64 25.56C6.46 25.1 5.68 23.68 5 23.3C4.44 23 3.64 22.26 4.98 22.24C6.24 22.22 7.14 23.4 7.44 23.88C8.88 26.3 11.18 25.62 12.1 25.2C12.24 24.16 12.66 23.46 13.12 23.06C9.56 22.66 5.84 21.28 5.84 15.16C5.84 13.42 6.46 11.98 7.48 10.86C7.32 10.46 6.76 8.82 7.64 6.62C7.64 6.62 8.98 6.2 12.04 8.26C13.32 7.9 14.68 7.72 16.04 7.72C17.4 7.72 18.76 7.9 20.04 8.26C23.1 6.18 24.44 6.62 24.44 6.62C25.32 8.82 24.76 10.46 24.6 10.86C25.62 11.98 26.24 13.4 26.24 15.16C26.24 21.3 22.5 22.66 18.94 23.06C19.52 23.56 20.02 24.52 20.02 26.02C20.02 28.16 20 29.88 20 30.42C20 30.84 20.3 31.34 21.1 31.18C27.42 29.06 32 23.06 32 16C32 7.16 24.84 0 16 0V0Z" fill="#24292E"/>
</svg>`;

const knownMcpFaviconUrlsBySanitizedName: Record<string, string> = {
    atlassian: createMcpIconDataUri(atlassianIconSvg),
    better_stack: "https://betterstack.com/favicon.ico",
    github: createMcpIconDataUri(githubIconSvg),
    notion: "https://www.notion.com/front-static/favicon.ico",
};

// @techdebt : duplicated in ee and non-ee
export function getMcpFaviconUrl(serverUrl: string, serverName?: string): string | undefined {
    if (serverName) {
        const knownFaviconUrl = knownMcpFaviconUrlsBySanitizedName[sanitizeMcpServerName(serverName)];
        if (knownFaviconUrl) {
            return knownFaviconUrl;
        }
    }

    try {
        const origin = new URL(serverUrl).origin;
        return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
    } catch {
        return undefined;
    }
}
