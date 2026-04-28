import { sourcebot_context, sourcebot_pr_payload } from "@/features/agents/review-agent/types";
import { fileSourceResponseSchema, getFileSourceForRepo } from '@/features/git';
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma } from "@/prisma";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('fetch-file-content');

type Org = Awaited<ReturnType<typeof __unsafePrisma.org.findUnique>>;
let cachedOrg: Org | undefined;

const getOrg = async (): Promise<NonNullable<Org>> => {
    if (!cachedOrg) {
        cachedOrg = await __unsafePrisma.org.findUnique({
            where: { id: SINGLE_TENANT_ORG_ID },
        });
    }
    if (!cachedOrg) {
        throw new Error("Organization not found");
    }
    return cachedOrg;
};

export const fetchFileContent = async (pr_payload: sourcebot_pr_payload, filename: string): Promise<sourcebot_context> => {
    logger.debug("Executing fetch_file_content");

    const org = await getOrg();

    const repoPath = pr_payload.hostDomain + "/" + pr_payload.owner + "/" + pr_payload.repo;
    const fileSourceRequest = {
        path: filename,
        repo: repoPath,
        ref: pr_payload.head_sha,
    };
    logger.debug(JSON.stringify(fileSourceRequest, null, 2));

    const response = await getFileSourceForRepo(fileSourceRequest, { org, prisma: __unsafePrisma });
    if (isServiceError(response)) {
        throw new Error(`Failed to fetch file content for ${filename} from ${repoPath}: ${response.message}`);
    }

    const fileSourceResponse = fileSourceResponseSchema.parse(response);
    const fileContent = fileSourceResponse.source;

    const fileContentContext: sourcebot_context = {
        type: "file_content",
        description: `The content of the file ${filename}`,
        context: fileContent,
    };

    logger.debug("Completed fetch_file_content");
    return fileContentContext;
};

/**
 * Fetches a repo-level context file (e.g. AGENTS.md) from the repository at the
 * PR's head commit. Returns null when the file does not exist or cannot be read,
 * so the caller can silently skip it. Content is capped at CONTEXT_FILE_MAX_BYTES.
 */
export const fetchContextFile = async (
    pr_payload: sourcebot_pr_payload,
    filePath: string,
): Promise<sourcebot_context | null> => {
    logger.debug(`Fetching context file: ${filePath}`);

    const org = await getOrg();
    const repoPath = pr_payload.hostDomain + "/" + pr_payload.owner + "/" + pr_payload.repo;

    const response = await getFileSourceForRepo(
        { path: filePath, repo: repoPath, ref: pr_payload.head_sha },
        { org, prisma: __unsafePrisma },
    );

    if (isServiceError(response)) {
        logger.debug(`Context file '${filePath}' not found or unreadable — skipping`);
        return null;
    }

    const parsed = fileSourceResponseSchema.safeParse(response);
    if (!parsed.success) {
        logger.warn(`Failed to parse context file response for '${filePath}'`);
        return null;
    }

    const content = parsed.data.source;
    logger.debug(`Fetched context file '${filePath}' (${Buffer.byteLength(content, 'utf8')} bytes)`);
    return {
        type: "repo_instructions",
        description: `Repository-level review instructions from ${filePath}`,
        context: content,
    };
};
