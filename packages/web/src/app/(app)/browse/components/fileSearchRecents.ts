export const defaultRevisionName = 'HEAD';

export const getLegacyRecentlyOpenedFilesStorageKey = ({
    repoName,
}: {
    repoName: string;
}) => {
    return `recentlyOpenedFiles-${repoName}`;
}

export const getRecentlyOpenedFilesStorageKey = ({
    repoName,
    revisionName,
}: {
    repoName: string;
    revisionName?: string | null;
}) => {
    const encodedRepoName = encodeURIComponent(repoName);
    const encodedRevisionName = encodeURIComponent(revisionName ?? defaultRevisionName);

    return `recentlyOpenedFiles:${encodedRepoName}:${encodedRevisionName}`;
}

export const shouldMigrateLegacyRecentlyOpenedFiles = ({
    revisionName,
}: {
    revisionName?: string | null;
}) => {
    return revisionName === undefined || revisionName === null || revisionName === defaultRevisionName;
}
