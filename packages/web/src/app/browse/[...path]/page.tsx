import Image from "next/image";
import logoDark from '@/public/sb_logo_dark.png';
import logoLight from '@/public/sb_logo_light.png';
import { SettingsDropdown } from '@/app/components/settingsDropdown';
import { Separator } from '@/components/ui/separator';
import { getFileSource } from '@/lib/server/searchService';
import { base64Decode, isServiceError } from "@/lib/utils";
import { SearchBar } from "@/app/components/searchBar";
import { CodePreview } from "./codePreview";
import { TopBar } from "@/app/components/topBar";

interface BrowsePageProps {
    params: {
        path: string[];
    };
}

export default async function BrowsePage({
    params,
}: BrowsePageProps) {
    const rawPath = params.path.join('/');
    const sentinalIndex = rawPath.search(/\/-\/(tree|blob)\//);
    if (sentinalIndex === -1) {
        // @todo : proper error handling
        return (
            <>
                No sentinal found
            </>
        )
    }

    const repoName = rawPath.substring(0, sentinalIndex);
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

    if (pathType === 'tree') {
        // @todo : proper tree handling
        return (
            <>
                Tree view not supported
            </>
        )
    }
    
    // @todo: this will depend on `pathType`.
    const response = await getFileSource({
        fileName: path,
        repository: repoName,
        // @TODO: Incorporate branch in path
        branch: 'HEAD'
    });

    if (isServiceError(response)) {
        // @todo : proper error handling
        return (
            <>
                Error: {response.message}
            </>
        )
    }

    return (
        <div>
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    defaultSearchQuery={`repo:${repoName} `}
                />
                <Separator />
                <div className="bg-accent py-1 px-2 flex flex-row">
                    <span className="text-sm font-mono">
                        {rawPath}
                    </span>
                </div>
                <Separator />
            </div>
            <CodePreview
                source={base64Decode(response.source)}
                language={response.language}
            />
        </div>
    )
}