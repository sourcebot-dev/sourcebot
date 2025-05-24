import { sourcebot_context, sourcebot_pr_payload } from "@/features/agents/review-agent/types";
import { getFileSource } from "@/features/search/fileSourceApi";
import { fileSourceResponseSchema } from "@/features/search/schemas";
import { base64Decode } from "@/lib/utils";
import { isServiceError } from "@/lib/utils";
import { env } from "@/env.mjs";


export const fetchFileContent = async (pr_payload: sourcebot_pr_payload, filename: string): Promise<sourcebot_context> => {
    console.log("Executing fetch_file_content");

    const repoPath = pr_payload.hostDomain + "/" + pr_payload.owner + "/" + pr_payload.repo;
    const fileSourceRequest = {
        fileName: filename,
        repository: repoPath,
    }
    console.log(JSON.stringify(fileSourceRequest, null, 2));

    const response = await getFileSource(fileSourceRequest, "~", env.REVIEW_AGENT_API_KEY);
    if (isServiceError(response)) {
        throw new Error(`Failed to fetch file content for ${filename} from ${repoPath}: ${response.message}`);
    }

    const fileSourceResponse = fileSourceResponseSchema.parse(response);
    const fileContent = base64Decode(fileSourceResponse.source);

    const fileContentContext: sourcebot_context = {
        type: "file_content",
        description: `The content of the file ${filename}`,
        context: fileContent,
    }

    console.log("Completed fetch_file_content");
    return fileContentContext;
}