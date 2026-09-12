import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { artifact, scenario, minimal, canary } from './harness.mjs';

let packed;
before(() => { packed = artifact(); console.log(`Collector artifact SHA-256: ${packed.digest}`); });
after(() => packed?.cleanup());
const props = (r, name) => r.events.filter(e => e.event === `setup_sourcebot_${name}`).map(e => e.properties);
const end = async d => {
    await d.answer('Add another code host?', 'n');
    await d.answer('Would you like to configure AI features?', 'n');
    await d.answer('What URL will Sourcebot be hosted at?');
    await d.answer('Download docker-compose.yml?', 'n');
};

for (const [host, index] of [['github', 0], ['gitlab', 1], ['gitea', 6]]) {
    for (const token of [false, true]) {
        test(`${host}: all explicit scopes, ${token ? 'credentialed' : 'public'}`, async () => {
            const label = host === 'github' ? 'GitHub' : host === 'gitlab' ? 'GitLab' : 'Gitea';
            const result = await scenario(packed, {}, async d => {
                await d.answer('What directory would you like');
                await d.select('Which code host', index);
                await d.answer(`${label} URL`);
                await d.answer(`${label} ${host === 'gitea' ? 'Access Token' : 'Personal Access Token'}`, token ? `${canary}-token` : '');
                await d.check('What do you want to index?', [0, 1, 2]);
                if (host === 'github') {
                    await d.multi('Repositories to index');
                    await d.multi('Organizations to index', canary);
                    await d.multi('GitHub users to index', canary);
                } else if (host === 'gitlab') {
                    await d.multi('Groups to index', canary);
                    await d.multi('Projects to index');
                    await d.multi('Users to index', canary);
                } else {
                    await d.multi('Organizations to index', canary);
                    await d.multi('Repositories to index');
                    await d.multi('Users to index', canary);
                }
                await end(d);
            });
            const summary = props(result, 'configured_code_source')[0];
            assert.equal(summary.codeHost, host);
            assert.equal(summary.deploymentType, 'cloud');
            assert.equal(summary.scopeTypes.length, 3);
            assert.equal(summary.userCount, 1);
            assert.equal(summary.credentialMode === 'none', !token);
            assert.equal(summary.repositoryCount, host === 'gitlab' ? 0 : 1);
            assert.equal(summary.projectCount, host === 'gitlab' ? 1 : 0);
        });
    }
}

for (const all of [true, false]) {
    test(`Gerrit: ${all ? 'all' : 'projects'}`, async () => {
        const result = await scenario(packed, {}, async d => {
            await d.answer('What directory would you like');
            await d.select('Which code host', 7);
            await d.answer('Gerrit URL', `https://${canary}.example.invalid`);
            await d.answer('Index all projects?', all ? 'y' : 'n');
            if (!all) {
                await d.multi('Projects to index', canary);
            }
            await end(d);
        });
        const s = props(result, 'configured_code_source')[0];
        assert.equal(s.indexAll, all);
        assert.equal(s.projectCount, all ? 0 : 1);
        assert.equal(s.deploymentType, 'self_hosted');
    });
}

for (const server of [false, true]) {
    test(`Azure DevOps ${server ? 'Server/TFS' : 'Cloud'}: all scopes`, async () => {
        const result = await scenario(packed, {}, async d => {
            await d.answer('What directory would you like');
            await d.select('Which code host', 4);
            await d.select('Which Azure DevOps deployment?', server ? 1 : 0);
            if (server) {
                await d.answer('Azure DevOps Server URL', `https://${canary}.example.invalid`);
                await d.answer('Use legacy TFS path format', 'y');
            }
            await d.answer('Azure DevOps Personal Access Token', `${canary}-token`);
            await d.check('What do you want to index?', [0, 1, 2]);
            await d.multi(server ? 'Collections to index' : 'Organizations to index', canary);
            await d.multi('Projects to index');
            await d.multi('Repositories to index', `${canary}/project/repo`);
            await end(d);
        });
        const s = props(result, 'configured_code_source')[0];
        assert.equal(s.deploymentType, server ? 'self_hosted' : 'cloud');
        assert.equal(s.organizationCount, 1);
        assert.equal(s.projectCount, 1);
        assert.equal(s.repositoryCount, 1);
    });
}

for (const auth of [0, 1, 2]) {
    test(`Bitbucket Cloud auth ${auth}: workspaces and repositories`, async () => {
        const result = await scenario(packed, {}, async d => {
            await d.answer('What directory would you like');
            await d.select('Which code host', 5);
            await d.select('Which Bitbucket deployment?');
            await d.select('How will you authenticate?', auth);
            if (auth === 0) {
                await d.answer('Atlassian account email', `${canary}@example.invalid`);
                await d.answer('Bitbucket username', canary);
                await d.answer('API Token (', `${canary}-token`);
            } else if (auth === 1) {
                await d.answer('Access Token (', `${canary}-token`);
            } else {
                await d.answer('Bitbucket username', canary);
                await d.answer('Bitbucket App Password', `${canary}-password`);
            }
            await d.check('What do you want to index?', [0, 1]);
            await d.multi('Workspaces to index', canary);
            await d.multi('Repositories to index');
            await end(d);
        });
        const s = props(result, 'configured_code_source')[0];
        assert.equal(s.credentialMode, ['api_token', 'access_token', 'app_password'][auth]);
        assert.equal(s.workspaceCount, 1);
        assert.equal(s.repositoryCount, 1);
    });
}

