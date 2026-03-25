'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import Link from "next/link";

type FileInfo = {
    path: string;
    name: string;
    repo: string;
    revision: string;
};

export const FileRow = ({ file }: { file: FileInfo }) => {
    const dir = file.path.includes('/')
        ? file.path.split('/').slice(0, -1).join('/')
        : '';

    const href = getBrowsePath({
        repoName: file.repo,
        revisionName: file.revision,
        path: file.path,
        pathType: 'blob',
        domain: SINGLE_TENANT_ORG_DOMAIN,
    });

    return (
        <Link
            href={href}
            className="flex items-center gap-2 px-3 py-1 hover:bg-accent transition-colors"
        >
            <VscodeFileIcon fileName={file.name} className="flex-shrink-0" />
            <span className="text-sm font-medium flex-shrink-0">{file.name}</span>
            {dir && (
                <>
                    <span className="text-xs text-muted-foreground flex-shrink-0">·</span>
                    <span className="block text-xs text-muted-foreground truncate-start flex-1"><span>{dir}</span></span>
                </>
            )}
        </Link>
    );
}
