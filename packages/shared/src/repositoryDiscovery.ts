import { z } from "zod";

export const repositoryDiscoveryIssueCodeSchema = z.enum([
    "NOT_FOUND_OR_INACCESSIBLE",
    "INVALID_TARGET",
    "UNSUPPORTED_CONFIGURATION",
    "INVALID_REPOSITORY_SOURCE",
    "ENUMERATION_FAILED",
    "INVALID_PROVIDER_RESPONSE",
    "AUTHENTICATION_FALLBACK",
]);

export type RepositoryDiscoveryIssueCode = z.infer<
    typeof repositoryDiscoveryIssueCodeSchema
>;

export const repositoryDiscoveryIssueEffectSchema = z.enum([
    "TARGET_SKIPPED",
    "CONFIGURATION_IGNORED",
    "DISCOVERY_INCOMPLETE",
]);

export type RepositoryDiscoveryIssueEffect = z.infer<
    typeof repositoryDiscoveryIssueEffectSchema
>;

export const repositoryDiscoveryIssueSubjectSchema = z.object({
    kind: z.enum([
        "organization",
        "group",
        "user",
        "workspace",
        "project",
        "repository",
        "path",
        "url",
        "configuration",
    ]),
    value: z.string().min(1),
});

export type RepositoryDiscoveryIssueSubject = z.infer<
    typeof repositoryDiscoveryIssueSubjectSchema
>;

export const repositoryDiscoveryIssueSchema = z.object({
    code: repositoryDiscoveryIssueCodeSchema,
    effect: repositoryDiscoveryIssueEffectSchema,
    subject: repositoryDiscoveryIssueSubjectSchema.optional(),
    message: z.string().min(1),
});

export type RepositoryDiscoveryIssue = z.infer<
    typeof repositoryDiscoveryIssueSchema
>;
