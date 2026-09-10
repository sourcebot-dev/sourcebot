import 'server-only';

import { sew } from "@/middleware/sew";
import { notFound, ServiceError } from '@/lib/serviceError';
import { withOptionalAuth } from '@/middleware/withAuth';
import { RepoInfo } from './types';

export const getRepoInfo = async (repoId: number): Promise<RepoInfo | ServiceError> => sew(() =>
    withOptionalAuth(async ({ prisma }) => {
        const repo = await prisma.repo.findUnique({
            where: { id: repoId },
        });

        if (!repo) {
            return notFound();
        }

        return {
            id: repo.id,
            name: repo.name,
            displayName: repo.displayName,
            imageUrl: repo.imageUrl,
            isIndexed: repo.indexedAt !== null,
        };
    })
)
