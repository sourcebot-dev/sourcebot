'use server';

import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { SIDEBAR_REPO_VISITS_LIMIT } from "../@sidebar/components/defaultSidebar";

export const trackRepoVisit = async ({ repoName }: { repoName: string }) => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const repo = await prisma.repo.findFirst({
            where: {
                name: repoName,
                orgId: org.id,
            },
            select: { id: true },
        });

        if (!repo) {
            return {
                wasPromoted: false,
            }
        }

        const topKVisits = await prisma.repoVisit.findMany({
            where: {
                userId: user.id,
                orgId: org.id
            },
            orderBy: { lastPromotedAt: 'desc'},
            take: SIDEBAR_REPO_VISITS_LIMIT,
            select: { repoId: true }
        });

        const shouldPromote = !topKVisits.some((visit) => visit.repoId === repo.id);
        const now = new Date();

        await prisma.repoVisit.upsert({
            where: {
                repoId_userId: {
                    repoId: repo.id,
                    userId: user.id,
                },
            },
            update: {
                visitedAt: now,
                ...(shouldPromote ? {
                    lastPromotedAt: now,
                } : {})
            },
            create: {
                repoId: repo.id,
                userId: user.id,
                orgId: org.id,
            },
        });

        return {
            wasPromoted: shouldPromote,
        };
    })
);
