import { GithubAppConfig, SourcebotConfig } from "@sourcebot/schemas/v3/index.type";
import { loadConfig } from "@sourcebot/shared";
import { env } from "../env.js";
import { createLogger } from "@sourcebot/logger";
import { getTokenFromConfig } from "../utils.js";
import { PrismaClient } from "@sourcebot/db";
import { App } from "@octokit/app";

const logger = createLogger('githubAppManager');
const GITHUB_DEFAULT_DEPLOYMENT_HOSTNAME = 'github.com';

type Installation = {
    id: number;
    appId: number;
    account: {
        login: string;
        type: 'organization' | 'user';
    };
    createdAt: string;
    expiresAt: string;
    token: string;
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
        const config = await loadConfig(env.CONFIG_PATH!);
        if (!config.apps) {
            return;
        }

        const githubApps = config.apps.filter(app => app.type === 'githubApp') as GithubAppConfig[];
        logger.info(`Found ${githubApps.length} GitHub apps in config`);

        for (const app of githubApps) {
            const deploymentHostname = app.deploymentHostname as string || GITHUB_DEFAULT_DEPLOYMENT_HOSTNAME;
            
            // @todo: we should move SINGLE_TENANT_ORG_ID to shared package or just remove the need to pass this in 
            // when resolving tokens
            const SINGLE_TENANT_ORG_ID = 1;
            const privateKey = await getTokenFromConfig(app.privateKey, SINGLE_TENANT_ORG_ID, this.db!);

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
                const installationOctokit = await octokitApp.getInstallationOctokit(installationData.id);
                const auth = await installationOctokit.auth({ type: "installation" }) as { expires_at: string, token: string };
                
                const installation: Installation = {
                    id: installationData.id,
                    appId: Number(app.id),
                    account: {
                        login: owner,
                        type: accountType,
                    },
                    createdAt: installationData.created_at,
                    expiresAt: auth.expires_at,
                    token: auth.token
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

        if (installation.expiresAt < new Date().toISOString()) {
            const octokitApp = this.octokitApps.get(installation.appId) as App;
            const installationOctokit = await octokitApp.getInstallationOctokit(installation.id);
            const auth = await installationOctokit.auth({ type: "installation" }) as { expires_at: string, token: string };

            const newInstallation: Installation = {
                ...installation,
                expiresAt: auth.expires_at,
                token: auth.token
            };
            this.installationMap.set(key, newInstallation);
            
            return newInstallation.token;
        } else {
            return installation.token;
        }
    }

    public appsConfigured() {
        return this.octokitApps.size > 0;
    }

    private generateMapKey(owner: string, deploymentHostname: string): string {
        return `${deploymentHostname}/${owner}`;
    }
}