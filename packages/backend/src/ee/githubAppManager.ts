import { App } from "@octokit/app";
import { getTokenFromConfig } from "@sourcebot/crypto";
import { PrismaClient } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { GitHubAppConfig } from "@sourcebot/schemas/v3/index.type";
import { env, loadConfig } from "@sourcebot/shared";

const logger = createLogger('githubAppManager');
const GITHUB_DEFAULT_DEPLOYMENT_HOSTNAME = 'github.com';

type Installation = {
    id: number;
    appId: number;
    account: {
        login: string;
        type: 'organization' | 'user';
    };
};

export class GithubAppManager {
    private static instance: GithubAppManager | null = null;
    private octokitApps: Map<number, App>;
    private installationMap: Map<string, Installation>;
    private db: PrismaClient | null = null;
    private initialized: boolean = false;

    private constructor() {
        this.octokitApps = new Map<number, App>();
        this.installationMap = new Map<string, Installation>();
    }

    public static getInstance(): GithubAppManager {
        if (!GithubAppManager.instance) {
            GithubAppManager.instance = new GithubAppManager();
        }
        return GithubAppManager.instance;
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('GithubAppManager must be initialized before use. Call init() first.');
        }
    }

    public async init(db: PrismaClient) {
        this.db = db;
        const config = await loadConfig(env.CONFIG_PATH);
        if (!config.apps) {
            return;
        }

        const githubApps = config.apps.filter(app => app.type === 'github') as GitHubAppConfig[];
        logger.info(`Found ${githubApps.length} GitHub apps in config`);

        for (const app of githubApps) {
            const deploymentHostname = app.deploymentHostname as string || GITHUB_DEFAULT_DEPLOYMENT_HOSTNAME;
            const privateKey = await getTokenFromConfig(app.privateKey);

            const octokitApp = new App({
                appId: Number(app.id),
                privateKey: privateKey,
            });
            this.octokitApps.set(Number(app.id), octokitApp);

            const installations = await octokitApp.octokit.request("GET /app/installations");
            logger.info(`Found ${installations.data.length} GitHub App installations for ${deploymentHostname}/${app.id}:`);

            for (const installationData of installations.data) {
                if (!installationData.account || !installationData.account.login || !installationData.account.type) {
                    logger.warn(`Skipping installation ${installationData.id}: missing account data (${installationData.account})`);
                    continue;
                }

                logger.info(`\tInstallation ID: ${installationData.id}, Account: ${installationData.account.login}, Type: ${installationData.account.type}`);
                
                const owner = installationData.account.login;
                const accountType = installationData.account.type.toLowerCase() as 'organization' | 'user';
                const installation: Installation = {
                    id: installationData.id,
                    appId: Number(app.id),
                    account: {
                        login: owner,
                        type: accountType,
                    },
                };
                this.installationMap.set(this.generateMapKey(owner, deploymentHostname), installation);
            }
        }
        
        this.initialized = true;
    }

    public async getInstallationToken(owner: string, deploymentHostname: string = GITHUB_DEFAULT_DEPLOYMENT_HOSTNAME): Promise<string> {
        this.ensureInitialized();

        const key = this.generateMapKey(owner, deploymentHostname);
        const installation = this.installationMap.get(key) as Installation | undefined;
        if (!installation) {
            throw new Error(`GitHub App Installation not found for ${key}`);
        }

        const octokitApp = this.octokitApps.get(installation.appId) as App;
        const installationOctokit = await octokitApp.getInstallationOctokit(installation.id);
        const auth = await installationOctokit.auth({ type: "installation" }) as { expires_at: string, token: string };
        return auth.token;
    }

    public appsConfigured() {
        return this.octokitApps.size > 0;
    }

    private generateMapKey(owner: string, deploymentHostname: string): string {
        return `${deploymentHostname}/${owner}`;
    }
}