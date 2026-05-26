/**
 * Sanitizes an MCP server name into a lowercase alphanumeric string suitable
 * for use as a tool-name prefix (e.g. "My Server!" → "my_server_").
 *
 * This is used to namespace MCP tools (mcp_{sanitizedName}__{toolName}) and
 * to key favicon maps. Must be kept consistent everywhere — collisions on
 * this value are prevented at server-creation time.
 */
export function sanitizeMcpServerName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function createMcpProductIconDataUri(svg: string): string {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const confluenceIconSvg = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 12C0 5.37258 5.37258 0 12 0H36C42.6274 0 48 5.37258 48 12V36C48 42.6274 42.6274 48 36 48H12C5.37258 48 0 42.6274 0 36V12Z" fill="#1868DB"/>
<g clip-path="url(#clip0_1_6000)">
<path d="M34.7396 28.5301C27.3329 24.9487 25.1691 24.4136 22.0484 24.4136C18.3866 24.4136 15.2658 25.9367 12.4779 30.2179L12.0202 30.9177C11.6457 31.494 11.5625 31.6998 11.5625 31.9468C11.5625 32.1938 11.6873 32.3996 12.145 32.6878L16.847 35.6105C17.0967 35.7752 17.3048 35.8575 17.5128 35.8575C17.7625 35.8575 17.9289 35.734 18.1786 35.3635L18.9276 34.2109C20.0927 32.4408 21.1329 31.8645 22.4645 31.8645C23.6296 31.8645 25.0027 32.1938 26.7087 33.0171L31.6188 35.3224C32.1181 35.5693 32.659 35.4458 32.9087 34.8695L35.2389 29.765C35.4886 29.1887 35.3221 28.8182 34.7396 28.5301ZM13.1437 19.5149C20.5504 23.0963 22.7141 23.6314 25.8349 23.6314C29.4966 23.6314 32.6174 22.1083 35.4053 17.8271L35.8631 17.1273C36.2376 16.551 36.3208 16.3452 36.3208 16.0982C36.3208 15.8512 36.1959 15.6454 35.7382 15.3572L31.0362 12.4345C30.7866 12.2698 30.5785 12.1875 30.3705 12.1875C30.1208 12.1875 29.9544 12.311 29.7047 12.6815L28.9557 13.8341C27.7906 15.6042 26.7504 16.1805 25.4188 16.1805C24.2537 16.1805 22.8806 15.8512 21.1745 15.0279L16.2645 12.7226C15.7652 12.4757 15.2242 12.5992 14.9746 13.1755L12.6444 18.28C12.3947 18.8563 12.5612 19.2268 13.1437 19.5149Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1_6000">
<rect width="24.7583" height="23.67" fill="white" transform="translate(11.5625 12.1875)"/>
</clipPath>
</defs>
</svg>`;

const jiraIconSvg = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 12C0 5.37258 5.37258 0 12 0H36C42.6274 0 48 5.37258 48 12V36C48 42.6274 42.6274 48 36 48H12C5.37258 48 0 42.6274 0 36V12Z" fill="#1868DB"/>
<g clip-path="url(#clip0_1_5403)">
<path d="M17.9475 31.0469H15.2429C11.1638 31.0469 8.23755 28.5484 8.23755 24.8899H22.7804C23.5341 24.8899 24.0218 25.4252 24.0218 26.1837V40.8178C20.3861 40.8178 17.9475 37.8731 17.9475 33.7684V31.0469ZM25.1303 23.7745H22.4257C18.3466 23.7745 15.4203 21.3206 15.4203 17.6621H29.9631C30.7168 17.6621 31.2489 18.1528 31.2489 18.9113V33.5454C27.6132 33.5454 25.1303 30.6007 25.1303 26.496V23.7745ZM32.3573 16.5467H29.6527C25.5736 16.5467 22.6473 14.0482 22.6473 10.3896H37.1902C37.9439 10.3896 38.4316 10.925 38.4316 11.6389V26.273C34.7959 26.273 32.3573 23.3283 32.3573 19.2236V16.5467Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1_5403">
<rect width="30.1941" height="30.4281" fill="white" transform="translate(8.23755 10.3901)"/>
</clipPath>
</defs>
</svg>`;

const knownMcpFaviconUrlsBySanitizedName: Record<string, string> = {
    confluence: createMcpProductIconDataUri(confluenceIconSvg),
    jira: createMcpProductIconDataUri(jiraIconSvg),
};

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
