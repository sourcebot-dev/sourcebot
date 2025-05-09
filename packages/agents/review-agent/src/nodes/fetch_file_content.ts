import { sourcebot_context, sourcebot_pr_payload } from "../types.js";
import { fileSourceResponseSchema } from "@sourcebot/web/src/features/search/schemas.js"; 
import { base64Decode } from "@sourcebot/web/src/lib/utils.js";

export const fetch_file_content = async (pr_payload: sourcebot_pr_payload, filename: string): Promise<sourcebot_context> => {
    console.log("Executing fetch_file_content");

    const repoPath = pr_payload.hostDomain + "/" + pr_payload.owner + "/" + pr_payload.repo;
    const fileSourceRequest = {
        fileName: filename,
        repository: repoPath,
    }
    console.log(JSON.stringify(fileSourceRequest, null, 2));

    const response = await fetch('http://localhost:3000/api/source', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Org-Domain': '~'
        },
        body: JSON.stringify(fileSourceRequest)
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch file content for ${filename} from ${repoPath}: ${response.statusText}`);
    }

    const responseData = await response.json();
    const fileSourceResponse = fileSourceResponseSchema.parse(responseData);
    const fileContent = base64Decode(fileSourceResponse.source);

    const fileContentContext: sourcebot_context = {
        type: "file_content",
        description: `The content of the file ${filename}`,
        context: fileContent,
    }

    console.log("Completed fetch_file_content");
    return fileContentContext;
}