for (const all of [false, true]) {
    test(`Bitbucket Data Center: ${all ? 'all' : 'selected'}`, async () => {
        const result = await scenario(packed, {}, async d => {
            await d.answer('What directory would you like');
            await d.select('Which code host', 5);
            await d.select('Which Bitbucket deployment?', 1);
            await d.answer('Bitbucket Data Center URL', `https://${canary}.example.invalid`);
            await d.answer('Bitbucket username');
            await d.answer('Bitbucket HTTP Access Token', `${canary}-token`);
            await d.answer('Index every repository visible to the token?', all ? 'y' : 'n');
            if (!all) {
                await d.check('What do you want to index?', [0, 1]);
                await d.multi('Project keys to index', canary);
                await d.multi('Repositories to index');
            }
            await end(d);
        });
        assert.equal(props(result, 'configured_code_source')[0].indexAll, all);
        assert.equal(props(result, 'configured_code_source')[0].deploymentType, 'self_hosted');
    });
}

for (const shape of ['root', 'wildcard', 'nested']) {
    test(`Local repositories: ${shape}`, async () => {
        const result = await scenario(packed, { prepare({ cwd }) {
            const root = join(cwd, canary);
            if (shape === 'root') {
                mkdirSync(join(root, '.git'), { recursive: true });
            } else {
                mkdirSync(join(root, 'one/.git'), { recursive: true });
                mkdirSync(join(root, shape === 'wildcard' ? 'two/.git' : 'nested/two/.git'), { recursive: true });
            }
        } }, async d => {
            await d.answer('What directory would you like');
            await d.select('Which code host', 2);
            await d.answer('Path to your repos directory', join(d.cwd, canary));
            if (shape !== 'root') {
                await d.answer('Which repositories should be indexed?');
            }
            await end(d);
        });
        const s = props(result, 'configured_code_source')[0];
        assert.equal(s.repositoryCount, shape === 'root' ? 1 : 2);
        assert.equal(s.generatedConnectionCount, shape === 'nested' ? 2 : 1);
        assert.equal(props(result, 'generated_configs')[0].wroteComposeOverride, true);
        assert.ok(result.files['docker-compose.override.yml']);
    });
}

const providers = ['anthropic', 'openai', 'openai-compatible', 'amazon-bedrock', 'google-generative-ai', 'google-vertex', 'google-vertex-anthropic', 'azure', 'deepseek', 'mistral', 'openrouter', 'xai'];
for (const provider of providers) {
    for (const explicit of (provider === 'amazon-bedrock' || provider.startsWith('google-vertex') ? [false, true] : [false])) {
        test(`AI ${provider}${explicit ? ' explicit credentials' : ''}`, async () => {
            const result = await scenario(packed, {}, async d => {
                await minimal(d, { ai: true });
                await d.select('Which AI provider?', providers.indexOf(provider));
                await d.answer('Model name', `${canary}-model`);
                if (provider === 'openai-compatible') {
                    await d.answer('Base URL', `https://${canary}.example.invalid/v1`);
                }
                if (provider === 'azure') {
                    await d.answer('Azure resource name', canary);
                    await d.answer('API version');
                }
                if (provider === 'amazon-bedrock') {
                    await d.answer('Use the default AWS credential chain?', explicit ? 'n' : 'y');
                    if (explicit) {
                        await d.answer('AWS Access Key ID', canary);
                        await d.answer('AWS Secret Access Key', `${canary}-secret`);
                    }
                    await d.answer('AWS region');
                } else if (provider.startsWith('google-vertex')) {
                    await d.answer('Google Cloud project ID', canary);
                    await d.answer('Google Cloud region');
                    await d.answer('Use Application Default Credentials?', explicit ? 'n' : 'y');
                    if (explicit) {
                        await d.answer('Path to service account credentials JSON', `/${canary}/credentials.json`);
                    }
                } else {
                    await d.answer('API key (', `${canary}-api-key`);
                }
                await d.answer('Display name', `${canary}-display`);
                await d.answer('Add another model?', 'n');
                await d.answer('What URL will Sourcebot be hosted at?');
                await d.answer('Download docker-compose.yml?', 'n');
            });
            const s = props(result, 'configured_ai_provider')[0];
            assert.equal(s.provider, provider);
            assert.equal(s.hasDisplayName, true);
            assert.equal(s.usesCustomEndpoint, provider === 'openai-compatible');
            assert.equal(s.modelSelectionMethod, 'manual_fallback');
            assert.deepEqual(props(result, 'ai_setup_completed')[0].providerTypes, [provider]);
            assert.equal(JSON.parse(result.files['config.json']).models[0].provider, provider);
        });
    }
}
