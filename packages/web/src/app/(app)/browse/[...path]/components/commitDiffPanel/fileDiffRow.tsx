'use client';

import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { FileDiff } from "@/features/git";
import { FileCode } from "lucide-react";
import { useCallback, useMemo } from "react";
import { CommitActionLink } from "../../../components/commitParts";
import { getBrowsePath } from "../../../hooks/utils";
import { computeChangeCounts, DiffStat } from "./diffStat";
import { LightweightDiffViewer } from "./lightweightDiffViewer";

type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

const getFileStatus = (file: FileDiff): FileStatus => {
    if (!file.oldPath) {
        return 'added';
    }
    if (!file.newPath) {
        return 'deleted';
    }
    if (file.oldPath !== file.newPath) {
        return 'renamed';
    }
    return 'modified';
};

const getDisplayPath = (file: FileDiff): string => {
    if (getFileStatus(file) === 'renamed') {
        return `${file.oldPath} → ${file.newPath}`;
    }
    return file.newPath ?? file.oldPath ?? '';
};

interface FileDiffRowProps {
    file: FileDiff;
    yOffset: number;
    repoName: string;
    commitSha: string;
    // Null for the initial commit (no parent).
    parentSha: string | null;
}

export const FileDiffRow = ({ file, yOffset, repoName, commitSha, parentSha }: FileDiffRowProps) => {
    const status = getFileStatus(file);

    // Deleted files don't exist at the commit, so the link points to the
    // file's last existing state — the old path at the parent commit. For
    // every other status, link to the new path at this commit.
    const isDeleted = status === 'deleted';
    const linkPath = isDeleted ? file.oldPath : file.newPath;
    const linkRevision = isDeleted ? parentSha : commitSha;
    const viewAtCommitHref = linkPath && linkRevision
        ? getBrowsePath({
            repoName,
            revisionName: linkRevision,
            path: linkPath,
            pathType: 'blob',
        })
        : null;

    const onCopyPath = useCallback(() => {
        const pathToCopy = file.newPath ?? file.oldPath;
        if (!pathToCopy) {
            return false;
        }
        navigator.clipboard.writeText(pathToCopy);
        return true;
    }, [file.newPath, file.oldPath]);

    const changeCounts = useMemo(() => computeChangeCounts(file), [file]);

    return (
        <div className="flex flex-col">
            <div
                className="flex flex-row items-center gap-2 py-2 px-3 border-b bg-muted sticky z-10"
                style={{ top: `-${yOffset}px` }}
            >
                <StatusBadge status={status} />
                <div className="flex-1 min-w-0 flex flex-row items-center gap-1 overflow-hidden">
                    <code className="text-xs truncate">{getDisplayPath(file)}</code>
                    <CopyIconButton onCopy={onCopyPath} className="flex-shrink-0" />
                </div>
                <DiffStat {...changeCounts} />
                {viewAtCommitHref && (
                    <CommitActionLink
                        href={viewAtCommitHref}
                        label="View code at this commit"
                        icon={<FileCode className="h-3 w-3" />}
                    />
                )}
            </div>
            {file.hunks.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                    No textual diff (binary file or empty change).
                </div>
            ) : (
                <LightweightDiffViewer
                    hunks={file.hunks}
                    oldPath={file.oldPath}
                    newPath={file.newPath}
                />
            )}
        </div>
    );
};

const STATUS_LABELS: Record<FileStatus, string> = {
    added: 'A',
    modified: 'M',
    deleted: 'D',
    renamed: 'R',
};

const STATUS_COLORS: Record<FileStatus, string> = {
    added: 'bg-green-500/20 text-green-700 dark:text-green-400',
    modified: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    deleted: 'bg-red-500/20 text-red-700 dark:text-red-400',
    renamed: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
};

const StatusBadge = ({ status }: { status: FileStatus }) => (
    <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-mono font-bold ${STATUS_COLORS[status]}`}
    >
        {STATUS_LABELS[status]}
    </span>
);
