'use client';

import { FileDiff } from "@/features/git";
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
}

export const FileDiffRow = ({ file }: FileDiffRowProps) => {
    const status = getFileStatus(file);

    return (
        <div className="flex flex-col border rounded">
            <div className="flex flex-row items-center gap-2 p-2 bg-muted border-b">
                <StatusBadge status={status} />
                <code className="text-xs">{getDisplayPath(file)}</code>
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
