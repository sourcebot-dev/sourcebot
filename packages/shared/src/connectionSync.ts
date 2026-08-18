import { z } from "zod";

export const connectionSyncPartialSuccessReasonCodeSchema = z.enum([
    "NOT_FOUND_OR_INACCESSIBLE",
    "INVALID_TARGET",
    "UNSUPPORTED_CONFIGURATION",
    "INVALID_REPOSITORY_SOURCE",
    "ENUMERATION_FAILED",
    "INVALID_PROVIDER_RESPONSE",
]);

export type ConnectionSyncPartialSuccessReasonCode = z.infer<
    typeof connectionSyncPartialSuccessReasonCodeSchema
>;

export const connectionSyncPartialSuccessEffectSchema = z.enum([
    "TARGET_SKIPPED",
    "CONFIGURATION_IGNORED",
    "DISCOVERY_INCOMPLETE",
]);

export type ConnectionSyncPartialSuccessEffect = z.infer<
    typeof connectionSyncPartialSuccessEffectSchema
>;

export const connectionSyncPartialSuccessSubjectSchema = z.object({
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

export type ConnectionSyncPartialSuccessSubject = z.infer<
    typeof connectionSyncPartialSuccessSubjectSchema
>;

export const connectionSyncPartialSuccessReasonSchema = z.object({
    code: connectionSyncPartialSuccessReasonCodeSchema,
    effect: connectionSyncPartialSuccessEffectSchema,
    subject: connectionSyncPartialSuccessSubjectSchema.optional(),
    message: z.string().min(1),
});

export type ConnectionSyncPartialSuccessReason = z.infer<
    typeof connectionSyncPartialSuccessReasonSchema
>;

export const connectionSyncResultSchema = z.discriminatedUnion("outcome", [
    z.object({
        outcome: z.literal("SUCCESS"),
    }),
    z.object({
        outcome: z.literal("PARTIAL_SUCCESS"),
        reasons: z.array(connectionSyncPartialSuccessReasonSchema).min(1),
    }),
]);

export type ConnectionSyncResult = z.infer<
    typeof connectionSyncResultSchema
>;
