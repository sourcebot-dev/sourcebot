import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { cloneRepository, fetchRepository, getBranches, getRemoteDefaultBranch, getTags } from "./git.js";

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

const createAuthenticatedGitServer = async ({
    projectRoot,
    username,
    password,
}: {
    projectRoot: string;
    username: string;
    password: string;
}) => {
    const expectedAuthorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    let authenticatedRequestCount = 0;
    let unauthenticatedRequestCount = 0;

    const server = createServer((request, response) => {
        if (request.headers.authorization !== expectedAuthorization) {
            unauthenticatedRequestCount++;
            response.writeHead(401, {
                'WWW-Authenticate': 'Basic realm="Sourcebot Git Test"',
            });
            response.end();
            return;
        }

        authenticatedRequestCount++;
        const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
        const backend = spawn('git', ['http-backend'], {
            env: {
                ...process.env,
                GIT_HTTP_EXPORT_ALL: '1',
                GIT_PROJECT_ROOT: projectRoot,
                PATH_INFO: requestUrl.pathname,
                QUERY_STRING: requestUrl.searchParams.toString(),
                REQUEST_METHOD: request.method ?? 'GET',
                CONTENT_TYPE: request.headers['content-type'] ?? '',
                CONTENT_LENGTH: request.headers['content-length'] ?? '',
                REMOTE_USER: username,
                SERVER_PROTOCOL: 'HTTP/1.1',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let headerBuffer = Buffer.alloc(0);
        let headersSent = false;
        const stderr: Buffer[] = [];

        backend.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
        backend.stdout.on('data', (chunk: Buffer) => {
            if (headersSent) {
                response.write(chunk);
                return;
            }

            headerBuffer = Buffer.concat([headerBuffer, chunk]);
            const crlfTerminatorIndex = headerBuffer.indexOf('\r\n\r\n');
            const lfTerminatorIndex = headerBuffer.indexOf('\n\n');
            const terminatorIndex = crlfTerminatorIndex >= 0
                ? crlfTerminatorIndex
                : lfTerminatorIndex;
            if (terminatorIndex < 0) {
                return;
            }

            const terminatorLength = crlfTerminatorIndex >= 0 ? 4 : 2;
            const rawHeaders = headerBuffer.subarray(0, terminatorIndex).toString('utf8');
            const responseHeaders: Record<string, string> = {};
            let statusCode = 200;
            for (const line of rawHeaders.split(/\r?\n/)) {
                const separatorIndex = line.indexOf(':');
                if (separatorIndex < 0) {
                    continue;
                }

                const name = line.slice(0, separatorIndex).trim();
                const value = line.slice(separatorIndex + 1).trim();
                if (name.toLowerCase() === 'status') {
                    statusCode = Number.parseInt(value, 10);
                } else {
                    responseHeaders[name] = value;
                }
            }

            response.writeHead(statusCode, responseHeaders);
            headersSent = true;
            response.write(headerBuffer.subarray(terminatorIndex + terminatorLength));
            headerBuffer = Buffer.alloc(0);
        });
        backend.once('error', (error) => {
            if (!response.headersSent) {
                response.writeHead(500);
            }
            response.end(error.message);
        });
        backend.once('close', (code) => {
            if (!headersSent) {
                response.writeHead(500);
                response.end(Buffer.concat(stderr));
                return;
            }
            if (code !== 0) {
                response.destroy(new Error(Buffer.concat(stderr).toString('utf8')));
                return;
            }
            response.end();
        });

        request.pipe(backend.stdin);
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Git test server did not bind to a TCP port');
    }

    return {
        cloneUrl: `http://127.0.0.1:${address.port}/repo.git`,
        getAuthenticatedRequestCount: () => authenticatedRequestCount,
        getUnauthenticatedRequestCount: () => unauthenticatedRequestCount,
        server,
    };
};

const closeServer = async (server: Server) => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
};

const directoryContains = async (directory: string, value: string): Promise<boolean> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            if (await directoryContains(path, value)) {
                return true;
            }
        } else if (entry.isFile()) {
            const contents = await readFile(path);
            if (contents.includes(Buffer.from(value))) {
                return true;
            }
        }
    }
    return false;
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

describe('authenticated Git operations', () => {
    const repoPaths: string[] = [];

    afterEach(async () => {
        await Promise.all(
            repoPaths
                .splice(0)
                .map((repoPath) => rm(repoPath, { recursive: true, force: true })),
        );
    });

    test('clone, fetch, and ls-remote authenticate without exposing the credential', async () => {
        const sourcePath = await createTempRepo();
        repoPaths.push(sourcePath);
        await commitFile({
            repoPath: sourcePath,
            fileName: 'README.md',
            content: 'initial\n',
            message: 'initial commit',
            timestamp: '2024-01-01T00:00:00Z',
        });

        const projectRoot = await mkdtemp(join(tmpdir(), 'sourcebot-git-http-root-'));
        repoPaths.push(projectRoot);
        const bareRepoPath = join(projectRoot, 'repo.git');
        runGit(projectRoot, ['clone', '--bare', sourcePath, bareRepoPath]);

        const username = 'sourcebot-test-user';
        const token = `sourcebot-test-token-${randomUUID()}`;
        const gitServer = await createAuthenticatedGitServer({
            projectRoot,
            username,
            password: token,
        });
        const clonePath = await mkdtemp(join(tmpdir(), 'sourcebot-git-auth-clone-'));
        repoPaths.push(clonePath);
        const tracePath = join(projectRoot, 'git-trace.json');
        const previousTrace = process.env.GIT_TRACE2_EVENT;
        process.env.GIT_TRACE2_EVENT = tracePath;
        let unauthenticatedRequestsBeforeProactiveAuth: number | undefined;
        let proactiveAuthDefaultBranch: string | undefined;

        try {
            await cloneRepository({
                cloneUrl: gitServer.cloneUrl,
                credentials: {
                    username,
                    password: token,
                },
                path: clonePath,
            });

            await commitFile({
                repoPath: sourcePath,
                fileName: 'new.txt',
                content: 'new commit\n',
                message: 'new commit',
                timestamp: '2024-01-02T00:00:00Z',
            });
            runGit(sourcePath, ['push', bareRepoPath, 'main']);

            await fetchRepository({
                cloneUrl: gitServer.cloneUrl,
                credentials: {
                    username,
                    password: token,
                },
                path: clonePath,
            });

            unauthenticatedRequestsBeforeProactiveAuth = gitServer.getUnauthenticatedRequestCount();
            proactiveAuthDefaultBranch = await getRemoteDefaultBranch({
                path: clonePath,
                cloneUrl: gitServer.cloneUrl,
                credentials: {
                    username,
                    password: token,
                    proactiveAuth: 'basic',
                },
            });
        } finally {
            if (previousTrace === undefined) {
                delete process.env.GIT_TRACE2_EVENT;
            } else {
                process.env.GIT_TRACE2_EVENT = previousTrace;
            }
            await closeServer(gitServer.server);
        }

        const expectedHead = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: sourcePath,
            encoding: 'utf8',
        }).trim();
        const fetchedHead = execFileSync('git', ['rev-parse', 'refs/heads/main'], {
            cwd: clonePath,
            encoding: 'utf8',
        }).trim();
        const repositoryConfig = execFileSync('git', ['config', '--local', '--list', '--show-origin'], {
            cwd: clonePath,
            encoding: 'utf8',
        });
        const trace = await readFile(tracePath, 'utf8');

        expect(fetchedHead).toBe(expectedHead);
        expect(gitServer.getAuthenticatedRequestCount()).toBeGreaterThan(0);
        expect(gitServer.getUnauthenticatedRequestCount()).toBeGreaterThan(0);
        expect(proactiveAuthDefaultBranch).toBe('main');
        expect(gitServer.getUnauthenticatedRequestCount()).toBe(unauthenticatedRequestsBeforeProactiveAuth);
        expect(repositoryConfig).not.toContain('remote.origin.url');
        expect(repositoryConfig).not.toContain('http.extraHeader');
        expect(repositoryConfig).not.toContain(token);
        expect(trace).not.toContain(token);
        expect(trace).not.toContain(Buffer.from(`${username}:${token}`).toString('base64'));
        expect(await directoryContains(clonePath, token)).toBe(false);
    }, 20_000);
});
