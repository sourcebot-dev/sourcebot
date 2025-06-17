import { sourcebot_context, sourcebot_pr_payload } from "@/features/agents/review-agent/types";
import { getFileSource } from "@/features/search/fileSourceApi";
import { fileSourceResponseSchema } from "@/features/search/schemas";
import { isServiceError } from "@/lib/utils";
import { env } from "@/env.mjs";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('fetch-file-content');

export const fetchFileContent = async (pr_payload: sourcebot_pr_payload, filename: string): Promise<sourcebot_context> => {
    logger.debug("Executing fetch_file_content");

    const repoPath = pr_payload.hostDomain + "/" + pr_payload.owner + "/" + pr_payload.repo;
    const fileSourceRequest = {
        fileName: filename,
        repository: repoPath,
    }
    logger.debug(JSON.stringify(fileSourceRequest, null, 2));

    const response = await getFileSource(fileSourceRequest, "~", env.REVIEW_AGENT_API_KEY);
    if (isServiceError(response)) {
        throw new Error(`Failed to fetch file content for ${filename} from ${repoPath}: ${response.message}`);
    }

    const fileSourceResponse = fileSourceResponseSchema.parse(response);
    const fileContent = fileSourceResponse.source;

    const fileContentContext: sourcebot_context = {
        type: "file_content",
        description: `The content of the file ${filename}`,
        context: fileContent,
    }

    logger.debug("Completed fetch_file_content");
    return fileContentContext;
}