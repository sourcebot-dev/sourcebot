
export const getBrowseParamsFromPathParam = (pathParam: string) => {
    const sentinelIndex = pathParam.search(/\/-\/(tree|blob)/);
    if (sentinelIndex === -1) {
        throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain "/-/(tree|blob)/" pattern`);
    }

    const repoAndRevisionPart = decodeURIComponent(pathParam.substring(0, sentinelIndex));
    const lastAtIndex = repoAndRevisionPart.lastIndexOf('@');
    
    const repoName = lastAtIndex === -1 ? repoAndRevisionPart : repoAndRevisionPart.substring(0, lastAtIndex);
    const revisionName = lastAtIndex === -1 ? undefined : repoAndRevisionPart.substring(lastAtIndex + 1);

    const { path, pathType } = ((): { path: string, pathType: 'tree' | 'blob' } => {
        const path = pathParam.substring(sentinelIndex + '/-/'.length);
        const pathType = path.startsWith('tree') ? 'tree' : 'blob';

        // @note: decodedURIComponent is needed here incase the path contains a space.
        switch (pathType) {
            case 'tree':
                return {
                    path: decodeURIComponent(path.startsWith('tree/') ? path.substring('tree/'.length) : path.substring('tree'.length)),
                    pathType,
                };
            case 'blob':
                return {
                    path: decodeURIComponent(path.startsWith('blob/') ? path.substring('blob/'.length) : path.substring('blob'.length)),
                    pathType,
                };
        }
    })();

    if (pathType === 'blob' && path === '') {
        throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain a path for blob type`);
    }

    return {
        repoName,
        revisionName,
        path,
        pathType,
    }
}