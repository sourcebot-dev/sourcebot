import { sew } from "@/actions";
import { notFound, fileNotFound, ServiceError } from "@/lib/serviceError";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { getRepoPath } from "@sourcebot/shared";
import simpleGit from "simple-git";
import z from "zod";

export const rawFileSourceRequestSchema = z.object({
    path: z.string(),
    repo: z.string(),
    ref: z.string().optional(),
});
export type RawFileSourceRequest = z.infer<typeof rawFileSourceRequestSchema>;

export const getRawFileSource = async ({
    path: filePath,
    repo: repoName,
    ref,
}: RawFileSourceRequest): Promise<Buffer | ServiceError> =>
    sew(() =>
        withOptionalAuthV2(async ({ org, prisma }) => {
            const repo = await prisma.repo.findFirst({
                where: { name: repoName, orgId: org.id },
            });
            if (!repo) {
                return notFound(`Repository "${repoName}" not found.`);
            }

            const { path: repoPath } = getRepoPath(repo);
            const git = simpleGit().cwd(repoPath);

            const gitRef = ref ?? repo.defaultBranch ?? "HEAD";

            try {
                // 1. Get the object hash (SHA) for the file at the specific revision
                // This ensures the file exists at that revision
                const sha = await git.revparse([`${gitRef}:${filePath}`]);

                // 2. Read the binary content using cat-file
                // simple-git's binaryCatFile returns the raw buffer from git cat-file -p <sha>
                // Note: binaryCatFile is not available in all simple-git versions, checking typing...
                // If simple-git doesn't support binaryCatFile directly in types, we use cat-file with buffer encoding.
                // Assuming simple-git v3+ supports this via custom options or command execution.

                // Using 'buffer' encoding with show/cat-file is tricky with simple-git's high-level API which returns string by default.
                // The most reliable way for binary data with simple-git is using `binaryCatFile` if available or `raw` with buffer handling.
                // Let's use `git.binaryCatFile` which is designed for this.
                const buffer = await git.binaryCatFile(["blob", sha]);
                return buffer;
            } catch (error: unknown) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                if (
                    errorMessage.includes("exists on disk") ||
                    errorMessage.includes("fatal: path")
                ) {
                    return fileNotFound(filePath, repoName);
                }
                // git rev-parse failure usually means file doesn't exist at that ref
                if (
                    errorMessage.includes("unknown revision") ||
                    errorMessage.includes("bad revision")
                ) {
                    return fileNotFound(filePath, repoName);
                }

                throw error;
            }
        }),
    );
