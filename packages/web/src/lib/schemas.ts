import { checkIfOrgDomainExists } from "@/actions";
import { z } from "zod";
import { isServiceError } from "./utils";
import { serviceErrorSchema } from "./serviceError";
import { CodeHostType } from "@sourcebot/db";

export const secretCreateRequestSchema = z.object({
    key: z.string(),
    value: z.string(),
});

export const secreteDeleteRequestSchema = z.object({
    key: z.string(),
});

export const repositoryQuerySchema = z.object({
    codeHostType: z.nativeEnum(CodeHostType),
    repoId: z.number(),
    repoName: z.string(),
    repoDisplayName: z.string().optional(),
    repoCloneUrl: z.string(),
    webUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    indexedAt: z.coerce.date().optional(),
    pushedAt: z.coerce.date().optional(),
});

export const searchContextQuerySchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().optional(),
    repoNames: z.array(z.string()),
});

export const verifyCredentialsRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export const orgNameSchema = z.string().min(2, { message: "Organization name must be at least 3 characters long." });

export const orgDomainSchema = z.string()
    .min(2, { message: "Url must be at least 3 characters long." })
    .max(50, { message: "Url must be at most 50 characters long." })
    .regex(/^[a-z][a-z-]*[a-z]$/, {
        message: "Url must start and end with a letter, and can only contain lowercase letters and dashes.",
    })
    .refine((domain) => {
        const reserved = [
            'api',
            'login',
            'signup',
            'onboard',
            'redeem',
            'account',
            'settings',
            'staging',
            'support',
            'docs',
            'blog',
            'contact',
            'status'
        ];
        return !reserved.includes(domain);
    }, "This url is reserved for internal use.")
    .refine(async (domain) => {
        const doesDomainExist = await checkIfOrgDomainExists(domain);
        return isServiceError(doesDomainExist) || !doesDomainExist;
    }, "This url is already taken.");

export const getVersionResponseSchema = z.object({
    version: z.string(),
});

export const getReposResponseSchema = z.union([repositoryQuerySchema.array(), serviceErrorSchema]);