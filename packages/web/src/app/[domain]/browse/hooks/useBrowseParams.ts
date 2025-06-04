'use client';

import { usePathname } from "next/navigation";

export const useBrowseParams = () => {
    const pathname = usePathname();

    const startIndex = pathname.indexOf('/browse/');
    if (startIndex === -1) {
        throw new Error(`Invalid browse pathname: "${pathname}" - expected to contain "/browse/"`);
    }

    const rawPath = pathname.substring(startIndex + '/browse/'.length);
    const sentinalIndex = rawPath.search(/\/-\/(tree|blob)\//);
    if (sentinalIndex === -1) {
        throw new Error(`Invalid browse pathname: "${pathname}" - expected to contain "/-/(tree|blob)/" pattern`);
    }

    const repoAndRevisionName = rawPath.substring(0, sentinalIndex).split('@');
    const repoName = repoAndRevisionName[0];
    const revisionName = repoAndRevisionName.length > 1 ? repoAndRevisionName[1] : undefined;

    const { path, pathType } = ((): { path: string, pathType: 'tree' | 'blob' } => {
        const path = rawPath.substring(sentinalIndex + '/-/'.length);
        const pathType = path.startsWith('tree/') ? 'tree' : 'blob';
        switch (pathType) {
            case 'tree':
                return {
                    path: path.substring('tree/'.length),
                    pathType,
                };
            case 'blob':
                return {
                    path: path.substring('blob/'.length),
                    pathType,
                };
        }
    })();

    return {
        repoName,
        revisionName,
        path,
        pathType,
    }
}