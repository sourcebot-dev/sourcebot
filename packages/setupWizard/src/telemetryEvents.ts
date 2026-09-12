// Runtime allowlists are also the TypeScript event contract. Never accept arbitrary maps.
type Rule<T> = { parse: (value: unknown) => T };
type Value<R> = R extends Rule<infer T> ? T : never;
type Shape = Record<string, Rule<unknown>>;
type Fields<S extends Shape> = { [K in keyof S]: Value<S[K]> };
function rule<T>(check: (v: unknown) => boolean): Rule<T> {
    return {
        parse(value) {
            if (!check(value)) {
                throw new Error('Invalid telemetry property');
            }
            return value as T;
        },
    };
}
export function choice<const T extends readonly string[]>(
    ...values: T
): Rule<T[number]> {
    return rule((v) => typeof v === 'string' && values.includes(v));
}
const boolean = rule<boolean>((v) => typeof v === 'boolean');
const count = rule<number>(
    (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0,
);
const position = rule<number>(
    (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1,
);
const nullable = <T>(inner: Rule<T>): Rule<T | null> => ({
    parse: (v) => (v === null ? null : inner.parse(v)),
});
const array = <T>(inner: Rule<T>): Rule<T[]> => ({
    parse(v) {
        if (!Array.isArray(v)) {
            throw new Error('Invalid telemetry array');
        }
        return v.map((item) => inner.parse(item));
    },
});
export const codeHost = choice(
    'github',
    'gitlab',
    'bitbucket',
    'gitea',
    'azure_devops',
    'gerrit',
    'local_git',
    'remote_git',
);
export const provider = choice(
    'anthropic',
    'openai',
    'openai-compatible',
    'amazon-bedrock',
    'google-generative-ai',
    'google-vertex',
    'google-vertex-anthropic',
    'azure',
    'deepseek',
    'mistral',
    'openrouter',
    'xai',
);
export const deploymentType = choice(
    'cloud',
    'self_hosted',
    'local',
    'remote',
    'unknown',
);
const sourceCredential = choice(
    'none',
    'personal_access_token',
    'api_token',
    'access_token',
    'app_password',
    'http_access_token',
);
const aiCredential = choice(
    'api_key',
    'aws_default_chain',
    'aws_explicit_keys',
    'google_application_default_credentials',
    'google_credentials_file',
);
const modelSelection = choice('catalog', 'custom_entry', 'manual_fallback');
const scope = choice(
    'all',
    'repositories',
    'organizations',
    'users',
    'groups',
    'projects',
    'workspaces',
);
const file = choice('config_json', 'env', 'compose_override');
const identity = choice('created_from_setup_session', 'preserved_existing');
const stage = choice(
    'setup_directory',
    'code_sources',
    'ai_setup',
    'hosted_url',
    'config_overwrite',
    'compose_file',
    'docker_validation',
    'start',
);
const category = choice(
    'validation',
    'network',
    'filesystem',
    'docker_unavailable',
    'docker_command',
    'process_spawn',
    'unknown',
);
const dockerOutcome = choice(
    'passed',
    'passed_after_cleanup',
    'unresolved_conflicts',
    'skipped_no_compose',
    'skipped_existing_deployment_running',
    'validation_failed',
);
const entityCounts = {
    repositoryCount: count,
    organizationCount: count,
    userCount: count,
    groupCount: count,
    projectCount: count,
    workspaceCount: count,
};
export const codeSourceSchema = {
    codeHost,
    deploymentType,
    credentialMode: sourceCredential,
    scopeTypes: array(scope),
    indexAll: boolean,
    ...entityCounts,
    generatedConnectionCount: count,
    localDiscoveredRepoCountBucket: nullable(
        choice('1', '2-5', '6-20', '21-100', '101+'),
    ),
};
export const aiSchema = {
    provider,
    modelSelectionMethod: modelSelection,
    credentialMode: aiCredential,
    usesCustomEndpoint: boolean,
    hasDisplayName: boolean,
};
export const eventSchemas = {
    started: {
        invocationMethod: choice(
            'npx',
            'global_binary',
            'local_binary',
            'workspace',
            'unknown',
        ),
        isInteractive: boolean,
    },
    chose_setup_directory: {
        usedDefaultDirectory: boolean,
        directoryExisted: boolean,
        directoryAction: choice('created', 'existing_directory_accepted'),
    },
    configured_code_source: {
        configurationIndex: position,
        ...codeSourceSchema,
    },
    configured_code_sources: {
        codeSourceConfigurationCount: count,
        generatedConnectionCount: count,
        uniqueCodeHostCount: count,
        codeHostTypes: array(codeHost),
        credentialedCodeSourceCount: count,
        cloudCodeSourceCount: count,
        selfHostedCodeSourceCount: count,
        localCodeSourceCount: count,
        indexAllCodeSourceCount: count,
        ...entityCounts,
    },
    configured_ai_provider: { configurationIndex: position, ...aiSchema },
    ai_setup_completed: {
        aiConfigured: boolean,
        aiConfigurationCount: count,
        uniqueProviderCount: count,
        providerTypes: array(provider),
        usesCustomEndpoint: boolean,
        credentialModes: array(aiCredential),
        modelSelectionMethods: array(modelSelection),
    },
    configured_hosted_url: {
        usedDefaultUrl: boolean,
        protocol: choice('http', 'https'),
        hostCategory: choice('localhost', 'address', 'unknown'),
    },
    generated_configs: {
        filesWritten: array(file),
        overwroteExistingFiles: array(file),
        wroteComposeOverride: boolean,
        localMountCount: count,
        generatedConnectionCount: count,
        aiConfigurationCount: count,
        credentialVariableCount: count,
        deploymentIdentityAction: identity,
    },
    resolved_compose_file: {
        outcome: choice(
            'downloaded',
            'already_present',
            'declined',
            'download_failed',
        ),
        composeAvailable: boolean,
        downloadPromptShown: boolean,
        downloadAttempted: boolean,
        failureCategory: nullable(
            choice(
                'network',
                'http_4xx',
                'http_5xx',
                'filesystem',
                'timeout',
                'unknown',
            ),
        ),
    },
    validated_docker_state: {
        outcome: dockerOutcome,
        dockerStatus: choice(
            'available',
            'unavailable',
            'error',
            'not_checked',
        ),
        composeContainerState: choice(
            'none',
            'running',
            'stopped',
            'mixed',
            'unknown',
        ),
        runningComposeContainerCount: nullable(count),
        stoppedComposeContainerCount: nullable(count),
        existingVolumeCount: nullable(count),
        initialPortConflictCount: nullable(count),
        remainingPortConflictCount: nullable(count),
        portConflictSource: choice(
            'none',
            'docker',
            'non_docker',
            'mixed',
            'unknown',
        ),
        existingDeploymentAction: choice(
            'none',
            'stopped',
            'left_running',
            'stop_failed',
        ),
        stoppedContainerAction: choice(
            'none',
            'removed',
            'kept',
            'remove_failed',
        ),
        volumeAction: choice('none', 'removed', 'kept', 'remove_failed'),
        portConflictAction: choice(
            'none',
            'containers_stopped',
            'kept',
            'stop_failed',
        ),
        leftExistingDeploymentRunning: boolean,
    },
    completed: {
        completionMode: choice(
            'sourcebot_start_spawned',
            'sourcebot_start_failed',
            'existing_deployment_left_running',
            'manual_start_required',
        ),
        sourcebotStartOffered: boolean,
        sourcebotStartRequested: boolean,
        sourcebotStartOutcome: choice(
            'spawned',
            'declined',
            'not_offered',
            'spawn_failed',
        ),
        composeAvailable: boolean,
        dockerValidationOutcome: dockerOutcome,
        remainingPortConflictCount: nullable(count),
        generatedConnectionCount: count,
        codeHostTypes: array(codeHost),
        repositoryCount: count,
        aiConfigured: boolean,
        aiConfigurationCount: count,
        providerTypes: array(provider),
        deploymentIdentityAction: identity,
        totalDurationMs: count,
    },
    cancelled: {
        stage,
        reason: choice(
            'keyboard_interrupt',
            'existing_directory_declined',
            'config_overwrite_declined',
        ),
    },
    failed: { stage, failureCategory: category, recoverable: boolean },
    start_failed: {
        failurePhase: choice('spawn', 'compose_exit'),
        failureCategory: choice('docker_unavailable', 'process_spawn', 'docker_command'),
        failureReason: choice(
            'container_name_conflict',
            'port_conflict',
            'image_pull_failed',
            'mount_failed',
            'compose_configuration',
            'docker_unavailable',
            'unknown',
        ),
    },
};
export type EventName = keyof typeof eventSchemas;
export type Events = { [K in EventName]: Fields<(typeof eventSchemas)[K]> };
export type CodeSourceSummary = Fields<typeof codeSourceSchema>;
export type AiSummary = Fields<typeof aiSchema>;
export type Stage = Value<typeof stage>;
export type FailureCategory = Value<typeof category>;
export type DockerSummary = Events['validated_docker_state'];
export function validateFields<S extends Shape>(
    schema: S,
    input: Fields<S>,
): Fields<S> {
    // Read only explicitly approved fields; the source object is never spread or serialized.
    return Object.fromEntries(
        Object.entries(schema).map(([key, validator]) => [
            key,
            validator.parse(input[key]),
        ]),
    ) as Fields<S>;
}
