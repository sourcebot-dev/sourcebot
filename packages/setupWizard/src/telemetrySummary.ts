import { isIP } from 'node:net';
import { INSTALL_ID_PATTERN } from './telemetry.js';
import type {
    CodeSourceSummary,
    AiSummary,
    Events,
    DockerSummary,
} from './telemetryEvents.js';

export function sourceSummary(
    codeHost: CodeSourceSummary['codeHost'],
    fields: Partial<Omit<CodeSourceSummary, 'codeHost'>> = {},
): CodeSourceSummary {
    return {
        codeHost,
        deploymentType: 'unknown',
        credentialMode: 'none',
        scopeTypes: [],
        indexAll: false,
        repositoryCount: 0,
        organizationCount: 0,
        userCount: 0,
        groupCount: 0,
        projectCount: 0,
        workspaceCount: 0,
        generatedConnectionCount: 1,
        localDiscoveredRepoCountBucket: null,
        ...fields,
    };
}
export function normalizeHost(value: string): string | undefined {
    try {
        const input = value.trim();
        if (!input) {
            return undefined;
        }
        const url = new URL(
            /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`,
        );
        if (!['http:', 'https:'].includes(url.protocol)) {
            return undefined;
        }
        return url.hostname
            .toLowerCase()
            .replace(/\.+$/, '')
            .replace(/^www\./, '');
    } catch {
        return undefined;
    }
}
export function deployment(
    host: 'github' | 'gitlab' | 'gitea',
    url: string,
): CodeSourceSummary['deploymentType'] {
    const name = normalizeHost(url);
    if (!name) {
        return 'unknown';
    }
    if (host === 'github') {
        return name === 'github.com' || name.endsWith('.ghe.com')
            ? 'cloud'
            : 'self_hosted';
    }
    if (host === 'gitlab') {
        return name === 'gitlab.com' ||
            name.endsWith('.gitlab-dedicated.com') ||
            name.endsWith('.gitlab-dedicated.systems')
            ? 'cloud'
            : 'unknown';
    }
    return name === 'gitea.com' ? 'cloud' : 'self_hosted';
}
export function hostCategory(
    value: string,
): Events['configured_hosted_url']['hostCategory'] {
    try {
        const url = new URL(value);
        const host = url.hostname
            .toLowerCase()
            .replace(/\.+$/, '')
            .replace(/^\[|\]$/g, '');
        if (!host) {
            return 'unknown';
        }
        return host === 'localhost' ||
            host.endsWith('.localhost') ||
            host === '::1' ||
            (isIP(host) === 4 && host.startsWith('127.'))
            ? 'localhost'
            : 'address';
    } catch {
        return 'unknown';
    }
}
export function discoveredBucket(
    n: number,
): CodeSourceSummary['localDiscoveredRepoCountBucket'] {
    return n <= 1
        ? '1'
        : n <= 5
          ? '2-5'
          : n <= 20
            ? '6-20'
            : n <= 100
              ? '21-100'
              : '101+';
}
const unique = <T extends string>(items: T[]): T[] =>
    [...new Set(items)].sort();
export function aggregateSources(
    sources: CodeSourceSummary[],
): Events['configured_code_sources'] {
    const sum = (
        key:
            | 'generatedConnectionCount'
            | 'repositoryCount'
            | 'organizationCount'
            | 'userCount'
            | 'groupCount'
            | 'projectCount'
            | 'workspaceCount',
    ) => sources.reduce((n, s) => n + s[key], 0);
    const codeHostTypes = unique(sources.map((s) => s.codeHost));
    return {
        codeSourceConfigurationCount: sources.length,
        generatedConnectionCount: sum('generatedConnectionCount'),
        uniqueCodeHostCount: codeHostTypes.length,
        codeHostTypes,
        credentialedCodeSourceCount: sources.filter(
            (s) => s.credentialMode !== 'none',
        ).length,
        cloudCodeSourceCount: sources.filter(
            (s) => s.deploymentType === 'cloud',
        ).length,
        selfHostedCodeSourceCount: sources.filter(
            (s) => s.deploymentType === 'self_hosted',
        ).length,
        localCodeSourceCount: sources.filter(
            (s) => s.deploymentType === 'local',
        ).length,
        indexAllCodeSourceCount: sources.filter((s) => s.indexAll).length,
        repositoryCount: sum('repositoryCount'),
        organizationCount: sum('organizationCount'),
        userCount: sum('userCount'),
        groupCount: sum('groupCount'),
        projectCount: sum('projectCount'),
        workspaceCount: sum('workspaceCount'),
    };
}
export function aggregateAi(models: AiSummary[]): Events['ai_setup_completed'] {
    const providerTypes = unique(models.map((m) => m.provider));
    return {
        aiConfigured: models.length > 0,
        aiConfigurationCount: models.length,
        uniqueProviderCount: providerTypes.length,
        providerTypes,
        usesCustomEndpoint: models.some((m) => m.usesCustomEndpoint),
        credentialModes: unique(models.map((m) => m.credentialMode)),
        modelSelectionMethods: unique(
            models.map((m) => m.modelSelectionMethod),
        ),
    };
}
export function selectInstallId(
    contents: string,
    sessionId: string | undefined,
) {
    // Parse only this setting. Accept normal dotenv quoting; never evaluate or expand it.
    const lines = contents
        .split(/\r?\n/)
        .filter((l) => /^\s*(?:export\s+)?SOURCEBOT_INSTALL_ID\s*=/.test(l));
    const raw = lines
        .at(-1)
        ?.replace(/^\s*(?:export\s+)?SOURCEBOT_INSTALL_ID\s*=\s*/, '')
        .trim();
    const existing = raw
        ?.match(/^(?:"([0-9a-f-]+)"|'([0-9a-f-]+)'|([0-9a-f-]+))\s*(?:#.*)?$/)
        ?.slice(1)
        .find(Boolean);
    return existing && INSTALL_ID_PATTERN.test(existing)
        ? { id: existing, action: 'preserved_existing' as const }
        : { id: sessionId, action: 'created_from_setup_session' as const };
}
export function emptyDockerSummary(): DockerSummary {
    return {
        outcome: 'skipped_no_compose',
        dockerStatus: 'not_checked',
        composeContainerState: 'unknown',
        runningComposeContainerCount: null,
        stoppedComposeContainerCount: null,
        existingVolumeCount: null,
        initialPortConflictCount: null,
        remainingPortConflictCount: null,
        portConflictSource: 'unknown',
        existingDeploymentAction: 'none',
        stoppedContainerAction: 'none',
        volumeAction: 'none',
        portConflictAction: 'none',
        leftExistingDeploymentRunning: false,
    };
}
export function dockerOutcome(
    summary: DockerSummary,
    composeAvailable: boolean,
    failed: boolean,
): DockerSummary['outcome'] {
    if (!composeAvailable) {
        return 'skipped_no_compose';
    }
    if (failed) {
        return 'validation_failed';
    }
    if (summary.leftExistingDeploymentRunning) {
        return 'skipped_existing_deployment_running';
    }
    if (
        (summary.remainingPortConflictCount ?? 0) > 0 ||
        summary.stoppedContainerAction === 'kept'
    ) {
        return 'unresolved_conflicts';
    }
    return summary.existingDeploymentAction === 'stopped' ||
        summary.stoppedContainerAction === 'removed' ||
        summary.volumeAction === 'removed' ||
        summary.portConflictAction === 'containers_stopped'
        ? 'passed_after_cleanup'
        : 'passed';
}
