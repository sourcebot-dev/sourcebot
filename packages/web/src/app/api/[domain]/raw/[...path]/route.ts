import { getRawFileSource } from "@/features/git/getRawFileSourceApi";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

// Simple MIME type mapping for common file extensions
const getContentType = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "png":
            return "image/png";
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "gif":
            return "image/gif";
        case "svg":
            return "image/svg+xml";
        case "webp":
            return "image/webp";
        case "ico":
            return "image/x-icon";
        case "bmp":
            return "image/bmp";
        case "tiff":
            return "image/tiff";
        case "pdf":
            return "application/pdf";
        case "mp4":
            return "video/mp4";
        case "webm":
            return "video/webm";
        default:
            return "application/octet-stream";
    }
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ domain: string; path: string[] }> },
) {
    const { path } = await params;

    // URL structure: /api/[domain]/raw/[repoOwner]/[repoName]/[...rest]

    if (path.length < 3) {
        return new Response("Invalid path parameters", { status: 400 });
    }

    // URL structure: /api/[domain]/raw/[repo]/-/[...filePath]?ref=[revision]
    // The "repo" part can have variable number of segments (e.g. github.com/owner/repo)

    // Check for query parameter 'ref'
    const searchParams = request.nextUrl.searchParams;
    const refParam = searchParams.get("ref");
    let revision: string | undefined = refParam ?? undefined;
    let fullRepoName: string;
    let filePath: string;

    // Find the separator "-"
    const separatorIndex = path.indexOf("-");

    if (separatorIndex !== -1) {
        // New logic with separator
        const repoParts = path.slice(0, separatorIndex);
        const fileParts = path.slice(separatorIndex + 1);

        fullRepoName = repoParts.join("/");
        filePath = fileParts.join("/");

        // Revision must be query param in this mode OR we default to HEAD
        if (!revision) revision = "HEAD";
    } else {
        // Fallback legacy logic if no separator (assume owner/repo)
        if (path.length < 3) {
            return new Response("Invalid path parameters", { status: 400 });
        }

        const repoOwner = path[0];
        const repoName = path[1];
        fullRepoName = `${repoOwner}/${repoName}`;

        if (revision) {
            filePath = path.slice(2).join("/");
        } else {
            if (path.length < 4) {
                return new Response(
                    "Invalid path parameters: missing revision",
                    { status: 400 },
                );
            }
            revision = path[2];
            filePath = path.slice(3).join("/");
        }
    }

    const buffer = await getRawFileSource({
        repo: fullRepoName,
        path: filePath,
        ref: revision,
    });

    if (isServiceError(buffer)) {
        return new Response(buffer.message, { status: buffer.statusCode });
    }

    const contentType = getContentType(filePath);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(new Blob([buffer as any]), {
        headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600, immutable",
        },
    });
}
