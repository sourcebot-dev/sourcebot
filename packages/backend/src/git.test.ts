import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";
import { getBranches, getTags } from "./git.js";

const runGit = (
    repoPath: string,
    args: string[],
    env: Record<string, string> = {},
) => {
    execFileSync("git", args, {
        cwd: repoPath,
        env: {
            ...process.env,
            ...env,
        },
        stdio: "pipe",
    });
};

const createTempRepo = async () => {
    const repoPath = await mkdtemp(join(tmpdir(), "sourcebot-git-test-"));

    runGit(repoPath, ["init", "--initial-branch=main"]);
    runGit(repoPath, ["config", "user.name", "Sourcebot Test"]);
    runGit(repoPath, ["config", "user.email", "sourcebot@example.com"]);
    runGit(repoPath, ["config", "tag.sort", "refname"]);
    runGit(repoPath, ["config", "branch.sort", "refname"]);

    return repoPath;
};

const commitFile = async ({
    repoPath,
    fileName,
    content,
    message,
    timestamp,
}: {
    repoPath: string;
    fileName: string;
    content: string;
    message: string;
    timestamp: string;
}) => {
    await writeFile(join(repoPath, fileName), content);
    runGit(repoPath, ["add", fileName]);
    runGit(repoPath, ["commit", "-m", message], {
        GIT_AUTHOR_DATE: timestamp,
        GIT_COMMITTER_DATE: timestamp,
    });
};

describe("git ref ordering", () => {
    const repoPaths: string[] = [];

    afterEach(async () => {
        await Promise.all(
            repoPaths
                .splice(0)
                .map((repoPath) =>
                    rm(repoPath, { recursive: true, force: true }),
                ),
        );
    });

    test("getTags returns newest tags first by creator date", async () => {
        const repoPath = await createTempRepo();
        repoPaths.push(repoPath);

        await commitFile({
            repoPath,
            fileName: "README.md",
            content: "base\n",
            message: "initial commit",
            timestamp: "2024-01-01T00:00:00Z",
        });

        runGit(repoPath, ["tag", "-a", "a-oldest", "-m", "oldest tag"], {
            GIT_COMMITTER_DATE: "2024-01-02T00:00:00Z",
        });
        runGit(repoPath, ["tag", "-a", "z-newest", "-m", "newest tag"], {
            GIT_COMMITTER_DATE: "2024-01-03T00:00:00Z",
        });

        const tags = await getTags(repoPath);

        expect(tags).toContain("z-newest");
        expect(tags).toContain("a-oldest");
        expect(tags.indexOf("z-newest")).toBeLessThan(tags.indexOf("a-oldest"));
    });

    test("getBranches returns newest branches first by last commit date", async () => {
        const repoPath = await createTempRepo();
        repoPaths.push(repoPath);

        await commitFile({
            repoPath,
            fileName: "README.md",
            content: "base\n",
            message: "initial commit",
            timestamp: "2024-01-01T00:00:00Z",
        });

        runGit(repoPath, ["checkout", "-b", "aaa-oldest"]);
        await commitFile({
            repoPath,
            fileName: "oldest.txt",
            content: "oldest\n",
            message: "oldest branch commit",
            timestamp: "2024-01-02T00:00:00Z",
        });

        runGit(repoPath, ["checkout", "main"]);
        runGit(repoPath, ["checkout", "-b", "zzz-newest"]);
        await commitFile({
            repoPath,
            fileName: "newest.txt",
            content: "newest\n",
            message: "newest branch commit",
            timestamp: "2024-01-03T00:00:00Z",
        });

        runGit(repoPath, ["checkout", "main"]);

        const branches = await getBranches(repoPath);

        expect(branches).toContain("zzz-newest");
        expect(branches).toContain("aaa-oldest");
        expect(branches.indexOf("zzz-newest")).toBeLessThan(
            branches.indexOf("aaa-oldest"),
        );
    });
});
