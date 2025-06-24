
export const getBrowseParamsFromPathParam = (pathParam: string) => {
    const sentinalIndex = pathParam.search(/\/-\/(tree|blob)\//);
    if (sentinalIndex === -1) {
        throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain "/-/(tree|blob)/" pattern`);
    }

    const repoAndRevisionName = pathParam.substring(0, sentinalIndex).split('@');
    const repoName = repoAndRevisionName[0];
    const revisionName = repoAndRevisionName.length > 1 ? repoAndRevisionName[1] : undefined;

    const { path, pathType } = ((): { path: string, pathType: 'tree' | 'blob' } => {
        const path = pathParam.substring(sentinalIndex + '/-/'.length);
        const pathType = path.startsWith('tree/') ? 'tree' : 'blob';

        // @note: decodedURIComponent is needed here incase the path contains a space.
        switch (pathType) {
            case 'tree':
                return {
                    path: decodeURIComponent(path.substring('tree/'.length)),
                    pathType,
                };
            case 'blob':
                return {
                    path: decodeURIComponent(path.substring('blob/'.length)),
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