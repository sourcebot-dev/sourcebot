import { sourcebot_context, sourcebot_pr_payload } from "../types.js";
import { z } from "zod";

// TODO: use original Sourcebot schemas instead of redefining here
const fileSourceResponseSchema = z.object({
    source: z.string(),
    language: z.string(),
});

const base64Decode = (base64: string): string => {
    const binString = atob(base64);
    return Buffer.from(Uint8Array.from(binString, (m) => m.codePointAt(0)!).buffer).toString();
}

export const fetch_file_content = async (pr_payload: sourcebot_pr_payload, filename: string): Promise<sourcebot_context> => {
    console.log("Executing fetch_file_content");

    const fileSourceRequest = {
        fileName: filename,
        repository: pr_payload.hostDomain + "/" + pr_payload.owner + "/" + pr_payload.repo,
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
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
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