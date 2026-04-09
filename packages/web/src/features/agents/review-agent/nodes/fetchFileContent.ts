import { sourcebot_context, sourcebot_pr_payload } from "@/features/agents/review-agent/types";
import { fileSourceResponseSchema, getFileSourceForRepo } from '@/features/git';
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma } from "@/prisma";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('fetch-file-content');

export const fetchFileContent = async (pr_payload: sourcebot_pr_payload, filename: string): Promise<sourcebot_context> => {
    logger.debug("Executing fetch_file_content");

    const org = await __unsafePrisma.org.findUnique({
        where: { id: SINGLE_TENANT_ORG_ID },
    });
    if (!org) {
        throw new Error("Organization not found");
    }

    const repoPath = pr_payload.hostDomain + "/" + pr_payload.owner + "/" + pr_payload.repo;
    const fileSourceRequest = {
        path: filename,
        repo: repoPath,
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
