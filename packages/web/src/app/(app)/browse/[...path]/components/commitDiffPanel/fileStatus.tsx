import type { FileDiff } from "@/features/git";

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export const getFileStatus = (file: FileDiff): FileStatus => {
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

const STATUS_BADGE_LABELS: Record<FileStatus, string> = {
    added: 'A',
    modified: 'M',
    deleted: 'D',
    renamed: 'R',
};

const STATUS_BADGE_COLORS: Record<FileStatus, string> = {
    added: 'bg-green-500/20 text-green-700 dark:text-green-400',
    modified: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    deleted: 'bg-red-500/20 text-red-700 dark:text-red-400',
    renamed: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
};

export const StatusBadge = ({ status }: { status: FileStatus }) => (
    <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-mono font-bold ${STATUS_BADGE_COLORS[status]}`}
    >
        {STATUS_BADGE_LABELS[status]}
    </span>
);
