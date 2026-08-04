type Args = {
    baseUrl?: string;
    token?: string;
    count: number;
    concurrency: number;
    start: number;
    prefix: string;
    domain: string;
    externalIdPrefix: string;
    active: boolean;
    timeoutMs: number;
    progressEvery: number;
    dryRun: boolean;
    allowFailures: boolean;
};

type Result = {
    index: number;
    email: string;
    ok: boolean;
    status?: number;
    body?: string;
    error?: string;
};

const DEFAULT_COUNT = 5_000;
const DEFAULT_CONCURRENCY = 25;
const DEFAULT_TIMEOUT_MS = 30_000;

const usage = `Usage:
  yarn tool:scim-provision --base-url http://localhost:3000/scim/v2 --token <token> [options]

Environment fallbacks:
  SCIM_BASE_URL, SCIM_TOKEN

Options:
  --count <number>              Users to provision. Default: ${DEFAULT_COUNT}
  --concurrency <number>        Concurrent POST requests. Default: ${DEFAULT_CONCURRENCY}
  --start <number>              First numeric suffix. Default: 1
  --prefix <string>             Email/display-name prefix. Default: scim-load-<timestamp>
  --domain <string>             Email domain. Default: example.com
  --external-id-prefix <string> External ID prefix. Default: same as --prefix
  --active <true|false>         SCIM active value. Default: true
  --timeout-ms <number>         Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --progress-every <number>     Log progress every N users. Default: 100
  --dry-run                     Print the first payload and exit without sending
  --allow-failures              Exit 0 even when some requests fail
  --help                        Show this help
`;

const parsePositiveInt = (value: string | undefined, name: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
};

const parseBoolean = (value: string | undefined, name: string): boolean => {
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    throw new Error(`${name} must be true or false`);
};

const takeValue = (argv: string[], index: number, name: string): string => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
        throw new Error(`${name} requires a value`);
    }
    return value;
};

const parseArgs = (): Args => {
    const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const args: Args = {
        baseUrl: process.env.SCIM_BASE_URL,
        token: process.env.SCIM_TOKEN,
        count: DEFAULT_COUNT,
        concurrency: DEFAULT_CONCURRENCY,
        start: 1,
        prefix: `scim-load-${runId}`,
        domain: "example.com",
        externalIdPrefix: "",
        active: true,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        progressEvery: 100,
        dryRun: false,
        allowFailures: false,
    };

    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case "--help":
            case "-h":
                process.stdout.write(usage);
                process.exit(0);
            case "--base-url":
                args.baseUrl = takeValue(argv, i, arg);
                i++;
                break;
            case "--token":
                args.token = takeValue(argv, i, arg);
                i++;
                break;
            case "--count":
                args.count = parsePositiveInt(takeValue(argv, i, arg), arg);
                i++;
                break;
            case "--concurrency":
                args.concurrency = parsePositiveInt(takeValue(argv, i, arg), arg);
                i++;
                break;
            case "--start":
                args.start = parsePositiveInt(takeValue(argv, i, arg), arg);
                i++;
                break;
            case "--prefix":
                args.prefix = takeValue(argv, i, arg);
                i++;
                break;
            case "--domain":
                args.domain = takeValue(argv, i, arg);
                i++;
                break;
            case "--external-id-prefix":
                args.externalIdPrefix = takeValue(argv, i, arg);
                i++;
                break;
            case "--active":
                args.active = parseBoolean(takeValue(argv, i, arg), arg);
                i++;
                break;
            case "--timeout-ms":
                args.timeoutMs = parsePositiveInt(takeValue(argv, i, arg), arg);
                i++;
                break;
            case "--progress-every":
                args.progressEvery = parsePositiveInt(takeValue(argv, i, arg), arg);
                i++;
                break;
            case "--dry-run":
                args.dryRun = true;
                break;
            case "--allow-failures":
                args.allowFailures = true;
                break;
            default:
                throw new Error(`Unknown option: ${arg}`);
        }
    }

    args.externalIdPrefix ||= args.prefix;

    if (!args.baseUrl) {
        throw new Error("--base-url or SCIM_BASE_URL is required");
    }
    if (!args.token && !args.dryRun) {
        throw new Error("--token or SCIM_TOKEN is required");
    }

    return args;
};

