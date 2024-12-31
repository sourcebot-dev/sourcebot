'use client';

import { fetchFileSource } from '@/app/api/(client)/client';
import { base64Decode } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';


export default function BrowsePage({ params }: { params: { path: string[] } }) {

    // @TODO: This does not factor in branch...
    // Also, we can probably do this in a server component.
    const parsedParams = useMemo(() => {
        const path = params.path.join('/');
        const idx = path.search(/\/-\/(tree|blob)\//);
        if (idx === -1) {
            console.log('No sentinal found');
            return;
        }

        const repoName = path.substring(0, idx);
        const { filePath, type } = (() => {
            const fullPath = path.substring(idx + '/-/'.length);
            const type = fullPath.startsWith('tree/') ? 'tree' : 'blob';
            if (type === 'tree') {
                return {
                    filePath: fullPath.substring('tree/'.length),
                    type,
                };
            } else {
                return {
                    filePath: fullPath.substring('blob/'.length),
                    type,
                };
            }
        })();

        return {
            path: filePath,
            type,
            repoName,
        }
    }, [params.path]);

    const { data: source } = useQuery({
        queryKey: ["source", parsedParams?.path, parsedParams?.repoName, parsedParams?.type],
        queryFn: async (): Promise<string | undefined> => {
            if (!parsedParams || parsedParams.type !== 'blob') {
                return undefined;
            }

            console.log(parsedParams);

            return fetchFileSource({
                fileName: parsedParams.path,
                repository: parsedParams.repoName,
            }).then(({ source }) => {
                return base64Decode(source);
            });
        }
    });

    return (
        <div>
            {params.path.join('/')}
            <pre>{source}</pre>
        </div>
    )
}