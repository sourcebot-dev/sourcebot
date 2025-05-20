import type { Provider } from "next-auth/providers";
import { env } from "@/env.mjs";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Okta from "next-auth/providers/okta";
import Keycloak from "next-auth/providers/keycloak";
import Gitlab from "next-auth/providers/gitlab";
import Atlassian from "next-auth/providers/atlassian";
import { prisma } from "@/prisma";
import { notFound, ServiceError } from "@/lib/serviceError";
import { OrgRole } from "@sourcebot/db";
import { isServiceError } from "@/lib/utils";
import { getOrgMembers } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { getSeats, SOURCEBOT_UNLIMITED_SEATS } from "@/features/entitlements/server";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";

export const getSSOProviders = (): Provider[] => {
    const providers: Provider[] = [];

    if (env.AUTH_EE_GITHUB_CLIENT_ID && env.AUTH_EE_GITHUB_CLIENT_SECRET) {
        const authUrl = env.AUTH_EE_GITHUB_BASE_URL ?? "https://github.com";
        providers.push(GitHub({
            clientId: env.AUTH_EE_GITHUB_CLIENT_ID,
            clientSecret: env.AUTH_EE_GITHUB_CLIENT_SECRET,
            authorization: {
                url: `${authUrl}/oauth/authorize`,
                params: {
                    scope: "read_user",
                },
            },
            token: {
                url: `${authUrl}/oauth/token`,
            },
            userinfo: {
                url: `${authUrl}/api/v4/user`,
            },
        }));
    }

    if (env.AUTH_EE_GITLAB_CLIENT_ID && env.AUTH_EE_GITLAB_CLIENT_SECRET) {
        const authUrl = env.AUTH_EE_GITLAB_BASE_URL ?? "https://gitlab.com";
        providers.push(Gitlab({
            clientId: env.AUTH_EE_GITLAB_CLIENT_ID,
            clientSecret: env.AUTH_EE_GITLAB_CLIENT_SECRET,
            authorization: {
                url: `${authUrl}/oauth/authorize`,
                params: {
                    scope: "read_user",
                },
            },
            token: {
                url: `${authUrl}/oauth/token`,
            },
            userinfo: {
                url: `${authUrl}/api/v4/user`,
            },
        }));
    }

    if (env.AUTH_EE_ATLASSIAN_CLIENT_ID && env.AUTH_EE_ATLASSIAN_CLIENT_SECRET) {
        const authUrl = env.AUTH_EE_ATLASSIAN_BASE_URL ?? "https://atlassian.com";
        providers.push(Atlassian({
            clientId: env.AUTH_EE_ATLASSIAN_CLIENT_ID,
            clientSecret: env.AUTH_EE_ATLASSIAN_CLIENT_SECRET,
            authorization: {
                url: `${authUrl}/oauth/authorize`,
                params: {
                    scope: "read_user",
                },
            },
            token: {
                url: `${authUrl}/oauth/token`,
            },
            userinfo: {
                url: `${authUrl}/api/2.0/user`,
            },
        }));
    }

    if (env.AUTH_EE_GOOGLE_CLIENT_ID && env.AUTH_EE_GOOGLE_CLIENT_SECRET) {
        providers.push(Google({
            clientId: env.AUTH_EE_GOOGLE_CLIENT_ID,
            clientSecret: env.AUTH_EE_GOOGLE_CLIENT_SECRET,
        }));
    }

    if (env.AUTH_EE_OKTA_CLIENT_ID && env.AUTH_EE_OKTA_CLIENT_SECRET && env.AUTH_EE_OKTA_ISSUER) {
        providers.push(Okta({
            clientId: env.AUTH_EE_OKTA_CLIENT_ID,
            clientSecret: env.AUTH_EE_OKTA_CLIENT_SECRET,
            issuer: env.AUTH_EE_OKTA_ISSUER,
        }));
    }

    if (env.AUTH_EE_KEYCLOAK_CLIENT_ID && env.AUTH_EE_KEYCLOAK_CLIENT_SECRET && env.AUTH_EE_KEYCLOAK_ISSUER) {
        providers.push(Keycloak({
            clientId: env.AUTH_EE_KEYCLOAK_CLIENT_ID,
            clientSecret: env.AUTH_EE_KEYCLOAK_CLIENT_SECRET,
            issuer: env.AUTH_EE_KEYCLOAK_ISSUER,
        }));
    }

    return providers;
}

export const handleJITProvisioning = async (userId: string, domain: string): Promise<ServiceError | boolean> => {
    const org = await prisma.org.findUnique({
        where: {
            domain,
        },
        include: {
            members: {
                where: {
                    role: {
                        not: OrgRole.GUEST,
                    }
                }
            }
        }
    });

    if (!org) {
        return notFound(`Org ${domain} not found`);
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        return notFound(`User ${userId} not found`);
    }


    const seats = await getSeats();
    const memberCount = org.members.length;

    if (seats != SOURCEBOT_UNLIMITED_SEATS && memberCount >= seats) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
            message: "Failed to provision user since the organization is at max capacity",
        } satisfies ServiceError;
    }

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: {
                id: userId,
            },
            data: {
                pendingApproval: false,
            },
        });

        await tx.userToOrg.create({
            data: {
                userId,
                orgId: org.id,
                role: OrgRole.MEMBER,
            },
        });
    });

    return true;
}