const buildScimUser = (args: Args, index: number) => {
    const suffix = String(index).padStart(String(args.start + args.count - 1).length, "0");
    const email = `${args.prefix}-${suffix}@${args.domain}`.toLowerCase();
    const displayName = `${args.prefix} ${suffix}`;

    return {
        email,
        payload: {
            schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
            userName: email,
            externalId: `${args.externalIdPrefix}-${suffix}`,
            name: {
                givenName: args.prefix,
                familyName: suffix,
                formatted: displayName,
            },
            displayName,
            emails: [
                {
                    value: email,
                    primary: true,
                    type: "work",
                },
            ],
            active: args.active,
        },
    };
};

const readResponseBody = async (response: Response): Promise<string> => {
    const text = await response.text().catch(() => "");
    if (text.length <= 500) {
        return text;
    }
    return `${text.slice(0, 500)}...`;
};

const provisionUser = async (args: Args, index: number, usersUrl: string): Promise<Result> => {
    const { email, payload } = buildScimUser(args, index);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

    try {
        const response = await fetch(usersUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${args.token}`,
                "Content-Type": "application/scim+json",
                "Accept": "application/scim+json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        const body = await readResponseBody(response);
        return {
            index,
            email,
            ok: response.ok,
            status: response.status,
            body: response.ok ? undefined : body,
        };
    } catch (error) {
        return {
            index,
            email,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    } finally {
        clearTimeout(timeout);
    }
};

const runPool = async (args: Args, usersUrl: string): Promise<Result[]> => {
    const results: Result[] = [];
    let nextIndex = args.start;
    let completed = 0;
    const endExclusive = args.start + args.count;

    const worker = async () => {
        while (true) {
            const index = nextIndex;
            nextIndex++;
            if (index >= endExclusive) {
                return;
            }

            const result = await provisionUser(args, index, usersUrl);
            results.push(result);
            completed++;

            if (completed % args.progressEvery === 0 || completed === args.count) {
                const failed = results.filter((r) => !r.ok).length;
                process.stdout.write(`Provisioned ${completed}/${args.count} users (${failed} failed)\n`);
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(args.concurrency, args.count) }, () => worker()));
    return results.sort((a, b) => a.index - b.index);
};

const summarize = (results: Result[]) => {
    const statusCounts = new Map<string, number>();
    for (const result of results) {
        const key = result.ok ? String(result.status) : result.status ? String(result.status) : "request-error";
        statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
    }

    const failed = results.filter((result) => !result.ok);
    process.stdout.write("\nSummary\n");
    process.stdout.write(`  Total: ${results.length}\n`);
    process.stdout.write(`  Successful: ${results.length - failed.length}\n`);
    process.stdout.write(`  Failed: ${failed.length}\n`);
    process.stdout.write(`  Statuses: ${Array.from(statusCounts.entries()).map(([status, count]) => `${status}=${count}`).join(", ")}\n`);

    if (failed.length > 0) {
        process.stdout.write("\nFirst failures\n");
        for (const failure of failed.slice(0, 10)) {
            process.stdout.write(`  [${failure.index}] ${failure.email}: ${failure.status ?? "request-error"} ${failure.error ?? failure.body ?? ""}\n`);
        }
    }
};

const main = async () => {
    const args = parseArgs();
    const usersUrl = `${args.baseUrl!.replace(/\/$/, "")}/Users`;
    const firstUser = buildScimUser(args, args.start);

    if (args.dryRun) {
        process.stdout.write(`POST ${usersUrl}\n`);
        process.stdout.write(`${JSON.stringify(firstUser.payload, null, 2)}\n`);
        return;
    }

    process.stdout.write(`Provisioning ${args.count} SCIM users to ${usersUrl}\n`);
    process.stdout.write(`Prefix: ${args.prefix}, domain: ${args.domain}, concurrency: ${args.concurrency}, active: ${args.active}\n`);

    const startedAt = Date.now();
    const results = await runPool(args, usersUrl);
    summarize(results);

    const durationSeconds = (Date.now() - startedAt) / 1000;
    process.stdout.write(`Duration: ${durationSeconds.toFixed(1)}s (${(results.length / durationSeconds).toFixed(1)} users/s)\n`);

    if (!args.allowFailures && results.some((result) => !result.ok)) {
        process.exit(1);
    }
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
